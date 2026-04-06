package matchmaking

import "github.com/go-chi/chi/v5"

// RegisterRoutes registers matchmaking routes on the given router.
// The router should already have auth middleware applied.
func RegisterRoutes(r chi.Router, h *Handler) {
	r.Post("/matchmaking/flares", h.CreateFlare)
	r.Get("/matchmaking/flares", h.ListFlares)
	r.Post("/matchmaking/flares/{id}/respond", h.RespondToFlare)
	r.Delete("/matchmaking/flares/{id}", h.CancelFlare)
}
