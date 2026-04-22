//go:build integration

package matchmaking_test

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"

	"github.com/juani/blendpadel/backend/internal/db"
	"github.com/juani/blendpadel/backend/internal/match"
	"github.com/juani/blendpadel/backend/internal/matchmaking"
	"github.com/juani/blendpadel/backend/internal/platform/database"
	"github.com/juani/blendpadel/backend/internal/ranking"
	"github.com/juani/blendpadel/backend/internal/trust"
	"github.com/juani/blendpadel/backend/migrations"
)

func setupMatchmakingDB(t *testing.T) (*pgxpool.Pool, *db.Queries) {
	t.Helper()
	ctx := context.Background()

	pgContainer, err := tcpostgres.Run(ctx,
		"postgis/postgis:16-3.4-alpine",
		tcpostgres.WithDatabase("testdb"),
		tcpostgres.WithUsername("testuser"),
		tcpostgres.WithPassword("testpass"),
		tcpostgres.BasicWaitStrategies(),
	)
	require.NoError(t, err, "start postgres container")
	t.Cleanup(func() {
		if err := pgContainer.Terminate(ctx); err != nil {
			t.Logf("failed to terminate container: %v", err)
		}
	})

	connStr, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
	require.NoError(t, err, "get connection string")

	require.NoError(t, database.RunMigrations(connStr, migrations.FS()), "run migrations")

	pool, err := pgxpool.New(ctx, connStr)
	require.NoError(t, err, "create pool")
	t.Cleanup(pool.Close)

	return pool, db.New(pool)
}

func createTestPlayer(t *testing.T, ctx context.Context, pool *pgxpool.Pool, q *db.Queries, email string) uuid.UUID {
	t.Helper()
	user, err := q.CreateUser(ctx, db.CreateUserParams{
		Email:        email,
		PasswordHash: "hash",
		Name:         pgtype.Text{String: "TestPlayer", Valid: true},
	})
	require.NoError(t, err, "creating test player %s", email)

	_, err = pool.Exec(ctx,
		`UPDATE users SET onboarding_completed=true, elo=1200, status='active', trust_score=80 WHERE id=$1`,
		user.ID,
	)
	require.NoError(t, err)

	return uuid.UUID(user.ID.Bytes)
}

func newTestMatchService(t *testing.T, pool *pgxpool.Pool, q *db.Queries) *match.Service {
	t.Helper()
	matchRepo := match.NewPostgresRepo(q, pool)
	rankingRepo := ranking.NewPostgresRepo(q)
	rankingSvc := ranking.NewService(pool, rankingRepo)
	trustRepo := trust.NewPostgresRepo(q)
	trustSvc := trust.NewService(trustRepo)
	return match.NewService(matchRepo, rankingSvc, trustSvc)
}

func newTestMatchmakingService(t *testing.T, pool *pgxpool.Pool, q *db.Queries) *matchmaking.Service {
	t.Helper()
	flareRepo := matchmaking.NewPostgresFlareRepo(pool, q)
	matchSvc := newTestMatchService(t, pool, q)
	return matchmaking.NewService(flareRepo, matchSvc, pool)
}

// --- CreateFlare tests ---

func TestCreateFlare_HappyPath(t *testing.T) {
	pool, q := setupMatchmakingDB(t)
	ctx := context.Background()

	playerID := createTestPlayer(t, ctx, pool, q, "creator@flare.test")
	svc := newTestMatchmakingService(t, pool, q)

	req := matchmaking.CreateFlareRequest{
		Lat:         -33.0,
		Lng:         -68.0,
		ScheduledAt: time.Now().Add(2 * time.Hour),
		ELOMin:      800,
		ELOMax:      1600,
		MinPlayers:  2,
		MaxPlayers:  4,
	}

	resp, err := svc.CreateFlare(ctx, playerID, req)
	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, resp.ID)
	assert.Equal(t, "active", resp.Status)
	assert.Equal(t, int32(2), resp.MinPlayers)
	assert.Equal(t, int32(4), resp.MaxPlayers)
	assert.Equal(t, int32(800), resp.ELOMin)
}

