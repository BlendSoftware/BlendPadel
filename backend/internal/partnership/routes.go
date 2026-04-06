package partnership

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// RegisterRoutes mounts all partnership routes.
//
//	POST   /partnerships              (authenticated)
//	PUT    /partnerships/{id}/accept   (authenticated)
//	PUT    /partnerships/{id}/reject   (authenticated)
//	DELETE /partnerships/{id}          (authenticated)
//	GET    /partnerships/me            (authenticated)
func RegisterRoutes(r chi.Router, h *Handler, authMw func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMw)

		r.Post("/partnerships", h.RequestPartnership)
		r.Put("/partnerships/{id}/accept", h.AcceptPartnership)
		r.Put("/partnerships/{id}/reject", h.RejectPartnership)
		r.Delete("/partnerships/{id}", h.DissolvePartnership)
		r.Get("/partnerships/me", h.ListMyPartnerships)
		r.Get("/partnerships/{id}/stats", h.GetPartnershipStats)
		r.Get("/players/me/best-partner", h.GetBestPartner)
	})
}
