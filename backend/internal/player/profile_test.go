package player_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"

	"github.com/juani/blendpadel/backend/internal/auth"
	"github.com/juani/blendpadel/backend/internal/db"
	"github.com/juani/blendpadel/backend/internal/platform/database"
	"github.com/juani/blendpadel/backend/internal/player"
	"github.com/juani/blendpadel/backend/migrations"
)

// profileTestEnv extends the base test setup with support for multiple users
// and match operations needed for EPIC 08 tests.
type profileTestEnv struct {
	server  *httptest.Server
	pool    *pgxpool.Pool
	queries *db.Queries
	jwtMgr  *auth.JWTManager
}

func setupProfileTestEnv(t *testing.T) *profileTestEnv {
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

	queries := db.New(pool)

	authRepo := auth.NewPostgresRepo(queries)
	jwtMgr := auth.NewJWTManager("profile-integration-test-secret-32b!", time.Hour)
	limiterCtx, cancel := context.WithCancel(ctx)
	t.Cleanup(cancel)
	rateLimiter := auth.NewRateLimiter(limiterCtx, 100, time.Minute)
	authSvc := auth.NewService(authRepo, jwtMgr, rateLimiter)
	authHandler := auth.NewHandler(authSvc)

	authMw := auth.AuthMiddleware(jwtMgr)
	rateLimitMw := auth.RateLimitMiddleware(rateLimiter)
	requireModerator := auth.RequireRole("moderator", "superadmin")
	requireRegion := auth.RequireRegion()

	playerRepo := player.NewPostgresRepo(queries)
	playerSvc := player.NewService(playerRepo, t.TempDir())
	playerHandler := player.NewHandler(playerSvc)

	r := chi.NewRouter()
	auth.RegisterRoutes(r, authHandler, authMw, rateLimitMw)
	player.RegisterRoutes(r, playerHandler, authMw, requireModerator, requireRegion)

	srv := httptest.NewServer(r)
	t.Cleanup(srv.Close)

	return &profileTestEnv{
		server:  srv,
		pool:    pool,
		queries: queries,
		jwtMgr:  jwtMgr,
	}
}

// registerAndGetToken registers a user and returns their access token.
func (e *profileTestEnv) registerAndGetToken(t *testing.T, email, password, name string) string {
	t.Helper()
	return registerAndLogin(t, e.server.URL, email, password, name)
}

// seedUserWithTrustAndStatus directly updates a user's trust_score and status in the DB.
func (e *profileTestEnv) seedUserWithTrustAndStatus(t *testing.T, email string, trustScore int32, status string) {
	t.Helper()
	_, err := e.pool.Exec(context.Background(),
		"UPDATE users SET trust_score = $1, status = $2 WHERE email = $3",
		trustScore, status, email,
	)
	if err != nil {
		t.Fatalf("seed user trust/status: %v", err)
	}
}

// getUserID returns the UUID of a user by email.
func (e *profileTestEnv) getUserID(t *testing.T, email string) string {
	t.Helper()
	var id pgtype.UUID
	err := e.pool.QueryRow(context.Background(),
		"SELECT id FROM users WHERE email = $1", email,
	).Scan(&id)
	if err != nil {
		t.Fatalf("get user id for %s: %v", email, err)
	}
	var uid [16]byte = id.Bytes
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		uid[0:4], uid[4:6], uid[6:8], uid[8:10], uid[10:16])
}

// seedCompletedMatch creates a completed match with the given players (A team and B team).
// Returns the match UUID string.
func (e *profileTestEnv) seedCompletedMatch(t *testing.T, playerAID, playerBID string) string {
	t.Helper()
	ctx := context.Background()

	var matchID pgtype.UUID
	err := e.pool.QueryRow(ctx, `
		INSERT INTO matches (status, scheduled_at, captain_a_id, captain_b_id)
		VALUES ('sealed', NOW(), $1::uuid, $2::uuid)
		RETURNING id
	`, playerAID, playerBID).Scan(&matchID)
	if err != nil {
		t.Fatalf("seed match: %v", err)
	}

	// Add both players to match_players.
	_, err = e.pool.Exec(ctx, `
		INSERT INTO match_players (match_id, player_id, team) VALUES ($1, $2::uuid, 'A'), ($1, $3::uuid, 'B')
	`, matchID, playerAID, playerBID)
	if err != nil {
		t.Fatalf("seed match_players: %v", err)
	}

	var uid [16]byte = matchID.Bytes
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		uid[0:4], uid[4:6], uid[6:8], uid[8:10], uid[10:16])
}

