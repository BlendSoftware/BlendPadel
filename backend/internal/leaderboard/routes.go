package leaderboard

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// RegisterRoutes mounts all leaderboard routes onto the given router.
//
//	GET  /rankings                    (authenticated)
//	GET  /regions                     (public — no auth required)
//	POST /admin/regions               (superadmin only)
//	GET  /matches/projection          (authenticated)
//	GET  /players/me/elo-history      (authenticated)
func RegisterRoutes(r chi.Router, h *Handler, authMiddleware, requireSuperAdmin func(http.Handler) http.Handler) {
	// Public routes — no authentication required.
	r.Get("/regions", h.GetRegions)

	// Authenticated routes.
	r.Group(func(r chi.Router) {
		r.Use(authMiddleware)

		r.Get("/rankings", h.GetRanking)
		r.Get("/matches/projection", h.ProjectELO)
		r.Get("/players/me/elo-history", h.GetELOHistory)
	})

	// Superadmin-only routes.
	r.Group(func(r chi.Router) {
		r.Use(authMiddleware)
		r.Use(requireSuperAdmin)

		r.Post("/admin/regions", h.CreateRegion)
	})
}
