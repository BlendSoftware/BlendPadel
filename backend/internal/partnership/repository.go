package partnership

import (
	"context"

	"github.com/google/uuid"
)

// Repository defines the data-access contract for the partnership domain.
type Repository interface {
	Create(ctx context.Context, requesterID, partnerID uuid.UUID) (*PartnershipResponse, error)
	GetByID(ctx context.Context, id uuid.UUID) (*PartnershipResponse, error)
	GetExisting(ctx context.Context, playerA, playerB uuid.UUID) (*PartnershipResponse, error)
	CountActive(ctx context.Context, playerID uuid.UUID) (int32, error)
	GetActiveByPlayer(ctx context.Context, playerID uuid.UUID) ([]PartnershipResponse, error)
	UpdateStatus(ctx context.Context, id uuid.UUID, status string) (*PartnershipResponse, error)

	// Pair metrics
	GetPairStats(ctx context.Context, playerA, playerB uuid.UUID) (totalMatches, wins int32, err error)
	GetPairRecentMatches(ctx context.Context, playerA, playerB uuid.UUID) ([]bool, error) // list of won (true/false)
	GetBestPartner(ctx context.Context, playerID uuid.UUID) (*BestPartnerResponse, error)
}
