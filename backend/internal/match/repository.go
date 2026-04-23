package match

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// Repository defines the data-access contract for the match domain.
type Repository interface {
	// BeginTx starts a new database transaction.
	BeginTx(ctx context.Context) (pgx.Tx, error)

	// WithTx returns a new Repository scoped to the given transaction.
	WithTx(tx pgx.Tx) Repository

	// CreateMatch inserts a new match and returns the created match.
	CreateMatch(ctx context.Context, m CreateMatchInput) (*MatchFull, error)

	// GetMatch fetches a match by ID (without players/result).
	GetMatch(ctx context.Context, matchID uuid.UUID) (*MatchFull, error)

	// GetMatchWithPlayers fetches a match including its players and result (if any).
	GetMatchWithPlayers(ctx context.Context, matchID uuid.UUID) (*MatchFull, error)

	// InsertMatchPlayers inserts the players for a match (both teams).
	InsertMatchPlayers(ctx context.Context, matchID uuid.UUID, teamA, teamB []uuid.UUID) error

	// InsertResult inserts the match result.
	InsertResult(ctx context.Context, matchID uuid.UUID, result MatchResultInput) error

	// UpdateStatus updates the match status and sealed_by field.
	UpdateStatus(ctx context.Context, matchID uuid.UUID, status, sealedBy string) error

	// UpdateStatusCAS atomically updates the match status only if the current status matches expectedStatus.
	// Returns ErrInvalidTransition if the status has already changed (compare-and-swap).
	UpdateStatusCAS(ctx context.Context, matchID uuid.UUID, expectedStatus, newStatus, sealedBy string) error

	// UpdateResultSets updates the sets/winner/games for an existing result (used on dispute override).
	UpdateResultSets(ctx context.Context, matchID uuid.UUID, sets []SetScore, winnerTeam string, totalA, totalB, gameDiff int) error

	// GetPendingSealMatches returns matches in awaiting_confirmation with result older than 6h.
	GetPendingSealMatches(ctx context.Context) ([]MatchFull, error)

	// GetMatchHistory returns sealed matches for a player with pagination.
	GetMatchHistory(ctx context.Context, playerID uuid.UUID, limit, offset int) ([]MatchHistoryItem, error)

	// GetActiveMatches returns non-sealed, non-cancelled matches for a player.
	GetActiveMatches(ctx context.Context, playerID uuid.UUID) ([]MatchHistoryItem, error)

	// CreateDispute creates a new dispute record and returns it.
	CreateDispute(ctx context.Context, matchID, raisedBy uuid.UUID, reason string) (*Dispute, error)

	// GetDispute fetches a dispute by ID.
	GetDispute(ctx context.Context, disputeID uuid.UUID) (*Dispute, error)

	// GetDisputeByMatch fetches the dispute for a given match.
	GetDisputeByMatch(ctx context.Context, matchID uuid.UUID) (*Dispute, error)

	// GetDisputesByStatus returns all disputes with the given status.
	GetDisputesByStatus(ctx context.Context, status string) ([]Dispute, error)

	// ResolveDispute marks the dispute as resolved.
	ResolveDispute(ctx context.Context, disputeID, resolvedBy uuid.UUID, result []byte, penalizedID *uuid.UUID) error

	// GetPlayerProfile fetches basic player data for calibration egress check.
	GetPlayerProfile(ctx context.Context, playerID uuid.UUID) (*PlayerBasic, error)

	// UpdatePlayerStatus updates the status field for a player.
	UpdatePlayerStatus(ctx context.Context, playerID uuid.UUID, status string) error

	// UnfreezePlayerELO unfreezes the ELO for a player.
	UnfreezePlayerELO(ctx context.Context, playerID uuid.UUID) error

	// CreateMatchTx inserts a new match and its players within an existing transaction.
	CreateMatchTx(ctx context.Context, tx pgx.Tx, in CreateMatchInput, teamA, teamB []uuid.UUID) (*MatchFull, error)

	// GetPlayerGenders returns a map of playerID→gender for the given player IDs.
	GetPlayerGenders(ctx context.Context, playerIDs []uuid.UUID) (map[uuid.UUID]string, error)

	// GetPlayerELOs returns a map of playerID→ELO for the given player IDs.
	GetPlayerELOs(ctx context.Context, playerIDs []uuid.UUID) (map[uuid.UUID]int, error)

	// GetPlayerStatuses returns a map of playerID→status for the given player IDs.
	GetPlayerStatuses(ctx context.Context, playerIDs []uuid.UUID) (map[uuid.UUID]string, error)
}

// CreateMatchInput holds the data needed to insert a new match.
type CreateMatchInput struct {
	Latitude        float64
	Longitude       float64
	CaptainAID      uuid.UUID
	CaptainBID      uuid.UUID
	AvgELO          int
	MatchType       string
	VenueID         *uuid.UUID
	ScheduledAtTime interface{} // holds time.Time
}

// MatchResultInput holds the data needed to insert a match result.
type MatchResultInput struct {
	Sets        []SetScore
	WinnerTeam  string
	TotalGamesA int
	TotalGamesB int
	GameDiff    int
	SubmittedBy uuid.UUID
}

// PlayerBasic holds minimal player data needed for calibration egress check.
type PlayerBasic struct {
	ID                  uuid.UUID
	Status              string
	ValidatedMatchCount int
}
