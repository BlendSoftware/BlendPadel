package partnership

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

const (
	StatusPending   = "pending"
	StatusAccepted  = "accepted"
	StatusRejected  = "rejected"
	StatusDissolved = "dissolved"

	MaxActivePartnerships = 5
)

var (
	ErrNotFound          = errors.New("partnership not found")
	ErrAlreadyExists     = errors.New("partnership already exists between these players")
	ErrSelfPartnership   = errors.New("cannot partner with yourself")
	ErrMaxPartnerships   = errors.New("maximum active partnerships reached")
	ErrForbidden         = errors.New("forbidden: not authorized for this action")
	ErrInvalidTransition = errors.New("invalid status transition")
)

// CreateRequest is the payload for requesting a partnership.
type CreateRequest struct {
	PartnerID uuid.UUID `json:"partner_id"`
}

// PartnershipResponse is the API response for a partnership.
type PartnershipResponse struct {
	ID          uuid.UUID `json:"id"`
	RequesterID uuid.UUID `json:"requester_id"`
	PartnerID   uuid.UUID `json:"partner_id"`
	Status      string    `json:"status"`
	PartnerName string    `json:"partner_name,omitempty"`
	PartnerELO  int32     `json:"partner_elo,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

// PairStatsResponse is the API response for pair statistics.
type PairStatsResponse struct {
	TotalMatches  int32   `json:"total_matches"`
	Wins          int32   `json:"wins"`
	WinRate       float64 `json:"win_rate"`
	CurrentStreak int     `json:"current_streak"`
}

// BestPartnerResponse is the API response for the best partner endpoint.
type BestPartnerResponse struct {
	PartnerID    uuid.UUID `json:"partner_id"`
	PartnerName  string    `json:"partner_name"`
	PartnerELO   int32     `json:"partner_elo"`
	TotalMatches int32     `json:"total_matches"`
	Wins         int32     `json:"wins"`
	WinRatePct   int32     `json:"win_rate_pct"`
}

type RequestedUser struct {
	ID       uuid.UUID `json:"id"`
	FullName string    `json:"full_name"`
}

type SentRequestResponse struct {
	ID            uuid.UUID     `json:"id"`
	Status        string        `json:"status"`
	RequestedUser RequestedUser `json:"requested_user"`
	CreatedAt     time.Time     `json:"created_at"`
}
