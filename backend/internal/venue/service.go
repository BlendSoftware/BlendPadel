package venue

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

// Service holds the business logic for the venue domain.
type Service struct {
	repo Repository
}

// NewService creates a new venue Service.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// CreateVenue validates and creates a new venue. New venues are unverified.
func (s *Service) CreateVenue(ctx context.Context, callerID uuid.UUID, req CreateVenueRequest) (*VenueResponse, error) {
	if req.Name == "" {
		return nil, fmt.Errorf("name is required")
	}
	if req.Address == "" {
		return nil, fmt.Errorf("address is required")
	}
	if req.Lat < -90 || req.Lat > 90 {
		return nil, fmt.Errorf("lat must be between -90 and 90")
	}
	if req.Lng < -180 || req.Lng > 180 {
		return nil, fmt.Errorf("lng must be between -180 and 180")
	}
	if req.CourtCount <= 0 {
		req.CourtCount = 1
	}

	return s.repo.Create(ctx, callerID, req)
}

// GetVenue returns a venue by ID.
func (s *Service) GetVenue(ctx context.Context, id uuid.UUID) (*VenueResponse, error) {
	return s.repo.GetByID(ctx, id)
}

// GetVenuesNearby returns venues within a radius (km) of a point.
func (s *Service) GetVenuesNearby(ctx context.Context, lat, lng, radiusKm float64, limit, offset int32) ([]VenueResponse, error) {
	if radiusKm <= 0 {
		radiusKm = 10
	}
	if radiusKm > 50 {
		radiusKm = 50
	}
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	return s.repo.GetNearby(ctx, lat, lng, radiusKm*1000, limit, offset)
}

// UpdateVenue validates authorization and updates a venue.
// Only the creator or an admin (superadmin/moderator) can edit.
// Only admins can change the verified flag.
func (s *Service) UpdateVenue(ctx context.Context, callerID uuid.UUID, callerRole string, venueID uuid.UUID, req UpdateVenueRequest) (*VenueResponse, error) {
	existing, err := s.repo.GetByID(ctx, venueID)
	if err != nil {
		return nil, err
	}

	isAdmin := callerRole == "superadmin" || callerRole == "moderator"
	isCreator := existing.AddedBy == callerID

	if !isAdmin && !isCreator {
		return nil, ErrForbidden
	}

	// Determine verified status: only admin can change it.
	verified := existing.Verified
	if isAdmin && req.Verified != nil {
		verified = *req.Verified
	}

	return s.repo.Update(ctx, venueID, req, verified)
}
