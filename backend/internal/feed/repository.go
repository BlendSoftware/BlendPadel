package feed

import (
	"context"

	"github.com/google/uuid"
)

// Repository defines the data-access contract for the feed domain.
type Repository interface {
	CreateEvent(ctx context.Context, playerID uuid.UUID, eventType string, content []byte, regionID *uuid.UUID) error
	GetFeedByRegion(ctx context.Context, regionID uuid.UUID, limit, offset int32) ([]FeedEventResponse, error)
	HasRecentEvent(ctx context.Context, playerID uuid.UUID, eventType string) (bool, error)
	GetPlayerWinStreak(ctx context.Context, playerID uuid.UUID) (int, error)
}
