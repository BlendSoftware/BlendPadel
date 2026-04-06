package leaderboard_test

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
	"github.com/juani/blendpadel/backend/internal/leaderboard"
	"github.com/juani/blendpadel/backend/internal/platform/database"
	"github.com/juani/blendpadel/backend/internal/ranking"
	"github.com/juani/blendpadel/backend/migrations"
)

// --- test helpers ---

func setupLeaderboardDB(t *testing.T) (*pgxpool.Pool, *db.Queries) {
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
			t.Logf("terminate container: %v", err)
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

// createRegion inserts a test region and returns its UUID.
func createRegion(t *testing.T, ctx context.Context, pool *pgxpool.Pool, name string) uuid.UUID {
	t.Helper()
	var id pgtype.UUID
	err := pool.QueryRow(ctx,
		`INSERT INTO regions (name) VALUES ($1) RETURNING id`, name,
	).Scan(&id)
	require.NoError(t, err, "create region %s", name)
	return uuid.UUID(id.Bytes)
}

// createActivePlayer inserts an active player in a given region with a specific ELO.
func createActivePlayer(t *testing.T, ctx context.Context, pool *pgxpool.Pool, q *db.Queries,
	email string, elo int, regionID uuid.UUID) uuid.UUID {
	t.Helper()
	user, err := q.CreateUser(ctx, db.CreateUserParams{
		Email:        email,
		PasswordHash: "hash",
		Name:         pgtype.Text{String: "Player", Valid: true},
	})
	require.NoError(t, err, "create user %s", email)

	_, err = pool.Exec(ctx,
		`UPDATE users SET status='active', elo=$1, validated_match_count=10, region_id=$2 WHERE id=$3`,
		elo, pgtype.UUID{Bytes: regionID, Valid: true}, user.ID,
	)
	require.NoError(t, err, "set active status and elo for %s", email)

	return uuid.UUID(user.ID.Bytes)
}

// createInactivePlayer inserts a non-active player in a region.
func createInactivePlayer(t *testing.T, ctx context.Context, pool *pgxpool.Pool, q *db.Queries,
	email string, elo int, regionID uuid.UUID) uuid.UUID {
	t.Helper()
	user, err := q.CreateUser(ctx, db.CreateUserParams{
		Email:        email,
		PasswordHash: "hash",
		Name:         pgtype.Text{String: "Inactive", Valid: true},
	})
	require.NoError(t, err, "create inactive user %s", email)

	_, err = pool.Exec(ctx,
		`UPDATE users SET status='inactive', elo=$1, region_id=$2 WHERE id=$3`,
		elo, pgtype.UUID{Bytes: regionID, Valid: true}, user.ID,
	)
	require.NoError(t, err)

	return uuid.UUID(user.ID.Bytes)
}

func newService(q *db.Queries) (*leaderboard.Service, leaderboard.Repository) {
	repo := leaderboard.NewPostgresRepo(q)
	rankingRepo := ranking.NewPostgresRepo(q)
	svc := leaderboard.NewService(repo, rankingRepo)
	return svc, repo
}

// --- tests ---

func TestGetRanking_OrderByELODesc(t *testing.T) {
	pool, q := setupLeaderboardDB(t)
	ctx := context.Background()

	regionID := createRegion(t, ctx, pool, "Test Region")
	p1 := createActivePlayer(t, ctx, pool, q, "p1@test.com", 1400, regionID)
	p2 := createActivePlayer(t, ctx, pool, q, "p2@test.com", 1200, regionID)
	p3 := createActivePlayer(t, ctx, pool, q, "p3@test.com", 1000, regionID)

	svc, _ := newService(q)
	page, err := svc.GetRanking(ctx, p1, &regionID, 50, 0)
	require.NoError(t, err)

	require.Len(t, page.Entries, 3)
	assert.Equal(t, int64(1), page.Entries[0].Rank)
	assert.Equal(t, p1, page.Entries[0].PlayerID)
	assert.Equal(t, int64(2), page.Entries[1].Rank)
	assert.Equal(t, p2, page.Entries[1].PlayerID)
	assert.Equal(t, int64(3), page.Entries[2].Rank)
	assert.Equal(t, p3, page.Entries[2].PlayerID)
}

func TestGetRanking_RegionFilter(t *testing.T) {
	pool, q := setupLeaderboardDB(t)
	ctx := context.Background()

	regionA := createRegion(t, ctx, pool, "Region A")
	regionB := createRegion(t, ctx, pool, "Region B")

	p1 := createActivePlayer(t, ctx, pool, q, "pa1@test.com", 1500, regionA)
	_ = createActivePlayer(t, ctx, pool, q, "pb1@test.com", 1600, regionB)

	svc, _ := newService(q)
	page, err := svc.GetRanking(ctx, p1, &regionA, 50, 0)
	require.NoError(t, err)

	require.Len(t, page.Entries, 1, "only region A players should appear")
	assert.Equal(t, p1, page.Entries[0].PlayerID)
}

func TestGetRanking_ExcludesInactivePlayers(t *testing.T) {
	pool, q := setupLeaderboardDB(t)
	ctx := context.Background()

	regionID := createRegion(t, ctx, pool, "Mixed Region")
	p1 := createActivePlayer(t, ctx, pool, q, "active@test.com", 1300, regionID)
	_ = createInactivePlayer(t, ctx, pool, q, "inactive@test.com", 1500, regionID)

	svc, _ := newService(q)
	page, err := svc.GetRanking(ctx, p1, &regionID, 50, 0)
	require.NoError(t, err)

	require.Len(t, page.Entries, 1, "inactive player should be excluded")
	assert.Equal(t, p1, page.Entries[0].PlayerID)
}

func TestProjectELO_WinScenario(t *testing.T) {
	pool, q := setupLeaderboardDB(t)
	ctx := context.Background()

	regionID := createRegion(t, ctx, pool, "Projection Region")
	// Underdog (1400) vs favorite (1600) — win should gain ELO.
	callerID := createActivePlayer(t, ctx, pool, q, "caller@test.com", 1400, regionID)
	opponentID := createActivePlayer(t, ctx, pool, q, "opponent@test.com", 1600, regionID)

	svc, _ := newService(q)
	result, err := svc.ProjectELO(ctx, callerID, opponentID, "win")
	require.NoError(t, err)

	assert.Equal(t, int32(1400), result.CurrentELO)
	assert.Greater(t, result.ProjectedELO, result.CurrentELO, "win against stronger opponent should increase ELO")
	assert.Greater(t, result.Delta, int32(0))
	assert.Less(t, result.ExpectedScore, 0.5, "underdog expected score should be < 0.5")
	assert.Equal(t, int32(1600), result.OpponentELO)
}

func TestProjectELO_LoseScenario(t *testing.T) {
	pool, q := setupLeaderboardDB(t)
	ctx := context.Background()

	regionID := createRegion(t, ctx, pool, "Projection Region 2")
	callerID := createActivePlayer(t, ctx, pool, q, "caller2@test.com", 1400, regionID)
	opponentID := createActivePlayer(t, ctx, pool, q, "opponent2@test.com", 1200, regionID)

	svc, _ := newService(q)
	result, err := svc.ProjectELO(ctx, callerID, opponentID, "lose")
	require.NoError(t, err)

	assert.Less(t, result.ProjectedELO, result.CurrentELO, "loss against weaker opponent should decrease ELO")
	assert.Less(t, result.Delta, int32(0))
}

func TestProjectELO_InvalidResult(t *testing.T) {
	pool, q := setupLeaderboardDB(t)
	ctx := context.Background()

	regionID := createRegion(t, ctx, pool, "Invalid Region")
	callerID := createActivePlayer(t, ctx, pool, q, "caller3@test.com", 1400, regionID)
	opponentID := createActivePlayer(t, ctx, pool, q, "opponent3@test.com", 1400, regionID)

	svc, _ := newService(q)
	_, err := svc.ProjectELO(ctx, callerID, opponentID, "unknown")
	assert.ErrorIs(t, err, leaderboard.ErrUnknownResult)
}

func TestGetELOHistory_CursorPagination(t *testing.T) {
	pool, q := setupLeaderboardDB(t)
	ctx := context.Background()

	regionID := createRegion(t, ctx, pool, "History Region")
	p1 := createActivePlayer(t, ctx, pool, q, "hist1@test.com", 1200, regionID)
	p2 := createActivePlayer(t, ctx, pool, q, "hist2@test.com", 1200, regionID)

	// Insert a match between p1 and p2.
	matchID := insertTestMatch(t, ctx, pool, q, p1, p2)

	// Insert ELO history entries for p1.
	insertELOHistory(t, ctx, pool, p1, matchID, 1200, 1210, 10, time.Now().Add(-2*time.Second))
	insertELOHistory(t, ctx, pool, p1, matchID, 1210, 1220, 10, time.Now().Add(-1*time.Second))
	insertELOHistory(t, ctx, pool, p1, matchID, 1220, 1230, 10, time.Now())

	svc, _ := newService(q)

	// First page — limit 2.
	page1, err := svc.GetELOHistory(ctx, p1, nil, 2)
	require.NoError(t, err)
	require.Len(t, page1.Entries, 2, "first page should have 2 entries")
	require.NotNil(t, page1.NextCursor, "NextCursor should be set when len==limit")

	// Second page using cursor.
	page2, err := svc.GetELOHistory(ctx, p1, page1.NextCursor, 2)
	require.NoError(t, err)
	require.Len(t, page2.Entries, 1, "second page should have 1 remaining entry")
	assert.Nil(t, page2.NextCursor, "NextCursor should be nil when fewer results than limit")
}

func TestGetELOHistory_OpponentName(t *testing.T) {
	pool, q := setupLeaderboardDB(t)
	ctx := context.Background()

	regionID := createRegion(t, ctx, pool, "Opponent Region")
	p1 := createActivePlayer(t, ctx, pool, q, "phist1@test.com", 1200, regionID)
	p2 := createActivePlayer(t, ctx, pool, q, "phist2@test.com", 1200, regionID)

	// Set p2 name.
	_, err := pool.Exec(ctx, `UPDATE users SET name='Rival Player' WHERE id=$1`,
		pgtype.UUID{Bytes: p2, Valid: true})
	require.NoError(t, err)

	matchID := insertTestMatch(t, ctx, pool, q, p1, p2)
	insertELOHistory(t, ctx, pool, p1, matchID, 1200, 1210, 10, time.Now())

	svc, _ := newService(q)
	page, err := svc.GetELOHistory(ctx, p1, nil, 20)
	require.NoError(t, err)

	require.NotEmpty(t, page.Entries)
	assert.Equal(t, "Rival Player", page.Entries[0].OpponentName)
	assert.Equal(t, p2, page.Entries[0].OpponentID)
}

func TestGetRegions_ReturnsSeedRegions(t *testing.T) {
	_, q := setupLeaderboardDB(t)
	ctx := context.Background()

	svc, _ := newService(q)
	regions, err := svc.GetRegions(ctx)
	require.NoError(t, err)

	// The seed migration inserts 4 Mendoza regions.
	names := make([]string, 0, len(regions))
	for _, r := range regions {
		names = append(names, r.Name)
	}

	assert.Contains(t, names, "Gran Mendoza")
	assert.Contains(t, names, "Zona Este")
	assert.Contains(t, names, "Valle de Uco")
	assert.Contains(t, names, "Sur")
}

func TestCreateRegion_AppearsInGetRegions(t *testing.T) {
	_, q := setupLeaderboardDB(t)
	ctx := context.Background()

	svc, _ := newService(q)

	created, err := svc.CreateRegion(ctx, "Test New Region", "POLYGON((-68.7 -33.1, -68.3 -33.1, -68.3 -32.7, -68.7 -32.7, -68.7 -33.1))")
	require.NoError(t, err)
	assert.Equal(t, "Test New Region", created.Name)
	assert.NotEqual(t, uuid.Nil, created.ID)

	regions, err := svc.GetRegions(ctx)
	require.NoError(t, err)

	found := false
	for _, r := range regions {
		if r.ID == created.ID {
			found = true
			break
		}
	}
	assert.True(t, found, "created region should appear in GetRegions")
}

func TestGetPlayerRank_HighestELOIsRank1(t *testing.T) {
	pool, q := setupLeaderboardDB(t)
	ctx := context.Background()

	regionID := createRegion(t, ctx, pool, "Rank Region")
	p1 := createActivePlayer(t, ctx, pool, q, "rank1@test.com", 1500, regionID)
	_ = createActivePlayer(t, ctx, pool, q, "rank2@test.com", 1300, regionID)
	_ = createActivePlayer(t, ctx, pool, q, "rank3@test.com", 1100, regionID)

	svc, _ := newService(q)
	rank, err := svc.GetPlayerRank(ctx, p1)
	require.NoError(t, err)
	assert.Equal(t, int64(1), rank, "player with highest ELO should be rank 1")
}

// --- test data helpers ---

func insertTestMatch(t *testing.T, ctx context.Context, pool *pgxpool.Pool, q *db.Queries, p1, p2 uuid.UUID) uuid.UUID {
	t.Helper()
	var matchID pgtype.UUID
	err := pool.QueryRow(ctx,
		`INSERT INTO matches (status, scheduled_at, captain_a_id, captain_b_id)
		 VALUES ('sealed', NOW(), $1, $2) RETURNING id`,
		pgtype.UUID{Bytes: p1, Valid: true},
		pgtype.UUID{Bytes: p2, Valid: true},
	).Scan(&matchID)
	require.NoError(t, err, "insert test match")

	// Add both players to match_players.
	_, err = pool.Exec(ctx,
		`INSERT INTO match_players (match_id, player_id, team) VALUES ($1, $2, 'A'), ($1, $3, 'B')`,
		matchID,
		pgtype.UUID{Bytes: p1, Valid: true},
		pgtype.UUID{Bytes: p2, Valid: true},
	)
	require.NoError(t, err, "insert match_players")

	return uuid.UUID(matchID.Bytes)
}

func insertELOHistory(t *testing.T, ctx context.Context, pool *pgxpool.Pool,
	playerID, matchID uuid.UUID, eloBefore, eloAfter, delta int, createdAt time.Time) {
	t.Helper()
	_, err := pool.Exec(ctx,
		`INSERT INTO elo_history (player_id, match_id, elo_before, elo_after, delta, k_factor, created_at)
		 VALUES ($1, $2, $3, $4, $5, 20, $6)`,
		pgtype.UUID{Bytes: playerID, Valid: true},
		pgtype.UUID{Bytes: matchID, Valid: true},
		eloBefore, eloAfter, delta, createdAt,
	)
	require.NoError(t, err, "insert ELO history")
}
