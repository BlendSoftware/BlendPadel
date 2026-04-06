package trust

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
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

func (r *postgresRepo) GetTrustScore(ctx context.Context, playerID uuid.UUID) (int, error) {
	row, err := r.q.GetPlayerTrustScore(ctx, pgtype.UUID{Bytes: playerID, Valid: true})
	if err != nil {
		return 0, err
	}
	return int(row.TrustScore), nil
}

func (r *postgresRepo) UpdateTrustScore(ctx context.Context, playerID uuid.UUID, newScore int) error {
	return r.q.UpdateTrustScore(ctx, db.UpdateTrustScoreParams{
		ID:         pgtype.UUID{Bytes: playerID, Valid: true},
		TrustScore: int32(newScore),
	})
}

func (r *postgresRepo) InsertTrustEvent(ctx context.Context, event TrustEvent) error {
	_, err := r.q.InsertTrustEvent(ctx, db.InsertTrustEventParams{
		PlayerID:    pgtype.UUID{Bytes: event.PlayerID, Valid: true},
		EventType:   event.EventType,
		Delta:       int32(event.Delta),
		ReferenceID: pgtype.UUID{Bytes: event.ReferenceID, Valid: event.ReferenceID != uuid.Nil},
	})
	return err
}

func (r *postgresRepo) GetMonthlyRecovery(ctx context.Context, playerID uuid.UUID) (int, error) {
	total, err := r.q.GetMonthlyRecoverySum(ctx, pgtype.UUID{Bytes: playerID, Valid: true})
	if err != nil {
		return 0, err
	}
	return int(total), nil
}

func (r *postgresRepo) CountRecentDisputes(ctx context.Context, playerID uuid.UUID) (int, error) {
	count, err := r.q.CountRecentDisputes(ctx, pgtype.UUID{Bytes: playerID, Valid: true})
	if err != nil {
		return 0, err
	}
	return int(count), nil
}

func (r *postgresRepo) FreezeELO(ctx context.Context, playerID uuid.UUID) error {
	return r.q.FreezePlayerELO(ctx, pgtype.UUID{Bytes: playerID, Valid: true})
}
