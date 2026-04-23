package leaderboard

import (
	"context"
	"errors"
	"fmt"
	"math"

	"github.com/google/uuid"

	"github.com/juani/blendpadel/backend/internal/ranking"
)

// ErrUnknownResult is returned when an invalid result string is provided to ProjectELO.
var ErrUnknownResult = errors.New("unknown result: must be win, lose, or draw")

// ErrNotFound is returned when the requested resource does not exist.
var ErrNotFound = errors.New("not found")

// playerRepository is the minimal interface required by the leaderboard service
// to fetch player ELO data. It is satisfied by *ranking.Repository.
type playerRepository interface {
	GetPlayerELO(ctx context.Context, playerID uuid.UUID) (elo int, matchCount int, frozen bool, err error)
}

// Service provides leaderboard, projection, and ELO history logic.
type Service struct {
	repo       Repository
	playerRepo playerRepository
}

// NewService creates a new leaderboard Service.
func NewService(repo Repository, playerRepo playerRepository) *Service {
	return &Service{repo: repo, playerRepo: playerRepo}
}

// GetRanking returns the ranked player list for a region.
// If regionID is nil, it falls back to the caller's own region extracted
// from the JWT claims — caller must pass their own playerID so the service
// can look up their region via GetPlayerRank (which reads region_id internally).
// For the MVP, callerID is used only when regionID is nil to return a 422.
func (s *Service) GetRanking(ctx context.Context, callerID uuid.UUID, regionID *uuid.UUID, gender string, limit, offset int32) (RankingPage, error) {
	if regionID == nil {
		return RankingPage{}, fmt.Errorf("region_id is required")
	}

	var entries []RankingEntry
	var err error

	if gender != "" {
		entries, err = s.repo.GetRankingByRegionAndGender(ctx, *regionID, gender, limit, offset)
	} else {
		entries, err = s.repo.GetRankingByRegion(ctx, *regionID, limit, offset)
	}
	if err != nil {
		return RankingPage{}, err
	}

	regionName, _ := s.repo.GetRegionName(ctx, *regionID)

	return RankingPage{
		RegionID:   *regionID,
		RegionName: regionName,
		Entries:    entries,
		Total:      int64(len(entries)),
	}, nil
}

// GetPlayerRank returns the RANK() of a player within their region.
func (s *Service) GetPlayerRank(ctx context.Context, playerID uuid.UUID) (int64, error) {
	return s.repo.GetPlayerRank(ctx, playerID)
}

// CreateRegion creates a new region (superadmin only — enforced at the HTTP layer).
func (s *Service) CreateRegion(ctx context.Context, name string, boundaryWKT string) (RegionResponse, error) {
	if name == "" {
		return RegionResponse{}, fmt.Errorf("region name is required")
	}
	return s.repo.CreateRegion(ctx, name, boundaryWKT)
}

// GetRegions returns all regions.
func (s *Service) GetRegions(ctx context.Context) ([]RegionResponse, error) {
	return s.repo.GetAllRegions(ctx)
}

// ProjectELO computes the projected ELO change for a hypothetical match result.
// result must be "win", "lose", or "draw".
func (s *Service) ProjectELO(ctx context.Context, callerID, opponentID uuid.UUID, result string) (ProjectionResult, error) {
	var actualScore float64
	switch result {
	case "win":
		actualScore = 1.0
	case "lose":
		actualScore = 0.0
	case "draw":
		actualScore = 0.5
	default:
		return ProjectionResult{}, ErrUnknownResult
	}

	callerELO, matchCount, _, err := s.playerRepo.GetPlayerELO(ctx, callerID)
	if err != nil {
		return ProjectionResult{}, fmt.Errorf("fetching caller ELO: %w", err)
	}

	opponentELO, _, _, err := s.playerRepo.GetPlayerELO(ctx, opponentID)
	if err != nil {
		return ProjectionResult{}, fmt.Errorf("fetching opponent ELO: %w", err)
	}

	k := float64(kFactor(matchCount))
	expected := ranking.CalcExpected(callerELO, opponentELO)

	// Compute projected ELO using the K-factor and margin multiplier M=1.0.
	delta := math.Round(k * (actualScore - expected) * 1.0)
	projected := callerELO + int(delta)

	return ProjectionResult{
		CurrentELO:    int32(callerELO),
		ProjectedELO:  int32(projected),
		Delta:         int32(delta),
		OpponentELO:   int32(opponentELO),
		ExpectedScore: expected,
	}, nil
}

// GetELOHistory returns a paginated ELO history for a player.
func (s *Service) GetELOHistory(ctx context.Context, playerID uuid.UUID, cursor *int64, limit int32) (ELOHistoryPage, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 50 {
		limit = 50
	}
	return s.repo.GetELOHistoryWithOpponents(ctx, playerID, cursor, limit)
}

// kFactor returns the K-factor based on the player's validated match count.
// Mirrors the same formula used in internal/ranking/service.go.
func kFactor(matchCount int) int {
	if matchCount < 5 {
		return 60
	}
	return 20
}
