package ranking

import (
	"context"

	"github.com/google/uuid"
)

// Repository defines the data access contract for the ranking domain.
type Repository interface {
	// GetPlayerELO fetches the ELO, match count, and frozen status for a player.
	GetPlayerELO(ctx context.Context, playerID uuid.UUID) (elo int, matchCount int, frozen bool, err error)

	// UpdatePlayerELO updates the ELO for a player and increments their validated match count.
	UpdatePlayerELO(ctx context.Context, playerID uuid.UUID, newELO int) error

	// InsertELOHistory creates a new ELO history entry.
	InsertELOHistory(ctx context.Context, record ELOHistoryRecord) error

	// GetELOHistory returns ELO history for a player, ordered by date descending.
	GetELOHistory(ctx context.Context, playerID uuid.UUID, limit int) ([]ELOHistoryRecord, error)
}
