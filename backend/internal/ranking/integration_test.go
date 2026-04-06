package ranking_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"

	"github.com/juani/blendpadel/backend/internal/db"
	"github.com/juani/blendpadel/backend/internal/platform/database"
	"github.com/juani/blendpadel/backend/internal/ranking"
	"github.com/juani/blendpadel/backend/migrations"
)

func setupRankingDB(t *testing.T) (*pgxpool.Pool, *db.Queries) {
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

// createTestUser inserts a minimal user and returns their UUID.
func createTestUser(t *testing.T, ctx context.Context, pool *pgxpool.Pool, q *db.Queries, email string, elo int, matchCount int32, frozen bool) uuid.UUID {
	t.Helper()
	user, err := q.CreateUser(ctx, db.CreateUserParams{
		Email:        email,
		PasswordHash: "hash",
		Name:         pgtype.Text{String: "Player", Valid: true},
	})
	if err != nil {
		t.Fatalf("createTestUser %s: %v", email, err)
	}

	// Set specific ELO, match count, and frozen status.
	playerID := user.ID
	_, err = pool.Exec(ctx,
		"UPDATE users SET elo=$1, validated_match_count=$2, elo_frozen=$3 WHERE id=$4",
		elo, matchCount, frozen, playerID,
	)
	if err != nil {
		t.Fatalf("updating test user %s: %v", email, err)
	}

	return playerID.Bytes
}

func TestIntegration_ApplyELO_BasicMatch(t *testing.T) {
	pool, q := setupRankingDB(t)
	ctx := context.Background()

	// Create 4 players with equal ELOs, enough matches to use K=20.
	p1 := createTestUser(t, ctx, pool, q, "p1@test.com", 1200, 5, false)
	p2 := createTestUser(t, ctx, pool, q, "p2@test.com", 1200, 5, false)
	p3 := createTestUser(t, ctx, pool, q, "p3@test.com", 1200, 5, false)
	p4 := createTestUser(t, ctx, pool, q, "p4@test.com", 1200, 5, false)

	repo := ranking.NewPostgresRepo(q)
	svc := ranking.NewService(pool, repo)

	matchID := uuid.New()
	input := ranking.MatchELOInput{
		MatchID:        matchID,
		TeamAPlayerIDs: []uuid.UUID{p1, p2},
		TeamBPlayerIDs: []uuid.UUID{p3, p4},
		WinnerTeam:     "A",
		GamesWon:       12,
		GamesLost:      8, // diff=4, M=1.2
	}

	results, err := svc.ApplyELO(ctx, input)
	if err != nil {
		t.Fatalf("ApplyELO failed: %v", err)
	}

	if len(results) != 4 {
		t.Fatalf("expected 4 results, got %d", len(results))
	}

	// Team A players should have gained ELO, Team B lost ELO.
	for _, r := range results[:2] {
		if r.Delta <= 0 {
			t.Errorf("team A player %s should have gained ELO, got delta %d", r.PlayerID, r.Delta)
		}
	}
	for _, r := range results[2:] {
		if r.Delta >= 0 {
			t.Errorf("team B player %s should have lost ELO, got delta %d", r.PlayerID, r.Delta)
		}
	}

	// Verify ELO history was inserted.
	history, err := repo.GetELOHistory(ctx, p1, 10)
	if err != nil {
		t.Fatalf("GetELOHistory failed: %v", err)
	}
	if len(history) != 1 {
		t.Errorf("expected 1 history entry for p1, got %d", len(history))
	}
	if history[0].MatchID != matchID {
		t.Errorf("history match ID mismatch: want %s, got %s", matchID, history[0].MatchID)
	}
}

func TestIntegration_ApplyELO_FrozenPlayerSkipped(t *testing.T) {
	pool, q := setupRankingDB(t)
	ctx := context.Background()

	// p1 is frozen, should not get updated.
	p1 := createTestUser(t, ctx, pool, q, "frozen1@test.com", 1200, 5, true)
	p2 := createTestUser(t, ctx, pool, q, "frozen2@test.com", 1200, 5, false)
	p3 := createTestUser(t, ctx, pool, q, "frozen3@test.com", 1200, 5, false)
	p4 := createTestUser(t, ctx, pool, q, "frozen4@test.com", 1200, 5, false)

	repo := ranking.NewPostgresRepo(q)
	svc := ranking.NewService(pool, repo)

	results, err := svc.ApplyELO(ctx, ranking.MatchELOInput{
		MatchID:        uuid.New(),
		TeamAPlayerIDs: []uuid.UUID{p1, p2},
		TeamBPlayerIDs: []uuid.UUID{p3, p4},
		WinnerTeam:     "A",
		GamesWon:       12,
		GamesLost:      8,
	})
	if err != nil {
		t.Fatalf("ApplyELO failed: %v", err)
	}

	// p1 (frozen) should have Delta=0.
	frozenResult := results[0]
	if frozenResult.Delta != 0 {
		t.Errorf("frozen player should have delta=0, got %d", frozenResult.Delta)
	}
	if frozenResult.OldELO != frozenResult.NewELO {
		t.Errorf("frozen player ELO should not change")
	}

	// No ELO history for p1.
	history, err := repo.GetELOHistory(ctx, p1, 10)
	if err != nil {
		t.Fatalf("GetELOHistory failed: %v", err)
	}
	if len(history) != 0 {
		t.Errorf("frozen player should have no history, got %d entries", len(history))
	}
}

func TestIntegration_ApplyELO_CalibrationKFactor(t *testing.T) {
	pool, q := setupRankingDB(t)
	ctx := context.Background()

	// matchCount=4 → K=60, expected delta=30 (equal ELOs, M=1.0, win)
	p1 := createTestUser(t, ctx, pool, q, "calib1@test.com", 1200, 4, false)
	p2 := createTestUser(t, ctx, pool, q, "calib2@test.com", 1200, 5, false) // K=20
	p3 := createTestUser(t, ctx, pool, q, "calib3@test.com", 1200, 5, false)
	p4 := createTestUser(t, ctx, pool, q, "calib4@test.com", 1200, 5, false)

	repo := ranking.NewPostgresRepo(q)
	svc := ranking.NewService(pool, repo)

	results, err := svc.ApplyELO(ctx, ranking.MatchELOInput{
		MatchID:        uuid.New(),
		TeamAPlayerIDs: []uuid.UUID{p1, p2},
		TeamBPlayerIDs: []uuid.UUID{p3, p4},
		WinnerTeam:     "A",
		GamesWon:       12,
		GamesLost:      12, // diff=0, M=1.0
	})
	if err != nil {
		t.Fatalf("ApplyELO failed: %v", err)
	}

	// p1 (K=60) should have larger delta than p2 (K=20).
	p1Result := results[0]
	p2Result := results[1]

	if p1Result.KFactor != 60 {
		t.Errorf("p1 K-factor should be 60, got %d", p1Result.KFactor)
	}
	if p2Result.KFactor != 20 {
		t.Errorf("p2 K-factor should be 20, got %d", p2Result.KFactor)
	}
	if p1Result.Delta <= p2Result.Delta {
		t.Errorf("calibration player (K=60) delta %d should be > recurrent (K=20) delta %d",
			p1Result.Delta, p2Result.Delta)
	}
}

func TestIntegration_ApplyELO_HistoryRecordedForAllNonFrozen(t *testing.T) {
	pool, q := setupRankingDB(t)
	ctx := context.Background()

	p1 := createTestUser(t, ctx, pool, q, "hist1@test.com", 1000, 10, false)
	p2 := createTestUser(t, ctx, pool, q, "hist2@test.com", 1100, 10, false)
	p3 := createTestUser(t, ctx, pool, q, "hist3@test.com", 1200, 10, false)
	p4 := createTestUser(t, ctx, pool, q, "hist4@test.com", 1300, 10, false)

	repo := ranking.NewPostgresRepo(q)
	svc := ranking.NewService(pool, repo)

	matchID := uuid.New()
	_, err := svc.ApplyELO(ctx, ranking.MatchELOInput{
		MatchID:        matchID,
		TeamAPlayerIDs: []uuid.UUID{p1, p2},
		TeamBPlayerIDs: []uuid.UUID{p3, p4},
		WinnerTeam:     "B",
		GamesWon:       12,
		GamesLost:      0, // diff=12, M=1.5
	})
	if err != nil {
		t.Fatalf("ApplyELO failed: %v", err)
	}

	for _, pid := range []uuid.UUID{p1, p2, p3, p4} {
		history, err := repo.GetELOHistory(ctx, pid, 10)
		if err != nil {
			t.Fatalf("GetELOHistory(%s): %v", pid, err)
		}
		if len(history) != 1 {
			t.Errorf("player %s: expected 1 history entry, got %d", pid, len(history))
		}
	}
}
