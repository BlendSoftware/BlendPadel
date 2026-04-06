package notification

import (
	"context"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// MockNotifier logs notifications to zerolog instead of sending real push messages.
// Used for local development and all tests.
type MockNotifier struct{}

// NewMockNotifier creates a new MockNotifier.
func NewMockNotifier() *MockNotifier {
	return &MockNotifier{}
}

// Send logs the notification at Info level.
func (m *MockNotifier) Send(_ context.Context, playerID uuid.UUID, n Notification) error {
	log.Info().
		Str("player_id", playerID.String()).
		Str("type", string(n.Type)).
		Str("title", n.Title).
		Str("body", n.Body).
		Interface("data", n.Data).
		Msg("[MockNotifier] notification sent")
	return nil
}

// SendMulticast logs the notification for each player.
func (m *MockNotifier) SendMulticast(ctx context.Context, playerIDs []uuid.UUID, n Notification) error {
	for _, pid := range playerIDs {
		if err := m.Send(ctx, pid, n); err != nil {
			return err
		}
	}
	return nil
}
