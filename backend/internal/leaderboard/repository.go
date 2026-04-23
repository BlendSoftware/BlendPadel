package leaderboard

import (
	"context"

	"github.com/google/uuid"
)

// Repository is the persistence contract for the leaderboard domain.
type Repository interface {
	// GetRankingByRegion returns the ranked player list for a region, with pagination.
	GetRankingByRegion(ctx context.Context, regionID uuid.UUID, limit, offset int32) ([]RankingEntry, error)

	// GetRankingByRegionAndGender returns the ranked player list filtered by gender.
	GetRankingByRegionAndGender(ctx context.Context, regionID uuid.UUID, gender string, limit, offset int32) ([]RankingEntry, error)

	// GetPlayerRank returns the RANK() position of the player within their region.
	GetPlayerRank(ctx context.Context, playerID uuid.UUID) (int64, error)

	// GetPlayerRankByGender returns the RANK() position filtered by gender.
	GetPlayerRankByGender(ctx context.Context, playerID uuid.UUID, gender string) (int64, error)

	// GetRegionName returns the display name for a region.
	GetRegionName(ctx context.Context, regionID uuid.UUID) (string, error)

	// GetAllRegions returns all regions ordered by name.
	GetAllRegions(ctx context.Context) ([]RegionResponse, error)

	// CreateRegion inserts a new region with an optional WKT polygon boundary.
	// boundaryWKT may be empty — if empty, boundary is stored as NULL.
	CreateRegion(ctx context.Context, name string, boundaryWKT string) (RegionResponse, error)

	// GetELOHistoryWithOpponents returns a cursor-paginated ELO history page for a player.
	// cursor is the CreatedAt Unix nanoseconds of the last seen entry (nil for first page).
	GetELOHistoryWithOpponents(ctx context.Context, playerID uuid.UUID, cursor *int64, limit int32) (ELOHistoryPage, error)
}
