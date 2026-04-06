package auth_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"

	"github.com/juani/blendpadel/backend/internal/auth"
	"github.com/juani/blendpadel/backend/internal/db"
	"github.com/juani/blendpadel/backend/internal/platform/database"
	"github.com/juani/blendpadel/backend/migrations"
)

// testEnv holds all wired dependencies for integration tests.
type testEnv struct {
	server *httptest.Server
	router chi.Router
}

func setupTestEnv(t *testing.T) *testEnv {
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

	// Apply migrations.
	if err := database.RunMigrations(connStr, migrations.FS()); err != nil {
		t.Fatalf("failed to run migrations: %v", err)
	}

	// Connect pool.
	pool, err := pgxpool.New(ctx, connStr)
	if err != nil {
		t.Fatalf("failed to create pool: %v", err)
	}
	t.Cleanup(pool.Close)

	// Wire dependencies.
	queries := db.New(pool)
	repo := auth.NewPostgresRepo(queries)
	jwtMgr := auth.NewJWTManager("integration-test-secret-key-32bytes!", time.Hour)
	limiterCtx, cancel := context.WithCancel(ctx)
	t.Cleanup(cancel)
	rateLimiter := auth.NewRateLimiter(limiterCtx, 5, 15*time.Minute)
	svc := auth.NewService(repo, jwtMgr, rateLimiter)
	handler := auth.NewHandler(svc)

	authMw := auth.AuthMiddleware(jwtMgr)
	rateLimitMw := auth.RateLimitMiddleware(rateLimiter)

	r := chi.NewRouter()
	auth.RegisterRoutes(r, handler, authMw, rateLimitMw)

	srv := httptest.NewServer(r)
	t.Cleanup(srv.Close)

	return &testEnv{server: srv, router: r}
}

// helpers

func postJSON(t *testing.T, url string, body interface{}) *http.Response {
	t.Helper()
	b, _ := json.Marshal(body)
	resp, err := http.Post(url, "application/json", bytes.NewReader(b))
	if err != nil {
		t.Fatalf("POST %s failed: %v", url, err)
	}
	return resp
}

func putJSON(t *testing.T, url string, body interface{}, token string) *http.Response {
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

func decodeBody(t *testing.T, r *http.Response, v interface{}) {
	t.Helper()
	defer r.Body.Close()
	b, _ := io.ReadAll(r.Body)
	if err := json.Unmarshal(b, v); err != nil {
		t.Logf("body: %s", b)
		t.Fatalf("decoding response: %v", err)
	}
}

// --- Tests ---

func TestIntegration_Register_Success(t *testing.T) {
	env := setupTestEnv(t)
	url := env.server.URL + "/auth/register"

	resp := postJSON(t, url, auth.RegisterRequest{
		Email:    "alice@example.com",
		Password: "Password1",
		Name:     "Alice",
	})
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 201, got %d: %s", resp.StatusCode, b)
	}

	var result map[string]interface{}
	decodeBody(t, resp, &result)

	if result["email"] != "alice@example.com" {
		t.Errorf("expected email alice@example.com, got %v", result["email"])
	}
	trustScore, _ := result["trust_score"].(float64)
	if int(trustScore) != 80 {
		t.Errorf("expected trust_score 80, got %v", result["trust_score"])
	}
}

func TestIntegration_Register_DuplicateEmail_Returns409(t *testing.T) {
	env := setupTestEnv(t)
	url := env.server.URL + "/auth/register"

	body := auth.RegisterRequest{Email: "dup@example.com", Password: "Password1", Name: "Dup"}
	postJSON(t, url, body)
	resp := postJSON(t, url, body)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusConflict {
		t.Errorf("expected 409, got %d", resp.StatusCode)
	}
}

func TestIntegration_Register_WeakPassword_Returns422(t *testing.T) {
	env := setupTestEnv(t)
	url := env.server.URL + "/auth/register"

	resp := postJSON(t, url, auth.RegisterRequest{
		Email:    "weak@example.com",
		Password: "weak",
		Name:     "Weak",
	})
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("expected 422, got %d", resp.StatusCode)
	}
}

func TestIntegration_Login_Success(t *testing.T) {
	env := setupTestEnv(t)
	baseURL := env.server.URL

	// Register first.
	postJSON(t, baseURL+"/auth/register", auth.RegisterRequest{
		Email:    "login@example.com",
		Password: "Password1",
		Name:     "Login User",
	})

	resp := postJSON(t, baseURL+"/auth/login", auth.LoginRequest{
		Email:    "login@example.com",
		Password: "Password1",
	})

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, b)
	}

	var loginResp auth.LoginResponse
	decodeBody(t, resp, &loginResp)

	if loginResp.AccessToken == "" {
		t.Error("expected non-empty access_token")
	}
	if loginResp.RefreshToken == "" {
		t.Error("expected non-empty refresh_token")
	}
}

func TestIntegration_Login_InvalidCredentials_Returns401(t *testing.T) {
	env := setupTestEnv(t)

	resp := postJSON(t, env.server.URL+"/auth/login", auth.LoginRequest{
		Email:    "nobody@example.com",
		Password: "WrongPass1",
	})
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", resp.StatusCode)
	}
}

