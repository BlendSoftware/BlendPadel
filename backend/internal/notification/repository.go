package notification

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// Repository defines the data-access contract for notification storage.
type Repository interface {
	// UpsertDeviceToken registers or refreshes a device token for a player.
	UpsertDeviceToken(ctx context.Context, playerID uuid.UUID, token, platform string) error

	// DeleteDeviceToken removes a device token for a player.
	DeleteDeviceToken(ctx context.Context, playerID uuid.UUID, token string) error

	// GetDeviceTokensByPlayer returns all active tokens for a player.
	GetDeviceTokensByPlayer(ctx context.Context, playerID uuid.UUID) ([]string, error)

	// InsertNotificationLog records that a notification was sent.
	InsertNotificationLog(ctx context.Context, playerID uuid.UUID, notifType NotificationType, referenceID uuid.UUID) error

	// CheckNotificationSent returns true if the notification was already sent within the dedup window.
	CheckNotificationSent(ctx context.Context, playerID uuid.UUID, notifType NotificationType, referenceID uuid.UUID, dedupWindow time.Duration) (bool, error)
}
