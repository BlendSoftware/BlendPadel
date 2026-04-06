package ranking

import "github.com/google/uuid"

// ELOResult holds the result of an ELO calculation for a single player.
type ELOResult struct {
	PlayerID uuid.UUID
	OldELO   int
	NewELO   int
	Delta    int
	KFactor  int
}

// MatchELOInput is the input required to compute and apply ELO for a match.
type MatchELOInput struct {
	MatchID        uuid.UUID
	TeamAPlayerIDs []uuid.UUID // exactly 2 players
	TeamBPlayerIDs []uuid.UUID // exactly 2 players
	WinnerTeam     string      // "A" or "B"
	GamesWon       int         // games won by the winner team
	GamesLost      int         // games won by the loser team
}

// ELOHistoryRecord is a domain-layer representation of an ELO history entry.
type ELOHistoryRecord struct {
	PlayerID  uuid.UUID
	MatchID   uuid.UUID
	EloBefore int
	EloAfter  int
	Delta     int
	KFactor   int
	Type      string
}
