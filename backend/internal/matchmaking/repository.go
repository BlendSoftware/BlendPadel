package matchmaking

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// FlareRow is the internal representation of a flare from the DB.
type FlareRow struct {
	ID          uuid.UUID
	PlayerID    uuid.UUID
	Lat         float64
	Lng         float64
	ScheduledAt time.Time
	EloMin      int32
	EloMax      int32
	MinPlayers  int32
	MaxPlayers  int32
	MatchType   string
	VenueID     *uuid.UUID
	Status      string
	MatchID     *uuid.UUID
	ExpiresAt   time.Time
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// FlareListRow is the flare row returned from GetActiveFlares (includes computed columns).
type FlareListRow struct {
	FlareRow
	CreatorName     string
	DistanceMeters  float64
	RespondentCount int32
}

// GetActiveFlaresParams holds the query parameters for GetActiveFlares.
type GetActiveFlaresParams struct {
	Lat           float64
	Lng           float64
	RadiusMeters  float64
	ViewerID      uuid.UUID
	MinTrustScore int32
	CursorAt      time.Time
	CursorID      uuid.UUID
	PageSize      int32
}

// Repository defines the data-access contract for the matchmaking domain.
type Repository interface {
	CreateFlare(ctx context.Context, playerID uuid.UUID, req CreateFlareRequest) (*FlareRow, error)
	GetActiveFlareByPlayer(ctx context.Context, playerID uuid.UUID) (*FlareRow, error)
	GetActiveFlares(ctx context.Context, params GetActiveFlaresParams) ([]FlareListRow, error)
	GetActiveFlaresByMatchType(ctx context.Context, params GetActiveFlaresParams, matchType string) ([]FlareListRow, error)
	GetFlareByID(ctx context.Context, id uuid.UUID) (*FlareRow, error)
	GetFlareByIDForUpdate(ctx context.Context, tx pgx.Tx, id uuid.UUID) (*FlareRow, error)
	UpdateFlareStatus(ctx context.Context, tx pgx.Tx, id uuid.UUID, status string, matchID *uuid.UUID) (*FlareRow, error)
	CancelFlare(ctx context.Context, id, playerID uuid.UUID) (*FlareRow, error)
	ExpireOldFlares(ctx context.Context) (int64, error)
	AddRespondent(ctx context.Context, tx pgx.Tx, flareID, playerID uuid.UUID) error
	AddRespondentDirect(ctx context.Context, flareID, playerID uuid.UUID) error
	CountRespondents(ctx context.Context, tx pgx.Tx, flareID uuid.UUID) (int32, error)
	GetRespondents(ctx context.Context, tx pgx.Tx, flareID uuid.UUID) ([]uuid.UUID, error)
}
