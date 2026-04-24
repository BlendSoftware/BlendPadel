package match

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

// Match status constants.
const (
	StatusPendingResult        = "pending_result"
	StatusAwaitingConfirmation = "awaiting_confirmation"
	StatusSealed               = "sealed"
	StatusDisputed             = "disputed"
	StatusCancelled            = "cancelled"
)

// Dispute status constants.
const (
	DisputeStatusPending  = "pending"
	DisputeStatusResolved = "resolved"
)

// Confirmation window duration.
const ConfirmationWindow = 6 * time.Hour

// Match type constants.
const (
	MatchTypeMale   = "male"
	MatchTypeFemale = "female"
	MatchTypeMixed  = "mixed"
)

// Sentinel errors.
var (
	ErrMatchNotFound          = errors.New("match not found")
	ErrInvalidTransition      = errors.New("invalid status transition")
	ErrForbidden              = errors.New("forbidden: caller is not authorized")
	ErrWindowClosed           = errors.New("confirmation window has closed")
	ErrInvalidSets            = errors.New("invalid sets")
	ErrDisputeNotFound        = errors.New("dispute not found")
	ErrDisputeAlreadyExists   = errors.New("dispute already exists for this match")
	ErrNotCaptain             = errors.New("caller is not a captain of this match")
	ErrInvalidMatchType       = errors.New("invalid match_type; allowed: male, female, mixed")
	ErrGenderMismatch         = errors.New("gender mismatch for selected match type")
	ErrInvalidTeamComposition = errors.New("team composition does not match the match type")
	ErrMatchNotCancellable    = errors.New("match cannot be cancelled in its current status")
	ErrPlayerBanned           = errors.New("one or more players are banned")
)

// SetScore represents the score of a single set.
type SetScore struct {
	TeamAGames int `json:"team_a_games"`
	TeamBGames int `json:"team_b_games"`
}

// CreateMatchRequest is the payload for creating a match.
type CreateMatchRequest struct {
	TeamA       []uuid.UUID `json:"team_a"`
	TeamB       []uuid.UUID `json:"team_b"`
	ScheduledAt time.Time   `json:"scheduled_at"`
	Latitude    float64     `json:"latitude"`
	Longitude   float64     `json:"longitude"`
	MatchType   string      `json:"match_type"`
	VenueID     *uuid.UUID  `json:"venue_id,omitempty"`
}

// SubmitResultRequest is the payload for submitting match results.
type SubmitResultRequest struct {
	Sets []SetScore `json:"sets"`
}

// DisputeRequest is the payload for disputing a match result.
type DisputeRequest struct {
	Reason string `json:"reason"`
}

// ResolveDisputeRequest is the payload for moderator dispute resolution.
// Action: "seal" (default) applies result + ELO; "dismiss" cancels match without sealing.
type ResolveDisputeRequest struct {
	Action           string               `json:"action,omitempty"`
	ResultOverride   *SubmitResultRequest  `json:"result_override,omitempty"`
	PenalizePlayerID *uuid.UUID            `json:"penalize_player_id,omitempty"`
}

// MatchPlayerDetail is the hydrated view of a match participant, enough to
// render the match detail without a client-side lookup.
type MatchPlayerDetail struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	LastName  string    `json:"last_name,omitempty"`
	ELO       int       `json:"elo"`
	Gender    string    `json:"gender,omitempty"`
	AvatarURL string    `json:"avatar_url,omitempty"`
	Status    string    `json:"status,omitempty"`
	Team      string    `json:"team,omitempty"`
}

