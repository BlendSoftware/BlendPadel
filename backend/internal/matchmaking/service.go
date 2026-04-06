package matchmaking

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/juani/blendpadel/backend/internal/match"
	"github.com/juani/blendpadel/backend/internal/trust"
)

// MatchCreator is the interface used to create matches within a transaction.
// match.Service satisfies this interface, avoiding a direct import in handlers.
type MatchCreator interface {
	CreateMatchTx(ctx context.Context, tx pgx.Tx, req match.CreateMatchRequest) (*match.MatchResponse, error)
}

// Service holds the business logic for the matchmaking domain.
type Service struct {
	repo     Repository
	matchSvc MatchCreator
	pool     *pgxpool.Pool
}

// NewService creates a new matchmaking Service.
func NewService(repo Repository, matchSvc MatchCreator, pool *pgxpool.Pool) *Service {
	return &Service{
		repo:     repo,
		matchSvc: matchSvc,
		pool:     pool,
	}
}

// CreateFlare creates a new flare for the given player.
func (s *Service) CreateFlare(ctx context.Context, playerID uuid.UUID, req CreateFlareRequest) (*FlareResponse, error) {
	// Apply defaults.
	if req.ELOMin == 0 && req.ELOMax == 0 {
		req.ELOMax = 3000
	}
	if req.MinPlayers == 0 {
		req.MinPlayers = 2
	}
	if req.MaxPlayers == 0 {
		req.MaxPlayers = 4
	}
	if req.MatchType == "" {
		req.MatchType = "male"
	}

	// Validate.
	if req.Lat < -90 || req.Lat > 90 {
		return nil, fmt.Errorf("lat must be between -90 and 90")
	}
	if req.Lng < -180 || req.Lng > 180 {
		return nil, fmt.Errorf("lng must be between -180 and 180")
	}
	if req.ScheduledAt.IsZero() || req.ScheduledAt.Before(time.Now()) {
		return nil, fmt.Errorf("scheduled_at must be in the future")
	}
	if req.MinPlayers < 2 || req.MinPlayers > 4 {
		return nil, fmt.Errorf("min_players must be between 2 and 4")
	}
	if req.MaxPlayers < req.MinPlayers || req.MaxPlayers > 4 {
		return nil, fmt.Errorf("max_players must be >= min_players and <= 4")
	}
	if req.ELOMax <= req.ELOMin {
		return nil, fmt.Errorf("elo_max must be greater than elo_min")
	}

	// Check for existing active flare.
	existing, err := s.repo.GetActiveFlareByPlayer(ctx, playerID)
	if err != nil {
		return nil, fmt.Errorf("check active flare: %w", err)
	}
	if existing != nil {
		return nil, ErrActiveFlareExists
	}

	row, err := s.repo.CreateFlare(ctx, playerID, req)
	if err != nil {
		return nil, fmt.Errorf("create flare: %w", err)
	}

	// Set lat/lng from request since the DB returns geography (not extracted).
	row.Lat = req.Lat
	row.Lng = req.Lng
	return flareRowToResponse(row, "", 0), nil
}

// GetFlares returns a paginated list of active flares near the viewer.
func (s *Service) GetFlares(ctx context.Context, viewerID uuid.UUID, params GetFlaresParams) (*FlaresListResponse, error) {
	// Validate and clamp.
	if params.RadiusKm <= 0 {
		params.RadiusKm = 10
	}
	if params.RadiusKm > 50 {
		params.RadiusKm = 50
	}
	if params.PageSize <= 0 {
		params.PageSize = 20
	}
	if params.PageSize > 50 {
		params.PageSize = 50
	}

	// Decode cursor or use sentinel (far-past time + zero UUID).
	var cursorAt time.Time
	var cursorID uuid.UUID
	if params.Cursor != nil && *params.Cursor != "" {
		c, err := DecodeFlareCursor(*params.Cursor)
		if err != nil {
			return nil, fmt.Errorf("invalid cursor: %w", err)
		}
		cursorAt = c.CreatedAt
		cursorID = c.ID
	} else {
		// Sentinel: far future so the first page comparison (created_at, id) < (sentinel, sentinel) returns all rows.
		cursorAt = time.Now().Add(10 * 365 * 24 * time.Hour) // 10 years in the future
		cursorID = uuid.UUID{0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF}
	}

	queryParams := GetActiveFlaresParams{
		Lat:           params.Lat,
		Lng:           params.Lng,
		RadiusMeters:  params.RadiusKm * 1000,
		ViewerID:      viewerID,
		MinTrustScore: trust.ThresholdVisible,
		CursorAt:      cursorAt,
		CursorID:      cursorID,
		PageSize:      params.PageSize,
	}

	var rows []FlareListRow
	var err error
	if params.MatchType != "" {
		rows, err = s.repo.GetActiveFlaresByMatchType(ctx, queryParams, params.MatchType)
	} else {
		rows, err = s.repo.GetActiveFlares(ctx, queryParams)
	}
	if err != nil {
		return nil, fmt.Errorf("get flares: %w", err)
	}

	items := make([]FlareResponse, 0, len(rows))
	for _, row := range rows {
		items = append(items, *flareRowToResponse(&row.FlareRow, row.CreatorName, row.DistanceMeters))
	}

	var nextCursor *string
	if int32(len(rows)) == params.PageSize {
		last := rows[len(rows)-1]
		c := FlareCursor{
			CreatedAt: last.CreatedAt,
			ID:        last.ID,
		}.Encode()
		nextCursor = &c
	}

	return &FlaresListResponse{
		Items:      items,
		NextCursor: nextCursor,
	}, nil
}

