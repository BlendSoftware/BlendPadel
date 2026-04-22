package venue

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

// CoordsAdapter implements match.VenueCoordsFetcher.
type CoordsAdapter struct {
	repo Repository
}

// NewCoordsAdapter creates a new CoordsAdapter.
func NewCoordsAdapter(repo Repository) *CoordsAdapter {
	return &CoordsAdapter{repo: repo}
}

// GetVenueCoords returns the coordinates for a venue.
func (a *CoordsAdapter) GetVenueCoords(ctx context.Context, venueID uuid.UUID) (float64, float64, error) {
	v, err := a.repo.GetByID(ctx, venueID)
	if err != nil {
		return 0, 0, fmt.Errorf("venue %s: %w", venueID, err)
	}
	return v.Lat, v.Lng, nil
}
