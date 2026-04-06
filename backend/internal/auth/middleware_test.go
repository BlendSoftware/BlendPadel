package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestJWTManager() *JWTManager {
	return NewJWTManager("middleware-test-secret-key", time.Hour)
}

func makeAuthRequest(token string) *http.Request {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	if token != "" {
		r.Header.Set("Authorization", "Bearer "+token)
	}
	return r
}

func okHandler(t *testing.T) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
}

func TestAuthMiddleware_NoToken_Returns401(t *testing.T) {
	mgr := newTestJWTManager()
	handler := AuthMiddleware(mgr)(okHandler(t))

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, makeAuthRequest(""))

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthMiddleware_ValidToken_InjectsClaimsInContext(t *testing.T) {
	mgr := newTestJWTManager()
	userID := uuid.New()

	token, err := mgr.GenerateAccessToken(userID, "player", nil)
	require.NoError(t, err)

	var capturedRole string
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedRole = GetRole(r.Context())
		w.WriteHeader(http.StatusOK)
	})

	handler := AuthMiddleware(mgr)(inner)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, makeAuthRequest(token))

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "player", capturedRole)
}

func TestAuthMiddleware_ExpiredToken_Returns401(t *testing.T) {
	mgr := newTestJWTManager()
	expiredMgr := NewJWTManager("middleware-test-secret-key", -time.Second)
	userID := uuid.New()

	token, err := expiredMgr.GenerateAccessToken(userID, "player", nil)
	require.NoError(t, err)

	handler := AuthMiddleware(mgr)(okHandler(t))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, makeAuthRequest(token))

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestRequireRole_WrongRole_Returns403(t *testing.T) {
	mgr := newTestJWTManager()
	userID := uuid.New()

	token, err := mgr.GenerateAccessToken(userID, "player", nil)
	require.NoError(t, err)

	handler := AuthMiddleware(mgr)(RequireRole("superadmin")(okHandler(t)))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, makeAuthRequest(token))

	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestRequireRole_AllowedRole_ReturnsOK(t *testing.T) {
	mgr := newTestJWTManager()
	userID := uuid.New()

	token, err := mgr.GenerateAccessToken(userID, "moderator", nil)
	require.NoError(t, err)

	handler := AuthMiddleware(mgr)(RequireRole("player", "moderator")(okHandler(t)))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, makeAuthRequest(token))

	assert.Equal(t, http.StatusOK, w.Code)
}
