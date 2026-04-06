package partnership

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/juani/blendpadel/backend/internal/db"
)

type postgresRepo struct {
	q *db.Queries
}

func NewPostgresRepo(q *db.Queries) Repository {
	return &postgresRepo{q: q}
}

func (r *postgresRepo) Create(ctx context.Context, requesterID, partnerID uuid.UUID) (*PartnershipResponse, error) {
	row, err := r.q.CreatePartnership(ctx, db.CreatePartnershipParams{
		RequesterID: uuidToPg(requesterID),
		PartnerID:   uuidToPg(partnerID),
	})
	if err != nil {
		return nil, err
	}
	return mapRow(row), nil
}

func (r *postgresRepo) GetByID(ctx context.Context, id uuid.UUID) (*PartnershipResponse, error) {
	row, err := r.q.GetPartnershipByID(ctx, uuidToPg(id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return mapRow(row), nil
}

func (r *postgresRepo) GetExisting(ctx context.Context, playerA, playerB uuid.UUID) (*PartnershipResponse, error) {
	row, err := r.q.GetExistingPartnership(ctx, db.GetExistingPartnershipParams{
		PlayerA: uuidToPg(playerA),
		PlayerB: uuidToPg(playerB),
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return mapRow(row), nil
}

func (r *postgresRepo) CountActive(ctx context.Context, playerID uuid.UUID) (int32, error) {
	return r.q.CountActivePartnershipsByPlayer(ctx, uuidToPg(playerID))
}

func (r *postgresRepo) GetActiveByPlayer(ctx context.Context, playerID uuid.UUID) ([]PartnershipResponse, error) {
	rows, err := r.q.GetActivePartnershipsByPlayer(ctx, uuidToPg(playerID))
	if err != nil {
		return nil, err
	}
	result := make([]PartnershipResponse, 0, len(rows))
	for _, row := range rows {
		result = append(result, PartnershipResponse{
			ID:          pgToUUID(row.ID),
			RequesterID: pgToUUID(row.RequesterID),
			PartnerID:   pgToUUID(row.PartnerID),
			Status:      row.Status,
			PartnerName: row.PartnerName.String,
			PartnerELO:  row.PartnerElo,
			CreatedAt:   row.CreatedAt.Time,
		})
	}
	return result, nil
}

func (r *postgresRepo) UpdateStatus(ctx context.Context, id uuid.UUID, status string) (*PartnershipResponse, error) {
	row, err := r.q.UpdatePartnershipStatus(ctx, db.UpdatePartnershipStatusParams{
		ID:     uuidToPg(id),
		Status: status,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return mapRow(row), nil
}

func (r *postgresRepo) GetPairStats(ctx context.Context, playerA, playerB uuid.UUID) (int32, int32, error) {
	row, err := r.q.GetPairStats(ctx, db.GetPairStatsParams{
		PlayerA: uuidToPg(playerA),
		PlayerB: uuidToPg(playerB),
	})
	if err != nil {
		return 0, 0, err
	}
	return row.TotalMatches, row.Wins, nil
}

func (r *postgresRepo) GetPairRecentMatches(ctx context.Context, playerA, playerB uuid.UUID) ([]bool, error) {
	rows, err := r.q.GetPairRecentMatches(ctx, db.GetPairRecentMatchesParams{
		PlayerA: uuidToPg(playerA),
		PlayerB: uuidToPg(playerB),
	})
	if err != nil {
		return nil, err
	}
	results := make([]bool, 0, len(rows))
	for _, row := range rows {
		results = append(results, row.Won)
	}
	return results, nil
}

func (r *postgresRepo) GetBestPartner(ctx context.Context, playerID uuid.UUID) (*BestPartnerResponse, error) {
	row, err := r.q.GetBestPartner(ctx, uuidToPg(playerID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &BestPartnerResponse{
		PartnerID:    pgToUUID(row.PartnerID),
		PartnerName:  row.PartnerName.String,
		PartnerELO:   row.PartnerElo,
		TotalMatches: row.TotalMatches,
		Wins:         row.Wins,
		WinRatePct:   row.WinRatePct,
	}, nil
}

// --- helpers ---

func uuidToPg(id uuid.UUID) pgtype.UUID {
	return pgtype.UUID{Bytes: id, Valid: true}
}

func pgToUUID(p pgtype.UUID) uuid.UUID {
	return uuid.UUID(p.Bytes)
}

func mapRow(row db.PlayerPartnership) *PartnershipResponse {
	return &PartnershipResponse{
		ID:          pgToUUID(row.ID),
		RequesterID: pgToUUID(row.RequesterID),
		PartnerID:   pgToUUID(row.PartnerID),
		Status:      row.Status,
		CreatedAt:   row.CreatedAt.Time,
	}
}
