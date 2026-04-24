package match

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/rs/zerolog/log"

	"github.com/juani/blendpadel/backend/internal/ranking"
	"github.com/juani/blendpadel/backend/internal/trust"
)

// NotificationHookFn is an optional callback invoked after significant match events.
// event is a short identifier (e.g. "result_submitted", "match_sealed").
// data carries event-specific context (e.g. matchID, playerID, eloDelta).
// Errors from the hook are logged but never propagate to callers.
type NotificationHookFn func(ctx context.Context, event string, data map[string]interface{})

// VenueCoordsFetcher resolves venue coordinates by ID.
type VenueCoordsFetcher interface {
	GetVenueCoords(ctx context.Context, venueID uuid.UUID) (lat, lng float64, err error)
}

// Service holds the business logic for the match domain.
type Service struct {
	repo           Repository
	rankingService *ranking.Service
	trustService   *trust.Service
	venueFetcher   VenueCoordsFetcher
	notifyHook     NotificationHookFn
}

// NewService creates a new match Service.
func NewService(repo Repository, rankingSvc *ranking.Service, trustSvc *trust.Service) *Service {
	return &Service{
		repo:           repo,
		rankingService: rankingSvc,
		trustService:   trustSvc,
	}
}

// SetVenueCoordsFetcher registers an optional venue coordinate resolver.
func (s *Service) SetVenueCoordsFetcher(fetcher VenueCoordsFetcher) {
	s.venueFetcher = fetcher
}

// SetNotificationHook registers an optional notification callback.
// Safe to call multiple times; last call wins.
func (s *Service) SetNotificationHook(hook NotificationHookFn) {
	s.notifyHook = hook
}

// ValidateMatchType checks if the given match type value is valid.
func ValidateMatchType(matchType string) error {
	switch matchType {
	case MatchTypeMale, MatchTypeFemale, MatchTypeMixed:
		return nil
	default:
		return ErrInvalidMatchType
	}
}

// ValidateTeamComposition checks that team genders match the declared match type.
func ValidateTeamComposition(matchType string, teamA, teamB []uuid.UUID, genders map[uuid.UUID]string) error {
	switch matchType {
	case MatchTypeMale:
		for _, pid := range append(teamA, teamB...) {
			if genders[pid] != "male" {
				return fmt.Errorf("%w: cannot add female players to a male match", ErrGenderMismatch)
			}
		}
	case MatchTypeFemale:
		for _, pid := range append(teamA, teamB...) {
			if genders[pid] != "female" {
				return fmt.Errorf("%w: cannot add male players to a female match", ErrGenderMismatch)
			}
		}
	case MatchTypeMixed:
		// Each team needs at least 1 male and 1 female (or other).
		for _, team := range [][]uuid.UUID{teamA, teamB} {
			hasMale := false
			hasFemaleOrOther := false
			for _, pid := range team {
				switch genders[pid] {
				case "male":
					hasMale = true
				case "female", "other":
					hasFemaleOrOther = true
				}
			}
			if !hasMale || !hasFemaleOrOther {
				return fmt.Errorf("%w: mixed matches require at least one player of each gender per team", ErrInvalidTeamComposition)
			}
		}
	}
	return nil
}

