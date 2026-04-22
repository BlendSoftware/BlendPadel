package match

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/juani/blendpadel/backend/internal/auth"
)

// RegisterRoutes mounts all match routes onto the given router.
//
//	POST /matches                         (authenticated)
//	GET  /matches/{id}                    (authenticated)
//	POST /matches/{id}/result             (authenticated)
//	POST /matches/{id}/confirm            (authenticated)
//	POST /matches/{id}/dispute            (authenticated)
//	POST /matches/{id}/cancel             (authenticated)
//	GET  /players/{playerID}/matches        (authenticated)
//	GET  /players/{playerID}/matches/active (authenticated)
//	GET  /admin/disputes                    (moderator/superadmin)
//	POST /admin/disputes/{id}/resolve       (moderator/superadmin)
func RegisterRoutes(r chi.Router, h *Handler, authMw func(http.Handler) http.Handler) {
	// Authenticated routes.
	r.Group(func(r chi.Router) {
		r.Use(authMw)

		r.Post("/matches", h.CreateMatch)
		r.Get("/matches/{id}", h.GetMatchDetail)
		r.Post("/matches/{id}/result", h.SubmitResult)
		r.Post("/matches/{id}/confirm", h.ConfirmMatch)
		r.Post("/matches/{id}/dispute", h.DisputeMatch)
		r.Post("/matches/{id}/cancel", h.CancelMatch)

		r.Get("/players/{playerID}/matches/active", h.GetActiveMatches)
		r.Get("/players/{playerID}/matches", h.GetMatchHistory)
	})

	// Admin dispute routes: moderator or superadmin only.
	r.Group(func(r chi.Router) {
		r.Use(authMw)
		r.Use(auth.RequireRole("moderator", "superadmin"))

		r.Get("/admin/disputes", h.GetPendingDisputes)
		r.Post("/admin/disputes/{id}/resolve", h.ResolveDispute)
	})
}
