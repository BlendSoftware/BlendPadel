package trust

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/juani/blendpadel/backend/internal/db"
)

// TrustNotificationHookFn is an optional callback invoked when a player's trust score changes.
// playerID is the affected player, newScore is their updated trust score.
type TrustNotificationHookFn func(ctx context.Context, playerID uuid.UUID, newScore int)

// Service provides trust score penalization and recovery logic.
type Service struct {
	repo         Repository
	notifyHook   TrustNotificationHookFn
}

// NewService creates a new trust Service.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// SetNotificationHook registers an optional notification callback.
// It is called when a player's trust score drops below ThresholdVisible.
func (s *Service) SetNotificationHook(hook TrustNotificationHookFn) {
	s.notifyHook = hook
}

// applyDelta fetches the current trust score, applies delta, clamps to [0,100],
// persists the new score and the event, and returns the new score.
func (s *Service) applyDelta(ctx context.Context, playerID, refID uuid.UUID, eventType string, delta int) (int, error) {
	current, err := s.repo.GetTrustScore(ctx, playerID)
	if err != nil {
		return 0, fmt.Errorf("getting trust score: %w", err)
	}

	newScore := clamp(current+delta, MinTrustScore, MaxTrustScore)

	if err := s.repo.UpdateTrustScore(ctx, playerID, newScore); err != nil {
		return 0, fmt.Errorf("updating trust score: %w", err)
	}

	if err := s.repo.InsertTrustEvent(ctx, TrustEvent{
		PlayerID:    playerID,
		EventType:   eventType,
		Delta:       delta,
		ReferenceID: refID,
	}); err != nil {
		return 0, fmt.Errorf("inserting trust event: %w", err)
	}

	// Notify if score just crossed below the visibility threshold.
	if s.notifyHook != nil && delta < 0 && newScore < ThresholdVisible && current >= ThresholdVisible {
		s.notifyHook(ctx, playerID, newScore)
	}

	return newScore, nil
}

// PenalizeLateCancellation applies a -10 penalty for a late cancellation (<2h).
func (s *Service) PenalizeLateCancellation(ctx context.Context, playerID, matchID uuid.UUID) (int, error) {
	return s.applyDelta(ctx, playerID, matchID, EventLateCancellation, PenaltyLateCancellation)
}

// PenalizeDispute applies a dispute penalty.
// First dispute in 30 days: -5, no freeze.
// Second+ dispute in 30 days: -20, ELO freeze activated.
func (s *Service) PenalizeDispute(ctx context.Context, playerID, matchID uuid.UUID) (int, bool, error) {
	count, err := s.repo.CountRecentDisputes(ctx, playerID)
	if err != nil {
		return 0, false, fmt.Errorf("counting recent disputes: %w", err)
	}

	var (
		delta     int
		eventType string
		frozen    bool
	)

	if count == 0 {
		// First dispute.
		delta = PenaltyFirstDispute
		eventType = EventDispute
		frozen = false
	} else {
		// Systematic dispute (2nd or more in 30 days).
		delta = PenaltySystematicDispute
		eventType = EventSystematicDispute
		frozen = true
	}

	newScore, err := s.applyDelta(ctx, playerID, matchID, eventType, delta)
	if err != nil {
		return 0, false, err
	}

	if frozen {
		if err := s.repo.FreezeELO(ctx, playerID); err != nil {
			return 0, false, fmt.Errorf("freezing ELO: %w", err)
		}
	}

	return newScore, frozen, nil
}

// PenalizeConductReport applies a -15 penalty for a validated conduct report.
func (s *Service) PenalizeConductReport(ctx context.Context, playerID, reportID uuid.UUID) (int, error) {
	return s.applyDelta(ctx, playerID, reportID, EventConductReport, PenaltyConductReport)
}

// RecoverFromMatch applies a +2 trust score recovery for completing a match,
// subject to the monthly cap of +10.
// Returns the new score and actual points recovered (0 if cap reached).
func (s *Service) RecoverFromMatch(ctx context.Context, playerID, matchID uuid.UUID) (int, int, error) {
	current, err := s.repo.GetTrustScore(ctx, playerID)
	if err != nil {
		return 0, 0, fmt.Errorf("getting trust score: %w", err)
	}

	// Check monthly cap.
	monthlyRecovered, err := s.repo.GetMonthlyRecovery(ctx, playerID)
	if err != nil {
		return 0, 0, fmt.Errorf("getting monthly recovery: %w", err)
	}

	if monthlyRecovered >= RecoveryMonthlyCap {
		// Cap reached, no recovery.
		return current, 0, nil
	}

	if current >= MaxTrustScore {
		// Already at maximum.
		return current, 0, nil
	}

	// How much can we still recover this month?
	remaining := RecoveryMonthlyCap - monthlyRecovered
	delta := RecoveryPerMatch
	if delta > remaining {
		delta = remaining
	}

	newScore := clamp(current+delta, MinTrustScore, MaxTrustScore)
	actualRecovered := newScore - current

	if actualRecovered == 0 {
		return current, 0, nil
	}

	if err := s.repo.UpdateTrustScore(ctx, playerID, newScore); err != nil {
		return 0, 0, fmt.Errorf("updating trust score: %w", err)
	}

	if err := s.repo.InsertTrustEvent(ctx, TrustEvent{
		PlayerID:    playerID,
		EventType:   EventMatchCompleted,
		Delta:       actualRecovered,
		ReferenceID: matchID,
	}); err != nil {
		return 0, 0, fmt.Errorf("inserting trust event: %w", err)
	}

	return newScore, actualRecovered, nil
}

// RecoverFromMatchTx is like RecoverFromMatch but operates within an externally-managed transaction.
func (s *Service) RecoverFromMatchTx(ctx context.Context, tx pgx.Tx, playerID, matchID uuid.UUID) (int, int, error) {
	txRepo := NewPostgresRepo(db.New(tx))

	current, err := txRepo.GetTrustScore(ctx, playerID)
	if err != nil {
		return 0, 0, fmt.Errorf("getting trust score: %w", err)
	}

	monthlyRecovered, err := txRepo.GetMonthlyRecovery(ctx, playerID)
	if err != nil {
		return 0, 0, fmt.Errorf("getting monthly recovery: %w", err)
	}

	if monthlyRecovered >= RecoveryMonthlyCap || current >= MaxTrustScore {
		return current, 0, nil
	}

	remaining := RecoveryMonthlyCap - monthlyRecovered
	delta := RecoveryPerMatch
	if delta > remaining {
		delta = remaining
	}

	newScore := clamp(current+delta, MinTrustScore, MaxTrustScore)
	actualRecovered := newScore - current
	if actualRecovered == 0 {
		return current, 0, nil
	}

	if err := txRepo.UpdateTrustScore(ctx, playerID, newScore); err != nil {
		return 0, 0, fmt.Errorf("updating trust score: %w", err)
	}
	if err := txRepo.InsertTrustEvent(ctx, TrustEvent{
		PlayerID: playerID, EventType: EventMatchCompleted,
		Delta: actualRecovered, ReferenceID: matchID,
	}); err != nil {
		return 0, 0, fmt.Errorf("inserting trust event: %w", err)
	}

	return newScore, actualRecovered, nil
}
