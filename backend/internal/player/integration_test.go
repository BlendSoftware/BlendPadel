package player_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"

	"github.com/juani/blendpadel/backend/internal/auth"
	"github.com/juani/blendpadel/backend/internal/db"
	"github.com/juani/blendpadel/backend/internal/platform/database"
	"github.com/juani/blendpadel/backend/internal/player"
	"github.com/juani/blendpadel/backend/migrations"
)

// playerTestEnv holds all wired dependencies for player integration tests.
type playerTestEnv struct {
	server    *httptest.Server
	uploadDir string
	// tokens for a pre-registered user
	accessToken string
}

func setupPlayerTestEnv(t *testing.T) *playerTestEnv {
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

	// Temp upload dir.
	uploadDir, err := os.MkdirTemp("", "player-test-uploads-*")
	if err != nil {
		t.Fatalf("failed to create temp upload dir: %v", err)
	}
	t.Cleanup(func() { os.RemoveAll(uploadDir) })

	queries := db.New(pool)

	// Auth dependencies.
	authRepo := auth.NewPostgresRepo(queries)
	jwtMgr := auth.NewJWTManager("player-integration-test-secret-32b!", time.Hour)
	limiterCtx, cancel := context.WithCancel(ctx)
	t.Cleanup(cancel)
	rateLimiter := auth.NewRateLimiter(limiterCtx, 100, time.Minute)
	authSvc := auth.NewService(authRepo, jwtMgr, rateLimiter)
	authHandler := auth.NewHandler(authSvc)

	authMw := auth.AuthMiddleware(jwtMgr)
	rateLimitMw := auth.RateLimitMiddleware(rateLimiter)

	// Player dependencies.
	playerRepo := player.NewPostgresRepo(queries)
	playerSvc := player.NewService(playerRepo, uploadDir)
	playerHandler := player.NewHandler(playerSvc)

	r := chi.NewRouter()
	auth.RegisterRoutes(r, authHandler, authMw, rateLimitMw)
	player.RegisterRoutes(r, playerHandler, authMw)

	srv := httptest.NewServer(r)
	t.Cleanup(srv.Close)

	// Register + login a default user.
	accessToken := registerAndLogin(t, srv.URL, "player@example.com", "Password1", "Test Player")

	return &playerTestEnv{
		server:      srv,
		uploadDir:   uploadDir,
		accessToken: accessToken,
	}
}

// --- helper functions ---

func registerAndLogin(t *testing.T, baseURL, email, password, name string) string {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"email": email, "password": password, "name": name})
	resp, err := http.Post(baseURL+"/auth/register", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}
	resp.Body.Close()

	body, _ = json.Marshal(map[string]string{"email": email, "password": password})
	loginResp, err := http.Post(baseURL+"/auth/login", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("login failed: %v", err)
	}
	defer loginResp.Body.Close()

	var tokens struct {
		AccessToken string `json:"access_token"`
	}
	b, _ := io.ReadAll(loginResp.Body)
	if err := json.Unmarshal(b, &tokens); err != nil {
		t.Fatalf("decode login response: %v", err)
	}
	if tokens.AccessToken == "" {
		t.Fatalf("empty access token in login response: %s", b)
	}
	return tokens.AccessToken
}

func authedPost(t *testing.T, url, token string, body interface{}) *http.Response {
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

func authedGet(t *testing.T, url, token string) *http.Response {
	t.Helper()
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("GET %s failed: %v", url, err)
	}
	return resp
}

func authedPut(t *testing.T, url, token string, body interface{}) *http.Response {
	t.Helper()
	b, _ := json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPut, url, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("PUT %s failed: %v", url, err)
	}
	return resp
}

func readBody(t *testing.T, r *http.Response) []byte {
	t.Helper()
	defer r.Body.Close()
	b, _ := io.ReadAll(r.Body)
	return b
}

// --- Integration tests ---

func TestIntegration_Player_Onboarding_Success(t *testing.T) {
	env := setupPlayerTestEnv(t)

	resp := authedPost(t, env.server.URL+"/onboarding/questionnaire", env.accessToken, player.OnboardingRequest{
		Frequency:      player.Frequency3MasSem,
		Tournaments:    player.TournamentsAmateur,
		PaddleType:     player.PaddleIntermedia,
		SelfAssessment: player.SelfIntermedio,
		Gender:         "male",
	})
	body := readBody(t, resp)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, body)
	}

	var result player.OnboardingResponseDTO
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	// freq=+100, tournaments=+50, paddle=0, self=0 → 1150
	if result.ELO != 1150 {
		t.Errorf("expected ELO 1150, got %d", result.ELO)
	}
	if !result.OnboardingCompleted {
		t.Error("expected onboarding_completed=true")
	}
	if result.CalibrationMatchesRemaining != player.CalibrationMatchesTotal {
		t.Errorf("expected %d calibration matches remaining, got %d", player.CalibrationMatchesTotal, result.CalibrationMatchesRemaining)
	}
}

func TestIntegration_Player_Onboarding_AlreadyCompleted_Returns409(t *testing.T) {
	env := setupPlayerTestEnv(t)

	req := player.OnboardingRequest{
		Frequency:      player.Frequency1_2Sem,
		Tournaments:    player.TournamentsNunca,
		PaddleType:     player.PaddleIntermedia,
		SelfAssessment: player.SelfIntermedio,
		Gender:         "male",
	}

	// First completion.
	first := authedPost(t, env.server.URL+"/onboarding/questionnaire", env.accessToken, req)
	first.Body.Close()

	// Second attempt should return conflict.
	second := authedPost(t, env.server.URL+"/onboarding/questionnaire", env.accessToken, req)
	body := readBody(t, second)

	if second.StatusCode != http.StatusConflict {
		t.Errorf("expected 409, got %d: %s", second.StatusCode, body)
	}
}

