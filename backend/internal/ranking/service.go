package ranking

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/juani/blendpadel/backend/internal/db"
)

// Service provides ELO computation and application logic.
type Service struct {
	pool *pgxpool.Pool
	repo Repository
}

// NewService creates a new ranking Service.
func NewService(pool *pgxpool.Pool, repo Repository) *Service {
	return &Service{pool: pool, repo: repo}
}

// playerData holds fetched data for a single player before computation.
type playerData struct {
	id         uuid.UUID
	currentELO int
	matchCount int
	frozen     bool
}

// ApplyELO computes and persists ELO changes for all 4 players in a match.
// Frozen players are skipped but an ELOResult with Delta=0 is still returned.
// The entire DB mutation is wrapped in a single transaction.
func (s *Service) ApplyELO(ctx context.Context, input MatchELOInput) ([]ELOResult, error) {
	// Fetch all player data outside the transaction (reads don't need locking here).
	allPlayerIDs := append(input.TeamAPlayerIDs, input.TeamBPlayerIDs...)
	players := make([]playerData, 0, 4)
	for _, pid := range allPlayerIDs {
		elo, count, frozen, err := s.repo.GetPlayerELO(ctx, pid)
		if err != nil {
			return nil, fmt.Errorf("fetching ELO for player %s: %w", pid, err)
		}
		players = append(players, playerData{id: pid, currentELO: elo, matchCount: count, frozen: frozen})
	}

	// Separate into teams (indices 0,1 = teamA; indices 2,3 = teamB).
	teamA := players[:2]
	teamB := players[2:]

	// Compute team average ELOs.
	teamAAvg := avg(teamA[0].currentELO, teamA[1].currentELO)
	teamBAvg := avg(teamB[0].currentELO, teamB[1].currentELO)

	marginMult := CalcMarginMultiplier(input.GamesWon, input.GamesLost)

	// Compute ELOResult for each player.
	results := make([]ELOResult, 0, 4)
	for i, p := range players {
		if p.frozen {
			results = append(results, ELOResult{
				PlayerID: p.id,
				OldELO:   p.currentELO,
				NewELO:   p.currentELO,
				Delta:    0,
				KFactor:  kFactor(p.matchCount),
			})
			continue
		}

		inTeamA := i < 2
		var rivalAvg int
		var won bool
		if inTeamA {
			rivalAvg = teamBAvg
			won = input.WinnerTeam == "A"
		} else {
			rivalAvg = teamAAvg
			won = input.WinnerTeam == "B"
		}

		k := kFactor(p.matchCount)
		newELO := CalcNewELO(p.currentELO, rivalAvg, won, p.matchCount, marginMult)
		delta := newELO - p.currentELO

		results = append(results, ELOResult{
			PlayerID: p.id,
			OldELO:   p.currentELO,
			NewELO:   newELO,
			Delta:    delta,
			KFactor:  k,
		})
	}

	// Apply everything in a transaction using a tx-scoped repository.
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	txRepo := NewPostgresRepo(db.New(tx))

	for i, result := range results {
		p := players[i]
		if p.frozen {
			continue
		}

		if err := txRepo.UpdatePlayerELO(ctx, result.PlayerID, result.NewELO); err != nil {
			return nil, fmt.Errorf("updating ELO for player %s: %w", result.PlayerID, err)
		}

		if err := txRepo.InsertELOHistory(ctx, ELOHistoryRecord{
			PlayerID:  result.PlayerID,
			MatchID:   input.MatchID,
			EloBefore: result.OldELO,
			EloAfter:  result.NewELO,
			Delta:     result.Delta,
			KFactor:   result.KFactor,
			Type:      "match_result",
		}); err != nil {
			return nil, fmt.Errorf("inserting ELO history for player %s: %w", result.PlayerID, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("committing transaction: %w", err)
	}

	return results, nil
}

// ApplyELOTx is like ApplyELO but operates within an externally-managed transaction.
func (s *Service) ApplyELOTx(ctx context.Context, tx pgx.Tx, input MatchELOInput) ([]ELOResult, error) {
	allPlayerIDs := append(input.TeamAPlayerIDs, input.TeamBPlayerIDs...)
	players := make([]playerData, 0, 4)
	for _, pid := range allPlayerIDs {
		elo, count, frozen, err := s.repo.GetPlayerELO(ctx, pid)
		if err != nil {
			return nil, fmt.Errorf("fetching ELO for player %s: %w", pid, err)
		}
		players = append(players, playerData{id: pid, currentELO: elo, matchCount: count, frozen: frozen})
	}

	teamA := players[:2]
	teamB := players[2:]
	teamAAvg := avg(teamA[0].currentELO, teamA[1].currentELO)
	teamBAvg := avg(teamB[0].currentELO, teamB[1].currentELO)
	marginMult := CalcMarginMultiplier(input.GamesWon, input.GamesLost)

	results := make([]ELOResult, 0, 4)
	for i, p := range players {
		if p.frozen {
			results = append(results, ELOResult{PlayerID: p.id, OldELO: p.currentELO, NewELO: p.currentELO, Delta: 0, KFactor: kFactor(p.matchCount)})
			continue
		}
		inTeamA := i < 2
		var rivalAvg int
		var won bool
		if inTeamA {
			rivalAvg = teamBAvg
			won = input.WinnerTeam == "A"
		} else {
			rivalAvg = teamAAvg
			won = input.WinnerTeam == "B"
		}
		k := kFactor(p.matchCount)
		newELO := CalcNewELO(p.currentELO, rivalAvg, won, p.matchCount, marginMult)
		delta := newELO - p.currentELO
		results = append(results, ELOResult{PlayerID: p.id, OldELO: p.currentELO, NewELO: newELO, Delta: delta, KFactor: k})
	}

	txRepo := NewPostgresRepo(db.New(tx))
	for i, result := range results {
		if players[i].frozen {
			continue
		}
		if err := txRepo.UpdatePlayerELO(ctx, result.PlayerID, result.NewELO); err != nil {
			return nil, fmt.Errorf("updating ELO for player %s: %w", result.PlayerID, err)
		}
		if err := txRepo.InsertELOHistory(ctx, ELOHistoryRecord{
			PlayerID: result.PlayerID, MatchID: input.MatchID,
			EloBefore: result.OldELO, EloAfter: result.NewELO,
			Delta: result.Delta, KFactor: result.KFactor, Type: "match_result",
		}); err != nil {
			return nil, fmt.Errorf("inserting ELO history for player %s: %w", result.PlayerID, err)
		}
	}

	return results, nil
}

// avg returns the integer average of two ELO values.
func avg(a, b int) int {
	return (a + b) / 2
}

// kFactor returns the K-factor based on the player's validated match count.
func kFactor(matchCount int) int {
	if matchCount < 5 {
		return 60
	}
	return 20
}
