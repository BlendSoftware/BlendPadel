package notification

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// RegisterRoutes mounts notification routes onto the given router.
//
//	POST   /players/me/device-token   (authenticated)
//	DELETE /players/me/device-token   (authenticated)
func RegisterRoutes(r chi.Router, h *Handler, authMw func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMw)
		r.Post("/players/me/device-token", h.RegisterDeviceToken)
		r.Delete("/players/me/device-token", h.DeleteDeviceToken)
	})
}
