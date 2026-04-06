package venue

import (
	"context"

	"github.com/google/uuid"
)

// Repository defines the data-access contract for the venue domain.
type Repository interface {
	// Create inserts a new venue and returns it.
	Create(ctx context.Context, callerID uuid.UUID, req CreateVenueRequest) (*VenueResponse, error)

	// GetByID returns a venue by its ID.
	GetByID(ctx context.Context, id uuid.UUID) (*VenueResponse, error)

	// GetNearby returns venues within a radius of a point, ordered by distance.
	GetNearby(ctx context.Context, lat, lng, radiusMeters float64, limit, offset int32) ([]VenueResponse, error)

	// Update updates a venue and returns the updated version.
	Update(ctx context.Context, id uuid.UUID, req UpdateVenueRequest, verified bool) (*VenueResponse, error)
}