// MatchResponse is the API response for a match.
type MatchResponse struct {
	ID            uuid.UUID           `json:"id"`
	Status        string              `json:"status"`
	ScheduledAt   time.Time           `json:"scheduled_at"`
	CaptainAID    uuid.UUID           `json:"captain_a_id"`
	CaptainBID    uuid.UUID           `json:"captain_b_id"`
	AvgELO        int                 `json:"avg_elo"`
	MatchType     string              `json:"match_type"`
	VenueID       *uuid.UUID          `json:"venue_id,omitempty"`
	SealedBy      string              `json:"sealed_by,omitempty"`
	TeamA         []uuid.UUID         `json:"team_a"`
	TeamB         []uuid.UUID         `json:"team_b"`
	TeamAPlayers  []MatchPlayerDetail `json:"team_a_players"`
	TeamBPlayers  []MatchPlayerDetail `json:"team_b_players"`
	WinnerTeam    string              `json:"winner_team,omitempty"`
	TotalGamesA   int                 `json:"total_games_a,omitempty"`
	TotalGamesB   int                 `json:"total_games_b,omitempty"`
	GameDiff      int                 `json:"game_diff,omitempty"`
	Sets          []SetScore          `json:"sets,omitempty"`
	CreatedAt     time.Time           `json:"created_at"`
}

// MatchHistoryItem is the match list item for match history.
type MatchHistoryItem struct {
	ID            uuid.UUID           `json:"id"`
	Status        string              `json:"status"`
	ScheduledAt   time.Time           `json:"scheduled_at"`
	CaptainAID    uuid.UUID           `json:"captain_a_id"`
	CaptainBID    uuid.UUID           `json:"captain_b_id"`
	AvgELO        int                 `json:"avg_elo"`
	MatchType     string              `json:"match_type"`
	VenueID       *uuid.UUID          `json:"venue_id,omitempty"`
	SealedBy      string              `json:"sealed_by,omitempty"`
	TeamA         []uuid.UUID         `json:"team_a"`
	TeamB         []uuid.UUID         `json:"team_b"`
	TeamAPlayers  []MatchPlayerDetail `json:"team_a_players"`
	TeamBPlayers  []MatchPlayerDetail `json:"team_b_players"`
	WinnerTeam    string              `json:"winner_team,omitempty"`
	TotalGamesA   int                 `json:"total_games_a"`
	TotalGamesB   int                 `json:"total_games_b"`
	GameDiff      int                 `json:"game_diff"`
	CreatedAt     time.Time           `json:"created_at"`
}

// MatchFull is the internal domain model with all related data loaded.
type MatchFull struct {
	ID            uuid.UUID
	Status        string
	ScheduledAt   time.Time
	CaptainAID    uuid.UUID
	CaptainBID    uuid.UUID
	AvgELO        int
	MatchType     string
	VenueID       *uuid.UUID
	SealedBy      string
	TeamA         []uuid.UUID
	TeamB         []uuid.UUID
	TeamAPlayers  []MatchPlayerDetail
	TeamBPlayers  []MatchPlayerDetail
	Result        *MatchResultData
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// MatchResultData is the internal representation of a match result.
type MatchResultData struct {
	MatchID     uuid.UUID
	Sets        []SetScore
	WinnerTeam  string
	TotalGamesA int
	TotalGamesB int
	GameDiff    int
	SubmittedBy uuid.UUID
	SubmittedAt time.Time
}

// Dispute is the domain model for a match dispute.
type Dispute struct {
	ID                uuid.UUID
	MatchID           uuid.UUID
	RaisedBy          uuid.UUID
	Reason            string
	Status            string
	ResolvedBy        *uuid.UUID
	ResolutionResult  []byte
	PenalizedPlayerID *uuid.UUID
	ResolvedAt        *time.Time
	CreatedAt         time.Time
}

// DisputeResponse is the API response for a dispute.
type DisputeResponse struct {
	ID                uuid.UUID  `json:"id"`
	MatchID           uuid.UUID  `json:"match_id"`
	RaisedBy          uuid.UUID  `json:"raised_by"`
	Reason            string     `json:"reason"`
	Status            string     `json:"status"`
	ResolvedBy        *uuid.UUID `json:"resolved_by,omitempty"`
	PenalizedPlayerID *uuid.UUID `json:"penalized_player_id,omitempty"`
	ResolvedAt        *time.Time `json:"resolved_at,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
}
