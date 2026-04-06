package trust

import (
	"context"

	"github.com/google/uuid"
)

// Repository defines the data access contract for the trust domain.
type Repository interface {
	// GetTrustScore returns the current trust score for a player.
	GetTrustScore(ctx context.Context, playerID uuid.UUID) (int, error)

	// UpdateTrustScore sets the trust score for a player.
	UpdateTrustScore(ctx context.Context, playerID uuid.UUID, newScore int) error

	// InsertTrustEvent records a trust score change event.
	InsertTrustEvent(ctx context.Context, event TrustEvent) error

	// GetMonthlyRecovery returns the total recovery points accrued this calendar month.
	GetMonthlyRecovery(ctx context.Context, playerID uuid.UUID) (int, error)

	// CountRecentDisputes returns the number of dispute events in the last 30 days.
	CountRecentDisputes(ctx context.Context, playerID uuid.UUID) (int, error)

	// FreezeELO marks the player's ELO as frozen.
	FreezeELO(ctx context.Context, playerID uuid.UUID) error
}
