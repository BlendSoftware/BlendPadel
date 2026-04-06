package admin

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/crypto/bcrypt"

	"github.com/juani/blendpadel/backend/internal/db"
)

// postgresRepo implements Repository using sqlc-generated queries.
type postgresRepo struct {
	q *db.Queries
}

// NewPostgresRepo creates a new Repository backed by PostgreSQL.
func NewPostgresRepo(q *db.Queries) Repository {
	return &postgresRepo{q: q}
}

func (r *postgresRepo) GetKPIs(ctx context.Context) (*KPIResponse, error) {
	row, err := r.q.GetKPIs(ctx)
	if err != nil {
		return nil, err
	}
	return &KPIResponse{
		TotalPlayers:     row.TotalPlayers,
		ActivePlayers:    row.ActivePlayers,
		BannedPlayers:    row.BannedPlayers,
		TotalMatches:     row.TotalMatches,
		CompletedMatches: row.CompletedMatches,
		PendingDisputes:  row.PendingDisputes,
		AvgELO:           row.AvgElo,
		TotalModerators:  row.TotalModerators,
	}, nil
}

func (r *postgresRepo) ListModerators(ctx context.Context) ([]ModeratorResponse, error) {
	rows, err := r.q.ListModerators(ctx)
	if err != nil {
		return nil, err
	}
	mods := make([]ModeratorResponse, 0, len(rows))
	for _, row := range rows {
		mods = append(mods, mapModeratorRow(row.ID, row.Email, row.Name, row.LastName, row.Role, row.Status, row.RegionID, row.CreatedAt))
	}
	return mods, nil
}

func (r *postgresRepo) CreateModerator(ctx context.Context, req ModeratorRequest) (*ModeratorResponse, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	row, err := r.q.CreateModerator(ctx, db.CreateModeratorParams{
		Email:        req.Email,
		PasswordHash: string(hash),
		Name:         pgtype.Text{String: req.Name, Valid: req.Name != ""},
		LastName:     pgtype.Text{String: req.LastName, Valid: req.LastName != ""},
		RegionID:     pgtype.UUID{Bytes: req.RegionID, Valid: req.RegionID != uuid.Nil},
	})
	if err != nil {
		return nil, err
	}
	resp := mapModeratorRow(row.ID, row.Email, row.Name, row.LastName, row.Role, row.Status, row.RegionID, row.CreatedAt)
	return &resp, nil
}

func (r *postgresRepo) UpdateModerator(ctx context.Context, id uuid.UUID, req ModeratorRequest) (*ModeratorResponse, error) {
	row, err := r.q.UpdateModerator(ctx, db.UpdateModeratorParams{
		ID:       pgtype.UUID{Bytes: id, Valid: true},
		RegionID: pgtype.UUID{Bytes: req.RegionID, Valid: req.RegionID != uuid.Nil},
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrModeratorNotFound
		}
		return nil, err
	}
	resp := mapModeratorRow(row.ID, row.Email, row.Name, row.LastName, row.Role, row.Status, row.RegionID, row.CreatedAt)
	return &resp, nil
}

func (r *postgresRepo) DeleteModerator(ctx context.Context, id uuid.UUID) error {
	return r.q.DeleteModerator(ctx, pgtype.UUID{Bytes: id, Valid: true})
}

func (r *postgresRepo) BanPlayer(ctx context.Context, playerID uuid.UUID, status string) error {
	return r.q.BanPlayer(ctx, db.BanPlayerParams{
		ID:     pgtype.UUID{Bytes: playerID, Valid: true},
		Status: status,
	})
}

func (r *postgresRepo) UnbanPlayer(ctx context.Context, playerID uuid.UUID) error {
	return r.q.UnbanPlayer(ctx, pgtype.UUID{Bytes: playerID, Valid: true})
}

func (r *postgresRepo) GetUserELO(ctx context.Context, playerID uuid.UUID) (int, error) {
	elo, err := r.q.GetUserELO(ctx, pgtype.UUID{Bytes: playerID, Valid: true})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, ErrPlayerNotFound
		}
		return 0, err
	}
	return int(elo), nil
}

