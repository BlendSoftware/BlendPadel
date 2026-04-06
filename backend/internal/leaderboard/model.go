package leaderboard

import (
	"time"

	"github.com/google/uuid"
)

// RankingEntry represents a single player row in the leaderboard.
type RankingEntry struct {
	Rank                int64     `json:"rank"`
	PlayerID            uuid.UUID `json:"player_id"`
	Name                string    `json:"name"`
	ELO                 int32     `json:"elo"`
	ValidatedMatchCount int32     `json:"validated_match_count"`
}

// RegionResponse is the public representation of a region.
type RegionResponse struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
}

// ProjectionResult contains the ELO projection for a hypothetical match outcome.
type ProjectionResult struct {
	CurrentELO    int32   `json:"current_elo"`
	ProjectedELO  int32   `json:"projected_elo"`
	Delta         int32   `json:"delta"`
	OpponentELO   int32   `json:"opponent_elo"`
	ExpectedScore float64 `json:"expected_score"`
}

// ELOHistoryEntry is a single ELO change event with opponent context.
// The ID is a UUID (same type as the elo_history table primary key).
// Cursor pagination is done via CreatedAt — the client sends the last
// entry's CreatedAt (Unix nanoseconds) as the `cursor` query parameter.
type ELOHistoryEntry struct {
	ID           uuid.UUID `json:"id"`
	MatchID      uuid.UUID `json:"match_id"`
	ELOBefore    int32     `json:"elo_before"`
	ELOAfter     int32     `json:"elo_after"`
	Delta        int32     `json:"delta"`
	OpponentName string    `json:"opponent_name"`
	OpponentID   uuid.UUID `json:"opponent_id"`
	CreatedAt    time.Time `json:"created_at"`
}

// ELOHistoryPage wraps a page of ELO history entries.
// NextCursor is nil when there are no more pages.
// The cursor value is the CreatedAt of the last entry as Unix nanoseconds.
type ELOHistoryPage struct {
	Entries    []ELOHistoryEntry `json:"entries"`
	NextCursor *int64            `json:"next_cursor"`
}

// RankingPage is the paginated leaderboard response.
type RankingPage struct {
	RegionID   uuid.UUID      `json:"region_id"`
	RegionName string         `json:"region_name"`
	Entries    []RankingEntry `json:"entries"`
	Total      int64          `json:"total"`
}
