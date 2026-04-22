package radar

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// Repository is the persistence interface for the radar domain.
type Repository interface {
	GetMatches(ctx context.Context, params GetMatchesDBParams) ([]RadarMatch, error)
	GetAlerts(ctx context.Context, params GetAlertsDBParams) ([]RadarMatch, error)
}

// GetMatchesDBParams are the database-level params for GetMatches.
type GetMatchesDBParams struct {
	Lat           float64
	Lng           float64
	RadiusMeters  float64
	ELOMin        int32
	ELOMax        int32
	CursorTime    pgtype.Timestamptz // zero value = no cursor
	CursorID      pgtype.UUID        // zero value = no cursor
	ViewerID      uuid.UUID
	Limit         int32
}

// GetAlertsDBParams are the database-level params for GetAlerts.
type GetAlertsDBParams struct {
	Lat          float64
	Lng          float64
	ViewerID     uuid.UUID
	RadiusMeters float64
}

// zeroTimestamp returns a null pgtype.Timestamptz (no cursor = first page).
func zeroTimestamp() pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: time.Time{}, Valid: false}
}

// zeroUUID returns a null pgtype.UUID.
func zeroUUID() pgtype.UUID {
	return pgtype.UUID{Valid: false}
}
