package match_test

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
	"github.com/juani/blendpadel/backend/internal/match"
	"github.com/juani/blendpadel/backend/internal/platform/database"
	"github.com/juani/blendpadel/backend/internal/ranking"
	"github.com/juani/blendpadel/backend/internal/trust"
	"github.com/juani/blendpadel/backend/migrations"
)

func setupMatchDB(t *testing.T) (*pgxpool.Pool, *db.Queries) {
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

func createPlayer(t *testing.T, ctx context.Context, pool *pgxpool.Pool, q *db.Queries, email string) uuid.UUID {
	t.Helper()
	user, err := q.CreateUser(ctx, db.CreateUserParams{
		Email:        email,
		PasswordHash: "hash",
		Name:         pgtype.Text{String: "Player", Valid: true},
	})
	require.NoError(t, err, "creating test player %s", email)

	// Complete onboarding to set up ELO.
	_, err = pool.Exec(ctx, `UPDATE users SET onboarding_completed=true, elo=1200, status='calibration', trust_score=80 WHERE id=$1`, user.ID)
	require.NoError(t, err)

	return uuid.UUID(user.ID.Bytes)
}

func newMatchService(t *testing.T, pool *pgxpool.Pool, q *db.Queries) *match.Service {
	t.Helper()
	matchRepo := match.NewPostgresRepo(q)
	rankingRepo := ranking.NewPostgresRepo(q)
	rankingSvc := ranking.NewService(pool, rankingRepo)
	trustRepo := trust.NewPostgresRepo(q)
	trustSvc := trust.NewService(trustRepo)
	return match.NewService(matchRepo, rankingSvc, trustSvc)
}

// TestIntegration_FullMatchFlow tests the complete happy path:
// create match → submit result → confirm → verify ELO changed.
func TestIntegration_FullMatchFlow(t *testing.T) {
	pool, q := setupMatchDB(t)
	ctx := context.Background()

	p1 := createPlayer(t, ctx, pool, q, "p1@match.test")
	p2 := createPlayer(t, ctx, pool, q, "p2@match.test")
	p3 := createPlayer(t, ctx, pool, q, "p3@match.test")
	p4 := createPlayer(t, ctx, pool, q, "p4@match.test")

	svc := newMatchService(t, pool, q)

	// Create match: creator = p1 (captain_a), captain_b = p3
	req := match.CreateMatchRequest{
		TeamA:       []uuid.UUID{p1, p2},
		TeamB:       []uuid.UUID{p3, p4},
		ScheduledAt: time.Now().Add(2 * time.Hour),
		Latitude:    -33.0,
		Longitude:   -68.0,
	}
	resp, err := svc.CreateMatch(ctx, p1, req)
	require.NoError(t, err)
	assert.Equal(t, match.StatusPendingResult, resp.Status)
	matchID := resp.ID

	// Submit result as captain_a.
	submitReq := match.SubmitResultRequest{
		Sets: []match.SetScore{
			{TeamAGames: 6, TeamBGames: 4},
			{TeamAGames: 7, TeamBGames: 5},
		},
	}
	err = svc.SubmitResult(ctx, matchID, p1, submitReq)
	require.NoError(t, err)

	// Confirm as captain_b.
	err = svc.ConfirmMatch(ctx, matchID, p3)
	require.NoError(t, err)

	// Verify ELO changed for all players.
	for _, pid := range []uuid.UUID{p1, p2, p3, p4} {
		var elo int32
		err := pool.QueryRow(ctx, "SELECT elo FROM users WHERE id=$1", pgtype.UUID{Bytes: pid, Valid: true}).Scan(&elo)
		require.NoError(t, err)
		// ELO should differ from starting 1200 (team A won, A gains, B loses).
		assert.NotEqual(t, int32(1200), elo, "ELO should have changed for player %s", pid)
	}
}

// TestIntegration_SubmitByNonCaptain verifies that a non-captain cannot submit result.
func TestIntegration_SubmitByNonCaptain(t *testing.T) {
	pool, q := setupMatchDB(t)
	ctx := context.Background()

	p1 := createPlayer(t, ctx, pool, q, "nc1@match.test")
	p2 := createPlayer(t, ctx, pool, q, "nc2@match.test")
	p3 := createPlayer(t, ctx, pool, q, "nc3@match.test")
	p4 := createPlayer(t, ctx, pool, q, "nc4@match.test")

	svc := newMatchService(t, pool, q)

	resp, err := svc.CreateMatch(ctx, p1, match.CreateMatchRequest{
		TeamA: []uuid.UUID{p1, p2}, TeamB: []uuid.UUID{p3, p4},
		ScheduledAt: time.Now().Add(time.Hour), Latitude: -33, Longitude: -68,
	})
	require.NoError(t, err)

	// p2 is NOT a captain — should get ErrNotCaptain.
	err = svc.SubmitResult(ctx, resp.ID, p2, match.SubmitResultRequest{
		Sets: []match.SetScore{{TeamAGames: 6, TeamBGames: 4}, {TeamAGames: 6, TeamBGames: 4}},
	})
	assert.ErrorIs(t, err, match.ErrNotCaptain)
}

// TestIntegration_ConfirmByCaptainA verifies that captain_a cannot confirm (only captain_b can).
func TestIntegration_ConfirmByCaptainA(t *testing.T) {
	pool, q := setupMatchDB(t)
	ctx := context.Background()

	p1 := createPlayer(t, ctx, pool, q, "ca1@match.test")
	p2 := createPlayer(t, ctx, pool, q, "ca2@match.test")
	p3 := createPlayer(t, ctx, pool, q, "ca3@match.test")
	p4 := createPlayer(t, ctx, pool, q, "ca4@match.test")

	svc := newMatchService(t, pool, q)

	resp, err := svc.CreateMatch(ctx, p1, match.CreateMatchRequest{
		TeamA: []uuid.UUID{p1, p2}, TeamB: []uuid.UUID{p3, p4},
		ScheduledAt: time.Now().Add(time.Hour), Latitude: -33, Longitude: -68,
	})
	require.NoError(t, err)

	err = svc.SubmitResult(ctx, resp.ID, p1, match.SubmitResultRequest{
		Sets: []match.SetScore{{TeamAGames: 6, TeamBGames: 4}, {TeamAGames: 6, TeamBGames: 4}},
	})
	require.NoError(t, err)

	// p1 is captain_a — should get ErrForbidden.
	err = svc.ConfirmMatch(ctx, resp.ID, p1)
	assert.ErrorIs(t, err, match.ErrForbidden)
}

// TestIntegration_DisputeFlow verifies dispute creation and trust penalization.
func TestIntegration_DisputeFlow(t *testing.T) {
	pool, q := setupMatchDB(t)
	ctx := context.Background()

	p1 := createPlayer(t, ctx, pool, q, "d1@match.test")
	p2 := createPlayer(t, ctx, pool, q, "d2@match.test")
	p3 := createPlayer(t, ctx, pool, q, "d3@match.test")
	p4 := createPlayer(t, ctx, pool, q, "d4@match.test")

	svc := newMatchService(t, pool, q)

	resp, err := svc.CreateMatch(ctx, p1, match.CreateMatchRequest{
		TeamA: []uuid.UUID{p1, p2}, TeamB: []uuid.UUID{p3, p4},
		ScheduledAt: time.Now().Add(time.Hour), Latitude: -33, Longitude: -68,
	})
	require.NoError(t, err)

	// Get starting trust scores.
	var startTrustA, startTrustB int32
	pool.QueryRow(ctx, "SELECT trust_score FROM users WHERE id=$1", pgtype.UUID{Bytes: p1, Valid: true}).Scan(&startTrustA)
	pool.QueryRow(ctx, "SELECT trust_score FROM users WHERE id=$1", pgtype.UUID{Bytes: p3, Valid: true}).Scan(&startTrustB)

	err = svc.SubmitResult(ctx, resp.ID, p1, match.SubmitResultRequest{
		Sets: []match.SetScore{{TeamAGames: 6, TeamBGames: 4}, {TeamAGames: 6, TeamBGames: 4}},
	})
	require.NoError(t, err)

	// captain_b disputes.
	err = svc.DisputeMatch(ctx, resp.ID, p3, match.DisputeRequest{Reason: "scores are wrong"})
	require.NoError(t, err)

	// Match should now be in disputed status.
	matchRepo := match.NewPostgresRepo(q)
	m, err := matchRepo.GetMatch(ctx, resp.ID)
	require.NoError(t, err)
	assert.Equal(t, match.StatusDisputed, m.Status)

	// Both captains should have lower trust score.
	var endTrustA, endTrustB int32
	pool.QueryRow(ctx, "SELECT trust_score FROM users WHERE id=$1", pgtype.UUID{Bytes: p1, Valid: true}).Scan(&endTrustA)
	pool.QueryRow(ctx, "SELECT trust_score FROM users WHERE id=$1", pgtype.UUID{Bytes: p3, Valid: true}).Scan(&endTrustB)

	assert.Less(t, endTrustA, startTrustA, "captain_a trust should decrease after dispute")
	assert.Less(t, endTrustB, startTrustB, "captain_b trust should decrease after dispute")
}

// TestIntegration_ResolveDisputeByModerator verifies moderator can resolve dispute.
func TestIntegration_ResolveDisputeByModerator(t *testing.T) {
	pool, q := setupMatchDB(t)
	ctx := context.Background()

	p1 := createPlayer(t, ctx, pool, q, "mod1@match.test")
	p2 := createPlayer(t, ctx, pool, q, "mod2@match.test")
	p3 := createPlayer(t, ctx, pool, q, "mod3@match.test")
	p4 := createPlayer(t, ctx, pool, q, "mod4@match.test")
	moderator := createPlayer(t, ctx, pool, q, "mod5@match.test")

	// Make the moderator a moderator.
	_, err := pool.Exec(ctx, "UPDATE users SET role='moderator' WHERE id=$1", pgtype.UUID{Bytes: moderator, Valid: true})
	require.NoError(t, err)

	svc := newMatchService(t, pool, q)

	resp, err := svc.CreateMatch(ctx, p1, match.CreateMatchRequest{
		TeamA: []uuid.UUID{p1, p2}, TeamB: []uuid.UUID{p3, p4},
		ScheduledAt: time.Now().Add(time.Hour), Latitude: -33, Longitude: -68,
	})
	require.NoError(t, err)

	err = svc.SubmitResult(ctx, resp.ID, p1, match.SubmitResultRequest{
		Sets: []match.SetScore{{TeamAGames: 6, TeamBGames: 4}, {TeamAGames: 6, TeamBGames: 4}},
	})
	require.NoError(t, err)

	err = svc.DisputeMatch(ctx, resp.ID, p3, match.DisputeRequest{Reason: "I disagree"})
	require.NoError(t, err)

	// Moderator gets pending disputes.
	disputes, err := svc.GetPendingDisputes(ctx)
	require.NoError(t, err)
	require.Len(t, disputes, 1)

	// Resolve the dispute.
	err = svc.ResolveDispute(ctx, disputes[0].ID, moderator, match.ResolveDisputeRequest{})
	require.NoError(t, err)

	// Match should now be sealed.
	matchRepo := match.NewPostgresRepo(q)
	m, err := matchRepo.GetMatch(ctx, resp.ID)
	require.NoError(t, err)
	assert.Equal(t, match.StatusSealed, m.Status)
	assert.Equal(t, "moderator", m.SealedBy)
}

// TestIntegration_GetMatchHistory verifies sealed matches appear in history.
func TestIntegration_GetMatchHistory(t *testing.T) {
	pool, q := setupMatchDB(t)
	ctx := context.Background()

	p1 := createPlayer(t, ctx, pool, q, "h1@match.test")
	p2 := createPlayer(t, ctx, pool, q, "h2@match.test")
	p3 := createPlayer(t, ctx, pool, q, "h3@match.test")
	p4 := createPlayer(t, ctx, pool, q, "h4@match.test")

	svc := newMatchService(t, pool, q)

	// Play 2 matches.
	for i := 0; i < 2; i++ {
		resp, err := svc.CreateMatch(ctx, p1, match.CreateMatchRequest{
			TeamA: []uuid.UUID{p1, p2}, TeamB: []uuid.UUID{p3, p4},
			ScheduledAt: time.Now().Add(time.Duration(i+1) * time.Hour), Latitude: -33, Longitude: -68,
		})
		require.NoError(t, err)

		err = svc.SubmitResult(ctx, resp.ID, p1, match.SubmitResultRequest{
			Sets: []match.SetScore{{TeamAGames: 6, TeamBGames: 4}, {TeamAGames: 6, TeamBGames: 4}},
		})
		require.NoError(t, err)

		err = svc.ConfirmMatch(ctx, resp.ID, p3)
		require.NoError(t, err)
	}

	// Get history for p1.
	history, err := svc.GetMatchHistory(ctx, p1, 10, 0)
	require.NoError(t, err)
	assert.Len(t, history, 2)
	for _, h := range history {
		assert.Equal(t, match.StatusSealed, h.Status)
		assert.Equal(t, "A", h.WinnerTeam)
	}
}

// TestIntegration_CalibrationEgress verifies that after 3 matches, player graduates from calibration.
func TestIntegration_CalibrationEgress(t *testing.T) {
	pool, q := setupMatchDB(t)
	ctx := context.Background()

	// p1 starts in calibration with 2 validated matches (one more will trigger egress).
	p1 := createPlayer(t, ctx, pool, q, "cal1@match.test")
	p2 := createPlayer(t, ctx, pool, q, "cal2@match.test")
	p3 := createPlayer(t, ctx, pool, q, "cal3@match.test")
	p4 := createPlayer(t, ctx, pool, q, "cal4@match.test")

	// Set p1 to have 2 validated matches already.
	_, err := pool.Exec(ctx, "UPDATE users SET validated_match_count=2 WHERE id=$1", pgtype.UUID{Bytes: p1, Valid: true})
	require.NoError(t, err)

	svc := newMatchService(t, pool, q)

	// Play one match (sealing increments validated_match_count via ranking.ApplyELO).
	resp, createErr := svc.CreateMatch(ctx, p1, match.CreateMatchRequest{
		TeamA: []uuid.UUID{p1, p2}, TeamB: []uuid.UUID{p3, p4},
		ScheduledAt: time.Now().Add(time.Hour), Latitude: -33, Longitude: -68,
	})
	require.NoError(t, createErr)

	err = svc.SubmitResult(ctx, resp.ID, p1, match.SubmitResultRequest{
		Sets: []match.SetScore{{TeamAGames: 6, TeamBGames: 4}, {TeamAGames: 6, TeamBGames: 4}},
	})
	require.NoError(t, err)

	err = svc.ConfirmMatch(ctx, resp.ID, p3)
	require.NoError(t, err)

	// After sealing, p1 should now have validated_match_count=3 and status='active'.
	var status string
	var matchCount int32
	err = pool.QueryRow(ctx, "SELECT status, validated_match_count FROM users WHERE id=$1", pgtype.UUID{Bytes: p1, Valid: true}).Scan(&status, &matchCount)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, matchCount, int32(3))
	assert.Equal(t, "active", status, "player should have graduated from calibration to active")
}

