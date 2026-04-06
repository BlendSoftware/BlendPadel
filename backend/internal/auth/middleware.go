package auth

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/juani/blendpadel/backend/internal/platform/response"
)

type contextKey string

const (
	claimsKey contextKey = "auth_claims"
)

// AuthMiddleware validates the Bearer token and injects claims into the request context.
func AuthMiddleware(jwtManager *JWTManager) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authorization header")
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				response.Problem(w, http.StatusUnauthorized, "Unauthorized", "invalid authorization header format")
				return
			}

			claims, err := jwtManager.ValidateToken(parts[1])
			if err != nil {
				response.Problem(w, http.StatusUnauthorized, "Unauthorized", "invalid or expired token")
				return
			}

			ctx := context.WithValue(r.Context(), claimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireRole returns a middleware that permits only the specified roles.
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(roles))
	for _, role := range roles {
		allowed[role] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := claimsFromContext(r.Context())
			if claims == nil {
				response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
				return
			}
			if _, ok := allowed[claims.Role]; !ok {
				response.Problem(w, http.StatusForbidden, "Forbidden", fmt.Sprintf("role %q is not permitted", claims.Role))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequireRegion verifies that a moderator's region_id matches the region_id query parameter.
// SuperAdmin bypasses this check.
func RequireRegion() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := claimsFromContext(r.Context())
			if claims == nil {
				response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
				return
			}

			// SuperAdmin bypasses region check.
			if claims.Role == "superadmin" {
				next.ServeHTTP(w, r)
				return
			}

			if claims.Role == "moderator" {
				regionParam := r.URL.Query().Get("region_id")
				if regionParam == "" {
					response.Problem(w, http.StatusForbidden, "Forbidden", "region_id is required for moderators")
					return
				}

				if claims.RegionID == nil {
					response.Problem(w, http.StatusForbidden, "Forbidden", "moderator has no assigned region")
					return
				}

				if claims.RegionID.String() != regionParam {
					response.Problem(w, http.StatusForbidden, "Forbidden", "region mismatch")
					return
				}
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RateLimitMiddleware returns a middleware that enforces rate limiting by client IP.
func RateLimitMiddleware(limiter *RateLimiter) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := extractIP(r)
			allowed, remaining, retryAfter := limiter.Allow(ip)

			w.Header().Set("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))
			if !allowed {
				w.Header().Set("Retry-After", fmt.Sprintf("%.0f", retryAfter.Seconds()))
				response.Problem(w, http.StatusTooManyRequests, "Too Many Requests",
					fmt.Sprintf("rate limit exceeded, retry after %.0f seconds", retryAfter.Seconds()))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// --- Context helpers ---

func claimsFromContext(ctx context.Context) *Claims {
	claims, _ := ctx.Value(claimsKey).(*Claims)
	return claims
}

// GetUserID extracts the user UUID from the request context.
func GetUserID(ctx context.Context) (uuid.UUID, bool) {
	claims := claimsFromContext(ctx)
	if claims == nil {
		return uuid.UUID{}, false
	}
	id, err := uuid.Parse(claims.Subject)
	if err != nil {
		return uuid.UUID{}, false
	}
	return id, true
}

// GetRole extracts the role from the request context.
func GetRole(ctx context.Context) string {
	claims := claimsFromContext(ctx)
	if claims == nil {
		return ""
	}
	return claims.Role
}

// IsAdmin returns true if the caller has the superadmin role.
func IsAdmin(ctx context.Context) bool {
	return GetRole(ctx) == "superadmin"
}

// IsModerator returns true if the caller has the moderator role.
func IsModerator(ctx context.Context) bool {
	return GetRole(ctx) == "moderator"
}

// GetRegionID extracts the region UUID from the context claims.
func GetRegionID(ctx context.Context) *uuid.UUID {
	claims := claimsFromContext(ctx)
	if claims == nil {
		return nil
	}
	return claims.RegionID
}

// extractIP returns the client IP, stripping the port if present.
func extractIP(r *http.Request) string {
	// Honour X-Forwarded-For if set.
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		parts := strings.SplitN(fwd, ",", 2)
		return strings.TrimSpace(parts[0])
	}
	addr := r.RemoteAddr
	if idx := strings.LastIndex(addr, ":"); idx != -1 {
		return addr[:idx]
	}
	return addr
}
