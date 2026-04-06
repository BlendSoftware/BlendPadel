package notification

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

const (
	// dedupWindowReminder is how long to suppress duplicate reminder notifications.
	dedupWindowReminder = 25 * time.Hour
	// dedupWindowELO is how long to suppress duplicate ELO change notifications.
	dedupWindowELO = 1 * time.Hour
	// dedupWindowTrust is how long to suppress duplicate trust warning notifications.
	dedupWindowTrust = 6 * time.Hour
	// dedupWindowResult is how long to suppress duplicate result validation notifications.
	dedupWindowResult = 24 * time.Hour
)

// Service orchestrates notification delivery with deduplication.
type Service struct {
	repo     Repository
	notifier Notifier
}

// NewService creates a new notification Service.
func NewService(repo Repository, notifier Notifier) *Service {
	return &Service{repo: repo, notifier: notifier}
}

// UpsertDeviceToken registers or refreshes a device token for a player.
func (s *Service) UpsertDeviceToken(ctx context.Context, playerID uuid.UUID, token, platform string) error {
	return s.repo.UpsertDeviceToken(ctx, playerID, token, platform)
}

// DeleteDeviceToken removes a device token for a player.
func (s *Service) DeleteDeviceToken(ctx context.Context, playerID uuid.UUID, token string) error {
	return s.repo.DeleteDeviceToken(ctx, playerID, token)
}

// SendResultValidation notifies captain_b that a result is awaiting confirmation.
func (s *Service) SendResultValidation(ctx context.Context, captainBID, matchID uuid.UUID) error {
	return s.sendWithDedup(ctx, captainBID, TypeResultValidation, matchID, dedupWindowResult, Notification{
		Type:  TypeResultValidation,
		Title: "Resultado pendiente de confirmación",
		Body:  "El capitán A subió el resultado. Tenés 6 horas para confirmar o disputar.",
		Data:  map[string]string{"match_id": matchID.String()},
	})
}

// SendReminder notifies captain_b about an upcoming 4h deadline.
func (s *Service) SendReminder(ctx context.Context, captainBID, matchID uuid.UUID) error {
	return s.sendWithDedup(ctx, captainBID, TypeReminder4h, matchID, dedupWindowReminder, Notification{
		Type:  TypeReminder4h,
		Title: "Recordatorio: confirmá el resultado",
		Body:  "Te quedan ~2 horas para confirmar o disputar el resultado del partido.",
		Data:  map[string]string{"match_id": matchID.String()},
	})
}

// SendELOChange notifies a player of a significant ELO change after a sealed match.
// delta is positive for gains, negative for losses.
func (s *Service) SendELOChange(ctx context.Context, playerID uuid.UUID, delta int, matchID uuid.UUID) error {
	var title, body string
	if delta > 0 {
		title = fmt.Sprintf("+%d puntos ELO!", delta)
		body = "Tu ranking subió después del último partido."
	} else {
		title = fmt.Sprintf("%d puntos ELO", delta)
		body = "Tu ranking bajó después del último partido."
	}
	return s.sendWithDedup(ctx, playerID, TypeELOChange, matchID, dedupWindowELO, Notification{
		Type:  TypeELOChange,
		Title: title,
		Body:  body,
		Data:  map[string]string{"match_id": matchID.String(), "delta": fmt.Sprintf("%d", delta)},
	})
}

// SendTrustWarning notifies a player that their trust score dropped below the threshold.
func (s *Service) SendTrustWarning(ctx context.Context, playerID uuid.UUID, newScore int) error {
	// Use playerID as referenceID so one warning per player per dedup window.
	return s.sendWithDedup(ctx, playerID, TypeTrustWarning, playerID, dedupWindowTrust, Notification{
		Type:  TypeTrustWarning,
		Title: "Tu confianza bajó",
		Body:  fmt.Sprintf("Tu puntaje de confianza es %d. Si baja más, dejás de aparecer en búsquedas.", newScore),
		Data:  map[string]string{"trust_score": fmt.Sprintf("%d", newScore)},
	})
}

// SendUrgentMatch notifies multiple players of an urgent nearby match opportunity.
func (s *Service) SendUrgentMatch(ctx context.Context, playerIDs []uuid.UUID, matchID uuid.UUID) error {
	n := Notification{
		Type:  TypeUrgentMatchNearby,
		Title: "Partido urgente cerca tuyo",
		Body:  "Se formó un partido cerca de tu zona. ¡Unite ahora!",
		Data:  map[string]string{"match_id": matchID.String()},
	}
	for _, pid := range playerIDs {
		if err := s.sendWithDedup(ctx, pid, TypeUrgentMatchNearby, matchID, dedupWindowResult, n); err != nil {
			log.Error().Err(err).Str("player_id", pid.String()).Msg("failed to send urgent match notification")
		}
	}
	return nil
}

// sendWithDedup checks the dedup log before sending. If already sent within the window, skips.
func (s *Service) sendWithDedup(ctx context.Context, playerID uuid.UUID, notifType NotificationType, referenceID uuid.UUID, window time.Duration, n Notification) error {
	already, err := s.repo.CheckNotificationSent(ctx, playerID, notifType, referenceID, window)
	if err != nil {
		log.Error().Err(err).Str("type", string(notifType)).Msg("dedup check failed, sending anyway")
		// On dedup error, proceed to avoid blocking notifications.
	}
	if already {
		log.Debug().
			Str("player_id", playerID.String()).
			Str("type", string(notifType)).
			Str("reference_id", referenceID.String()).
			Msg("notification skipped (dedup)")
		return nil
	}

	if err := s.notifier.Send(ctx, playerID, n); err != nil {
		return fmt.Errorf("send notification: %w", err)
	}

	if logErr := s.repo.InsertNotificationLog(ctx, playerID, notifType, referenceID); logErr != nil {
		log.Error().Err(logErr).Str("type", string(notifType)).Msg("failed to insert notification log")
		// Non-fatal: notification was sent, just dedup record failed.
	}

	return nil
}