// CreateMatch creates a new match with 4 players.
func (s *Service) CreateMatch(ctx context.Context, creatorID uuid.UUID, req CreateMatchRequest) (*MatchResponse, error) {
	// Default match type.
	if req.MatchType == "" {
		req.MatchType = MatchTypeMale
	}
	if err := ValidateMatchType(req.MatchType); err != nil {
		return nil, err
	}

	// Validate team sizes.
	if len(req.TeamA) != 2 || len(req.TeamB) != 2 {
		return nil, fmt.Errorf("each team must have exactly 2 players")
	}

	// Validate all 4 players are unique.
	allPlayers := append(req.TeamA, req.TeamB...)
	seen := make(map[uuid.UUID]struct{}, 4)
	for _, pid := range allPlayers {
		if _, ok := seen[pid]; ok {
			return nil, fmt.Errorf("duplicate player in match")
		}
		seen[pid] = struct{}{}
	}

	// Validate creator is in the match.
	creatorInMatch := false
	for _, pid := range allPlayers {
		if pid == creatorID {
			creatorInMatch = true
			break
		}
	}
	if !creatorInMatch {
		return nil, fmt.Errorf("creator must be a participant in the match")
	}

	// Creator is captain_a if in team A, otherwise determine.
	// By convention: captain_a = creator (must be in TeamA), captain_b = first player in TeamB.
	inTeamA := false
	for _, pid := range req.TeamA {
		if pid == creatorID {
			inTeamA = true
			break
		}
	}
	if !inTeamA {
		return nil, fmt.Errorf("creator must be in team A")
	}

	captainAID := creatorID
	captainBID := req.TeamB[0]

	// Validate no player is banned.
	statuses, err := s.repo.GetPlayerStatuses(ctx, allPlayers)
	if err != nil {
		return nil, fmt.Errorf("fetch player statuses: %w", err)
	}
	for _, pid := range allPlayers {
		if strings.HasPrefix(statuses[pid], "banned") {
			return nil, ErrPlayerBanned
		}
	}

	// Validate team composition against match type.
	genders, err := s.repo.GetPlayerGenders(ctx, allPlayers)
	if err != nil {
		return nil, fmt.Errorf("fetch player genders: %w", err)
	}
	if err := ValidateTeamComposition(req.MatchType, req.TeamA, req.TeamB, genders); err != nil {
		return nil, err
	}

	// Fetch all players' ELOs in a batch and compute average.
	elos, err := s.repo.GetPlayerELOs(ctx, allPlayers)
	if err != nil {
		return nil, fmt.Errorf("fetch player ELOs: %w", err)
	}
	totalELO := 0
	for _, pid := range allPlayers {
		totalELO += elos[pid]
	}
	avgELO := totalELO / len(allPlayers)

	// Resolve coordinates: use venue location if venue_id is provided.
	lat, lng := req.Latitude, req.Longitude
	if req.VenueID != nil && s.venueFetcher != nil {
		vLat, vLng, vErr := s.venueFetcher.GetVenueCoords(ctx, *req.VenueID)
		if vErr != nil {
			return nil, fmt.Errorf("fetch venue coords: %w", vErr)
		}
		lat, lng = vLat, vLng
	}

	m, err := s.repo.CreateMatch(ctx, CreateMatchInput{
		ScheduledAtTime: req.ScheduledAt,
		Latitude:        lat,
		Longitude:       lng,
		CaptainAID:      captainAID,
		CaptainBID:      captainBID,
		AvgELO:          avgELO,
		MatchType:       req.MatchType,
		VenueID:         req.VenueID,
	})
	if err != nil {
		return nil, fmt.Errorf("create match: %w", err)
	}

	if err := s.repo.InsertMatchPlayers(ctx, m.ID, req.TeamA, req.TeamB); err != nil {
		return nil, fmt.Errorf("insert match players: %w", err)
	}

	m.TeamA = req.TeamA
	m.TeamB = req.TeamB

	return matchToResponse(m), nil
}

// CreateMatchTx creates a match within an existing pgx transaction.
// It is used by the matchmaking service to atomically create a match when a flare fills up.
func (s *Service) CreateMatchTx(ctx context.Context, tx pgx.Tx, req CreateMatchRequest) (*MatchResponse, error) {
	if len(req.TeamA) < 1 || len(req.TeamB) < 1 {
		return nil, fmt.Errorf("each team must have at least 1 player")
	}

	if req.MatchType == "" {
		req.MatchType = MatchTypeMale
	}

	captainAID := req.TeamA[0]
	captainBID := req.TeamB[0]

	m, err := s.repo.CreateMatchTx(ctx, tx, CreateMatchInput{
		ScheduledAtTime: req.ScheduledAt,
		Latitude:        req.Latitude,
		Longitude:       req.Longitude,
		CaptainAID:      captainAID,
		CaptainBID:      captainBID,
		AvgELO:          0,
		MatchType:       req.MatchType,
		VenueID:         req.VenueID,
	}, req.TeamA, req.TeamB)
	if err != nil {
		return nil, fmt.Errorf("create match tx: %w", err)
	}

	return matchToResponse(m), nil
}

