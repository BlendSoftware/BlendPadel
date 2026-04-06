package matchmaking

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
)

// Sentinel errors.
var (
	ErrActiveFlareExists = errors.New("player already has an active flare")
	ErrFlareNotFound     = errors.New("flare not found")
	ErrAlreadyRespondent = errors.New("player is already a respondent")
	ErrFlareNotActive    = errors.New("flare is not active")
	ErrFlareFull         = errors.New("flare has reached max players")
	ErrNotFlareOwner     = errors.New("caller is not the flare owner")
)

// CreateFlareRequest is the payload for creating a new flare.
type CreateFlareRequest struct {
	Lat         float64   `json:"lat"`          // required, -90 to 90
	Lng         float64   `json:"lng"`          // required, -180 to 180
	ScheduledAt time.Time `json:"scheduled_at"` // required, must be in the future
	ELOMin      int32     `json:"elo_min"`      // optional, default 0
	ELOMax      int32     `json:"elo_max"`      // optional, default 3000
	MinPlayers  int32     `json:"min_players"`  // optional, default 2, min 2, max 4
	MaxPlayers  int32     `json:"max_players"`  // optional, default 4, min 2, max 4
	MatchType   string    `json:"match_type"`   // optional, default "male", one of: male, female, mixed
	VenueID     *uuid.UUID `json:"venue_id,omitempty"` // optional venue association
}

// FlareResponse is the public view of a flare.
type FlareResponse struct {
	ID              uuid.UUID  `json:"id"`
	CreatorName     string     `json:"creator_name"`
	Lat             float64    `json:"lat"`
	Lng             float64    `json:"lng"`
	DistanceMeters  float64    `json:"distance_meters,omitempty"`
	ScheduledAt     time.Time  `json:"scheduled_at"`
	ELOMin          int32      `json:"elo_min"`
	ELOMax          int32      `json:"elo_max"`
	MinPlayers      int32      `json:"min_players"`
	MaxPlayers      int32      `json:"max_players"`
	MatchType       string     `json:"match_type"`
	VenueID         *uuid.UUID `json:"venue_id,omitempty"`
	RespondentCount int32      `json:"respondent_count"`
	Status          string     `json:"status"`
	ExpiresAt       time.Time  `json:"expires_at"`
	MatchID         *uuid.UUID `json:"match_id,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}

// RespondRequest is the payload for responding to a flare (empty body is valid).
type RespondRequest struct{}

// FlaresListResponse is the paginated list of flares.
type FlaresListResponse struct {
	Items      []FlareResponse `json:"items"`
	NextCursor *string         `json:"next_cursor,omitempty"`
}

// GetFlaresParams holds the parameters for listing flares.
type GetFlaresParams struct {
	Lat        float64
	Lng        float64
	RadiusKm   float64
	Cursor     *string
	PageSize   int32
	ViewerID   uuid.UUID // player UUID (not user UUID)
	MatchType  string    // optional filter by match type
}

// FlareCursor is the cursor for flare pagination.
type FlareCursor struct {
	CreatedAt time.Time `json:"ca"`
	ID        uuid.UUID `json:"id"`
}

// Encode encodes the cursor to a base64 string.
func (c FlareCursor) Encode() string {
	b, _ := json.Marshal(c)
	return base64.StdEncoding.EncodeToString(b)
}

// DecodeFlareCursor decodes a base64 cursor string.
func DecodeFlareCursor(s string) (*FlareCursor, error) {
	b, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		return nil, err
	}
	var c FlareCursor
	if err := json.Unmarshal(b, &c); err != nil {
		return nil, err
	}
	return &c, nil
}
