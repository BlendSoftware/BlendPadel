package notification_test

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
	"github.com/juani/blendpadel/backend/internal/notification"
	"github.com/juani/blendpadel/backend/internal/platform/database"
	"github.com/juani/blendpadel/backend/migrations"
)

func setupNotifDB(t *testing.T) (*pgxpool.Pool, *db.Queries) {
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

func createTestPlayer(t *testing.T, ctx context.Context, q *db.Queries, email string) uuid.UUID {
	t.Helper()
	user, err := q.CreateUser(ctx, db.CreateUserParams{
		Email:        email,
		PasswordHash: "hash",
		Name:         pgtype.Text{String: "Test Player", Valid: true},
	})
	require.NoError(t, err, "create test player")
	return uuid.UUID(user.ID.Bytes)
}

func TestUpsertAndGetDeviceTokens(t *testing.T) {
	ctx := context.Background()
	_, q := setupNotifDB(t)

	playerID := createTestPlayer(t, ctx, q, "device-token-test@example.com")
	repo := notification.NewPostgresRepo(q)

	// Upsert a token.
	err := repo.UpsertDeviceToken(ctx, playerID, "token-abc-123", "ios")
	require.NoError(t, err)

	// Get tokens.
	tokens, err := repo.GetDeviceTokensByPlayer(ctx, playerID)
	require.NoError(t, err)
	require.Len(t, tokens, 1)
	assert.Equal(t, "token-abc-123", tokens[0])

	// Upsert again (idempotent — same token, different platform).
	err = repo.UpsertDeviceToken(ctx, playerID, "token-abc-123", "android")
	require.NoError(t, err)

	tokens, err = repo.GetDeviceTokensByPlayer(ctx, playerID)
	require.NoError(t, err)
	assert.Len(t, tokens, 1, "upsert should not create duplicate")

	// Add a second token.
	err = repo.UpsertDeviceToken(ctx, playerID, "token-xyz-456", "android")
	require.NoError(t, err)

	tokens, err = repo.GetDeviceTokensByPlayer(ctx, playerID)
	require.NoError(t, err)
	assert.Len(t, tokens, 2)
}

func TestDeleteDeviceToken(t *testing.T) {
	ctx := context.Background()
	_, q := setupNotifDB(t)

	playerID := createTestPlayer(t, ctx, q, "delete-token-test@example.com")
	repo := notification.NewPostgresRepo(q)

	require.NoError(t, repo.UpsertDeviceToken(ctx, playerID, "token-to-delete", "web"))

	// Delete the token.
	err := repo.DeleteDeviceToken(ctx, playerID, "token-to-delete")
	require.NoError(t, err)

	tokens, err := repo.GetDeviceTokensByPlayer(ctx, playerID)
	require.NoError(t, err)
	assert.Empty(t, tokens)
}

func TestNotificationLogDedup(t *testing.T) {
	ctx := context.Background()
	_, q := setupNotifDB(t)

	playerID := createTestPlayer(t, ctx, q, "notif-dedup@example.com")
	repo := notification.NewPostgresRepo(q)
	matchID := uuid.New()

	// First check: should not be sent yet.
	sent, err := repo.CheckNotificationSent(ctx, playerID, notification.TypeResultValidation, matchID, 24*time.Hour)
	require.NoError(t, err)
	assert.False(t, sent, "notification should not be logged yet")

	// Insert log entry.
	err = repo.InsertNotificationLog(ctx, playerID, notification.TypeResultValidation, matchID)
	require.NoError(t, err)

	// Second check: should now be detected.
	sent, err = repo.CheckNotificationSent(ctx, playerID, notification.TypeResultValidation, matchID, 24*time.Hour)
	require.NoError(t, err)
	assert.True(t, sent, "notification should be detected as already sent")
}

func TestSendResultValidationDedup(t *testing.T) {
	ctx := context.Background()
	_, q := setupNotifDB(t)

	playerID := createTestPlayer(t, ctx, q, "result-validation@example.com")
	repo := notification.NewPostgresRepo(q)
	mockNotifier := notification.NewMockNotifier()
	svc := notification.NewService(repo, mockNotifier)

	matchID := uuid.New()

	// First send: should succeed and log.
	err := svc.SendResultValidation(ctx, playerID, matchID)
	require.NoError(t, err)

	// Second send: dedup should skip.
	err = svc.SendResultValidation(ctx, playerID, matchID)
	require.NoError(t, err)

	// Verify log has exactly one entry.
	sent, err := repo.CheckNotificationSent(ctx, playerID, notification.TypeResultValidation, matchID, 24*time.Hour)
	require.NoError(t, err)
	assert.True(t, sent)
}

func TestSendReminderDedup(t *testing.T) {
	ctx := context.Background()
	_, q := setupNotifDB(t)

	playerID := createTestPlayer(t, ctx, q, "reminder-dedup@example.com")
	repo := notification.NewPostgresRepo(q)
	mockNotifier := notification.NewMockNotifier()
	svc := notification.NewService(repo, mockNotifier)

	matchID := uuid.New()

	// First reminder: sent.
	err := svc.SendReminder(ctx, playerID, matchID)
	require.NoError(t, err)

	// Second reminder: deduped.
	err = svc.SendReminder(ctx, playerID, matchID)
	require.NoError(t, err)

	sent, err := repo.CheckNotificationSent(ctx, playerID, notification.TypeReminder4h, matchID, 25*time.Hour)
	require.NoError(t, err)
	assert.True(t, sent)
}

func TestMockNotifier(t *testing.T) {
	ctx := context.Background()
	notifier := notification.NewMockNotifier()

	playerID := uuid.New()
	n := notification.Notification{
		Type:  notification.TypeELOChange,
		Title: "+55 puntos ELO!",
		Body:  "Tu ranking subió después del último partido.",
		Data:  map[string]string{"delta": "55"},
	}

	// Should not error.
	err := notifier.Send(ctx, playerID, n)
	assert.NoError(t, err)

	err = notifier.SendMulticast(ctx, []uuid.UUID{playerID, uuid.New()}, n)
	assert.NoError(t, err)
}