func TestIntegration_Refresh_Success(t *testing.T) {
	env := setupTestEnv(t)
	baseURL := env.server.URL

	postJSON(t, baseURL+"/auth/register", auth.RegisterRequest{
		Email:    "refresh@example.com",
		Password: "Password1",
		Name:     "Refresh User",
	})

	loginResp := postJSON(t, baseURL+"/auth/login", auth.LoginRequest{
		Email:    "refresh@example.com",
		Password: "Password1",
	})
	var tokens auth.LoginResponse
	decodeBody(t, loginResp, &tokens)

	// Refresh.
	resp := postJSON(t, baseURL+"/auth/refresh", auth.RefreshRequest{
		RefreshToken: tokens.RefreshToken,
	})

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, b)
	}

	var newTokens auth.LoginResponse
	decodeBody(t, resp, &newTokens)

	if newTokens.AccessToken == "" || newTokens.RefreshToken == "" {
		t.Error("expected new tokens")
	}
	if newTokens.RefreshToken == tokens.RefreshToken {
		t.Error("refresh token should have been rotated")
	}
}

func TestIntegration_Refresh_TokenReuse_Returns401_AndRevokesFamiy(t *testing.T) {
	env := setupTestEnv(t)
	baseURL := env.server.URL

	postJSON(t, baseURL+"/auth/register", auth.RegisterRequest{
		Email:    "reuse@example.com",
		Password: "Password1",
		Name:     "Reuse User",
	})

	loginResp := postJSON(t, baseURL+"/auth/login", auth.LoginRequest{
		Email:    "reuse@example.com",
		Password: "Password1",
	})
	var tokens auth.LoginResponse
	decodeBody(t, loginResp, &tokens)

	// First refresh — consumes the token.
	firstRefresh := postJSON(t, baseURL+"/auth/refresh", auth.RefreshRequest{
		RefreshToken: tokens.RefreshToken,
	})
	var newTokens auth.LoginResponse
	decodeBody(t, firstRefresh, &newTokens)

	// Reuse the OLD token — should trigger family revocation.
	reuseResp := postJSON(t, baseURL+"/auth/refresh", auth.RefreshRequest{
		RefreshToken: tokens.RefreshToken,
	})
	defer reuseResp.Body.Close()

	if reuseResp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401 on reuse, got %d", reuseResp.StatusCode)
	}

	// New token from first refresh should also be invalidated now.
	afterReuseResp := postJSON(t, baseURL+"/auth/refresh", auth.RefreshRequest{
		RefreshToken: newTokens.RefreshToken,
	})
	defer afterReuseResp.Body.Close()

	if afterReuseResp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401 for family-revoked token, got %d", afterReuseResp.StatusCode)
	}
}

func TestIntegration_Logout_RevokesToken(t *testing.T) {
	env := setupTestEnv(t)
	baseURL := env.server.URL

	postJSON(t, baseURL+"/auth/register", auth.RegisterRequest{
		Email:    "logout@example.com",
		Password: "Password1",
		Name:     "Logout User",
	})

	loginResp := postJSON(t, baseURL+"/auth/login", auth.LoginRequest{
		Email:    "logout@example.com",
		Password: "Password1",
	})
	var tokens auth.LoginResponse
	decodeBody(t, loginResp, &tokens)

	// Logout.
	logoutBody, _ := json.Marshal(auth.RefreshRequest{RefreshToken: tokens.RefreshToken})
	req, _ := http.NewRequest(http.MethodPost, baseURL+"/auth/logout", bytes.NewReader(logoutBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+tokens.AccessToken)
	logoutResp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("logout request failed: %v", err)
	}
	defer logoutResp.Body.Close()

	if logoutResp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(logoutResp.Body)
		t.Fatalf("expected 200 on logout, got %d: %s", logoutResp.StatusCode, b)
	}

	// Attempt to refresh with the revoked token.
	refreshResp := postJSON(t, baseURL+"/auth/refresh", auth.RefreshRequest{
		RefreshToken: tokens.RefreshToken,
	})
	defer refreshResp.Body.Close()

	if refreshResp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401 after logout, got %d", refreshResp.StatusCode)
	}
}

func TestIntegration_ChangePassword_RevokesTokens(t *testing.T) {
	env := setupTestEnv(t)
	baseURL := env.server.URL

	postJSON(t, baseURL+"/auth/register", auth.RegisterRequest{
		Email:    "chpass@example.com",
		Password: "Password1",
		Name:     "Change Pass",
	})

	loginResp := postJSON(t, baseURL+"/auth/login", auth.LoginRequest{
		Email:    "chpass@example.com",
		Password: "Password1",
	})
	var tokens auth.LoginResponse
	decodeBody(t, loginResp, &tokens)

	// Change password.
	chResp := putJSON(t, baseURL+"/auth/password", auth.ChangePasswordRequest{
		CurrentPassword: "Password1",
		NewPassword:     "NewPassword2",
	}, tokens.AccessToken)
	defer chResp.Body.Close()

	if chResp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(chResp.Body)
		t.Fatalf("expected 200, got %d: %s", chResp.StatusCode, b)
	}

	// Old refresh token should be revoked.
	refreshResp := postJSON(t, baseURL+"/auth/refresh", auth.RefreshRequest{
		RefreshToken: tokens.RefreshToken,
	})
	defer refreshResp.Body.Close()

	if refreshResp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401 after password change, got %d", refreshResp.StatusCode)
	}
}

func TestIntegration_RateLimit_Returns429OnSixthAttempt(t *testing.T) {
	env := setupTestEnv(t)
	url := env.server.URL + "/auth/login"

	var lastResp *http.Response
	for i := 0; i < 6; i++ {
		lastResp = postJSON(t, url, auth.LoginRequest{
			Email:    fmt.Sprintf("ratelimit%d@example.com", i),
			Password: "Wrong1Pass",
		})
		if i < 5 {
			lastResp.Body.Close()
		}
	}
	defer lastResp.Body.Close()

	if lastResp.StatusCode != http.StatusTooManyRequests {
		t.Errorf("expected 429 on 6th attempt, got %d", lastResp.StatusCode)
	}
}
