package admin

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/juani/blendpadel/backend/internal/auth"
	"github.com/juani/blendpadel/backend/internal/platform/response"
)

// Handler holds HTTP handlers for the admin domain.
type Handler struct {
	svc *Service
}

// NewHandler creates a new admin Handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// GetKPIs handles GET /admin/kpis.
func (h *Handler) GetKPIs(w http.ResponseWriter, r *http.Request) {
	kpis, err := h.svc.GetKPIs(r.Context())
	if err != nil {
		response.Problem(w, http.StatusInternalServerError, "Internal Server Error", err.Error())
		return
	}
	response.JSON(w, http.StatusOK, kpis)
}

// ListModerators handles GET /admin/moderators.
func (h *Handler) ListModerators(w http.ResponseWriter, r *http.Request) {
	mods, err := h.svc.ListModerators(r.Context())
	if err != nil {
		response.Problem(w, http.StatusInternalServerError, "Internal Server Error", err.Error())
		return
	}
	response.JSON(w, http.StatusOK, mods)
}

// CreateModerator handles POST /admin/moderators.
func (h *Handler) CreateModerator(w http.ResponseWriter, r *http.Request) {
	adminID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	var req ModeratorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid request body")
		return
	}

	mod, err := h.svc.CreateModerator(r.Context(), adminID, req)
	if err != nil {
		response.Problem(w, http.StatusInternalServerError, "Internal Server Error", err.Error())
		return
	}
	response.JSON(w, http.StatusCreated, mod)
}

// UpdateModerator handles PUT /admin/moderators/{id}.
func (h *Handler) UpdateModerator(w http.ResponseWriter, r *http.Request) {
	adminID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid moderator id")
		return
	}

	var req ModeratorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid request body")
		return
	}

	mod, err := h.svc.UpdateModerator(r.Context(), adminID, id, req)
	if err != nil {
		mapError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, mod)
}

// DeleteModerator handles DELETE /admin/moderators/{id}.
func (h *Handler) DeleteModerator(w http.ResponseWriter, r *http.Request) {
	adminID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid moderator id")
		return
	}

	if err := h.svc.DeleteModerator(r.Context(), adminID, id); err != nil {
		mapError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// BanPlayer handles POST /admin/players/{id}/ban.
func (h *Handler) BanPlayer(w http.ResponseWriter, r *http.Request) {
	adminID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	playerID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid player id")
		return
	}

	var req BanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid request body")
		return
	}

	if err := h.svc.BanPlayer(r.Context(), adminID, playerID, req); err != nil {
		mapError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"status": "banned"})
}

// UnbanPlayer handles POST /admin/players/{id}/unban.
func (h *Handler) UnbanPlayer(w http.ResponseWriter, r *http.Request) {
	adminID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	playerID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid player id")
		return
	}

	if err := h.svc.UnbanPlayer(r.Context(), adminID, playerID); err != nil {
		mapError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"status": "active"})
}

// AdjustELO handles POST /admin/players/{id}/elo-adjust.
func (h *Handler) AdjustELO(w http.ResponseWriter, r *http.Request) {
	adminID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	playerID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid player id")
		return
	}

	var req ELOAdjustRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid request body")
		return
	}

	if err := h.svc.AdjustELO(r.Context(), adminID, playerID, req); err != nil {
		mapError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"status": "adjusted"})
}

// GetAuditLog handles GET /admin/audit-log.
func (h *Handler) GetAuditLog(w http.ResponseWriter, r *http.Request) {
	limit := parseIntParam(r, "limit", 50)
	offset := parseIntParam(r, "offset", 0)

	var adminFilter *uuid.UUID
	if raw := r.URL.Query().Get("admin_id"); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid admin_id")
			return
		}
		adminFilter = &id
	}

	result, err := h.svc.GetAuditLog(r.Context(), adminFilter, int32(limit), int32(offset))
	if err != nil {
		response.Problem(w, http.StatusInternalServerError, "Internal Server Error", err.Error())
		return
	}
	response.JSON(w, http.StatusOK, result)
}

// --- helpers ---

func parseIntParam(r *http.Request, name string, defaultVal int) int {
	raw := r.URL.Query().Get(name)
	if raw == "" {
		return defaultVal
	}
	v, err := strconv.Atoi(raw)
	if err != nil || v < 0 {
		return defaultVal
	}
	return v
}

func mapError(w http.ResponseWriter, err error) {
	switch err {
	case ErrPlayerNotFound, ErrModeratorNotFound:
		response.Problem(w, http.StatusNotFound, "Not Found", err.Error())
	case ErrInvalidBanType:
		response.Problem(w, http.StatusBadRequest, "Bad Request", err.Error())
	default:
		response.Problem(w, http.StatusInternalServerError, "Internal Server Error", err.Error())
	}
}
