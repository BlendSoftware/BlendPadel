package matchmaking

import (
	"context"
	"log"
	"time"
)

// FlareExpirer periodically expires flares whose expires_at has passed.
type FlareExpirer struct {
	svc      *Service
	ticker   *time.Ticker
	done     chan struct{}
	interval time.Duration
}

// NewFlareExpirer creates a new FlareExpirer that ticks on the given interval.
func NewFlareExpirer(svc *Service, interval time.Duration) *FlareExpirer {
	return &FlareExpirer{
		svc:      svc,
		ticker:   time.NewTicker(interval),
		done:     make(chan struct{}),
		interval: interval,
	}
}

// Start begins the expirer loop. It runs until the context is cancelled.
// This should be invoked as a goroutine: go expirer.Start(ctx)
func (e *FlareExpirer) Start(ctx context.Context) {
	log.Printf("[FlareExpirer] started with interval %s", e.interval)
	for {
		select {
		case <-e.ticker.C:
			count, err := e.svc.ExpireFlares(ctx)
			if err != nil {
				log.Printf("[FlareExpirer] error: %v", err)
			} else if count > 0 {
				log.Printf("[FlareExpirer] expired %d flares", count)
			}
		case <-ctx.Done():
			e.ticker.Stop()
			log.Printf("[FlareExpirer] stopped")
			return
		case <-e.done:
			e.ticker.Stop()
			log.Printf("[FlareExpirer] stopped")
			return
		}
	}
}

// Stop stops the expirer gracefully.
func (e *FlareExpirer) Stop() {
	close(e.done)
}
