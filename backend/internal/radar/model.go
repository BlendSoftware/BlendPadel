package radar

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// RadarMatch is the domain model for a match visible in the radar.
type RadarMatch struct {
	ID             uuid.UUID `json:"id"`
	CaptainID      uuid.UUID `json:"captain_id"`
	CaptainName    string    `json:"captain_name"`
	Lat            float64   `json:"lat"`
	Lng            float64   `json:"lng"`
	DistanceMeters float64   `json:"distance_meters"`
	AvgELO         int32     `json:"avg_elo"`
	ScheduledAt    time.Time `json:"scheduled_at"`
	JoinedCount    int32     `json:"joined_count"`
}

// RadarMatchesResponse is the paginated response for /radar/matches.
type RadarMatchesResponse struct {
	Items      []RadarMatch `json:"items"`
	NextCursor *string      `json:"next_cursor,omitempty"`
}

// RadarAlertsResponse is the response for /radar/alerts.
type RadarAlertsResponse struct {
	Items []RadarMatch `json:"items"`
}

// RadarCursor encodes pagination state as (scheduled_at, id).
type RadarCursor struct {
	ScheduledAt time.Time `json:"sa"`
	ID          uuid.UUID `json:"id"`
}

// Encode serialises the cursor to a URL-safe base64 string.
func (c RadarCursor) Encode() string {
	b, _ := json.Marshal(c)
	return base64.URLEncoding.EncodeToString(b)
}

// DecodeCursor parses a base64 cursor string back into a RadarCursor.
func DecodeCursor(s string) (*RadarCursor, error) {
	b, err := base64.URLEncoding.DecodeString(s)
	if err != nil {
		return nil, fmt.Errorf("invalid cursor encoding: %w", err)
	}
	var c RadarCursor
	if err := json.Unmarshal(b, &c); err != nil {
		return nil, fmt.Errorf("invalid cursor payload: %w", err)
	}
	return &c, nil
}

// GetMatchesParams holds the service-level input for GetMatches.
type GetMatchesParams struct {
	ViewerUserID uuid.UUID
	Lat          float64
	Lng          float64
	RadiusKm     float64
	ELOMin       int32
	ELOMax       int32
	Cursor       *RadarCursor
	PageSize     int32
}

// GetAlertsParams holds the service-level input for GetAlerts.
type GetAlertsParams struct {
	ViewerUserID uuid.UUID
	Lat          float64
	Lng          float64
	RadiusKm     float64
}