// seedScheduledMatch creates a match with status 'scheduled'.
func (e *profileTestEnv) seedScheduledMatch(t *testing.T, playerAID, playerBID string) string {
	t.Helper()
	ctx := context.Background()

	var matchID pgtype.UUID
	err := e.pool.QueryRow(ctx, `
		INSERT INTO matches (status, scheduled_at, captain_a_id, captain_b_id)
		VALUES ('scheduled', NOW() + INTERVAL '1 day', $1::uuid, $2::uuid)
		RETURNING id
	`, playerAID, playerBID).Scan(&matchID)
	if err != nil {
		t.Fatalf("seed scheduled match: %v", err)
	}

	_, err = e.pool.Exec(ctx, `
		INSERT INTO match_players (match_id, player_id, team) VALUES ($1, $2::uuid, 'A'), ($1, $3::uuid, 'B')
	`, matchID, playerAID, playerBID)
	if err != nil {
		t.Fatalf("seed match_players for scheduled match: %v", err)
	}

	var uid [16]byte = matchID.Bytes
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		uid[0:4], uid[4:6], uid[6:8], uid[8:10], uid[10:16])
}

// authedPostJSON sends an authenticated POST with a JSON body.
func authedPostJSON(t *testing.T, url, token string, body interface{}) *http.Response {
	t.Helper()
	b, _ := json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPost, url, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("POST %s failed: %v", url, err)
	}
	return resp
}

// --- Public Profile Tests ---

func TestIntegration_GetPublicProfile_OtherPlayer_ReturnsTrustLabel(t *testing.T) {
	env := setupProfileTestEnv(t)

	// Register two users.
	tokenA := env.registerAndGetToken(t, "player_a@example.com", "Password1", "Player A")
	_ = env.registerAndGetToken(t, "player_b@example.com", "Password1", "Player B")

	idB := env.getUserID(t, "player_b@example.com")
	env.seedUserWithTrustAndStatus(t, "player_b@example.com", 85, "active")

	resp := authedGet(t, env.server.URL+"/players/"+idB, tokenA)
	body := readBody(t, resp)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, body)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if result["trust_label"] != "Bueno" {
		t.Errorf("expected trust_label 'Bueno' for score 85, got %v", result["trust_label"])
	}
	if _, hasScore := result["trust_score"]; hasScore {
		t.Error("public view should not expose trust_score field")
	}
	if _, hasPrefs := result["preferences"]; hasPrefs {
		t.Error("public view should not expose preferences field")
	}
}

func TestIntegration_GetPublicProfile_SelfView_IncludesTrustScore(t *testing.T) {
	env := setupProfileTestEnv(t)

	tokenA := env.registerAndGetToken(t, "self_viewer@example.com", "Password1", "Self Viewer")
	idA := env.getUserID(t, "self_viewer@example.com")
	env.seedUserWithTrustAndStatus(t, "self_viewer@example.com", 85, "active")

	resp := authedGet(t, env.server.URL+"/players/"+idA, tokenA)
	body := readBody(t, resp)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, body)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	score, hasScore := result["trust_score"]
	if !hasScore {
		t.Error("self-view should include trust_score")
	}
	if score != float64(85) {
		t.Errorf("expected trust_score 85, got %v", score)
	}
	if result["trust_label"] != "Bueno" {
		t.Errorf("expected trust_label 'Bueno', got %v", result["trust_label"])
	}
	if _, hasPrefs := result["preferences"]; !hasPrefs {
		t.Error("self-view should include preferences")
	}
}

func TestIntegration_GetPublicProfile_TrustLabelBoundaries(t *testing.T) {
	env := setupProfileTestEnv(t)

	cases := []struct {
		score int32
		label string
	}{
		{90, "Excelente"},
		{70, "Bueno"},
		{69, "Bajo"},
	}

	viewer := env.registerAndGetToken(t, "viewer@example.com", "Password1", "Viewer")

	for _, tc := range cases {
		email := fmt.Sprintf("trust_%d@example.com", tc.score)
		_ = env.registerAndGetToken(t, email, "Password1", fmt.Sprintf("Trust %d", tc.score))
		id := env.getUserID(t, email)
		env.seedUserWithTrustAndStatus(t, email, tc.score, "active")

		resp := authedGet(t, env.server.URL+"/players/"+id, viewer)
		body := readBody(t, resp)

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("score=%d: expected 200, got %d: %s", tc.score, resp.StatusCode, body)
		}

		var result map[string]interface{}
		json.Unmarshal(body, &result)

		if result["trust_label"] != tc.label {
			t.Errorf("score=%d: expected label %q, got %v", tc.score, tc.label, result["trust_label"])
		}
	}
}

func TestIntegration_GetPublicProfile_BannedPlayer_Returns404(t *testing.T) {
	env := setupProfileTestEnv(t)

	viewer := env.registerAndGetToken(t, "viewer2@example.com", "Password1", "Viewer2")
	_ = env.registerAndGetToken(t, "banned_soft@example.com", "Password1", "Banned Soft")
	idBanned := env.getUserID(t, "banned_soft@example.com")
	env.seedUserWithTrustAndStatus(t, "banned_soft@example.com", 75, "banned_soft")

	resp := authedGet(t, env.server.URL+"/players/"+idBanned, viewer)
	body := readBody(t, resp)

	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("expected 404 for banned_soft player, got %d: %s", resp.StatusCode, body)
	}
}

