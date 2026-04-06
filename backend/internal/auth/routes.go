package auth

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// RegisterRoutes mounts all auth routes onto the given router.
//
//	POST /auth/register   — public, rate limited
//	POST /auth/login      — public, rate limited
//	POST /auth/refresh    — public
//	POST /auth/logout     — authenticated
//	PUT  /auth/password   — authenticated
func RegisterRoutes(
	r chi.Router,
	h *Handler,
	authMw func(http.Handler) http.Handler,
	rateLimitMw func(http.Handler) http.Handler,
) {
	r.Route("/auth", func(r chi.Router) {
		// Public, rate-limited endpoints.
		r.With(rateLimitMw).Post("/register", h.Register)
		r.With(rateLimitMw).Post("/login", h.Login)

		// Public endpoint.
		r.Post("/refresh", h.Refresh)

		// Authenticated endpoints.
		r.Group(func(r chi.Router) {
			r.Use(authMw)
			r.Post("/logout", h.Logout)
			r.Put("/password", h.ChangePassword)
		})
	})
}
