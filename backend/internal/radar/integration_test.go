//go:build integration

package radar_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"

	"github.com/juani/blendpadel/backend/internal/db"
	"github.com/juani/blendpadel/backend/internal/platform/database"
	"github.com/juani/blendpadel/backend/internal/radar"
	"github.com/juani/blendpadel/backend/migrations"
)

// --- helpers ---

func setupRadarDB(t *testing.T) (*pgxpool.Pool, *db.Queries) {
	t.Helper()
	ctx := context.Background()

	pgContainer, err := tcpostgres.Run(ctx,
		"postgis/postgis:16-3.4-alpine",
		tcpostgres.WithDatabase("testdb"),
		tcpostgres.WithUsername("testuser"),
		tcpostgres.WithPassword("testpass"),
		tcpostgres.BasicWaitStrategies(),
	)
	if err != nil {
		t.Fatalf("failed to start postgres container: %v", err)
	}
	t.Cleanup(func() {
		if err := pgContainer.Terminate(ctx); err != nil {
			t.Logf("failed to terminate container: %v", err)
		}
	})

	connStr, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatalf("failed to get connection string: %v", err)
	}

	if err := database.RunMigrations(connStr, migrations.FS()); err != nil {
		t.Fatalf("failed to run migrations: %v", err)
	}

	pool, err := pgxpool.New(ctx, connStr)
	if err != nil {
		t.Fatalf("failed to create pool: %v", err)
	}
	t.Cleanup(pool.Close)

	return pool, db.New(pool)
}

// createTestPlayer creates a user with the given trust and ELO scores.
func createTestPlayer(t *testing.T, ctx context.Context, pool *pgxpool.Pool, q *db.Queries, email string, elo int, trustScore int) uuid.UUID {
	t.Helper()
	user, err := q.CreateUser(ctx, db.CreateUserParams{
		Email:        email,
		PasswordHash: "hash",
		Name:         pgtype.Text{String: "TestPlayer", Valid: true},
	})
	require.NoError(t, err)

	_, err = pool.Exec(ctx,
		`UPDATE users SET onboarding_completed=true, elo=$2, status='active', trust_score=$3 WHERE id=$1`,
		user.ID, elo, trustScore,
	)
	require.NoError(t, err)

	return uuid.UUID(user.ID.Bytes)
}

// seedMatch inserts a match into the DB and returns its ID.
// lat/lng use geographic convention: lat=Y, lng=X.
func seedMatch(t *testing.T, ctx context.Context, pool *pgxpool.Pool, captainAID, captainBID uuid.UUID, lat, lng float64, avgElo int, scheduledAt time.Time) uuid.UUID {
	t.Helper()

	var matchID pgtype.UUID
	err := pool.QueryRow(ctx,
		`INSERT INTO matches (status, scheduled_at, location, captain_a_id, captain_b_id, avg_elo)
		 VALUES ('pending_result', $1, ST_MakePoint($3, $2)::geography, $4, $5, $6)
		 RETURNING id`,
		scheduledAt,
		lat, lng, // lat=Y, lng=X — ST_MakePoint(lng, lat)
		pgtype.UUID{Bytes: captainAID, Valid: true},
		pgtype.UUID{Bytes: captainBID, Valid: true},
		avgElo,
	).Scan(&matchID)
	require.NoError(t, err)

	return uuid.UUID(matchID.Bytes)
}

// newRadarService builds a ready-to-use Service backed by the test DB.
func newRadarService(q *db.Queries) *radar.Service {
	repo := radar.NewPostgresRadarRepo(q)
	return radar.NewService(repo)
}

// --- tests ---