func TestCreateFlare_DuplicateActiveFlare(t *testing.T) {
	pool, q := setupMatchmakingDB(t)
	ctx := context.Background()

	playerID := createTestPlayer(t, ctx, pool, q, "dup@flare.test")
	svc := newTestMatchmakingService(t, pool, q)

	req := matchmaking.CreateFlareRequest{
		Lat:         -33.0,
		Lng:         -68.0,
		ScheduledAt: time.Now().Add(2 * time.Hour),
		ELOMin:      0,
		ELOMax:      3000,
		MinPlayers:  2,
		MaxPlayers:  4,
	}

	_, err := svc.CreateFlare(ctx, playerID, req)
	require.NoError(t, err)

	_, err = svc.CreateFlare(ctx, playerID, req)
	assert.ErrorIs(t, err, matchmaking.ErrActiveFlareExists)
}

func TestCreateFlare_InvalidScheduledAt(t *testing.T) {
	pool, q := setupMatchmakingDB(t)
	ctx := context.Background()

	playerID := createTestPlayer(t, ctx, pool, q, "past@flare.test")
	svc := newTestMatchmakingService(t, pool, q)

	req := matchmaking.CreateFlareRequest{
		Lat:         -33.0,
		Lng:         -68.0,
		ScheduledAt: time.Now().Add(-1 * time.Hour), // past
		ELOMin:      0,
		ELOMax:      3000,
		MinPlayers:  2,
		MaxPlayers:  4,
	}

	_, err := svc.CreateFlare(ctx, playerID, req)
	assert.Error(t, err)
}

func TestCreateFlare_InvalidLatLng(t *testing.T) {
	pool, q := setupMatchmakingDB(t)
	ctx := context.Background()

	playerID := createTestPlayer(t, ctx, pool, q, "latbad@flare.test")
	svc := newTestMatchmakingService(t, pool, q)

	req := matchmaking.CreateFlareRequest{
		Lat:         200.0, // out of bounds
		Lng:         -68.0,
		ScheduledAt: time.Now().Add(2 * time.Hour),
		ELOMin:      0,
		ELOMax:      3000,
		MinPlayers:  2,
		MaxPlayers:  4,
	}

	_, err := svc.CreateFlare(ctx, playerID, req)
	assert.Error(t, err)
}

// --- GetFlares tests ---

func TestGetFlares_ProximityAndELOFilter(t *testing.T) {
	pool, q := setupMatchmakingDB(t)
	ctx := context.Background()

	viewer := createTestPlayer(t, ctx, pool, q, "viewer@flare.test")
	// Viewer ELO is 1200 (set in createTestPlayer)

	// Set viewer location
	_, err := pool.Exec(ctx, `UPDATE users SET location = ST_MakePoint($1, $2)::geography WHERE id = $3`, -68.0, -33.0, viewer)
	require.NoError(t, err)

	creator1 := createTestPlayer(t, ctx, pool, q, "nearby1@flare.test") // ELO range includes 1200
	creator2 := createTestPlayer(t, ctx, pool, q, "nearby2@flare.test") // ELO range includes 1200
	creator3 := createTestPlayer(t, ctx, pool, q, "faraway@flare.test") // outside radius
	creator4 := createTestPlayer(t, ctx, pool, q, "elobad@flare.test")  // ELO range excludes 1200

	svc := newTestMatchmakingService(t, pool, q)

	// Flare 1: within radius, ELO includes viewer
	_, err = svc.CreateFlare(ctx, creator1, matchmaking.CreateFlareRequest{
		Lat: -33.001, Lng: -68.001,
		ScheduledAt: time.Now().Add(2 * time.Hour),
		ELOMin: 800, ELOMax: 1600, MinPlayers: 2, MaxPlayers: 4,
	})
	require.NoError(t, err)

	// Flare 2: within radius, ELO includes viewer
	_, err = svc.CreateFlare(ctx, creator2, matchmaking.CreateFlareRequest{
		Lat: -33.002, Lng: -68.002,
		ScheduledAt: time.Now().Add(2 * time.Hour),
		ELOMin: 1000, ELOMax: 1400, MinPlayers: 2, MaxPlayers: 4,
	})
	require.NoError(t, err)

	// Flare 3: outside radius (~1000 km away)
	_, err = svc.CreateFlare(ctx, creator3, matchmaking.CreateFlareRequest{
		Lat: 40.0, Lng: -3.0, // Madrid
		ScheduledAt: time.Now().Add(2 * time.Hour),
		ELOMin: 800, ELOMax: 1600, MinPlayers: 2, MaxPlayers: 4,
	})
	require.NoError(t, err)

	// Flare 4: within radius but ELO excludes viewer (viewer is 1200, flare wants 1500-2000)
	_, err = svc.CreateFlare(ctx, creator4, matchmaking.CreateFlareRequest{
		Lat: -33.003, Lng: -68.003,
		ScheduledAt: time.Now().Add(2 * time.Hour),
		ELOMin: 1500, ELOMax: 2000, MinPlayers: 2, MaxPlayers: 4,
	})
	require.NoError(t, err)

	result, err := svc.GetFlares(ctx, viewer, matchmaking.GetFlaresParams{
		Lat:      -33.0,
		Lng:      -68.0,
		RadiusKm: 10,
		PageSize: 20,
		ViewerID: viewer,
	})
	require.NoError(t, err)
	assert.Len(t, result.Items, 2, "only 2 flares should match (within radius + ELO)")

	// Check distance_meters is populated
	for _, item := range result.Items {
		assert.Greater(t, item.DistanceMeters, 0.0, "distance_meters should be > 0")
	}
}

