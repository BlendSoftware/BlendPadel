package leaderboard

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/juani/blendpadel/backend/internal/db"
)

// postgresRepo implements Repository backed by sqlc-generated queries.
type postgresRepo struct {
	q *db.Queries
}

// NewPostgresRepo returns a Repository backed by PostgreSQL via sqlc.
func NewPostgresRepo(q *db.Queries) Repository {
	return &postgresRepo{q: q}
}

func (r *postgresRepo) GetRankingByRegion(ctx context.Context, regionID uuid.UUID, limit, offset int32) ([]RankingEntry, error) {
	rows, err := r.q.GetRankingByRegion(ctx, db.GetRankingByRegionParams{
		RegionID: pgtype.UUID{Bytes: regionID, Valid: true},
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		return nil, err
	}

	entries := make([]RankingEntry, 0, len(rows))
	for _, row := range rows {
		entries = append(entries, RankingEntry{
			Rank:                row.Rank,
			PlayerID:            uuid.UUID(row.ID.Bytes),
			Name:                row.Name.String,
			ELO:                 row.Elo,
			ValidatedMatchCount: row.ValidatedMatchCount,
		})
	}
	return entries, nil
}

func (r *postgresRepo) GetRankingByRegionAndGender(ctx context.Context, regionID uuid.UUID, gender string, limit, offset int32) ([]RankingEntry, error) {
	rows, err := r.q.GetRankingByRegionAndGender(ctx, db.GetRankingByRegionAndGenderParams{
		RegionID: pgtype.UUID{Bytes: regionID, Valid: true},
		Limit:    limit,
		Offset:   offset,
		Gender:   gender,
	})
	if err != nil {
		return nil, err
	}

	entries := make([]RankingEntry, 0, len(rows))
	for _, row := range rows {
		entries = append(entries, RankingEntry{
			Rank:                row.Rank,
			PlayerID:            uuid.UUID(row.ID.Bytes),
			Name:                row.Name.String,
			ELO:                 row.Elo,
			ValidatedMatchCount: row.ValidatedMatchCount,
		})
	}
	return entries, nil
}

func (r *postgresRepo) GetPlayerRankByGender(ctx context.Context, playerID uuid.UUID, gender string) (int64, error) {
	rank, err := r.q.GetPlayerRankByGender(ctx, db.GetPlayerRankByGenderParams{
		ID:     pgtype.UUID{Bytes: playerID, Valid: true},
		Gender: gender,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, ErrNotFound
		}
		return 0, err
	}
	return rank, nil
}

func (r *postgresRepo) GetPlayerRank(ctx context.Context, playerID uuid.UUID) (int64, error) {
	rank, err := r.q.GetPlayerRank(ctx, pgtype.UUID{Bytes: playerID, Valid: true})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, ErrNotFound
		}
		return 0, err
	}
	return rank, nil
}

func (r *postgresRepo) GetRegionName(ctx context.Context, regionID uuid.UUID) (string, error) {
	pgID := pgtype.UUID{Bytes: regionID, Valid: true}
	return r.q.GetRegionNameByID(ctx, pgID)
}

func (r *postgresRepo) GetAllRegions(ctx context.Context) ([]RegionResponse, error) {
	rows, err := r.q.GetAllRegions(ctx)
	if err != nil {
		return nil, err
	}

	regions := make([]RegionResponse, 0, len(rows))
	for _, row := range rows {
		regions = append(regions, RegionResponse{
			ID:   uuid.UUID(row.ID.Bytes),
			Name: row.Name,
		})
	}
	return regions, nil
}

func (r *postgresRepo) CreateRegion(ctx context.Context, name string, boundaryWKT string) (RegionResponse, error) {
	var boundary interface{}
	if boundaryWKT != "" {
		boundary = boundaryWKT
	}

	row, err := r.q.CreateRegion(ctx, db.CreateRegionParams{
		Name:           name,
		StGeomfromtext: boundary,
	})
	if err != nil {
		return RegionResponse{}, err
	}

	return RegionResponse{
		ID:   uuid.UUID(row.ID.Bytes),
		Name: row.Name,
	}, nil
}

func (r *postgresRepo) GetELOHistoryWithOpponents(ctx context.Context, playerID uuid.UUID, cursor *int64, limit int32) (ELOHistoryPage, error) {
	var cursorTS pgtype.Timestamptz
	if cursor != nil {
		t := time.Unix(0, *cursor).UTC()
		cursorTS = pgtype.Timestamptz{Time: t, Valid: true}
	}

	rows, err := r.q.GetELOHistoryWithOpponents(ctx, db.GetELOHistoryWithOpponentsParams{
		PlayerID: pgtype.UUID{Bytes: playerID, Valid: true},
		Column2:  cursorTS,
		Limit:    limit,
	})
	if err != nil {
		return ELOHistoryPage{}, err
	}

	entries := make([]ELOHistoryEntry, 0, len(rows))
	for _, row := range rows {
		entries = append(entries, ELOHistoryEntry{
			ID:           uuid.UUID(row.ID.Bytes),
			MatchID:      uuid.UUID(row.MatchID.Bytes),
			ELOBefore:    row.EloBefore,
			ELOAfter:     row.EloAfter,
			Delta:        row.Delta,
			OpponentName: row.OpponentName.String,
			OpponentID:   uuid.UUID(row.OpponentID.Bytes),
			CreatedAt:    row.CreatedAt.Time,
		})
	}

	var nextCursor *int64
	if int32(len(rows)) == limit && len(rows) > 0 {
		last := entries[len(entries)-1].CreatedAt.UnixNano()
		nextCursor = &last
	}

	return ELOHistoryPage{
		Entries:    entries,
		NextCursor: nextCursor,
	}, nil
}
