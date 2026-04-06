package admin

import (
	"context"

	"github.com/google/uuid"
)

// Repository defines the data-access contract for the admin domain.
type Repository interface {
	// GetKPIs returns operational metrics.
	GetKPIs(ctx context.Context) (*KPIResponse, error)

	// ListModerators returns all users with role 'moderator'.
	ListModerators(ctx context.Context) ([]ModeratorResponse, error)

	// CreateModerator inserts a new user with role 'moderator'.
	CreateModerator(ctx context.Context, req ModeratorRequest) (*ModeratorResponse, error)

	// UpdateModerator updates the region_id of an existing moderator.
	UpdateModerator(ctx context.Context, id uuid.UUID, req ModeratorRequest) (*ModeratorResponse, error)

	// DeleteModerator demotes a moderator back to player role.
	DeleteModerator(ctx context.Context, id uuid.UUID) error

	// BanPlayer sets the player status to the given ban status.
	BanPlayer(ctx context.Context, playerID uuid.UUID, status string) error

	// UnbanPlayer restores the player status to 'active'.
	UnbanPlayer(ctx context.Context, playerID uuid.UUID) error

	// GetUserELO returns the current ELO for a user.
	GetUserELO(ctx context.Context, playerID uuid.UUID) (int, error)

	// UpdateUserELO sets the ELO for a user.
	UpdateUserELO(ctx context.Context, playerID uuid.UUID, newELO int) error

	// InsertELOHistory records a manual ELO adjustment in elo_history.
	InsertELOHistory(ctx context.Context, playerID uuid.UUID, eloBefore, eloAfter, delta int) error

	// InsertAuditLog records an admin action.
	InsertAuditLog(ctx context.Context, adminID uuid.UUID, action string, targetID *uuid.UUID, details any) error

	// ListAuditLog returns paginated audit log entries, optionally filtered by adminID.
	ListAuditLog(ctx context.Context, adminID *uuid.UUID, limit, offset int32) ([]AuditLogEntry, error)

	// CountAuditLog returns the total count for pagination.
	CountAuditLog(ctx context.Context, adminID *uuid.UUID) (int64, error)
}
