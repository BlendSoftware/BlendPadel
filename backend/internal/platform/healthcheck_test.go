package platform_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/juani/blendpadel/backend/internal/platform/response"
)

func healthHandler(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		dbStatus := "disconnected"
		status := http.StatusServiceUnavailable

		if pool != nil {
			ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
			defer cancel()

			if err := pool.Ping(ctx); err == nil {
				dbStatus = "connected"
				status = http.StatusOK
			}
		}

		result := map[string]string{
			"status":  "ok",
			"db":      dbStatus,
			"version": "0.1.0",
		}

		if status != http.StatusOK {
			result["status"] = "degraded"
		}

		response.JSON(w, status, result)
	}
}

func TestHealthCheck_NoDB(t *testing.T) {
	r := chi.NewRouter()
	r.Get("/health", healthHandler(nil))

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusServiceUnavailable, rec.Code)

	var body map[string]string
	err := json.NewDecoder(rec.Body).Decode(&body)
	require.NoError(t, err)

	assert.Equal(t, "degraded", body["status"])
	assert.Equal(t, "disconnected", body["db"])
	assert.Equal(t, "0.1.0", body["version"])
}

func TestHealthCheck_WithDB(t *testing.T) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL not set, skipping integration test")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, databaseURL)
	require.NoError(t, err)
	defer pool.Close()

	r := chi.NewRouter()
	r.Get("/health", healthHandler(pool))

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)

	var body map[string]string
	err = json.NewDecoder(rec.Body).Decode(&body)
	require.NoError(t, err)

	assert.Equal(t, "ok", body["status"])
	assert.Equal(t, "connected", body["db"])
}
