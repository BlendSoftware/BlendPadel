package radar

import "github.com/go-chi/chi/v5"

// RegisterRoutes mounts the radar endpoints on the given router.
// The router should already have AuthMiddleware applied.
func RegisterRoutes(r chi.Router, h *Handler) {
	r.Get("/radar/matches", h.GetMatches)
	r.Get("/radar/alerts", h.GetAlerts)
}
