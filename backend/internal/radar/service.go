package radar

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5/pgtype"
)

// Service constants.
const (
	MaxRadiusKm       = 50.0
	DefaultRadiusKm   = 10.0
	DefaultELOSpread  = 200
	DefaultPageSize   = int32(20)
	MaxPageSize       = int32(50)
	AlertRadiusMeters = 5000
	DefaultELO        = int32(1000)
	MinELO            = int32(0)
	MaxELO            = int32(3000)
)

// Sentinel errors.
var (
	ErrInvalidRadius   = errors.New("radius_km must be between 0 and 50")
	ErrInvalidELORange = errors.New("invalid elo range: elo_min must be >= 0, elo_max <= 3000, and elo_max > elo_min")
	ErrMissingLocation = errors.New("lat and lng are required")
)

// Service handles radar business logic.
type Service struct {
	repo Repository
}

// NewService creates a new radar Service.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// GetMatches returns a paginated list of open matches visible to the viewer.
func (s *Service) GetMatches(ctx context.Context, p GetMatchesParams) (*RadarMatchesResponse, error) {
	// Validate radius.
	if p.RadiusKm <= 0 || p.RadiusKm > MaxRadiusKm {
		return nil, ErrInvalidRadius
	}

	// Apply default ELO range if not provided.
	if p.ELOMin == 0 && p.ELOMax == 0 {
		p.ELOMin = DefaultELO - DefaultELOSpread
		p.ELOMax = DefaultELO + DefaultELOSpread
	}

	// Clamp ELO bounds.
	if p.ELOMin < MinELO {
		p.ELOMin = MinELO
	}
	if p.ELOMax > MaxELO {
		p.ELOMax = MaxELO
	}

	// Validate ELO range.
	if p.ELOMin < 0 || p.ELOMax > MaxELO || p.ELOMax <= p.ELOMin {
		return nil, ErrInvalidELORange
	}

	// Default/cap page size.
	if p.PageSize <= 0 {
		p.PageSize = DefaultPageSize
	}
	if p.PageSize > MaxPageSize {
		p.PageSize = MaxPageSize
	}

	// Build cursor params.
	cursorTime := pgtype.Timestamptz{Valid: false}
	cursorID := pgtype.UUID{Valid: false}
	if p.Cursor != nil {
		cursorTime = pgtype.Timestamptz{Time: p.Cursor.ScheduledAt, Valid: true}
		cursorID = pgtype.UUID{Bytes: p.Cursor.ID, Valid: true}
	}

	dbParams := GetMatchesDBParams{
		Lat:          p.Lat,
		Lng:          p.Lng,
		RadiusMeters: p.RadiusKm * 1000,
		ELOMin:       p.ELOMin,
		ELOMax:       p.ELOMax,
		CursorTime:   cursorTime,
		CursorID:     cursorID,
		ViewerID:     p.ViewerUserID,
		Limit:        p.PageSize,
	}

	results, err := s.repo.GetMatches(ctx, dbParams)
	if err != nil {
		return nil, err
	}

	resp := &RadarMatchesResponse{
		Items: results,
	}

	// Build next cursor if there are more results.
	if int32(len(results)) == p.PageSize {
		last := results[len(results)-1]
		c := RadarCursor{
			ScheduledAt: last.ScheduledAt,
			ID:          last.ID,
		}
		encoded := c.Encode()
		resp.NextCursor = &encoded
	}

	return resp, nil
}

// GetAlerts returns urgent matches (within 5km, within 1 hour) visible to the viewer.
func (s *Service) GetAlerts(ctx context.Context, p GetAlertsParams) (*RadarAlertsResponse, error) {
	results, err := s.repo.GetAlerts(ctx, GetAlertsDBParams{
		Lat:      p.Lat,
		Lng:      p.Lng,
		ViewerID: p.ViewerUserID,
	})
	if err != nil {
		return nil, err
	}

	return &RadarAlertsResponse{Items: results}, nil
}
