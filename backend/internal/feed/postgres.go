package feed

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

func (r *postgresRepo) CreateEvent(ctx context.Context, playerID uuid.UUID, eventType string, content []byte, regionID *uuid.UUID) error {
	rid := pgtype.UUID{}
	if regionID != nil {
		rid = pgtype.UUID{Bytes: *regionID, Valid: true}
	}
	_, err := r.q.CreateFeedEvent(ctx, db.CreateFeedEventParams{
		PlayerID:  pgtype.UUID{Bytes: playerID, Valid: true},
		EventType: eventType,
		Content:   content,
		RegionID:  rid,
	})
	return err
}

func (r *postgresRepo) GetFeedByRegion(ctx context.Context, regionID uuid.UUID, limit, offset int32) ([]FeedEventResponse, error) {
	rows, err := r.q.GetFeedByRegion(ctx, db.GetFeedByRegionParams{
		RegionID:  pgtype.UUID{Bytes: regionID, Valid: true},
		PageLimit: limit,
		PageOffset: offset,
	})
	if err != nil {
		return nil, err
	}

	items := make([]FeedEventResponse, 0, len(rows))
	for _, row := range rows {
		item := FeedEventResponse{
			ID:         uuid.UUID(row.ID.Bytes),
			PlayerID:   uuid.UUID(row.PlayerID.Bytes),
			PlayerName: row.PlayerName.String,
			EventType:  row.EventType,
			Content:    row.Content,
			CreatedAt:  row.CreatedAt.Time,
		}
		if row.RegionID.Valid {
			id := uuid.UUID(row.RegionID.Bytes)
			item.RegionID = &id
		}
		items = append(items, item)
	}
	return items, nil
}

func (r *postgresRepo) HasRecentEvent(ctx context.Context, playerID uuid.UUID, eventType string) (bool, error) {
	_, err := r.q.GetRecentPlayerEventByType(ctx, db.GetRecentPlayerEventByTypeParams{
		PlayerID:  pgtype.UUID{Bytes: playerID, Valid: true},
		EventType: eventType,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

func (r *postgresRepo) GetPlayerWinStreak(ctx context.Context, playerID uuid.UUID) (int, error) {
	results, err := r.q.GetPlayerWinStreak(ctx, pgtype.UUID{Bytes: playerID, Valid: true})
	if err != nil {
		return 0, err
	}
	streak := 0
	for _, won := range results {
		if won {
			streak++
		} else {
			break
		}
	}
	return streak, nil
}
