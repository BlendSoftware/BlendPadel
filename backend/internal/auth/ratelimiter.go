package auth

import (
	"context"
	"sync"
	"time"
)

// RateLimiter is an in-memory, sliding-window rate limiter keyed by IP.
type RateLimiter struct {
	mu      sync.Mutex
	entries map[string][]time.Time
	limit   int
	window  time.Duration
}

// NewRateLimiter creates a RateLimiter and starts a background cleanup goroutine.
// The cleanup goroutine stops when ctx is cancelled.
func NewRateLimiter(ctx context.Context, limit int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		entries: make(map[string][]time.Time),
		limit:   limit,
		window:  window,
	}
	go rl.cleanup(ctx)
	return rl
}

// Allow checks whether the given IP is allowed to proceed.
// Returns (allowed, remaining, retryAfter).
// retryAfter is only meaningful when allowed == false.
func (rl *RateLimiter) Allow(ip string) (bool, int, time.Duration) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-rl.window)

	times := rl.entries[ip]
	// Remove entries outside the window.
	valid := times[:0]
	for _, t := range times {
		if t.After(cutoff) {
			valid = append(valid, t)
		}
	}
	rl.entries[ip] = valid

	if len(valid) >= rl.limit {
		// Calculate retry-after: time until the oldest entry leaves the window.
		oldest := valid[0]
		retryAfter := oldest.Add(rl.window).Sub(now)
		if retryAfter < 0 {
			retryAfter = 0
		}
		return false, 0, retryAfter
	}

	rl.entries[ip] = append(rl.entries[ip], now)
	remaining := rl.limit - len(rl.entries[ip])
	return true, remaining, 0
}

// Reset clears the rate limit counter for the given IP (called after successful login).
func (rl *RateLimiter) Reset(ip string) {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	delete(rl.entries, ip)
}

// cleanup removes stale entries every minute.
func (rl *RateLimiter) cleanup(ctx context.Context) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			rl.mu.Lock()
			now := time.Now()
			cutoff := now.Add(-rl.window)
			for ip, times := range rl.entries {
				valid := times[:0]
				for _, t := range times {
					if t.After(cutoff) {
						valid = append(valid, t)
					}
				}
				if len(valid) == 0 {
					delete(rl.entries, ip)
				} else {
					rl.entries[ip] = valid
				}
			}
			rl.mu.Unlock()
		}
	}
}
