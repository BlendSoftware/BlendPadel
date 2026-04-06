package venue

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// RegisterRoutes mounts all venue routes onto the given router.
//
//	GET  /venues          (authenticated)
//	GET  /venues/{id}     (authenticated)
//	POST /venues          (authenticated)
//	PUT  /venues/{id}     (authenticated)
func RegisterRoutes(r chi.Router, h *Handler, authMw func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMw)

		r.Get("/venues", h.ListVenues)
		r.Get("/venues/{id}", h.GetVenue)
		r.Post("/venues", h.CreateVenue)
		r.Put("/venues/{id}", h.UpdateVenue)
	})
}
