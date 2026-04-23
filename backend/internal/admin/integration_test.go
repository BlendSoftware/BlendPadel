package admin_test

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

	"github.com/juani/blendpadel/backend/internal/admin"
	"github.com/juani/blendpadel/backend/internal/auth"
	"github.com/juani/blendpadel/backend/internal/db"
	"github.com/juani/blendpadel/backend/internal/platform/database"
	"github.com/juani/blendpadel/backend/migrations"
)

// --- test helpers ---

func setupAdminDB(t *testing.T) (*pgxpool.Pool, *db.Queries) {
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

func createTestUser(t *testing.T, ctx context.Context, q *db.Queries, email string) uuid.UUID {
	t.Helper()
	user, err := q.CreateUser(ctx, db.CreateUserParams{
		Email:        email,
		PasswordHash: "hash",
		Name:         pgtype.Text{String: "Test", Valid: true},
	})
	require.NoError(t, err)
	return uuid.UUID(user.ID.Bytes)
}

func createActivePlayer(t *testing.T, ctx context.Context, pool *pgxpool.Pool, q *db.Queries, email string, elo int) uuid.UUID {
	t.Helper()
	userID := createTestUser(t, ctx, q, email)
	_, err := pool.Exec(ctx,
		`UPDATE users SET status='active', elo=$1 WHERE id=$2`,
		elo, pgtype.UUID{Bytes: userID, Valid: true},
	)
	require.NoError(t, err)
	return userID
}

func createSuperadmin(t *testing.T, ctx context.Context, pool *pgxpool.Pool, q *db.Queries) uuid.UUID {
	t.Helper()
	user, err := q.CreateUser(ctx, db.CreateUserParams{
		Email:        "superadmin@test.com",
		PasswordHash: "hash",
		Name:         pgtype.Text{String: "Admin", Valid: true},
	})
	require.NoError(t, err)
	adminID := uuid.UUID(user.ID.Bytes)
	_, err = pool.Exec(ctx,
		`UPDATE users SET role='superadmin', status='active' WHERE id=$1`,
		pgtype.UUID{Bytes: adminID, Valid: true},
	)
	require.NoError(t, err)
	return adminID
}

func createRegion(t *testing.T, ctx context.Context, pool *pgxpool.Pool) uuid.UUID {
	t.Helper()
	var id pgtype.UUID
	err := pool.QueryRow(ctx,
		`INSERT INTO regions (name) VALUES ($1) RETURNING id`, "Test Region",
	).Scan(&id)
	require.NoError(t, err)
	return uuid.UUID(id.Bytes)
}

func newAdminService(t *testing.T, q *db.Queries, authRepo auth.Repository) *admin.Service {
	t.Helper()
	repo := admin.NewPostgresRepo(q)
	return admin.NewService(repo, authRepo)
}

// stubAuthRepo is a minimal auth.Repository for testing token revocation.
type stubAuthRepo struct {
	revokedUsers []uuid.UUID
	// Embed a nil-safe no-op for unused methods.
}

func (s *stubAuthRepo) CreateUser(_ context.Context, _, _, _, _ string) (*db.User, error) {
	return nil, nil
}
func (s *stubAuthRepo) GetUserByEmail(_ context.Context, _ string) (*db.User, error) {
	return nil, nil
}
func (s *stubAuthRepo) GetUserByID(_ context.Context, _ uuid.UUID) (*db.User, error) {
	return nil, nil
}
func (s *stubAuthRepo) UpdatePassword(_ context.Context, _ uuid.UUID, _ string) error {
	return nil
}
func (s *stubAuthRepo) CreateRefreshToken(_ context.Context, _ uuid.UUID, _ string, _ uuid.UUID, _ time.Time) error {
	return nil
}
func (s *stubAuthRepo) GetRefreshToken(_ context.Context, _ string) (*db.RefreshToken, error) {
	return nil, nil
}
func (s *stubAuthRepo) GetRefreshTokenAny(_ context.Context, _ string) (*db.RefreshToken, error) {
	return nil, nil
}
func (s *stubAuthRepo) RevokeToken(_ context.Context, _ uuid.UUID) error { return nil }
func (s *stubAuthRepo) RevokeTokenFamily(_ context.Context, _ uuid.UUID) error { return nil }
func (s *stubAuthRepo) RevokeAllUserTokens(_ context.Context, userID uuid.UUID) error {
	s.revokedUsers = append(s.revokedUsers, userID)
	return nil
}

// --- tests ---

func TestGetKPIs_ReturnsMetrics(t *testing.T) {
	pool, q := setupAdminDB(t)
	ctx := context.Background()
	authRepo := &stubAuthRepo{}
	svc := newAdminService(t, q, authRepo)

	regionID := createRegion(t, ctx, pool)

	// Seed 3 active players.
	createActivePlayer(t, ctx, pool, q, "p1@test.com", 1000)
	createActivePlayer(t, ctx, pool, q, "p2@test.com", 1100)
	createActivePlayer(t, ctx, pool, q, "p3@test.com", 1200)

	// Seed 1 moderator.
	mod := createTestUser(t, ctx, q, "mod@test.com")
	_, err := pool.Exec(ctx,
		`UPDATE users SET role='moderator', status='active', region_id=$1 WHERE id=$2`,
		pgtype.UUID{Bytes: regionID, Valid: true},
		pgtype.UUID{Bytes: mod, Valid: true},
	)
	require.NoError(t, err)

	kpis, err := svc.GetKPIs(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(3), kpis.ActivePlayers)
	assert.Equal(t, int64(1), kpis.TotalModerators)
	assert.Equal(t, int64(0), kpis.BannedPlayers)
}

func TestKPICache_ServedFromCache(t *testing.T) {
	_, q := setupAdminDB(t)
	ctx := context.Background()
	authRepo := &stubAuthRepo{}
	svc := newAdminService(t, q, authRepo)

	kpis1, err := svc.GetKPIs(ctx)
	require.NoError(t, err)

	// Second call within TTL should return the same pointer.
	kpis2, err := svc.GetKPIs(ctx)
	require.NoError(t, err)

	// Both should be identical (same cached data).
	assert.Equal(t, kpis1.TotalPlayers, kpis2.TotalPlayers)
}

func TestBanPlayer_SoftBan(t *testing.T) {
	pool, q := setupAdminDB(t)
	ctx := context.Background()
	authRepo := &stubAuthRepo{}
	svc := newAdminService(t, q, authRepo)

	adminID := createSuperadmin(t, ctx, pool, q)
	playerID := createActivePlayer(t, ctx, pool, q, "player@test.com", 1000)

	err := svc.BanPlayer(ctx, adminID, playerID, admin.BanRequest{Type: "soft", Reason: "test"})
	require.NoError(t, err)

	// Verify status is banned_soft.
	var status string
	err = pool.QueryRow(ctx, `SELECT status FROM users WHERE id=$1`,
		pgtype.UUID{Bytes: playerID, Valid: true}).Scan(&status)
	require.NoError(t, err)
	assert.Equal(t, "banned_soft", status)

	// Tokens should NOT have been revoked for soft ban.
	assert.Empty(t, authRepo.revokedUsers)
}

func TestBanPlayer_HardBan(t *testing.T) {
	pool, q := setupAdminDB(t)
	ctx := context.Background()
	authRepo := &stubAuthRepo{}
	svc := newAdminService(t, q, authRepo)

	adminID := createSuperadmin(t, ctx, pool, q)
	playerID := createActivePlayer(t, ctx, pool, q, "player@test.com", 1000)

	err := svc.BanPlayer(ctx, adminID, playerID, admin.BanRequest{Type: "hard", Reason: "cheating"})
	require.NoError(t, err)

	// Verify status is banned_hard.
	var status string
	err = pool.QueryRow(ctx, `SELECT status FROM users WHERE id=$1`,
		pgtype.UUID{Bytes: playerID, Valid: true}).Scan(&status)
	require.NoError(t, err)
	assert.Equal(t, "banned_hard", status)

	// Token revocation must have been called.
	require.Len(t, authRepo.revokedUsers, 1)
	assert.Equal(t, playerID, authRepo.revokedUsers[0])
}

func TestBanPlayer_InvalidType(t *testing.T) {
	pool, q := setupAdminDB(t)
	ctx := context.Background()
	authRepo := &stubAuthRepo{}
	svc := newAdminService(t, q, authRepo)

	adminID := createSuperadmin(t, ctx, pool, q)
	playerID := createActivePlayer(t, ctx, pool, q, "player@test.com", 1000)

	err := svc.BanPlayer(ctx, adminID, playerID, admin.BanRequest{Type: "invalid"})
	assert.ErrorIs(t, err, admin.ErrInvalidBanType)
}

func TestUnbanPlayer(t *testing.T) {
	pool, q := setupAdminDB(t)
	ctx := context.Background()
	authRepo := &stubAuthRepo{}
	svc := newAdminService(t, q, authRepo)

	adminID := createSuperadmin(t, ctx, pool, q)
	playerID := createActivePlayer(t, ctx, pool, q, "player@test.com", 1000)

	// Ban first.
	require.NoError(t, svc.BanPlayer(ctx, adminID, playerID, admin.BanRequest{Type: "soft"}))

	// Then unban.
	require.NoError(t, svc.UnbanPlayer(ctx, adminID, playerID))

	var status string
	err := pool.QueryRow(ctx, `SELECT status FROM users WHERE id=$1`,
		pgtype.UUID{Bytes: playerID, Valid: true}).Scan(&status)
	require.NoError(t, err)
	assert.Equal(t, "active", status)
}

func TestAdjustELO_PositiveDelta(t *testing.T) {
	pool, q := setupAdminDB(t)
	ctx := context.Background()
	authRepo := &stubAuthRepo{}
	svc := newAdminService(t, q, authRepo)

	adminID := createSuperadmin(t, ctx, pool, q)
	playerID := createActivePlayer(t, ctx, pool, q, "player@test.com", 1000)

	err := svc.AdjustELO(ctx, adminID, playerID, admin.ELOAdjustRequest{Delta: 100, Reason: "promo"})
	require.NoError(t, err)

	var elo int32
	err = pool.QueryRow(ctx, `SELECT elo FROM users WHERE id=$1`,
		pgtype.UUID{Bytes: playerID, Valid: true}).Scan(&elo)
	require.NoError(t, err)
	assert.Equal(t, int32(1100), elo)

	// Check elo_history entry was inserted.
	var histCount int
	err = pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM elo_history WHERE player_id=$1 AND type='manual_adjustment'`,
		pgtype.UUID{Bytes: playerID, Valid: true}).Scan(&histCount)
	require.NoError(t, err)
	assert.Equal(t, 1, histCount)
}

func TestAdjustELO_NegativeDeltaFloor(t *testing.T) {
	pool, q := setupAdminDB(t)
	ctx := context.Background()
	authRepo := &stubAuthRepo{}
	svc := newAdminService(t, q, authRepo)

	adminID := createSuperadmin(t, ctx, pool, q)
	playerID := createActivePlayer(t, ctx, pool, q, "player@test.com", 500)

	err := svc.AdjustELO(ctx, adminID, playerID, admin.ELOAdjustRequest{Delta: -99999})
	require.NoError(t, err)

	var elo int32
	err = pool.QueryRow(ctx, `SELECT elo FROM users WHERE id=$1`,
		pgtype.UUID{Bytes: playerID, Valid: true}).Scan(&elo)
	require.NoError(t, err)
	assert.Equal(t, int32(0), elo)
}

func TestModeratorCRUD(t *testing.T) {
	pool, q := setupAdminDB(t)
	ctx := context.Background()
	authRepo := &stubAuthRepo{}
	svc := newAdminService(t, q, authRepo)

	adminID := createSuperadmin(t, ctx, pool, q)
	regionID := createRegion(t, ctx, pool)

	// Create moderator.
	mod, err := svc.CreateModerator(ctx, adminID, admin.ModeratorRequest{
		Email:    "mod@test.com",
		Password: "secret123",
		Name:     "Mod",
		RegionID: regionID,
	})
	require.NoError(t, err)
	assert.Equal(t, "moderator", mod.Role)
	assert.Equal(t, "mod@test.com", mod.Email)

	// List moderators — should have 1.
	mods, err := svc.ListModerators(ctx)
	require.NoError(t, err)
	assert.Len(t, mods, 1)

	// Update moderator region.
	newRegionID := uuid.New()
	_, err = pool.Exec(ctx, `INSERT INTO regions (id, name) VALUES ($1, 'Other Region')`,
		pgtype.UUID{Bytes: newRegionID, Valid: true})
	require.NoError(t, err)

	updated, err := svc.UpdateModerator(ctx, adminID, mod.ID, admin.ModeratorRequest{RegionID: newRegionID})
	require.NoError(t, err)
	require.NotNil(t, updated.RegionID)
	assert.Equal(t, newRegionID, *updated.RegionID)

	// Delete moderator.
	err = svc.DeleteModerator(ctx, adminID, mod.ID)
	require.NoError(t, err)

	// Verify role reverted to player.
	var role string
	err = pool.QueryRow(ctx, `SELECT role FROM users WHERE id=$1`,
		pgtype.UUID{Bytes: mod.ID, Valid: true}).Scan(&role)
	require.NoError(t, err)
	assert.Equal(t, "player", role)
}

func TestAuditLog_RecordsActions(t *testing.T) {
	pool, q := setupAdminDB(t)
	ctx := context.Background()
	authRepo := &stubAuthRepo{}
	svc := newAdminService(t, q, authRepo)

	adminID := createSuperadmin(t, ctx, pool, q)
	playerID := createActivePlayer(t, ctx, pool, q, "player@test.com", 1000)

	// Perform a ban and an ELO adjust.
	require.NoError(t, svc.BanPlayer(ctx, adminID, playerID, admin.BanRequest{Type: "soft", Reason: "test"}))
	require.NoError(t, svc.AdjustELO(ctx, adminID, playerID, admin.ELOAdjustRequest{Delta: 50}))

	result, err := svc.GetAuditLog(ctx, nil, 50, 0)
	require.NoError(t, err)
	assert.Equal(t, int64(2), result.Total)
	assert.Len(t, result.Entries, 2)

	// Verify actions.
	actions := map[string]bool{}
	for _, e := range result.Entries {
		actions[e.Action] = true
	}
	assert.True(t, actions["ban_player"])
	assert.True(t, actions["elo_adjust"])

	// Filter by admin_id.
	filtered, err := svc.GetAuditLog(ctx, &adminID, 50, 0)
	require.NoError(t, err)
	assert.Equal(t, int64(2), filtered.Total)

	// Filter by non-existent admin_id.
	other := uuid.New()
	empty, err := svc.GetAuditLog(ctx, &other, 50, 0)
	require.NoError(t, err)
	assert.Equal(t, int64(0), empty.Total)
}