// SubmitResult submits the result for a match in pending_result status.
func (s *Service) SubmitResult(ctx context.Context, matchID, submitterID uuid.UUID, req SubmitResultRequest) error {
	m, err := s.repo.GetMatch(ctx, matchID)
	if err != nil {
		return err
	}

	if m.Status != StatusPendingResult {
		return fmt.Errorf("%w: match is in status %s", ErrInvalidTransition, m.Status)
	}

	if submitterID != m.CaptainAID && submitterID != m.CaptainBID {
		return ErrNotCaptain
	}

	if err := ValidateSets(req.Sets); err != nil {
		return err
	}

	winnerTeam, totalA, totalB, gameDiff := CalculateResult(req.Sets)

	if err := s.repo.InsertResult(ctx, matchID, MatchResultInput{
		Sets:        req.Sets,
		WinnerTeam:  winnerTeam,
		TotalGamesA: totalA,
		TotalGamesB: totalB,
		GameDiff:    gameDiff,
		SubmittedBy: submitterID,
	}); err != nil {
		return fmt.Errorf("insert result: %w", err)
	}

	if err := s.repo.UpdateStatus(ctx, matchID, StatusAwaitingConfirmation, ""); err != nil {
		return fmt.Errorf("update status: %w", err)
	}

	confirmerID := m.CaptainBID
	if submitterID == m.CaptainBID {
		confirmerID = m.CaptainAID
	}

	log.Info().
		Str("match_id", matchID.String()).
		Str("submitted_by", submitterID.String()).
		Str("confirmer", confirmerID.String()).
		Str("winner", winnerTeam).
		Msg("resultado pendiente de validación por capitán opuesto")

	if s.notifyHook != nil {
		s.notifyHook(ctx, "result_submitted", map[string]interface{}{
			"match_id":     matchID,
			"confirmer_id": confirmerID,
		})
	}

	return nil
}

// ConfirmMatch is called by captain_b to confirm the result within the 6h window.
// The status update and seal (ELO + trust) are wrapped in a single transaction.
func (s *Service) ConfirmMatch(ctx context.Context, matchID, confirmerID uuid.UUID) error {
	m, err := s.repo.GetMatchWithPlayers(ctx, matchID)
	if err != nil {
		return err
	}

	if m.Status != StatusAwaitingConfirmation {
		return fmt.Errorf("%w: match is in status %s", ErrInvalidTransition, m.Status)
	}

	if m.Result == nil {
		return fmt.Errorf("match has no result")
	}

	expectedConfirmer := m.CaptainBID
	if m.Result.SubmittedBy == m.CaptainBID {
		expectedConfirmer = m.CaptainAID
	}
	if confirmerID != expectedConfirmer {
		return fmt.Errorf("%w: only the opposite captain can confirm", ErrForbidden)
	}

	// Check 6h window.
	if time.Since(m.Result.SubmittedAt) > ConfirmationWindow {
		return ErrWindowClosed
	}

	sealedBy := "captain_b"
	if m.Result.SubmittedBy == m.CaptainBID {
		sealedBy = "captain_a"
	}
	return s.sealMatchAtomic(ctx, m, sealedBy)
}

// DisputeMatch is called by the opposite captain to dispute the result within the 6h window.
func (s *Service) DisputeMatch(ctx context.Context, matchID, disputerID uuid.UUID, req DisputeRequest) error {
	m, err := s.repo.GetMatchWithPlayers(ctx, matchID)
	if err != nil {
		return err
	}

	if m.Status != StatusAwaitingConfirmation {
		return fmt.Errorf("%w: match is in status %s", ErrInvalidTransition, m.Status)
	}

	if m.Result == nil {
		return fmt.Errorf("match has no result")
	}

	expectedDisputer := m.CaptainBID
	if m.Result.SubmittedBy == m.CaptainBID {
		expectedDisputer = m.CaptainAID
	}
	if disputerID != expectedDisputer {
		return fmt.Errorf("%w: only the opposite captain can dispute", ErrForbidden)
	}

	// Check 6h window.
	if time.Since(m.Result.SubmittedAt) > ConfirmationWindow {
		return ErrWindowClosed
	}

	if err := s.repo.UpdateStatusCAS(ctx, matchID, StatusAwaitingConfirmation, StatusDisputed, ""); err != nil {
		return err
	}

	if _, err := s.repo.CreateDispute(ctx, matchID, disputerID, req.Reason); err != nil {
		return fmt.Errorf("create dispute: %w", err)
	}

	// Penalize both captains.
	if _, _, err := s.trustService.PenalizeDispute(ctx, m.CaptainAID, matchID); err != nil {
		log.Error().Err(err).Str("player", m.CaptainAID.String()).Msg("failed to penalize captain_a for dispute")
	}
	if _, _, err := s.trustService.PenalizeDispute(ctx, m.CaptainBID, matchID); err != nil {
		log.Error().Err(err).Str("player", m.CaptainBID.String()).Msg("failed to penalize captain_b for dispute")
	}

	log.Info().
		Str("match_id", matchID.String()).
		Str("disputed_by", disputerID.String()).
		Msg("match disputed")

	return nil
}