func TestIntegration_Player_UpdateProfile_ValidMendoza_Returns200(t *testing.T) {
	env := setupPlayerTestEnv(t)

	// Rivadavia, Mendoza: lat=-33.35, lng=-68.33 (within bounds)
	lat, lng := -33.35, -68.33
	resp := authedPut(t, env.server.URL+"/players/me", env.accessToken, player.UpdateProfileRequest{
		LastName:  "Gonzalez",
		Latitude:  &lat,
		Longitude: &lng,
	})
	body := readBody(t, resp)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, body)
	}
}

func TestIntegration_Player_UpdateProfile_OutsideMendoza_Returns422(t *testing.T) {
	env := setupPlayerTestEnv(t)

	// Buenos Aires coordinates: outside Mendoza bounds.
	latBA, lngBA := -34.60, -58.38 // Buenos Aires — outside Mendoza bounds
	resp := authedPut(t, env.server.URL+"/players/me", env.accessToken, player.UpdateProfileRequest{
		LastName:  "Garcia",
		Latitude:  &latBA,
		Longitude: &lngBA,
	})
	body := readBody(t, resp)

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("expected 422, got %d: %s", resp.StatusCode, body)
	}
}

func TestIntegration_Player_GetProfile_Returns200_WithCalibrationRemaining(t *testing.T) {
	env := setupPlayerTestEnv(t)

	resp := authedGet(t, env.server.URL+"/players/me", env.accessToken)
	body := readBody(t, resp)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, body)
	}

	var profile player.ProfileResponse
	if err := json.Unmarshal(body, &profile); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if profile.Email == "" {
		t.Error("expected non-empty email")
	}
	if profile.CalibrationMatchesRemaining != player.CalibrationMatchesTotal {
		t.Errorf("expected %d calibration matches remaining, got %d", player.CalibrationMatchesTotal, profile.CalibrationMatchesRemaining)
	}
}

func TestIntegration_Player_UploadAvatar_ValidJPG_Returns200(t *testing.T) {
	env := setupPlayerTestEnv(t)

	// Minimal valid JPEG magic bytes (SOI marker + APP0 JFIF).
	jpegBytes := buildMinimalJPEG()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("avatar", "test.jpg")
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	part.Write(jpegBytes)
	writer.Close()

	req, _ := http.NewRequest(http.MethodPost, env.server.URL+"/players/me/avatar", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+env.accessToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("POST avatar failed: %v", err)
	}
	respBody := readBody(t, resp)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, respBody)
	}

	var result map[string]string
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !strings.HasPrefix(result["avatar_url"], "/uploads/avatars/") {
		t.Errorf("expected avatar_url starting with /uploads/avatars/, got %q", result["avatar_url"])
	}
}

func TestIntegration_Player_UploadAvatar_NotImage_Returns415(t *testing.T) {
	env := setupPlayerTestEnv(t)

	// Plain text content — not an image.
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("avatar", "evil.txt")
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	part.Write([]byte("this is definitely not an image file content at all"))
	writer.Close()

	req, _ := http.NewRequest(http.MethodPost, env.server.URL+"/players/me/avatar", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+env.accessToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("POST avatar failed: %v", err)
	}
	respBody := readBody(t, resp)

	if resp.StatusCode != http.StatusUnsupportedMediaType {
		t.Errorf("expected 415, got %d: %s", resp.StatusCode, respBody)
	}
}

func TestIntegration_Player_UploadAvatar_TooLarge_Returns413(t *testing.T) {
	env := setupPlayerTestEnv(t)

	// Create a file > 5MB with JPEG magic bytes but then garbage.
	const overLimit = 6 * 1024 * 1024
	bigContent := make([]byte, overLimit)
	// Write JPEG magic bytes at start.
	jpeg := buildMinimalJPEG()
	copy(bigContent, jpeg)

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("avatar", "big.jpg")
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	part.Write(bigContent)
	writer.Close()

	req, _ := http.NewRequest(http.MethodPost, env.server.URL+"/players/me/avatar", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+env.accessToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("POST avatar failed: %v", err)
	}
	respBody := readBody(t, resp)

	if resp.StatusCode != http.StatusRequestEntityTooLarge {
		t.Errorf("expected 413, got %d: %s", resp.StatusCode, respBody)
	}
}

// buildMinimalJPEG returns the minimal valid JPEG bytes that http.DetectContentType
// will identify as "image/jpeg". This is the SOI (FF D8) + APP0 marker (FF E0) with JFIF.
func buildMinimalJPEG() []byte {
	return []byte{
		0xFF, 0xD8, // SOI
		0xFF, 0xE0, // APP0 marker
		0x00, 0x10, // length = 16
		0x4A, 0x46, 0x49, 0x46, 0x00, // "JFIF\0"
		0x01, 0x01, // version 1.1
		0x00,       // aspect ratio units: 0 = no units
		0x00, 0x01, // X density
		0x00, 0x01, // Y density
		0x00, 0x00, // no thumbnail
	}
}
