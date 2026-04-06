package player

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// RegisterRoutes mounts all player routes onto the given router.
//
//	POST /onboarding/questionnaire     — authenticated
//	GET  /players/me                   — authenticated
//	PUT  /players/me                   — authenticated
//	POST /players/me/avatar            — authenticated
//	GET  /players/{id}                 — authenticated (public profile)
//	PUT  /players/me/preferences       — authenticated
//	POST /matches/{id}/report          — authenticated
//	GET  /admin/reports                — moderator + region
func RegisterRoutes(
	r chi.Router,
	h *Handler,
	authMw func(http.Handler) http.Handler,
	requireModerator ...func(http.Handler) http.Handler,
) {
	r.Group(func(r chi.Router) {
		r.Use(authMw)

		r.Post("/onboarding/questionnaire", h.CompleteOnboarding)

		r.Route("/players", func(r chi.Router) {
			r.Get("/me", h.GetProfile)
			r.Put("/me", h.UpdateProfile)
			r.Post("/me/avatar", h.UploadAvatar)
			r.Put("/me/preferences", h.UpdatePreferences)
			r.Get("/search", h.SearchPlayers)

			// Public profile lookup — must come after literal routes to avoid conflict.
			r.Get("/{id}", h.GetPublicProfile)
		})

		r.Route("/matches", func(r chi.Router) {
			r.Post("/{id}/report", h.ReportConduct)
		})
	})

	// Admin routes — require moderator role and region middleware.
	if len(requireModerator) > 0 {
		r.Group(func(r chi.Router) {
			r.Use(authMw)
			for _, mw := range requireModerator {
				r.Use(mw)
			}
			r.Get("/admin/reports", h.GetAdminReports)
		})
	}
}