// GetPendingDisputes returns all disputes with status 'pending'.
func (s *Service) GetPendingDisputes(ctx context.Context) ([]Dispute, error) {
	return s.repo.GetDisputesByStatus(ctx, DisputeStatusPending)
}

// ResolveDispute allows a moderator to resolve a pending dispute.
// action="seal" (default): apply result + ELO. action="dismiss": cancel match, no seal.
func (s *Service) ResolveDispute(ctx context.Context, disputeID, moderatorID uuid.UUID, req ResolveDisputeRequest) error {
	dispute, err := s.repo.GetDispute(ctx, disputeID)
	if err != nil {
		return err
	}

	if dispute.Status != DisputeStatusPending {
		return fmt.Errorf("dispute is already resolved")
	}

	matchID := dispute.MatchID

	action := req.Action
	if action == "" {
		action = "seal"
	}

	// Unfreeze ELO for both captains regardless of action.
	m, err := s.repo.GetMatchWithPlayers(ctx, matchID)
	if err != nil {
		return err
	}
	if err := s.repo.UnfreezePlayerELO(ctx, m.CaptainAID); err != nil {
		log.Error().Err(err).Str("player", m.CaptainAID.String()).Msg("failed to unfreeze ELO for captain_a")
	}
	if err := s.repo.UnfreezePlayerELO(ctx, m.CaptainBID); err != nil {
		log.Error().Err(err).Str("player", m.CaptainBID.String()).Msg("failed to unfreeze ELO for captain_b")
	}

	switch action {
	case "seal":
		// If result override provided, update the result before sealing.
		if req.ResultOverride != nil {
			if err := ValidateSets(req.ResultOverride.Sets); err != nil {
				return fmt.Errorf("invalid override sets: %w", err)
			}
			winnerTeam, totalA, totalB, gameDiff := CalculateResult(req.ResultOverride.Sets)
			if err := s.repo.UpdateResultSets(ctx, matchID, req.ResultOverride.Sets, winnerTeam, totalA, totalB, gameDiff); err != nil {
				return fmt.Errorf("update result sets: %w", err)
			}
		}

		// Re-fetch match with updated result for atomic sealing.
		freshMatch, err := s.repo.GetMatchWithPlayers(ctx, matchID)
		if err != nil {
			return fmt.Errorf("refetch match: %w", err)
		}
		if err := s.sealMatchAtomic(ctx, freshMatch, "moderator"); err != nil {
			return fmt.Errorf("seal match: %w", err)
		}

	case "dismiss":
		if err := s.repo.UpdateStatus(ctx, matchID, StatusCancelled, "moderator_dismiss"); err != nil {
			return fmt.Errorf("cancel match: %w", err)
		}

	default:
		return fmt.Errorf("invalid action %q: must be \"seal\" or \"dismiss\"", action)
	}

	// Build resolution result JSON.
	var resolutionJSON []byte
	if req.ResultOverride != nil {
		resolutionJSON, _ = json.Marshal(req.ResultOverride)
	}

	// Mark dispute as resolved.
	if err := s.repo.ResolveDispute(ctx, disputeID, moderatorID, resolutionJSON, req.PenalizePlayerID); err != nil {
		return fmt.Errorf("resolve dispute: %w", err)
	}

	// Penalize if requested.
	if req.PenalizePlayerID != nil {
		if _, err := s.trustService.PenalizeConductReport(ctx, *req.PenalizePlayerID, disputeID); err != nil {
			log.Error().Err(err).Str("player", req.PenalizePlayerID.String()).Msg("failed to apply conduct report penalty")
		}
	}

	log.Info().
		Str("dispute_id", disputeID.String()).
		Str("match_id", matchID.String()).
		Str("moderator", moderatorID.String()).
		Str("action", action).
		Msg("dispute resolved")

	return nil
}