// RespondToFlare adds the player as a respondent to the flare.
// If the flare reaches min_players, it automatically creates a match.
func (s *Service) RespondToFlare(ctx context.Context, flareID, responderID uuid.UUID) (*FlareResponse, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// Lock the flare row.
	flare, err := s.repo.GetFlareByIDForUpdate(ctx, tx, flareID)
	if err != nil {
		return nil, fmt.Errorf("lock flare: %w", err)
	}
	if flare == nil {
		return nil, ErrFlareNotFound
	}
	if flare.Status != "active" {
		return nil, ErrFlareNotActive
	}

	// Add respondent (ON CONFLICT DO NOTHING handles duplicates silently).
	if err := s.repo.AddRespondent(ctx, tx, flareID, responderID); err != nil {
		return nil, fmt.Errorf("add respondent: %w", err)
	}

	// Count respondents after inserting.
	count, err := s.repo.CountRespondents(ctx, tx, flareID)
	if err != nil {
		return nil, fmt.Errorf("count respondents: %w", err)
	}

	var matchID *uuid.UUID

	if count >= flare.MinPlayers {
		// Fetch all respondents (within same tx for consistency).
		respondents, err := s.repo.GetRespondents(ctx, tx, flareID)
		if err != nil {
			return nil, fmt.Errorf("get respondents: %w", err)
		}

		// Split into two teams. If odd number, put extra in team A.
		half := len(respondents) / 2
		if half == 0 {
			half = 1
		}
		teamA := respondents[:half]
		teamB := respondents[half:]
		if len(teamB) == 0 {
			teamB = teamA[1:]
			teamA = teamA[:1]
		}

		matchResp, err := s.matchSvc.CreateMatchTx(ctx, tx, match.CreateMatchRequest{
			TeamA:       teamA,
			TeamB:       teamB,
			ScheduledAt: flare.ScheduledAt,
			Latitude:    flare.Lat,
			Longitude:   flare.Lng,
			MatchType:   flare.MatchType,
		})
		if err != nil {
			return nil, fmt.Errorf("create match: %w", err)
		}

		matchID = &matchResp.ID

		// Update flare status to matched.
		flare, err = s.repo.UpdateFlareStatus(ctx, tx, flareID, "matched", matchID)
		if err != nil {
			return nil, fmt.Errorf("update flare status: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx: %w", err)
	}

	resp := flareRowToResponse(flare, "", 0)
	resp.RespondentCount = count
	return resp, nil
}

// CancelFlare cancels the flare owned by the given player.
func (s *Service) CancelFlare(ctx context.Context, flareID, playerID uuid.UUID) error {
	row, err := s.repo.CancelFlare(ctx, flareID, playerID)
	if err != nil {
		return fmt.Errorf("cancel flare: %w", err)
	}
	if row == nil {
		return ErrFlareNotFound
	}
	return nil
}

// ExpireFlares expires flares whose expires_at has passed.
func (s *Service) ExpireFlares(ctx context.Context) (int64, error) {
	return s.repo.ExpireOldFlares(ctx)
}

// --- helpers ---

func flareRowToResponse(row *FlareRow, creatorName string, distanceMeters float64) *FlareResponse {
	resp := &FlareResponse{
		ID:             row.ID,
		CreatorName:    creatorName,
		Lat:            row.Lat,
		Lng:            row.Lng,
		DistanceMeters: distanceMeters,
		ScheduledAt:    row.ScheduledAt,
		ELOMin:         row.EloMin,
		ELOMax:         row.EloMax,
		MinPlayers:     row.MinPlayers,
		MaxPlayers:     row.MaxPlayers,
		MatchType:      row.MatchType,
		VenueID:        row.VenueID,
		Status:         row.Status,
		ExpiresAt:      row.ExpiresAt,
		MatchID:        row.MatchID,
		CreatedAt:      row.CreatedAt,
	}
	return resp
}
