package player

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

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

func (r *postgresRepo) GetProfile(ctx context.Context, userID uuid.UUID) (*PlayerProfile, error) {
	row, err := r.q.GetPlayerProfile(ctx, uuidToPgtype(userID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	profile := &PlayerProfile{
		ID:                  pgtypeToUUID(row.ID),
		Email:               row.Email,
		Name:                row.Name.String,
		LastName:            row.LastName.String,
		Role:                row.Role,
		Status:              row.Status,
		ELO:                 int(row.Elo),
		Gender:              row.Gender,
		AvatarURL:           row.AvatarUrl.String,
		OnboardingCompleted: row.OnboardingCompleted,
		ValidatedMatchCount: int(row.ValidatedMatchCount),
		EloFrozen:           row.EloFrozen,
		TrustScore:          int(row.TrustScore),
		CreatedAt:           row.CreatedAt.Time,
	}

	if lat, ok := toFloat64(row.Latitude); ok {
		profile.Latitude = &lat
	}
	if lng, ok := toFloat64(row.Longitude); ok {
		profile.Longitude = &lng
	}

	return profile, nil
}

func (r *postgresRepo) UpdateProfile(ctx context.Context, userID uuid.UUID, lastName string, lat, lng float64) error {
	return r.q.UpdatePlayerProfile(ctx, db.UpdatePlayerProfileParams{
		ID:            uuidToPgtype(userID),
		LastName:      pgtype.Text{String: lastName, Valid: lastName != ""},
		StMakepoint:   lat,
		StMakepoint_2: lng,
	})
}

func (r *postgresRepo) UpdateProfileNameOnly(ctx context.Context, userID uuid.UUID, name, lastName string) error {
	return r.q.UpdatePlayerNameOnly(ctx, db.UpdatePlayerNameOnlyParams{
		ID:       uuidToPgtype(userID),
		Name:     name,
		LastName: lastName,
	})
}

func (r *postgresRepo) UpdateAvatar(ctx context.Context, userID uuid.UUID, avatarURL string) error {
	return r.q.UpdatePlayerAvatar(ctx, db.UpdatePlayerAvatarParams{
		ID:        uuidToPgtype(userID),
		AvatarUrl: pgtype.Text{String: avatarURL, Valid: avatarURL != ""},
	})
}

func (r *postgresRepo) CompleteOnboarding(ctx context.Context, userID uuid.UUID, elo int, gender string) error {
	return r.q.SetOnboardingCompleted(ctx, db.SetOnboardingCompletedParams{
		ID:     uuidToPgtype(userID),
		Elo:    int32(elo),
		Gender: gender,
	})
}

func (r *postgresRepo) SaveOnboardingResponses(ctx context.Context, userID uuid.UUID, responses json.RawMessage, calculatedELO int) error {
	return r.q.CreateOnboardingResponse(ctx, db.CreateOnboardingResponseParams{
		UserID:        uuidToPgtype(userID),
		Responses:     responses,
		CalculatedElo: int32(calculatedELO),
	})
}

func (r *postgresRepo) GetOnboardingResponses(ctx context.Context, userID uuid.UUID) (*OnboardingResponseRecord, error) {
	row, err := r.q.GetOnboardingResponse(ctx, uuidToPgtype(userID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &OnboardingResponseRecord{
		ID:            pgtypeToUUID(row.ID),
		UserID:        pgtypeToUUID(row.UserID),
		Responses:     json.RawMessage(row.Responses),
		CalculatedELO: int(row.CalculatedElo),
		CreatedAt:     row.CreatedAt.Time,
	}, nil
}

// --- EPIC 08: Perfil ---

func (r *postgresRepo) GetPublicProfile(ctx context.Context, playerID uuid.UUID) (*db.GetPublicProfileRow, error) {
	row, err := r.q.GetPublicProfile(ctx, uuidToPgtype(playerID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &row, nil
}

func (r *postgresRepo) GetOwnProfile(ctx context.Context, playerID uuid.UUID) (*db.GetOwnProfileRow, error) {
	row, err := r.q.GetOwnProfile(ctx, uuidToPgtype(playerID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &row, nil
}

func (r *postgresRepo) UpdatePreferences(ctx context.Context, playerID uuid.UUID, prefs Preferences) error {
	prefsJSON, err := json.Marshal(prefs)
	if err != nil {
		return fmt.Errorf("marshal preferences: %w", err)
	}
	return r.q.UpdatePreferences(ctx, db.UpdatePreferencesParams{
		ID:          uuidToPgtype(playerID),
		Preferences: prefsJSON,
	})
}

func (r *postgresRepo) CreateReport(ctx context.Context, arg db.CreateReportParams) (db.ConductReport, error) {
	report, err := r.q.CreateReport(ctx, arg)
	if err != nil {
		// Map unique constraint violation to domain error.
		if isUniqueViolation(err, "unique_report_per_match") {
			return db.ConductReport{}, ErrAlreadyReported
		}
		return db.ConductReport{}, err
	}
	return report, nil
}

func (r *postgresRepo) GetReportsByRegion(ctx context.Context, regionID uuid.UUID, statusFilter string, limit, offset int32) ([]db.ConductReport, error) {
	return r.q.GetReportsByRegion(ctx, db.GetReportsByRegionParams{
		RegionID: uuidToPgtype(regionID),
		Column2:  statusFilter,
		Limit:    limit,
		Offset:   offset,
	})
}

func (r *postgresRepo) IsMatchParticipant(ctx context.Context, matchID, playerID uuid.UUID) (bool, error) {
	return r.q.IsMatchParticipant(ctx, db.IsMatchParticipantParams{
		MatchID:  uuidToPgtype(matchID),
		PlayerID: uuidToPgtype(playerID),
	})
}

func (r *postgresRepo) IsMatchCompleted(ctx context.Context, matchID uuid.UUID) (bool, error) {
	return r.q.IsMatchCompleted(ctx, uuidToPgtype(matchID))
}

func (r *postgresRepo) CountReportsByRegion(ctx context.Context, regionID uuid.UUID, statusFilter string) (int64, error) {
	return r.q.CountReportsByRegion(ctx, db.CountReportsByRegionParams{
		RegionID: uuidToPgtype(regionID),
		Column2:  statusFilter,
	})
}

func (r *postgresRepo) SearchByName(ctx context.Context, query string) ([]PlayerSearchResult, error) {
	rows, err := r.q.SearchPlayersByName(ctx, pgtype.Text{String: query, Valid: true})
	if err != nil {
		return nil, fmt.Errorf("search players by name: %w", err)
	}

	results := make([]PlayerSearchResult, 0, len(rows))
	for _, row := range rows {
		results = append(results, PlayerSearchResult{
			ID:        pgtypeToUUID(row.ID),
			Name:      row.Name.String,
			ELO:       row.Elo,
			AvatarURL: row.AvatarUrl.String,
			Gender:    row.Gender,
		})
	}
	return results, nil
}

// isUniqueViolation checks if the error is a PostgreSQL unique constraint violation
// for a specific constraint name.
func isUniqueViolation(err error, constraintName string) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	return contains(errStr, "unique_violation") || contains(errStr, constraintName) ||
		contains(errStr, "ERROR: duplicate key") || contains(errStr, "23505")
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && indexStr(s, substr) >= 0)
}

func indexStr(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}

// --- helpers ---

func uuidToPgtype(id uuid.UUID) pgtype.UUID {
	return pgtype.UUID{Bytes: id, Valid: true}
}

func pgtypeToUUID(p pgtype.UUID) uuid.UUID {
	return uuid.UUID(p.Bytes)
}

// toFloat64 attempts to convert the interface{} returned by PostGIS ST_Y/ST_X to a float64.
func toFloat64(v interface{}) (float64, bool) {
	if v == nil {
		return 0, false
	}
	switch val := v.(type) {
	case float64:
		return val, true
	case float32:
		return float64(val), true
	case int64:
		return float64(val), true
	case []byte:
		// pgx may return numeric as []byte string
		var f float64
		if err := json.Unmarshal(val, &f); err == nil {
			return f, true
		}
	}
	return 0, false
}