// CancellationPenaltyWindow is the threshold before scheduled_at within which
// cancellation triggers a Trust Score penalty.
const CancellationPenaltyWindow = 3 * time.Hour

// IsLateCancellation returns true if cancelling now would be considered late
// (less than CancellationPenaltyWindow before scheduledAt, or after scheduledAt).
func IsLateCancellation(scheduledAt time.Time) bool {
	return time.Until(scheduledAt) < CancellationPenaltyWindow
}

// CancelMatch cancels a pending_result match. Only captains can cancel.
// If the match is scheduled within CancellationPenaltyWindow, the cancelling
// captain receives a late_cancellation Trust Score penalty.
func (s *Service) CancelMatch(ctx context.Context, matchID, callerID uuid.UUID) error {
	m, err := s.repo.GetMatchWithPlayers(ctx, matchID)
	if err != nil {
		return err
	}

	// Only pending_result matches can be cancelled.
	if m.Status != StatusPendingResult {
		return ErrMatchNotCancellable
	}

	// Only a captain can cancel.
	if callerID != m.CaptainAID && callerID != m.CaptainBID {
		return fmt.Errorf("%w: only a captain can cancel this match", ErrForbidden)
	}

	// Update status to cancelled.
	if err := s.repo.UpdateStatus(ctx, matchID, StatusCancelled, ""); err != nil {
		return fmt.Errorf("update match status: %w", err)
	}

	// Apply late cancellation penalty if within the penalty window.
	if IsLateCancellation(m.ScheduledAt) {
		if _, err := s.trustService.PenalizeLateCancellation(ctx, callerID, matchID); err != nil {
			log.Error().Err(err).
				Str("player", callerID.String()).
				Str("match_id", matchID.String()).
				Msg("failed to apply late cancellation penalty")
		}
	}

	log.Info().
		Str("match_id", matchID.String()).
		Str("cancelled_by", callerID.String()).
		Bool("late", IsLateCancellation(m.ScheduledAt)).
		Msg("match cancelled")

	// Notify other participants.
	if s.notifyHook != nil {
		allPlayers := append(m.TeamA, m.TeamB...)
		otherPlayers := make([]uuid.UUID, 0, 3)
		for _, pid := range allPlayers {
			if pid != callerID {
				otherPlayers = append(otherPlayers, pid)
			}
		}
		s.notifyHook(ctx, "match_cancelled", map[string]interface{}{
			"match_id":      matchID,
			"cancelled_by":  callerID,
			"notify_players": otherPlayers,
		})
	}

	return nil
}

// GetMatchHistory returns sealed matches for a player.
func (s *Service) GetMatchHistory(ctx context.Context, playerID uuid.UUID, limit, offset int) ([]MatchHistoryItem, error) {
	if limit <= 0 {
		limit = 10
	}
	if limit > 100 {
		limit = 100
	}
	return s.repo.GetMatchHistory(ctx, playerID, limit, offset)
}

// GetActiveMatches returns non-sealed, non-cancelled matches for a player.
func (s *Service) GetActiveMatches(ctx context.Context, playerID uuid.UUID) ([]MatchHistoryItem, error) {
	return s.repo.GetActiveMatches(ctx, playerID)
}

// GetMatchDetail returns full match data for a single match.
func (s *Service) GetMatchDetail(ctx context.Context, matchID uuid.UUID) (*MatchResponse, error) {
	m, err := s.repo.GetMatchWithPlayers(ctx, matchID)
	if err != nil {
		return nil, err
	}
	return matchToResponse(m), nil
}

