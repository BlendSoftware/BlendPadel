package admin

import (
	"github.com/go-chi/chi/v5"
)

// RegisterRoutes mounts all admin routes onto the given router.
//
//	GET    /admin/kpis                        (superadmin)
//	GET    /admin/moderators                  (superadmin)
//	POST   /admin/moderators                  (superadmin)
//	PUT    /admin/moderators/{id}             (superadmin)
//	DELETE /admin/moderators/{id}             (superadmin)
//	POST   /admin/players/{id}/ban            (superadmin)
//	POST   /admin/players/{id}/unban          (superadmin)
//	POST   /admin/players/{id}/elo-adjust     (superadmin)
//	GET    /admin/audit-log                   (superadmin)
// MountOnAdminRouter mounts admin-specific routes onto an existing /admin chi.Router.
// This avoids duplicate Route("/admin") conflicts with match package's dispute routes.
func MountOnAdminRouter(r chi.Router, h *Handler) {
	r.Get("/kpis", h.GetKPIs)
	r.Get("/audit-log", h.GetAuditLog)

	r.Get("/moderators", h.ListModerators)
	r.Post("/moderators", h.CreateModerator)
	r.Put("/moderators/{id}", h.UpdateModerator)
	r.Delete("/moderators/{id}", h.DeleteModerator)

	r.Post("/players/{id}/ban", h.BanPlayer)
	r.Post("/players/{id}/unban", h.UnbanPlayer)
	r.Post("/players/{id}/elo-adjust", h.AdjustELO)
}
