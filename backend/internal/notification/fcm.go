package notification

import (
	"context"

	"github.com/google/uuid"
)

// FCMNotifier is a stub implementation ready for Firebase Cloud Messaging.
// Fill in real FCM HTTP v1 API calls when credentials are available.
type FCMNotifier struct {
	credentials string // path or JSON string for FCM service account
}

// NewFCMNotifier creates a new FCMNotifier.
// credentials is the path to the FCM service account JSON or the raw JSON string.
func NewFCMNotifier(credentials string) *FCMNotifier {
	return &FCMNotifier{credentials: credentials}
}

// Send is a stub — returns nil until FCM credentials are wired.
func (f *FCMNotifier) Send(_ context.Context, _ uuid.UUID, _ Notification) error {
	// TODO: implement FCM HTTP v1 API call using f.credentials
	return nil
}

// SendMulticast is a stub — returns nil until FCM credentials are wired.
func (f *FCMNotifier) SendMulticast(_ context.Context, _ []uuid.UUID, _ Notification) error {
	// TODO: implement FCM multicast using f.credentials
	return nil
}
