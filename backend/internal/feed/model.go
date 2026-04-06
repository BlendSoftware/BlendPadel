package feed

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

const (
	EventWinStreak      = "win_streak"
	EventMatchMilestone = "match_milestone"
)

// Milestone thresholds.
var milestoneThresholds = []int{10, 25, 50, 100}

// FeedEventResponse is the API response for a feed item.
type FeedEventResponse struct {
	ID         uuid.UUID       `json:"id"`
	PlayerID   uuid.UUID       `json:"player_id"`
	PlayerName string          `json:"player_name"`
	EventType  string          `json:"event_type"`
	Content    json.RawMessage `json:"content"`
	RegionID   *uuid.UUID      `json:"region_id,omitempty"`
	CreatedAt  time.Time       `json:"created_at"`
}
