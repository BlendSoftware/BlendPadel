package feed

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// RegisterRoutes mounts feed routes.
//
//	GET /feed (authenticated)
func RegisterRoutes(r chi.Router, h *Handler, authMw func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMw)
		r.Get("/feed", h.GetFeed)
	})
}
