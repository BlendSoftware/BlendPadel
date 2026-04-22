package match

import (
	"context"
	"time"

	"github.com/rs/zerolog/log"
)

// AutoSealer periodically seals matches that have been in awaiting_confirmation
// for more than 6 hours without a response from captain_b.
type AutoSealer struct {
	service  *Service
	interval time.Duration
}

// NewAutoSealer creates a new AutoSealer that runs on the given interval.
func NewAutoSealer(svc *Service, interval time.Duration) *AutoSealer {
	return &AutoSealer{
		service:  svc,
		interval: interval,
	}
}

// Start begins the auto-sealer loop. It runs until the context is cancelled.
// This should be invoked as a goroutine: go sealer.Start(ctx)
func (a *AutoSealer) Start(ctx context.Context) {
	ticker := time.NewTicker(a.interval)
	defer ticker.Stop()

	log.Info().Dur("interval", a.interval).Msg("auto-sealer started")

	for {
		select {
		case <-ctx.Done():
			log.Info().Msg("auto-sealer stopped")
			return
		case <-ticker.C:
			a.sealExpiredMatches(ctx)
		}
	}
}

// RunOnce executes a single sealing tick. Useful for testing.
func (a *AutoSealer) RunOnce(ctx context.Context) {
	a.sealExpiredMatches(ctx)
}

// sealExpiredMatches fetches all matches that have been awaiting confirmation
// for more than 6 hours and seals them automatically.
func (a *AutoSealer) sealExpiredMatches(ctx context.Context) {
	matches, err := a.service.repo.GetPendingSealMatches(ctx)
	if err != nil {
		log.Error().Err(err).Msg("auto-sealer: failed to fetch pending seal matches")
		return
	}

	for _, m := range matches {
		matchID := m.ID

		current, err := a.service.repo.GetMatchWithPlayers(ctx, matchID)
		if err != nil {
			log.Error().Err(err).Str("match_id", matchID.String()).Msg("auto-sealer: failed to fetch match")
			continue
		}

		if current.Status != StatusAwaitingConfirmation {
			continue
		}

		if err := a.service.sealMatchAtomic(ctx, current, "auto"); err != nil {
			log.Error().Err(err).Str("match_id", matchID.String()).Msg("auto-sealer: failed to seal match")
			continue
		}

		log.Info().
			Str("match_id", matchID.String()).
			Msg("auto-sealer: match auto-sealed after 6h window")
	}
}