func TestGetFlares_CursorPagination(t *testing.T) {
	pool, q := setupMatchmakingDB(t)
	ctx := context.Background()

	viewer := createTestPlayer(t, ctx, pool, q, "pagviewer@flare.test")

	// Create 3 flares all within radius and ELO range
	for i := 0; i < 3; i++ {
		creator := createTestPlayer(t, ctx, pool, q, "pagcreator"+string(rune('a'+i))+"@flare.test")
		_, err := pool.Exec(ctx, `UPDATE users SET trust_score=80 WHERE id=$1`, creator)
		require.NoError(t, err)

		svc := newTestMatchmakingService(t, pool, q)
		_, err = svc.CreateFlare(ctx, creator, matchmaking.CreateFlareRequest{
			Lat: -33.0 + float64(i)*0.001, Lng: -68.0,
			ScheduledAt: time.Now().Add(time.Duration(i+1) * time.Hour),
			ELOMin: 800, ELOMax: 1600, MinPlayers: 2, MaxPlayers: 4,
		})
		require.NoError(t, err)
		time.Sleep(5 * time.Millisecond) // ensure ordering
	}

	svc := newTestMatchmakingService(t, pool, q)

	// Get first page of 2
	page1, err := svc.GetFlares(ctx, viewer, matchmaking.GetFlaresParams{
		Lat: -33.0, Lng: -68.0, RadiusKm: 10,
		PageSize: 2, ViewerID: viewer,
	})
	require.NoError(t, err)
	assert.Len(t, page1.Items, 2)
	assert.NotNil(t, page1.NextCursor)

	// Get second page using cursor
	page2, err := svc.GetFlares(ctx, viewer, matchmaking.GetFlaresParams{
		Lat: -33.0, Lng: -68.0, RadiusKm: 10,
		PageSize: 2, ViewerID: viewer,
		Cursor: page1.NextCursor,
	})
	require.NoError(t, err)
	assert.Len(t, page2.Items, 1)
	assert.Nil(t, page2.NextCursor) // no more pages
}

// --- RespondToFlare tests ---

func TestRespondToFlare_NoMatchYet(t *testing.T) {
	pool, q := setupMatchmakingDB(t)
	ctx := context.Background()

	creator := createTestPlayer(t, ctx, pool, q, "creator-nm@flare.test")
	responder := createTestPlayer(t, ctx, pool, q, "responder-nm@flare.test")
	svc := newTestMatchmakingService(t, pool, q)

	flare, err := svc.CreateFlare(ctx, creator, matchmaking.CreateFlareRequest{
		Lat: -33.0, Lng: -68.0,
		ScheduledAt: time.Now().Add(2 * time.Hour),
		ELOMin: 0, ELOMax: 3000, MinPlayers: 3, MaxPlayers: 4,
	})
	require.NoError(t, err)

	// Only 1 respondent, min_players=3 → should stay active
	resp, err := svc.RespondToFlare(ctx, flare.ID, responder)
	require.NoError(t, err)
	assert.Equal(t, "active", resp.Status)
	assert.Nil(t, resp.MatchID)
	assert.Equal(t, int32(1), resp.RespondentCount)
}