// TestIntegration_AutoSealer verifies the auto-sealer seals expired matches.
func TestIntegration_AutoSealer(t *testing.T) {
	pool, q := setupMatchDB(t)
	ctx := context.Background()

	p1 := createPlayer(t, ctx, pool, q, "as1@match.test")
	p2 := createPlayer(t, ctx, pool, q, "as2@match.test")
	p3 := createPlayer(t, ctx, pool, q, "as3@match.test")
	p4 := createPlayer(t, ctx, pool, q, "as4@match.test")

	svc := newMatchService(t, pool, q)

	// Create match and submit result.
	resp, err := svc.CreateMatch(ctx, p1, match.CreateMatchRequest{
		TeamA: []uuid.UUID{p1, p2}, TeamB: []uuid.UUID{p3, p4},
		ScheduledAt: time.Now().Add(time.Hour), Latitude: -33, Longitude: -68,
	})
	require.NoError(t, err)

	err = svc.SubmitResult(ctx, resp.ID, p1, match.SubmitResultRequest{
		Sets: []match.SetScore{{TeamAGames: 6, TeamBGames: 4}, {TeamAGames: 6, TeamBGames: 4}},
	})
	require.NoError(t, err)

	// Manually backdate the submitted_at to simulate 6h+ expiry.
	_, err = pool.Exec(ctx, "UPDATE match_results SET submitted_at = NOW() - INTERVAL '7 hours' WHERE match_id=$1",
		pgtype.UUID{Bytes: resp.ID, Valid: true})
	require.NoError(t, err)

	// Run a single auto-sealer tick.
	sealer := match.NewAutoSealer(svc, time.Minute)
	sealer.RunOnce(ctx)

	// Verify the match is now sealed.
	matchRepo := match.NewPostgresRepo(q)
	m, err := matchRepo.GetMatch(ctx, resp.ID)
	require.NoError(t, err)
	assert.Equal(t, match.StatusSealed, m.Status)
	assert.Equal(t, "auto", m.SealedBy)
}
