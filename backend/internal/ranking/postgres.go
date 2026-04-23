package ranking

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

func (r *postgresRepo) GetPlayerELO(ctx context.Context, playerID uuid.UUID) (int, int, bool, error) {
	row, err := r.q.GetPlayerELO(ctx, pgtype.UUID{Bytes: playerID, Valid: true})
	if err != nil {
		return 0, 0, false, err
	}
	return int(row.Elo), int(row.ValidatedMatchCount), row.EloFrozen, nil
}

func (r *postgresRepo) UpdatePlayerELO(ctx context.Context, playerID uuid.UUID, newELO int) error {
	return r.q.UpdatePlayerELOAndCount(ctx, db.UpdatePlayerELOAndCountParams{
		ID:  pgtype.UUID{Bytes: playerID, Valid: true},
		Elo: int32(newELO),
	})
}

func (r *postgresRepo) IncrementMatchCount(ctx context.Context, playerID uuid.UUID) error {
	return r.q.IncrementMatchCount(ctx, pgtype.UUID{Bytes: playerID, Valid: true})
}

func (r *postgresRepo) InsertELOHistory(ctx context.Context, record ELOHistoryRecord) error {
	_, err := r.q.InsertELOHistory(ctx, db.InsertELOHistoryParams{
		PlayerID:  pgtype.UUID{Bytes: record.PlayerID, Valid: true},
		MatchID:   pgtype.UUID{Bytes: record.MatchID, Valid: true},
		EloBefore: int32(record.EloBefore),
		EloAfter:  int32(record.EloAfter),
		Delta:     int32(record.Delta),
		KFactor:   int32(record.KFactor),
		Type:      record.Type,
	})
	return err
}

func (r *postgresRepo) GetELOHistory(ctx context.Context, playerID uuid.UUID, limit int) ([]ELOHistoryRecord, error) {
	rows, err := r.q.GetELOHistory(ctx, db.GetELOHistoryParams{
		PlayerID: pgtype.UUID{Bytes: playerID, Valid: true},
		Limit:    int32(limit),
	})
	if err != nil {
		return nil, err
	}

	records := make([]ELOHistoryRecord, 0, len(rows))
	for _, row := range rows {
		records = append(records, ELOHistoryRecord{
			PlayerID:  row.PlayerID.Bytes,
			MatchID:   row.MatchID.Bytes,
			EloBefore: int(row.EloBefore),
			EloAfter:  int(row.EloAfter),
			Delta:     int(row.Delta),
			KFactor:   int(row.KFactor),
			Type:      row.Type,
		})
	}
	return records, nil
}