// TestIntegration_GetMatches verifies radius, ELO, trust, and pagination filters.
func TestIntegration_GetMatches(t *testing.T) {
	pool, q := setupRadarDB(t)
	ctx := context.Background()

	// Buenos Aires city centre ~(-34.603722, -58.381592)
	baseLat := -34.603722
	baseLng := -58.381592

	// Viewer: elo=1200, trust=80 (high trust)
	viewer := createTestPlayer(t, ctx, pool, q, "viewer@radar.test", 1200, 80)
	captainB := createTestPlayer(t, ctx, pool, q, "captainb@radar.test", 1200, 80)

	// Match 1: inside radius (1km), inside ELO range — SHOULD appear
	captainA1 := createTestPlayer(t, ctx, pool, q, "captain1@radar.test", 1200, 80)
	_ = seedMatch(t, ctx, pool, captainA1, captainB, baseLat+0.003, baseLng, 1200, time.Now().Add(2*time.Hour))

	// Match 2: inside radius (2km), inside ELO range — SHOULD appear
	captainA2 := createTestPlayer(t, ctx, pool, q, "captain2@radar.test", 1100, 80)
	_ = seedMatch(t, ctx, pool, captainA2, captainB, baseLat+0.01, baseLng, 1100, time.Now().Add(3*time.Hour))

	// Match 3: outside radius (100km north) — should NOT appear
	captainA3 := createTestPlayer(t, ctx, pool, q, "captain3@radar.test", 1200, 80)
	_ = seedMatch(t, ctx, pool, captainA3, captainB, baseLat+1.0, baseLng, 1200, time.Now().Add(4*time.Hour))

	// Match 4: inside radius but ELO too high — should NOT appear
	captainA4 := createTestPlayer(t, ctx, pool, q, "captain4@radar.test", 2000, 80)
	_ = seedMatch(t, ctx, pool, captainA4, captainB, baseLat+0.003, baseLng, 2000, time.Now().Add(5*time.Hour))

	// Match 5: inside radius, ELO ok, but captain has low trust — should NOT appear for high-trust viewer
	captainA5 := createTestPlayer(t, ctx, pool, q, "captain5@radar.test", 1200, 50) // trust < 70
	_ = seedMatch(t, ctx, pool, captainA5, captainB, baseLat+0.003, baseLng, 1200, time.Now().Add(6*time.Hour))

	svc := newRadarService(q)

	result, err := svc.GetMatches(ctx, radar.GetMatchesParams{
		ViewerUserID: viewer,
		Lat:          baseLat,
		Lng:          baseLng,
		RadiusKm:     10,
		ELOMin:       900,
		ELOMax:       1400,
		PageSize:     20,
	})
	require.NoError(t, err)
	assert.Len(t, result.Items, 2, "should return exactly 2 matches (within radius, ELO range, trust OK)")
	assert.Nil(t, result.NextCursor, "no next page expected")

	// Assert distance_meters is populated.
	for _, m := range result.Items {
		assert.Greater(t, m.DistanceMeters, 0.0, "distance_meters should be populated")
	}
}

// TestIntegration_GetMatches_Pagination verifies cursor pagination works.
func TestIntegration_GetMatches_Pagination(t *testing.T) {
	pool, q := setupRadarDB(t)
	ctx := context.Background()

	baseLat := -34.603722
	baseLng := -58.381592

	viewer := createTestPlayer(t, ctx, pool, q, "viewer2@radar.test", 1200, 80)
	captainB := createTestPlayer(t, ctx, pool, q, "captainb2@radar.test", 1200, 80)

	// Seed 5 matches within radius + ELO range.
	for i := 0; i < 5; i++ {
		cap := createTestPlayer(t, ctx, pool, q, "pgcap"+strconv(i)+"@radar.test", 1200, 80)
		// Spread them slightly in lat so distances differ.
		_ = seedMatch(t, ctx, pool, cap, captainB,
			baseLat+float64(i)*0.001, baseLng, 1200,
			time.Now().Add(time.Duration(i+1)*time.Hour),
		)
	}

	svc := newRadarService(q)

	// Page 1: get 3.
	page1, err := svc.GetMatches(ctx, radar.GetMatchesParams{
		ViewerUserID: viewer,
		Lat:          baseLat,
		Lng:          baseLng,
		RadiusKm:     10,
		ELOMin:       900,
		ELOMax:       1400,
		PageSize:     3,
	})
	require.NoError(t, err)
	assert.Len(t, page1.Items, 3)
	require.NotNil(t, page1.NextCursor, "should have a next cursor")

	// Page 2: use cursor.
	cursor, err := radar.DecodeCursor(*page1.NextCursor)
	require.NoError(t, err)

	page2, err := svc.GetMatches(ctx, radar.GetMatchesParams{
		ViewerUserID: viewer,
		Lat:          baseLat,
		Lng:          baseLng,
		RadiusKm:     10,
		ELOMin:       900,
		ELOMax:       1400,
		PageSize:     3,
		Cursor:       cursor,
	})
	require.NoError(t, err)
	assert.Len(t, page2.Items, 2, "remaining 2 items on page 2")
	assert.Nil(t, page2.NextCursor, "no next page on last page")

	// Verify no overlap between pages.
	page1IDs := make(map[uuid.UUID]bool)
	for _, m := range page1.Items {
		page1IDs[m.ID] = true
	}
	for _, m := range page2.Items {
		assert.False(t, page1IDs[m.ID], "duplicate match ID found across pages")
	}
}

