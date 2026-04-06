package admin

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

// Sentinel errors.
var (
	ErrPlayerNotFound    = errors.New("player not found")
	ErrModeratorNotFound = errors.New("moderator not found")
	ErrInvalidBanType    = errors.New("invalid ban type; must be 'soft' or 'hard'")
)

// KPIResponse holds the operational metrics returned by GET /admin/kpis.
type KPIResponse struct {
	TotalPlayers     int64   `json:"total_players"`
	ActivePlayers    int64   `json:"active_players"`
	BannedPlayers    int64   `json:"banned_players"`
	TotalMatches     int64   `json:"total_matches"`
	CompletedMatches int64   `json:"completed_matches"`
	PendingDisputes  int64   `json:"pending_disputes"`
	AvgELO           float64 `json:"avg_elo"`
	TotalModerators  int64   `json:"total_moderators"`
}

// ModeratorRequest is the body for POST/PUT /admin/moderators.
type ModeratorRequest struct {
	// For creation only — provide either UserID (promote existing) or Email+Password+Name (new user).
	UserID   *uuid.UUID `json:"user_id,omitempty"`
	Email    string     `json:"email,omitempty"`
	Password string     `json:"password,omitempty"`
	Name     string     `json:"name,omitempty"`
	LastName string     `json:"last_name,omitempty"`
	RegionID uuid.UUID  `json:"region_id"`
}

// ModeratorResponse is returned by moderator list/create/update.
type ModeratorResponse struct {
	ID        uuid.UUID  `json:"id"`
	Email     string     `json:"email"`
	Name      string     `json:"name"`
	LastName  string     `json:"last_name,omitempty"`
	Role      string     `json:"role"`
	Status    string     `json:"status"`
	RegionID  *uuid.UUID `json:"region_id,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

// BanRequest is the body for POST /admin/players/{id}/ban.
type BanRequest struct {
	// Type must be "soft" or "hard".
	Type   string `json:"type"`
	Reason string `json:"reason,omitempty"`
}

// ELOAdjustRequest is the body for POST /admin/players/{id}/elo-adjust.
type ELOAdjustRequest struct {
	Delta  int    `json:"delta"`
	Reason string `json:"reason,omitempty"`
}

// AuditLogEntry is a single row from admin_audit_log.
type AuditLogEntry struct {
	ID           uuid.UUID  `json:"id"`
	AdminID      uuid.UUID  `json:"admin_id"`
	Action       string     `json:"action"`
	TargetUserID *uuid.UUID `json:"target_user_id,omitempty"`
	Details      []byte     `json:"details,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
}

// AuditLogListResponse is the paginated response for GET /admin/audit-log.
type AuditLogListResponse struct {
	Entries []AuditLogEntry `json:"entries"`
	Total   int64           `json:"total"`
}
