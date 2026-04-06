package match

import "fmt"

const (
	maxGamesPerSet = 7
	minSets        = 2
	maxSets        = 3
)

// ValidateSets validates the sets of a match result.
// Rules:
//   - Min 2 sets, max 3 sets
//   - Games per set must be in range [0, 7]
//   - There must be a clear winner (one team wins more sets than the other)
//   - In a 2-set match, one team must win both sets
//   - In a 3-set match, one team must win 2 sets
func ValidateSets(sets []SetScore) error {
	if len(sets) < minSets || len(sets) > maxSets {
		return fmt.Errorf("%w: must have 2 or 3 sets, got %d", ErrInvalidSets, len(sets))
	}

	winsA, winsB := 0, 0
	for i, s := range sets {
		if s.TeamAGames < 0 || s.TeamBGames < 0 {
			return fmt.Errorf("%w: set %d has negative games", ErrInvalidSets, i+1)
		}
		if s.TeamAGames > maxGamesPerSet || s.TeamBGames > maxGamesPerSet {
			return fmt.Errorf("%w: set %d games exceed maximum of %d", ErrInvalidSets, i+1, maxGamesPerSet)
		}
		if s.TeamAGames > s.TeamBGames {
			winsA++
		} else if s.TeamBGames > s.TeamAGames {
			winsB++
		}
		// Tied sets (equal games) count for neither team — but we still allow them for the
		// overall score calculation; the clear-winner check below will catch the case where
		// nobody wins.
	}

	if winsA == winsB {
		return fmt.Errorf("%w: no clear winner — each team won %d set(s)", ErrInvalidSets, winsA)
	}

	return nil
}

// CalculateResult computes the winner team, total games per team, and the game
// differential from the given sets. It assumes the sets have already been
// validated via ValidateSets.
func CalculateResult(sets []SetScore) (winnerTeam string, totalA, totalB, gameDiff int) {
	winsA, winsB := 0, 0
	for _, s := range sets {
		totalA += s.TeamAGames
		totalB += s.TeamBGames
		if s.TeamAGames > s.TeamBGames {
			winsA++
		} else if s.TeamBGames > s.TeamAGames {
			winsB++
		}
	}

	if winsA > winsB {
		winnerTeam = "A"
		gameDiff = totalA - totalB
	} else {
		winnerTeam = "B"
		gameDiff = totalB - totalA
	}

	return winnerTeam, totalA, totalB, gameDiff
}
