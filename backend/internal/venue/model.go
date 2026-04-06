package venue

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
)

// Sentinel errors.
var (
	ErrNotFound  = errors.New("venue not found")
	ErrForbidden = errors.New("forbidden: only the creator or an admin can edit this venue")
)

// CreateVenueRequest is the payload for creating a new venue.
type CreateVenueRequest struct {
	Name       string          `json:"name"`
	Address    string          `json:"address"`
	Lat        float64         `json:"lat"`
	Lng        float64         `json:"lng"`
	CourtCount int32           `json:"court_count"`
	Phone      string          `json:"phone,omitempty"`
	Hours      json.RawMessage `json:"hours,omitempty"`
	RegionID   *uuid.UUID      `json:"region_id,omitempty"`
}

// UpdateVenueRequest is the payload for updating a venue.
type UpdateVenueRequest struct {
	Name       string          `json:"name,omitempty"`
	Address    string          `json:"address,omitempty"`
	CourtCount int32           `json:"court_count,omitempty"`
	Phone      string          `json:"phone,omitempty"`
	Hours      json.RawMessage `json:"hours,omitempty"`
	Verified   *bool           `json:"verified,omitempty"`
}

// VenueResponse is the API response for a venue.
type VenueResponse struct {
	ID             uuid.UUID       `json:"id"`
	Name           string          `json:"name"`
	Address        string          `json:"address"`
	Lat            float64         `json:"lat"`
	Lng            float64         `json:"lng"`
	CourtCount     int32           `json:"court_count"`
	Phone          string          `json:"phone,omitempty"`
	Hours          json.RawMessage `json:"hours,omitempty"`
	RegionID       *uuid.UUID      `json:"region_id,omitempty"`
	AddedBy        uuid.UUID       `json:"added_by"`
	Verified       bool            `json:"verified"`
	DistanceMeters float64         `json:"distance_meters,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
}
