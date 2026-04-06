package notification

import (
	"context"

	"github.com/google/uuid"
)

// Notifier is the abstraction for push notification delivery.
// Implementations include MockNotifier (dev/test) and FCMNotifier (production).
type Notifier interface {
	// Send delivers a notification to a single player.
	Send(ctx context.Context, playerID uuid.UUID, n Notification) error

	// SendMulticast delivers a notification to multiple players.
	SendMulticast(ctx context.Context, playerIDs []uuid.UUID, n Notification) error
}
