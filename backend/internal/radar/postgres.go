package radar

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/juani/blendpadel/backend/internal/db"
)

// postgresRadarRepo is the PostgreSQL implementation of Repository.
type postgresRadarRepo struct {
	q *db.Queries
}

// NewPostgresRadarRepo creates a new Repository backed by the given sqlc Queries.
func NewPostgresRadarRepo(q *db.Queries) Repository {
	return &postgresRadarRepo{q: q}
}

func (r *postgresRadarRepo) GetMatches(ctx context.Context, p GetMatchesDBParams) ([]RadarMatch, error) {
	rows, err := r.q.GetRadarMatches(ctx, db.GetRadarMatchesParams{
		StMakepoint:   p.Lat,
		StMakepoint_2: p.Lng,
		StDwithin:     p.RadiusMeters,
		AvgElo:        pgtype.Int4{Int32: p.ELOMin, Valid: true},
		AvgElo_2:      pgtype.Int4{Int32: p.ELOMax, Valid: true},
		Column6:       p.CursorTime,
		Column7:       p.CursorID,
		ID:            uuidToPg(p.ViewerID),
		Limit:         p.Limit,
	})
	if err != nil {
		return nil, err
	}

	return mapRows(rows), nil
}

func (r *postgresRadarRepo) GetAlerts(ctx context.Context, p GetAlertsDBParams) ([]RadarMatch, error) {
	rows, err := r.q.GetRadarAlerts(ctx, db.GetRadarAlertsParams{
		StMakepoint:   p.Lat,
		StMakepoint_2: p.Lng,
		ID:            uuidToPg(p.ViewerID),
	})
	if err != nil {
		return nil, err
	}

	return mapAlertRows(rows), nil
}

// --- helpers ---

func mapRows(rows []db.GetRadarMatchesRow) []RadarMatch {
	out := make([]RadarMatch, 0, len(rows))
	for _, row := range rows {
		out = append(out, RadarMatch{
			ID:             pgToUUID(row.ID),
			CaptainID:      pgToUUID(row.CaptainID),
			CaptainName:    row.CaptainName.String,
			Lat:            row.Lat,
			Lng:            row.Lng,
			DistanceMeters: row.DistanceMeters,
			AvgELO:         row.AvgElo.Int32,
			ScheduledAt:    row.ScheduledAt.Time,
			JoinedCount:    row.JoinedCount,
		})
	}
	return out
}

func mapAlertRows(rows []db.GetRadarAlertsRow) []RadarMatch {
	out := make([]RadarMatch, 0, len(rows))
	for _, row := range rows {
		out = append(out, RadarMatch{
			ID:             pgToUUID(row.ID),
			CaptainID:      pgToUUID(row.CaptainID),
			CaptainName:    row.CaptainName.String,
			Lat:            row.Lat,
			Lng:            row.Lng,
			DistanceMeters: row.DistanceMeters,
			AvgELO:         row.AvgElo.Int32,
			ScheduledAt:    row.ScheduledAt.Time,
			JoinedCount:    row.JoinedCount,
		})
	}
	return out
}

func uuidToPg(id uuid.UUID) pgtype.UUID {
	return pgtype.UUID{Bytes: id, Valid: true}
}

func pgToUUID(p pgtype.UUID) uuid.UUID {
	return uuid.UUID(p.Bytes)
}
