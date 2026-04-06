package notification

// NotificationType identifies the kind of notification being sent.
type NotificationType string

const (
	TypeResultValidation  NotificationType = "result_validation"
	TypeReminder4h        NotificationType = "reminder_4h"
	TypeELOChange         NotificationType = "elo_change"
	TypeTrustWarning      NotificationType = "trust_warning"
	TypeUrgentMatchNearby NotificationType = "urgent_match_nearby"
)

// Notification is the payload sent to a player.
type Notification struct {
	Type  NotificationType
	Title string
	Body  string
	Data  map[string]string
}