// sealMatchAtomic wraps status update + ELO + trust recovery in a single transaction.
func (s *Service) sealMatchAtomic(ctx context.Context, m *MatchFull, sealedBy string) error {
	if m.Result == nil {
		return fmt.Errorf("cannot seal match without a result")
	}
	if len(m.TeamA) < 2 || len(m.TeamB) < 2 {
		return fmt.Errorf("match must have 2 players per team")
	}

	var gamesWon, gamesLost int
	if m.Result.WinnerTeam == "A" {
		gamesWon = m.Result.TotalGamesA
		gamesLost = m.Result.TotalGamesB
	} else {
		gamesWon = m.Result.TotalGamesB
		gamesLost = m.Result.TotalGamesA
	}

	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	txRepo := s.repo.WithTx(tx)
	if err := txRepo.UpdateStatusCAS(ctx, m.ID, m.Status, StatusSealed, sealedBy); err != nil {
		return err
	}

	eloResults, err := s.rankingService.ApplyELOTx(ctx, tx, ranking.MatchELOInput{
		MatchID:        m.ID,
		TeamAPlayerIDs: m.TeamA,
		TeamBPlayerIDs: m.TeamB,
		WinnerTeam:     m.Result.WinnerTeam,
		GamesWon:       gamesWon,
		GamesLost:      gamesLost,
	})
	if err != nil {
		return fmt.Errorf("apply ELO: %w", err)
	}

	allPlayers := append(m.TeamA, m.TeamB...)
	for _, pid := range allPlayers {
		if _, _, err := s.trustService.RecoverFromMatchTx(ctx, tx, pid, m.ID); err != nil {
			log.Error().Err(err).Str("player", pid.String()).Msg("failed to recover trust from match")
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit seal transaction: %w", err)
	}

	for _, pid := range allPlayers {
		if err := s.checkCalibrationEgress(ctx, pid); err != nil {
			log.Error().Err(err).Str("player", pid.String()).Msg("failed to check calibration egress")
		}
	}

	log.Info().
		Str("match_id", m.ID.String()).
		Str("winner", m.Result.WinnerTeam).
		Msg("match sealed, ELO and trust applied")

	if s.notifyHook != nil {
		s.notifyHook(ctx, "match_sealed", map[string]interface{}{
			"match_id":    m.ID,
			"elo_results": eloResults,
		})
	}

	return nil
}

// checkCalibrationEgress checks if a player should graduate from calibration to active.
func (s *Service) checkCalibrationEgress(ctx context.Context, playerID uuid.UUID) error {
	profile, err := s.repo.GetPlayerProfile(ctx, playerID)
	if err != nil {
		return err
	}

	const calibrationThreshold = 3
	if profile.Status == "calibration" && profile.ValidatedMatchCount >= calibrationThreshold {
		if err := s.repo.UpdatePlayerStatus(ctx, playerID, "active"); err != nil {
			return fmt.Errorf("update player status to active: %w", err)
		}
		log.Info().
			Str("player_id", playerID.String()).
			Int("match_count", profile.ValidatedMatchCount).
			Msg("player graduated from calibration to active")
	}

	return nil
}

// --- helpers ---

func matchToResponse(m *MatchFull) *MatchResponse {
	teamA := m.TeamA
	if teamA == nil {
		teamA = []uuid.UUID{}
	}
	teamB := m.TeamB
	if teamB == nil {
		teamB = []uuid.UUID{}
	}
	resp := &MatchResponse{
		ID:          m.ID,
		Status:      m.Status,
		ScheduledAt: m.ScheduledAt,
		CaptainAID:  m.CaptainAID,
		CaptainBID:  m.CaptainBID,
		AvgELO:      m.AvgELO,
		MatchType:   m.MatchType,
		VenueID:     m.VenueID,
		SealedBy:    m.SealedBy,
		TeamA:       teamA,
		TeamB:       teamB,
		Sets:        []SetScore{},
		CreatedAt:   m.CreatedAt,
	}
	if m.Result != nil {
		resp.WinnerTeam = m.Result.WinnerTeam
		resp.TotalGamesA = m.Result.TotalGamesA
		resp.TotalGamesB = m.Result.TotalGamesB
		resp.GameDiff = m.Result.GameDiff
		if m.Result.Sets != nil {
			resp.Sets = m.Result.Sets
		}
	}
	return resp
}
