package matchmaking

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/juani/blendpadel/backend/internal/db"
)

// PostgresFlareRepo is the PostgreSQL implementation of Repository.
type PostgresFlareRepo struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

// NewPostgresFlareRepo creates a new PostgresFlareRepo.
func NewPostgresFlareRepo(pool *pgxpool.Pool, q *db.Queries) *PostgresFlareRepo {
	return &PostgresFlareRepo{pool: pool, q: q}
}

func (r *PostgresFlareRepo) CreateFlare(ctx context.Context, playerID uuid.UUID, req CreateFlareRequest) (*FlareRow, error) {
	venueID := pgtype.UUID{}
	if req.VenueID != nil {
		venueID = uuidToPg(*req.VenueID)
	}
	row, err := r.q.CreateFlare(ctx, db.CreateFlareParams{
		PlayerID:    uuidToPg(playerID),
		Lng:         req.Lng,
		Lat:         req.Lat,
		ScheduledAt: pgtype.Timestamptz{Time: req.ScheduledAt, Valid: true},
		EloMin:      req.ELOMin,
		EloMax:      req.ELOMax,
		MinPlayers:  req.MinPlayers,
		MaxPlayers:  req.MaxPlayers,
		MatchType:   req.MatchType,
		VenueID:     venueID,
	})
	if err != nil {
		return nil, err
	}
	return mapFlare(row), nil
}