func TestIntegration_GetPublicProfile_HardBannedPlayer_Returns404(t *testing.T) {
	env := setupProfileTestEnv(t)

	viewer := env.registerAndGetToken(t, "viewer3@example.com", "Password1", "Viewer3")
	_ = env.registerAndGetToken(t, "banned_hard@example.com", "Password1", "Banned Hard")
	idBanned := env.getUserID(t, "banned_hard@example.com")
	env.seedUserWithTrustAndStatus(t, "banned_hard@example.com", 75, "banned_hard")

	resp := authedGet(t, env.server.URL+"/players/"+idBanned, viewer)
	body := readBody(t, resp)

	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("expected 404 for banned_hard player, got %d: %s", resp.StatusCode, body)
	}
}

func TestIntegration_GetPublicProfile_BannedPlayer_SelfView_Returns200(t *testing.T) {
	env := setupProfileTestEnv(t)

	tokenBanned := env.registerAndGetToken(t, "self_banned@example.com", "Password1", "Self Banned")
	idBanned := env.getUserID(t, "self_banned@example.com")
	env.seedUserWithTrustAndStatus(t, "self_banned@example.com", 75, "banned_soft")

	resp := authedGet(t, env.server.URL+"/players/"+idBanned, tokenBanned)
	body := readBody(t, resp)

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200 for self-view of own banned profile, got %d: %s", resp.StatusCode, body)
	}
}

// --- Update Preferences Tests ---

func TestIntegration_UpdatePreferences_Valid_Returns200(t *testing.T) {
	env := setupProfileTestEnv(t)

	token := env.registerAndGetToken(t, "prefs_user@example.com", "Password1", "Prefs User")
	id := env.getUserID(t, "prefs_user@example.com")

	resp := authedPut(t, env.server.URL+"/players/me/preferences", token, map[string]int{
		"radar_radius_km": 25,
		"elo_min_delta":   -150,
		"elo_max_delta":   300,
	})
	body := readBody(t, resp)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, body)
	}

	var prefs map[string]interface{}
	if err := json.Unmarshal(body, &prefs); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if prefs["radar_radius_km"] != float64(25) {
		t.Errorf("expected radar_radius_km=25, got %v", prefs["radar_radius_km"])
	}
	if prefs["elo_min_delta"] != float64(-150) {
		t.Errorf("expected elo_min_delta=-150, got %v", prefs["elo_min_delta"])
	}
	if prefs["elo_max_delta"] != float64(300) {
		t.Errorf("expected elo_max_delta=300, got %v", prefs["elo_max_delta"])
	}

	// Verify persisted via own profile.
	selfResp := authedGet(t, env.server.URL+"/players/"+id, token)
	selfBody := readBody(t, selfResp)
	var self map[string]interface{}
	json.Unmarshal(selfBody, &self)
	prefsInProfile, _ := self["preferences"].(map[string]interface{})
	if prefsInProfile == nil || prefsInProfile["radar_radius_km"] != float64(25) {
		t.Errorf("preferences not persisted: %v", self["preferences"])
	}
}

func TestIntegration_UpdatePreferences_InvalidRadius_Returns422(t *testing.T) {
	env := setupProfileTestEnv(t)
	token := env.registerAndGetToken(t, "prefs_invalid@example.com", "Password1", "Prefs Invalid")

	cases := []map[string]int{
		{"radar_radius_km": 0, "elo_min_delta": -100, "elo_max_delta": 100},
		{"radar_radius_km": 51, "elo_min_delta": -100, "elo_max_delta": 100},
	}

	for _, body := range cases {
		resp := authedPut(t, env.server.URL+"/players/me/preferences", token, body)
		respBody := readBody(t, resp)
		if resp.StatusCode != http.StatusUnprocessableEntity {
			t.Errorf("expected 422 for radius=%d, got %d: %s", body["radar_radius_km"], resp.StatusCode, respBody)
		}
	}
}

func TestIntegration_UpdatePreferences_InvalidDelta_Returns422(t *testing.T) {
	env := setupProfileTestEnv(t)
	token := env.registerAndGetToken(t, "prefs_delta@example.com", "Password1", "Prefs Delta")

	cases := []map[string]int{
		// elo_min_delta must be <= 0
		{"radar_radius_km": 10, "elo_min_delta": 100, "elo_max_delta": 100},
		// elo_max_delta must be >= 0
		{"radar_radius_km": 10, "elo_min_delta": -100, "elo_max_delta": -100},
		// elo_min_delta out of range
		{"radar_radius_km": 10, "elo_min_delta": -600, "elo_max_delta": 100},
	}

	for _, body := range cases {
		resp := authedPut(t, env.server.URL+"/players/me/preferences", token, body)
		respBody := readBody(t, resp)
		if resp.StatusCode != http.StatusUnprocessableEntity {
			t.Errorf("expected 422 for %v, got %d: %s", body, resp.StatusCode, respBody)
		}
	}
}