func TestRespondToFlare_TriggersMatchCreation(t *testing.T) {
	pool, q := setupMatchmakingDB(t)
	ctx := context.Background()

	creator := createTestPlayer(t, ctx, pool, q, "creator-mc@flare.test")
	responder1 := createTestPlayer(t, ctx, pool, q, "resp1-mc@flare.test")
	svc := newTestMatchmakingService(t, pool, q)

	flare, err := svc.CreateFlare(ctx, creator, matchmaking.CreateFlareRequest{
		Lat: -33.0, Lng: -68.0,
		ScheduledAt: time.Now().Add(2 * time.Hour),
		ELOMin: 0, ELOMax: 3000, MinPlayers: 2, MaxPlayers: 4,
	})
	require.NoError(t, err)

	// creator responds first (respondent 1)
	_, err = svc.RespondToFlare(ctx, flare.ID, creator)
	require.NoError(t, err)

	// responder1 is respondent 2 → min_players=2 → should trigger match
	resp, err := svc.RespondToFlare(ctx, flare.ID, responder1)
	require.NoError(t, err)
	assert.Equal(t, "matched", resp.Status)
	assert.NotNil(t, resp.MatchID)

	// Verify match was created in DB
	var count int
	err = pool.QueryRow(ctx, `SELECT COUNT(*) FROM matches WHERE id = $1`, resp.MatchID).Scan(&count)
	require.NoError(t, err)
	assert.Equal(t, 1, count)
}

func TestRespondToFlare_Concurrency(t *testing.T) {
	pool, q := setupMatchmakingDB(t)
	ctx := context.Background()

	creator := createTestPlayer(t, ctx, pool, q, "creator-cc@flare.test")
	resp1 := createTestPlayer(t, ctx, pool, q, "resp1-cc@flare.test")
	resp2 := createTestPlayer(t, ctx, pool, q, "resp2-cc@flare.test")

	svc := newTestMatchmakingService(t, pool, q)

	flare, err := svc.CreateFlare(ctx, creator, matchmaking.CreateFlareRequest{
		Lat: -33.0, Lng: -68.0,
		ScheduledAt: time.Now().Add(2 * time.Hour),
		ELOMin: 0, ELOMax: 3000, MinPlayers: 2, MaxPlayers: 4,
	})
	require.NoError(t, err)

	// Pre-add creator as first respondent
	_, err = svc.RespondToFlare(ctx, flare.ID, creator)
	require.NoError(t, err)

	// Two goroutines try to be the second respondent simultaneously
	var wg sync.WaitGroup
	var successes int
	var mu sync.Mutex
	var errs []error

	for _, pid := range []uuid.UUID{resp1, resp2} {
		wg.Add(1)
		go func(playerID uuid.UUID) {
			defer wg.Done()
			_, err := svc.RespondToFlare(ctx, flare.ID, playerID)
			mu.Lock()
			defer mu.Unlock()
			if err == nil {
				successes++
			} else {
				errs = append(errs, err)
			}
		}(pid)
	}
	wg.Wait()

	// One or both may succeed (both get inserted), but the match should only be created once
	var matchCount int
	err = pool.QueryRow(ctx, `SELECT COUNT(*) FROM matches WHERE id IN (SELECT match_id FROM matchmaking_flares WHERE id = $1)`, flare.ID).Scan(&matchCount)
	require.NoError(t, err)
	assert.LessOrEqual(t, matchCount, 1, "at most one match should be created")

	t.Logf("successes=%d errors=%d matchCount=%d", successes, len(errs), matchCount)
}

// --- CancelFlare tests ---

func TestCancelFlare_OwnerCancels(t *testing.T) {
	pool, q := setupMatchmakingDB(t)
	ctx := context.Background()

	owner := createTestPlayer(t, ctx, pool, q, "owner@cancel.test")
	svc := newTestMatchmakingService(t, pool, q)

	flare, err := svc.CreateFlare(ctx, owner, matchmaking.CreateFlareRequest{
		Lat: -33.0, Lng: -68.0,
		ScheduledAt: time.Now().Add(2 * time.Hour),
		ELOMin: 0, ELOMax: 3000, MinPlayers: 2, MaxPlayers: 4,
	})
	require.NoError(t, err)

	err = svc.CancelFlare(ctx, flare.ID, owner)
	require.NoError(t, err)

	// Verify status is cancelled
	var status string
	err = pool.QueryRow(ctx, `SELECT status FROM matchmaking_flares WHERE id = $1`, flare.ID).Scan(&status)
	require.NoError(t, err)
	assert.Equal(t, "cancelled", status)
}