func (r *PostgresFlareRepo) GetActiveFlareByPlayer(ctx context.Context, playerID uuid.UUID) (*FlareRow, error) {
	row, err := r.q.GetActiveFlareByPlayer(ctx, uuidToPg(playerID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return mapFlare(row), nil
}

func (r *PostgresFlareRepo) GetActiveFlares(ctx context.Context, params GetActiveFlaresParams) ([]FlareListRow, error) {
	rows, err := r.q.GetActiveFlares(ctx, db.GetActiveFlaresParams{
		Lng:             params.Lng,
		Lat:             params.Lat,
		ViewerPlayerID:  uuidToPg(params.ViewerID),
		RadiusMeters:    params.RadiusMeters,
		MinTrustScore:   params.MinTrustScore,
		CursorCreatedAt: pgtype.Timestamptz{Time: params.CursorAt, Valid: true},
		CursorID:        uuidToPg(params.CursorID),
		PageSize:        params.PageSize,
	})
	if err != nil {
		return nil, fmt.Errorf("get active flares: %w", err)
	}

	result := make([]FlareListRow, 0, len(rows))
	for _, row := range rows {
		f := FlareListRow{
			FlareRow: FlareRow{
				ID:          pgToUUID(row.ID),
				PlayerID:    pgToUUID(row.PlayerID),
				ScheduledAt: row.ScheduledAt.Time,
				EloMin:      row.EloMin,
				EloMax:      row.EloMax,
				MinPlayers:  row.MinPlayers,
				MaxPlayers:  row.MaxPlayers,
				MatchType:   row.MatchType,
				Status:      row.Status,
				ExpiresAt:   row.ExpiresAt.Time,
				CreatedAt:   row.CreatedAt.Time,
				UpdatedAt:   row.UpdatedAt.Time,
			},
			CreatorName:     row.CreatorName.String,
			DistanceMeters:  toFloat64(row.DistanceMeters),
			RespondentCount: row.RespondentCount,
		}
		if row.MatchID.Valid {
			id := pgToUUID(row.MatchID)
			f.MatchID = &id
		}
		if row.VenueID.Valid {
			id := pgToUUID(row.VenueID)
			f.VenueID = &id
		}
		f.Lat = toFloat64(row.Lat)
		f.Lng = toFloat64(row.Lng)
		result = append(result, f)
	}
	return result, nil
}

func (r *PostgresFlareRepo) GetActiveFlaresByMatchType(ctx context.Context, params GetActiveFlaresParams, matchType string) ([]FlareListRow, error) {
	rows, err := r.q.GetActiveFlaresByMatchType(ctx, db.GetActiveFlaresByMatchTypeParams{
		Lng:             params.Lng,
		Lat:             params.Lat,
		ViewerPlayerID:  uuidToPg(params.ViewerID),
		MatchType:       matchType,
		RadiusMeters:    params.RadiusMeters,
		MinTrustScore:   params.MinTrustScore,
		CursorCreatedAt: pgtype.Timestamptz{Time: params.CursorAt, Valid: true},
		CursorID:        uuidToPg(params.CursorID),
		PageSize:        params.PageSize,
	})
	if err != nil {
		return nil, fmt.Errorf("get active flares by match type: %w", err)
	}

	result := make([]FlareListRow, 0, len(rows))
	for _, row := range rows {
		f := FlareListRow{
			FlareRow: FlareRow{
				ID:          pgToUUID(row.ID),
				PlayerID:    pgToUUID(row.PlayerID),
				ScheduledAt: row.ScheduledAt.Time,
				EloMin:      row.EloMin,
				EloMax:      row.EloMax,
				MinPlayers:  row.MinPlayers,
				MaxPlayers:  row.MaxPlayers,
				MatchType:   row.MatchType,
				Status:      row.Status,
				ExpiresAt:   row.ExpiresAt.Time,
				CreatedAt:   row.CreatedAt.Time,
				UpdatedAt:   row.UpdatedAt.Time,
			},
			CreatorName:     row.CreatorName.String,
			DistanceMeters:  toFloat64(row.DistanceMeters),
			RespondentCount: row.RespondentCount,
		}
		if row.MatchID.Valid {
			id := pgToUUID(row.MatchID)
			f.MatchID = &id
		}
		if row.VenueID.Valid {
			id := pgToUUID(row.VenueID)
			f.VenueID = &id
		}
		f.Lat = toFloat64(row.Lat)
		f.Lng = toFloat64(row.Lng)
		result = append(result, f)
	}
	return result, nil
}

func (r *PostgresFlareRepo) GetFlareByID(ctx context.Context, id uuid.UUID) (*FlareRow, error) {
	row, err := r.q.GetFlareByID(ctx, uuidToPg(id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return mapFlare(row), nil
}

func (r *PostgresFlareRepo) GetFlareByIDForUpdate(ctx context.Context, tx pgx.Tx, id uuid.UUID) (*FlareRow, error) {
	tq := db.New(tx)
	row, err := tq.GetFlareByIDForUpdate(ctx, uuidToPg(id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return mapFlare(row), nil
}

func (r *PostgresFlareRepo) UpdateFlareStatus(ctx context.Context, tx pgx.Tx, id uuid.UUID, status string, matchID *uuid.UUID) (*FlareRow, error) {
	tq := db.New(tx)
	mid := pgtype.UUID{}
	if matchID != nil {
		mid = uuidToPg(*matchID)
	}
	row, err := tq.UpdateFlareStatus(ctx, db.UpdateFlareStatusParams{
		ID:      uuidToPg(id),
		Status:  status,
		MatchID: mid,
	})
	if err != nil {
		return nil, err
	}
	return mapFlare(row), nil
}

func (r *PostgresFlareRepo) CancelFlare(ctx context.Context, id, playerID uuid.UUID) (*FlareRow, error) {
	row, err := r.q.CancelFlare(ctx, db.CancelFlareParams{
		ID:       uuidToPg(id),
		PlayerID: uuidToPg(playerID),
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return mapFlare(row), nil
}

func (r *PostgresFlareRepo) ExpireOldFlares(ctx context.Context) (int64, error) {
	return r.q.ExpireOldFlares(ctx)
}

func (r *PostgresFlareRepo) AddRespondent(ctx context.Context, tx pgx.Tx, flareID, playerID uuid.UUID) error {
	tq := db.New(tx)
	return tq.AddFlareRespondent(ctx, db.AddFlareRespondentParams{
		FlareID:  uuidToPg(flareID),
		PlayerID: uuidToPg(playerID),
	})
}

func (r *PostgresFlareRepo) AddRespondentDirect(ctx context.Context, flareID, playerID uuid.UUID) error {
	return r.q.AddFlareRespondent(ctx, db.AddFlareRespondentParams{
		FlareID:  uuidToPg(flareID),
		PlayerID: uuidToPg(playerID),
	})
}

func (r *PostgresFlareRepo) CountRespondents(ctx context.Context, tx pgx.Tx, flareID uuid.UUID) (int32, error) {
	tq := db.New(tx)
	return tq.CountFlareRespondents(ctx, uuidToPg(flareID))
}

func (r *PostgresFlareRepo) GetRespondents(ctx context.Context, tx pgx.Tx, flareID uuid.UUID) ([]uuid.UUID, error) {
	tq := db.New(tx)
	rows, err := tq.GetFlareRespondents(ctx, uuidToPg(flareID))
	if err != nil {
		return nil, err
	}
	result := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		result = append(result, pgToUUID(row))
	}
	return result, nil
}

// --- helpers ---

func uuidToPg(id uuid.UUID) pgtype.UUID {
	return pgtype.UUID{Bytes: id, Valid: true}
}

func pgToUUID(p pgtype.UUID) uuid.UUID {
	return uuid.UUID(p.Bytes)
}

func mapFlare(row db.MatchmakingFlare) *FlareRow {
	f := &FlareRow{
		ID:          pgToUUID(row.ID),
		PlayerID:    pgToUUID(row.PlayerID),
		ScheduledAt: row.ScheduledAt.Time,
		EloMin:      row.EloMin,
		EloMax:      row.EloMax,
		MinPlayers:  row.MinPlayers,
		MaxPlayers:  row.MaxPlayers,
		MatchType:   row.MatchType,
		Status:      row.Status,
		ExpiresAt:   row.ExpiresAt.Time,
		CreatedAt:   row.CreatedAt.Time,
		UpdatedAt:   row.UpdatedAt.Time,
	}
	if row.MatchID.Valid {
		id := pgToUUID(row.MatchID)
		f.MatchID = &id
	}
	if row.VenueID.Valid {
		id := pgToUUID(row.VenueID)
		f.VenueID = &id
	}
	return f
}

func toFloat64(v interface{}) float64 {
	switch x := v.(type) {
	case float64:
		return x
	case float32:
		return float64(x)
	case int64:
		return float64(x)
	case int32:
		return float64(x)
	default:
		return 0
	}
}