// TestIntegration_GetAlerts verifies hard-coded radius (5km) and time (1h) thresholds.
func TestIntegration_GetAlerts(t *testing.T) {
	pool, q := setupRadarDB(t)
	ctx := context.Background()

	baseLat := -34.603722
	baseLng := -58.381592

	viewer := createTestPlayer(t, ctx, pool, q, "viewer3@radar.test", 1200, 80)
	captainB := createTestPlayer(t, ctx, pool, q, "captainb3@radar.test", 1200, 80)

	// Match A: < 1h + < 5km — SHOULD appear
	captainA := createTestPlayer(t, ctx, pool, q, "alertcap1@radar.test", 1200, 80)
	_ = seedMatch(t, ctx, pool, captainA, captainB, baseLat+0.002, baseLng, 1200, time.Now().Add(30*time.Minute))

	// Match B: > 1h + < 5km — should NOT appear
	captainB2 := createTestPlayer(t, ctx, pool, q, "alertcap2@radar.test", 1200, 80)
	_ = seedMatch(t, ctx, pool, captainB2, captainB, baseLat+0.002, baseLng, 1200, time.Now().Add(2*time.Hour))

	// Match C: < 1h + > 5km — should NOT appear (about 40km away)
	captainC := createTestPlayer(t, ctx, pool, q, "alertcap3@radar.test", 1200, 80)
	_ = seedMatch(t, ctx, pool, captainC, captainB, baseLat+0.4, baseLng, 1200, time.Now().Add(30*time.Minute))

	svc := newRadarService(q)

	result, err := svc.GetAlerts(ctx, radar.GetAlertsParams{
		ViewerUserID: viewer,
		Lat:          baseLat,
		Lng:          baseLng,
	})
	require.NoError(t, err)
	assert.Len(t, result.Items, 1, "only the urgent nearby match should appear")
}

// TestIntegration_TrustFilter verifies trust visibility logic.
func TestIntegration_TrustFilter(t *testing.T) {
	pool, q := setupRadarDB(t)
	ctx := context.Background()

	baseLat := -34.603722
	baseLng := -58.381592

	captainB := createTestPlayer(t, ctx, pool, q, "captainbtrust@radar.test", 1200, 80)

	// High-trust viewer (trust=80, above ThresholdVisible=70)
	highTrustViewer := createTestPlayer(t, ctx, pool, q, "htvviewer@radar.test", 1200, 80)

	// Low-trust viewer (trust=50, below ThresholdVisible=70)
	lowTrustViewer := createTestPlayer(t, ctx, pool, q, "ltvviewer@radar.test", 1200, 50)

	// Captain with LOW trust (trust=50) — visible to low-trust viewer, NOT to high-trust viewer
	lowTrustCaptain := createTestPlayer(t, ctx, pool, q, "lowtrustcap@radar.test", 1200, 50)
	_ = seedMatch(t, ctx, pool, lowTrustCaptain, captainB, baseLat+0.002, baseLng, 1200, time.Now().Add(2*time.Hour))

	// Captain with HIGH trust (trust=80) — visible to both viewers
	highTrustCaptain := createTestPlayer(t, ctx, pool, q, "hightrustcap@radar.test", 1200, 80)
	_ = seedMatch(t, ctx, pool, highTrustCaptain, captainB, baseLat+0.003, baseLng, 1200, time.Now().Add(3*time.Hour))

	svc := newRadarService(q)

	params := func(viewer uuid.UUID) radar.GetMatchesParams {
		return radar.GetMatchesParams{
			ViewerUserID: viewer,
			Lat:          baseLat,
			Lng:          baseLng,
			RadiusKm:     10,
			ELOMin:       900,
			ELOMax:       1400,
			PageSize:     20,
		}
	}

	// High-trust viewer: sees only the high-trust captain match.
	resultHigh, err := svc.GetMatches(ctx, params(highTrustViewer))
	require.NoError(t, err)
	assert.Len(t, resultHigh.Items, 1, "high-trust viewer should see only high-trust captain match")
	assert.Equal(t, highTrustCaptain, resultHigh.Items[0].CaptainID)

	// Low-trust viewer: sees both matches (trust filter doesn't apply).
	resultLow, err := svc.GetMatches(ctx, params(lowTrustViewer))
	require.NoError(t, err)
	assert.Len(t, resultLow.Items, 2, "low-trust viewer should see all matches")
}

// strconv is a helper to convert int to string for test data generation.
func strconv(i int) string {
	return string(rune('0' + i))
}