func (r *postgresRepo) UpdateUserELO(ctx context.Context, playerID uuid.UUID, newELO int) error {
	return r.q.UpdateUserELO(ctx, db.UpdateUserELOParams{
		ID:  pgtype.UUID{Bytes: playerID, Valid: true},
		Elo: int32(newELO),
	})
}

func (r *postgresRepo) InsertELOHistory(ctx context.Context, playerID uuid.UUID, eloBefore, eloAfter, delta int) error {
	// match_id is NULL for manual adjustments.
	_, err := r.q.InsertELOHistory(ctx, db.InsertELOHistoryParams{
		PlayerID:  pgtype.UUID{Bytes: playerID, Valid: true},
		MatchID:   pgtype.UUID{Valid: false}, // NULL
		EloBefore: int32(eloBefore),
		EloAfter:  int32(eloAfter),
		Delta:     int32(delta),
		KFactor:   0,
		Type:      "manual_adjustment",
	})
	return err
}

func (r *postgresRepo) InsertAuditLog(ctx context.Context, adminID uuid.UUID, action string, targetID *uuid.UUID, details any) error {
	var detailsJSON []byte
	if details != nil {
		b, err := json.Marshal(details)
		if err != nil {
			return err
		}
		detailsJSON = b
	}

	var targetPG pgtype.UUID
	if targetID != nil {
		targetPG = pgtype.UUID{Bytes: *targetID, Valid: true}
	}

	return r.q.InsertAuditLog(ctx, db.InsertAuditLogParams{
		AdminID:      pgtype.UUID{Bytes: adminID, Valid: true},
		Action:       action,
		TargetUserID: targetPG,
		Details:      detailsJSON,
	})
}

func (r *postgresRepo) ListAuditLog(ctx context.Context, adminID *uuid.UUID, limit, offset int32) ([]AuditLogEntry, error) {
	var adminPG pgtype.UUID
	if adminID != nil {
		adminPG = pgtype.UUID{Bytes: *adminID, Valid: true}
	}

	rows, err := r.q.ListAuditLog(ctx, db.ListAuditLogParams{
		Column1: adminPG,
		Limit:   limit,
		Offset:  offset,
	})
	if err != nil {
		return nil, err
	}

	entries := make([]AuditLogEntry, 0, len(rows))
	for _, row := range rows {
		e := AuditLogEntry{
			ID:        uuid.UUID(row.ID.Bytes),
			AdminID:   uuid.UUID(row.AdminID.Bytes),
			Action:    row.Action,
			Details:   row.Details,
			CreatedAt: row.CreatedAt.Time,
		}
		if row.TargetUserID.Valid {
			tid := uuid.UUID(row.TargetUserID.Bytes)
			e.TargetUserID = &tid
		}
		entries = append(entries, e)
	}
	return entries, nil
}

func (r *postgresRepo) CountAuditLog(ctx context.Context, adminID *uuid.UUID) (int64, error) {
	var adminPG pgtype.UUID
	if adminID != nil {
		adminPG = pgtype.UUID{Bytes: *adminID, Valid: true}
	}
	return r.q.CountAuditLog(ctx, adminPG)
}

// --- helpers ---

func mapModeratorRow(
	id pgtype.UUID,
	email string,
	name pgtype.Text,
	lastName pgtype.Text,
	role string,
	status string,
	regionID pgtype.UUID,
	createdAt pgtype.Timestamptz,
) ModeratorResponse {
	m := ModeratorResponse{
		ID:        uuid.UUID(id.Bytes),
		Email:     email,
		Name:      name.String,
		LastName:  lastName.String,
		Role:      role,
		Status:    status,
		CreatedAt: createdAt.Time,
	}
	if regionID.Valid {
		rid := uuid.UUID(regionID.Bytes)
		m.RegionID = &rid
	}
	return m
}

// Ensure time.Time is used (suppress unused import warning).
var _ = time.Now
