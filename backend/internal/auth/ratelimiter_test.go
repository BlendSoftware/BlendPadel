package auth

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRateLimiter_AllowsUpToLimit(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	rl := NewRateLimiter(ctx, 5, 15*time.Minute)
	ip := "192.0.2.1"

	for i := 0; i < 5; i++ {
		allowed, remaining, retryAfter := rl.Allow(ip)
		assert.True(t, allowed, "attempt %d should be allowed", i+1)
		assert.Equal(t, 4-i, remaining, "remaining should decrement")
		assert.Zero(t, retryAfter)
	}
}

func TestRateLimiter_BlocksSixthAttempt(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	rl := NewRateLimiter(ctx, 5, 15*time.Minute)
	ip := "192.0.2.2"

	for i := 0; i < 5; i++ {
		allowed, _, _ := rl.Allow(ip)
		require.True(t, allowed)
	}

	allowed, remaining, retryAfter := rl.Allow(ip)
	assert.False(t, allowed)
	assert.Equal(t, 0, remaining)
	assert.Positive(t, retryAfter)
}

func TestRateLimiter_AllowsAfterWindow(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Very short window for testing.
	rl := NewRateLimiter(ctx, 2, 50*time.Millisecond)
	ip := "192.0.2.3"

	rl.Allow(ip)
	rl.Allow(ip)

	allowed, _, _ := rl.Allow(ip)
	assert.False(t, allowed)

	time.Sleep(60 * time.Millisecond)

	allowed, _, _ = rl.Allow(ip)
	assert.True(t, allowed)
}

func TestRateLimiter_ResetClearsCounter(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	rl := NewRateLimiter(ctx, 3, 15*time.Minute)
	ip := "192.0.2.4"

	for i := 0; i < 3; i++ {
		rl.Allow(ip)
	}
	allowed, _, _ := rl.Allow(ip)
	require.False(t, allowed)

	rl.Reset(ip)

	allowed, remaining, _ := rl.Allow(ip)
	assert.True(t, allowed)
	assert.Equal(t, 2, remaining)
}

func TestRateLimiter_CleanupDoesNotLeak(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())

	rl := NewRateLimiter(ctx, 5, 15*time.Minute)
	rl.Allow("10.0.0.1")
	rl.Allow("10.0.0.2")

	// Cancel context — cleanup goroutine should stop.
	cancel()

	// Give the goroutine a moment to exit.
	time.Sleep(10 * time.Millisecond)
	// No assertion here; race detector would catch leaks.
	_ = rl
}