// --- Report Conduct Tests ---

func TestIntegration_ReportConduct_Valid_Returns201(t *testing.T) {
	env := setupProfileTestEnv(t)

	tokenA := env.registerAndGetToken(t, "report_a@example.com", "Password1", "Report A")
	_ = env.registerAndGetToken(t, "report_b@example.com", "Password1", "Report B")
	idA := env.getUserID(t, "report_a@example.com")
	idB := env.getUserID(t, "report_b@example.com")
	matchID := env.seedCompletedMatch(t, idA, idB)

	resp := authedPostJSON(t, env.server.URL+"/matches/"+matchID+"/report", tokenA, map[string]interface{}{
		"reported_id": idB,
		"reason":      "Falta de respeto",
	})
	body := readBody(t, resp)

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", resp.StatusCode, body)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if result["status"] != "pending" {
		t.Errorf("expected status=pending, got %v", result["status"])
	}
}

func TestIntegration_ReportConduct_NotParticipant_Returns403(t *testing.T) {
	env := setupProfileTestEnv(t)

	tokenC := env.registerAndGetToken(t, "outsider@example.com", "Password1", "Outsider")
	_ = env.registerAndGetToken(t, "in_match_a@example.com", "Password1", "In Match A")
	_ = env.registerAndGetToken(t, "in_match_b@example.com", "Password1", "In Match B")
	idA := env.getUserID(t, "in_match_a@example.com")
	idB := env.getUserID(t, "in_match_b@example.com")
	matchID := env.seedCompletedMatch(t, idA, idB)

	resp := authedPostJSON(t, env.server.URL+"/matches/"+matchID+"/report", tokenC, map[string]interface{}{
		"reported_id": idB,
		"reason":      "Bad behavior",
	})
	body := readBody(t, resp)

	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("expected 403 for non-participant, got %d: %s", resp.StatusCode, body)
	}
}

func TestIntegration_ReportConduct_MatchNotCompleted_Returns422(t *testing.T) {
	env := setupProfileTestEnv(t)

	tokenA := env.registerAndGetToken(t, "sched_a@example.com", "Password1", "Sched A")
	_ = env.registerAndGetToken(t, "sched_b@example.com", "Password1", "Sched B")
	idA := env.getUserID(t, "sched_a@example.com")
	idB := env.getUserID(t, "sched_b@example.com")
	matchID := env.seedScheduledMatch(t, idA, idB)

	resp := authedPostJSON(t, env.server.URL+"/matches/"+matchID+"/report", tokenA, map[string]interface{}{
		"reported_id": idB,
		"reason":      "Bad behavior",
	})
	body := readBody(t, resp)

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("expected 422 for non-completed match, got %d: %s", resp.StatusCode, body)
	}
}

func TestIntegration_ReportConduct_Duplicate_Returns409(t *testing.T) {
	env := setupProfileTestEnv(t)

	tokenA := env.registerAndGetToken(t, "dup_a@example.com", "Password1", "Dup A")
	_ = env.registerAndGetToken(t, "dup_b@example.com", "Password1", "Dup B")
	idA := env.getUserID(t, "dup_a@example.com")
	idB := env.getUserID(t, "dup_b@example.com")
	matchID := env.seedCompletedMatch(t, idA, idB)

	payload := map[string]interface{}{
		"reported_id": idB,
		"reason":      "Bad behavior",
	}

	// First report.
	first := authedPostJSON(t, env.server.URL+"/matches/"+matchID+"/report", tokenA, payload)
	first.Body.Close()

	// Duplicate.
	second := authedPostJSON(t, env.server.URL+"/matches/"+matchID+"/report", tokenA, payload)
	body := readBody(t, second)

	if second.StatusCode != http.StatusConflict {
		t.Errorf("expected 409 for duplicate report, got %d: %s", second.StatusCode, body)
	}
}

// --- Admin Reports Tests ---

func TestIntegration_GetAdminReports_NoModeratorRole_Returns403(t *testing.T) {
	env := setupProfileTestEnv(t)

	// Regular player trying to access admin endpoint.
	token := env.registerAndGetToken(t, "regular@example.com", "Password1", "Regular")

	resp := authedGet(t, env.server.URL+"/admin/reports", token)
	body := readBody(t, resp)

	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("expected 403 for non-moderator accessing admin/reports, got %d: %s", resp.StatusCode, body)
	}
}
