package trust_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"

	"github.com/juani/blendpadel/backend/internal/db"
	"github.com/juani/blendpadel/backend/internal/platform/database"
	"github.com/juani/blendpadel/backend/internal/trust"
	"github.com/juani/blendpadel/backend/migrations"
)

func setupTrustDB(t *testing.T) (*pgxpool.Pool, *db.Queries) {
	t.Helper()
	ctx := context.Background()

	pgContainer, err := tcpostgres.Run(ctx,
		"postgis/postgis:15-3.3",
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

func createTrustTestUser(t *testing.T, ctx context.Context, pool *pgxpool.Pool, q *db.Queries, email string, trustScore int) uuid.UUID {
	t.Helper()
	user, err := q.CreateUser(ctx, db.CreateUserParams{
		Email:        email,
		PasswordHash: "hash",
		Name:         pgtype.Text{String: "Trust Player", Valid: true},
	})
	if err != nil {
		t.Fatalf("createTrustTestUser %s: %v", email, err)
	}

	_, err = pool.Exec(ctx,
		"UPDATE users SET trust_score=$1 WHERE id=$2",
		trustScore, user.ID,
	)
	if err != nil {
		t.Fatalf("updating trust score for %s: %v", email, err)
	}

	return user.ID.Bytes
}

func TestIntegration_Trust_PenalizeAndRecover(t *testing.T) {
	pool, q := setupTrustDB(t)
	ctx := context.Background()

	playerID := createTrustTestUser(t, ctx, pool, q, "trustplayer@test.com", 80)
	repo := trust.NewPostgresRepo(q)
	svc := trust.NewService(repo)

	// Penalize late cancellation: 80 → 70.
	newScore, err := svc.PenalizeLateCancellation(ctx, playerID, uuid.New())
	if err != nil {
		t.Fatalf("PenalizeLateCancellation: %v", err)
	}
	if newScore != 70 {
		t.Errorf("expected trust 70, got %d", newScore)
	}

	// Recover from match: 70 → 72.
	newScore, recovered, err := svc.RecoverFromMatch(ctx, playerID, uuid.New())
	if err != nil {
		t.Fatalf("RecoverFromMatch: %v", err)
	}
	if newScore != 72 {
		t.Errorf("expected trust 72, got %d", newScore)
	}
	if recovered != 2 {
		t.Errorf("expected recovered=2, got %d", recovered)
	}
}

func TestIntegration_Trust_RecoveryCap(t *testing.T) {
	pool, q := setupTrustDB(t)
	ctx := context.Background()

	playerID := createTrustTestUser(t, ctx, pool, q, "capplayer@test.com", 60)
	repo := trust.NewPostgresRepo(q)
	svc := trust.NewService(repo)

	// Apply 5 recoveries (5 × +2 = +10 = monthly cap).
	for i := 0; i < 5; i++ {
		_, _, err := svc.RecoverFromMatch(ctx, playerID, uuid.New())
		if err != nil {
			t.Fatalf("RecoverFromMatch iteration %d: %v", i, err)
		}
	}

	// 6th recovery should be blocked by cap.
	newScore, recovered, err := svc.RecoverFromMatch(ctx, playerID, uuid.New())
	if err != nil {
		t.Fatalf("RecoverFromMatch (cap attempt): %v", err)
	}
	if recovered != 0 {
		t.Errorf("expected 0 recovery after cap, got %d", recovered)
	}
	if newScore != 70 {
		t.Errorf("expected trust to stay at 70 after cap, got %d", newScore)
	}
}

func TestIntegration_Trust_SystematicDisputeFreezesELO(t *testing.T) {
	pool, q := setupTrustDB(t)
	ctx := context.Background()

	playerID := createTrustTestUser(t, ctx, pool, q, "disputeplayer@test.com", 80)
	repo := trust.NewPostgresRepo(q)
	svc := trust.NewService(repo)

	// First dispute in 30 days: -5, no freeze.
	newScore, frozen, err := svc.PenalizeDispute(ctx, playerID, uuid.New())
	if err != nil {
		t.Fatalf("PenalizeDispute (first): %v", err)
	}
	if newScore != 75 {
		t.Errorf("first dispute: expected trust 75, got %d", newScore)
	}
	if frozen {
		t.Error("first dispute should not freeze ELO")
	}

	// Second dispute in 30 days: -20, freeze activated.
	newScore, frozen, err = svc.PenalizeDispute(ctx, playerID, uuid.New())
	if err != nil {
		t.Fatalf("PenalizeDispute (second): %v", err)
	}
	if newScore != 55 {
		t.Errorf("second dispute: expected trust 55, got %d", newScore)
	}
	if !frozen {
		t.Error("second dispute should freeze ELO")
	}

	// Verify ELO is frozen in DB.
	row, err := q.GetPlayerELO(ctx, pgtype.UUID{Bytes: playerID, Valid: true})
	if err != nil {
		t.Fatalf("GetPlayerELO: %v", err)
	}
	if !row.EloFrozen {
		t.Error("player ELO should be frozen in DB")
	}
}

func TestIntegration_Trust_EventsRecorded(t *testing.T) {
	pool, q := setupTrustDB(t)
	ctx := context.Background()

	playerID := createTrustTestUser(t, ctx, pool, q, "eventsplayer@test.com", 80)
	repo := trust.NewPostgresRepo(q)
	svc := trust.NewService(repo)

	matchID := uuid.New()
	reportID := uuid.New()

	_, err := svc.PenalizeLateCancellation(ctx, playerID, matchID)
	if err != nil {
		t.Fatalf("PenalizeLateCancellation: %v", err)
	}

	_, err = svc.PenalizeConductReport(ctx, playerID, reportID)
	if err != nil {
		t.Fatalf("PenalizeConductReport: %v", err)
	}

	_, _, err = svc.RecoverFromMatch(ctx, playerID, uuid.New())
	if err != nil {
		t.Fatalf("RecoverFromMatch: %v", err)
	}

	// Verify 3 events were recorded.
	events, err := q.GetTrustEvents(ctx, db.GetTrustEventsParams{
		PlayerID: pgtype.UUID{Bytes: playerID, Valid: true},
		Limit:    10,
	})
	if err != nil {
		t.Fatalf("GetTrustEvents: %v", err)
	}
	if len(events) != 3 {
		t.Errorf("expected 3 trust events, got %d", len(events))
	}
}

func TestIntegration_Trust_FloorAtZero(t *testing.T) {
	pool, q := setupTrustDB(t)
	ctx := context.Background()

	// Start with trust score of 5.
	playerID := createTrustTestUser(t, ctx, pool, q, "floorplayer@test.com", 5)
	repo := trust.NewPostgresRepo(q)
	svc := trust.NewService(repo)

	// Penalize -10 → should clamp to 0.
	newScore, err := svc.PenalizeLateCancellation(ctx, playerID, uuid.New())
	if err != nil {
		t.Fatalf("PenalizeLateCancellation: %v", err)
	}
	if newScore != 0 {
		t.Errorf("expected trust 0 (clamped), got %d", newScore)
	}

	// Penalize again on 0 → stays 0.
	newScore, err = svc.PenalizeLateCancellation(ctx, playerID, uuid.New())
	if err != nil {
		t.Fatalf("PenalizeLateCancellation on 0: %v", err)
	}
	if newScore != 0 {
		t.Errorf("expected trust 0, got %d", newScore)
	}
}