func TestCancelFlare_NonOwner(t *testing.T) {
	pool, q := setupMatchmakingDB(t)
	ctx := context.Background()

	owner := createTestPlayer(t, ctx, pool, q, "owner2@cancel.test")
	nonOwner := createTestPlayer(t, ctx, pool, q, "nonowner@cancel.test")
	svc := newTestMatchmakingService(t, pool, q)

	flare, err := svc.CreateFlare(ctx, owner, matchmaking.CreateFlareRequest{
		Lat: -33.0, Lng: -68.0,
		ScheduledAt: time.Now().Add(2 * time.Hour),
		ELOMin: 0, ELOMax: 3000, MinPlayers: 2, MaxPlayers: 4,
	})
	require.NoError(t, err)

	err = svc.CancelFlare(ctx, flare.ID, nonOwner)
	assert.ErrorIs(t, err, matchmaking.ErrFlareNotFound) // CancelFlare returns ErrFlareNotFound for not-owned
}

func TestCancelFlare_AlreadyCancelled(t *testing.T) {
	pool, q := setupMatchmakingDB(t)
	ctx := context.Background()

	owner := createTestPlayer(t, ctx, pool, q, "owner3@cancel.test")
	svc := newTestMatchmakingService(t, pool, q)

	flare, err := svc.CreateFlare(ctx, owner, matchmaking.CreateFlareRequest{
		Lat: -33.0, Lng: -68.0,
		ScheduledAt: time.Now().Add(2 * time.Hour),
		ELOMin: 0, ELOMax: 3000, MinPlayers: 2, MaxPlayers: 4,
	})
	require.NoError(t, err)

	err = svc.CancelFlare(ctx, flare.ID, owner)
	require.NoError(t, err)

	// Try to cancel again
	err = svc.CancelFlare(ctx, flare.ID, owner)
	assert.ErrorIs(t, err, matchmaking.ErrFlareNotFound)
}

// --- ExpireFlares tests ---

func TestExpireFlares(t *testing.T) {
	pool, q := setupMatchmakingDB(t)
	ctx := context.Background()

	p1 := createTestPlayer(t, ctx, pool, q, "exp1@flare.test")
	p2 := createTestPlayer(t, ctx, pool, q, "exp2@flare.test")
	p3 := createTestPlayer(t, ctx, pool, q, "exp3@flare.test")
	svc := newTestMatchmakingService(t, pool, q)

	// Create 2 flares, then manually set expires_at to past
	flare1, err := svc.CreateFlare(ctx, p1, matchmaking.CreateFlareRequest{
		Lat: -33.0, Lng: -68.0,
		ScheduledAt: time.Now().Add(2 * time.Hour),
		ELOMin: 0, ELOMax: 3000, MinPlayers: 2, MaxPlayers: 4,
	})
	require.NoError(t, err)

	flare2, err := svc.CreateFlare(ctx, p2, matchmaking.CreateFlareRequest{
		Lat: -33.0, Lng: -68.0,
		ScheduledAt: time.Now().Add(2 * time.Hour),
		ELOMin: 0, ELOMax: 3000, MinPlayers: 2, MaxPlayers: 4,
	})
	require.NoError(t, err)

	// Create 1 flare with future expiry (should NOT be expired)
	_, err = svc.CreateFlare(ctx, p3, matchmaking.CreateFlareRequest{
		Lat: -33.0, Lng: -68.0,
		ScheduledAt: time.Now().Add(2 * time.Hour),
		ELOMin: 0, ELOMax: 3000, MinPlayers: 2, MaxPlayers: 4,
	})
	require.NoError(t, err)

	// Manually set flare1 and flare2 to expired in past
	_, err = pool.Exec(ctx, `UPDATE matchmaking_flares SET expires_at = NOW() - INTERVAL '1 hour' WHERE id IN ($1, $2)`, flare1.ID, flare2.ID)
	require.NoError(t, err)

	count, err := svc.ExpireFlares(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(2), count)

	// Verify p3's flare is still active
	var status string
	err = pool.QueryRow(ctx, `SELECT status FROM matchmaking_flares WHERE player_id = $1`, p3).Scan(&status)
	require.NoError(t, err)
	assert.Equal(t, "active", status)
}
