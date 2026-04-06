package trust

import (
	"time"

	"github.com/google/uuid"
)

// Trust score boundary constants.
const (
	ThresholdVisible = 70
	MaxTrustScore    = 100
	MinTrustScore    = 0
)

// Penalty amounts (negative values).
const (
	PenaltyLateCancellation  = -10
	PenaltyFirstDispute      = -5
	PenaltySystematicDispute = -20
	PenaltyConductReport     = -15
)

// Recovery amounts.
const (
	RecoveryPerMatch    = 2
	RecoveryMonthlyCap = 10
)

// Event type constants.
const (
	EventLateCancellation  = "late_cancellation"
	EventDispute           = "dispute"
	EventSystematicDispute = "systematic_dispute"
	EventConductReport     = "conduct_report"
	EventMatchCompleted    = "match_completed"
	EventThresholdCrossed  = "trust_threshold_crossed"
)

// TrustEvent represents a change in a player's trust score.
type TrustEvent struct {
	ID          uuid.UUID
	PlayerID    uuid.UUID
	EventType   string
	Delta       int
	ReferenceID uuid.UUID
	CreatedAt   time.Time
}
