package venue

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/juani/blendpadel/backend/internal/db"
)

// postgresRepo is the PostgreSQL implementation of Repository.
type postgresRepo struct {
	q *db.Queries
}

// NewPostgresRepo creates a new Repository backed by the given sqlc Queries.
func NewPostgresRepo(q *db.Queries) Repository {
	return &postgresRepo{q: q}
}

func (r *postgresRepo) Create(ctx context.Context, callerID uuid.UUID, req CreateVenueRequest) (*VenueResponse, error) {
	regionID := pgtype.UUID{}
	if req.RegionID != nil {
		regionID = uuidToPg(*req.RegionID)
	}

	row, err := r.q.CreateVenue(ctx, db.CreateVenueParams{
		Name:       req.Name,
		Address:    req.Address,
		Lng:        req.Lng,
		Lat:        req.Lat,
		CourtCount: req.CourtCount,
		Phone:      pgtype.Text{String: req.Phone, Valid: req.Phone != ""},
		Hours:      req.Hours,
		RegionID:   regionID,
		AddedBy:    uuidToPg(callerID),
	})
	if err != nil {
		return nil, err
	}
	return mapCreateRow(row), nil
}

func (r *postgresRepo) GetByID(ctx context.Context, id uuid.UUID) (*VenueResponse, error) {
	row, err := r.q.GetVenueByID(ctx, uuidToPg(id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return mapGetByIDRow(row), nil
}

func (r *postgresRepo) GetNearby(ctx context.Context, lat, lng, radiusMeters float64, limit, offset int32) ([]VenueResponse, error) {
	rows, err := r.q.GetVenuesNearby(ctx, db.GetVenuesNearbyParams{
		Lng:          lng,
		Lat:          lat,
		RadiusMeters: radiusMeters,
		PageLimit:    limit,
		PageOffset:   offset,
	})
	if err != nil {
		return nil, err
	}

	venues := make([]VenueResponse, 0, len(rows))
	for _, row := range rows {
		v := VenueResponse{
			ID:             pgToUUID(row.ID),
			Name:           row.Name,
			Address:        row.Address,
			Lat:            toFloat64(row.Lat),
			Lng:            toFloat64(row.Lng),
			CourtCount:     row.CourtCount,
			Phone:          row.Phone.String,
			Hours:          row.Hours,
			AddedBy:        pgToUUID(row.AddedBy),
			Verified:       row.Verified,
			DistanceMeters: toFloat64(row.DistanceMeters),
			CreatedAt:      row.CreatedAt.Time,
		}
		if row.RegionID.Valid {
			id := pgToUUID(row.RegionID)
			v.RegionID = &id
		}
		venues = append(venues, v)
	}
	return venues, nil
}

func (r *postgresRepo) Update(ctx context.Context, id uuid.UUID, req UpdateVenueRequest, verified bool) (*VenueResponse, error) {
	row, err := r.q.UpdateVenue(ctx, db.UpdateVenueParams{
		ID:         uuidToPg(id),
		Name:       req.Name,
		Address:    req.Address,
		CourtCount: req.CourtCount,
		Phone:      req.Phone,
		Hours:      req.Hours,
		Verified:   verified,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return mapUpdateRow(row), nil
}

// --- helpers ---

func uuidToPg(id uuid.UUID) pgtype.UUID {
	return pgtype.UUID{Bytes: id, Valid: true}
}

func pgToUUID(p pgtype.UUID) uuid.UUID {
	return uuid.UUID(p.Bytes)
}

func toFloat64(v interface{}) float64 {
	switch x := v.(type) {
	case float64:
		return x
	case float32:
		return float64(x)
	case int64:
		return float64(x)
	case int32:
		return float64(x)
	case []byte:
		var f float64
		if err := json.Unmarshal(x, &f); err == nil {
			return f
		}
	}
	return 0
}

func mapCreateRow(row db.CreateVenueRow) *VenueResponse {
	v := &VenueResponse{
		ID:         pgToUUID(row.ID),
		Name:       row.Name,
		Address:    row.Address,
		Lat:        toFloat64(row.Lat),
		Lng:        toFloat64(row.Lng),
		CourtCount: row.CourtCount,
		Phone:      row.Phone.String,
		Hours:      row.Hours,
		AddedBy:    pgToUUID(row.AddedBy),
		Verified:   row.Verified,
		CreatedAt:  row.CreatedAt.Time,
	}
	if row.RegionID.Valid {
		id := pgToUUID(row.RegionID)
		v.RegionID = &id
	}
	return v
}

func mapGetByIDRow(row db.GetVenueByIDRow) *VenueResponse {
	v := &VenueResponse{
		ID:         pgToUUID(row.ID),
		Name:       row.Name,
		Address:    row.Address,
		Lat:        toFloat64(row.Lat),
		Lng:        toFloat64(row.Lng),
		CourtCount: row.CourtCount,
		Phone:      row.Phone.String,
		Hours:      row.Hours,
		AddedBy:    pgToUUID(row.AddedBy),
		Verified:   row.Verified,
		CreatedAt:  row.CreatedAt.Time,
	}
	if row.RegionID.Valid {
		id := pgToUUID(row.RegionID)
		v.RegionID = &id
	}
	return v
}

func mapUpdateRow(row db.UpdateVenueRow) *VenueResponse {
	v := &VenueResponse{
		ID:         pgToUUID(row.ID),
		Name:       row.Name,
		Address:    row.Address,
		Lat:        toFloat64(row.Lat),
		Lng:        toFloat64(row.Lng),
		CourtCount: row.CourtCount,
		Phone:      row.Phone.String,
		Hours:      row.Hours,
		AddedBy:    pgToUUID(row.AddedBy),
		Verified:   row.Verified,
		CreatedAt:  row.CreatedAt.Time,
	}
	if row.RegionID.Valid {
		id := pgToUUID(row.RegionID)
		v.RegionID = &id
	}
	return v
}
