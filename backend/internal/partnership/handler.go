package partnership

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/juani/blendpadel/backend/internal/auth"
	"github.com/juani/blendpadel/backend/internal/platform/response"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RequestPartnership(w http.ResponseWriter, r *http.Request) {
	callerID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	var req CreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid JSON body")
		return
	}

	p, err := h.svc.RequestPartnership(r.Context(), callerID, req)
	if err != nil {
		mapError(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, p)
}

func (h *Handler) AcceptPartnership(w http.ResponseWriter, r *http.Request) {
	callerID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid partnership id")
		return
	}

	p, err := h.svc.AcceptPartnership(r.Context(), id, callerID)
	if err != nil {
		mapError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, p)
}

func (h *Handler) RejectPartnership(w http.ResponseWriter, r *http.Request) {
	callerID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid partnership id")
		return
	}

	p, err := h.svc.RejectPartnership(r.Context(), id, callerID)
	if err != nil {
		mapError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, p)
}

func (h *Handler) DissolvePartnership(w http.ResponseWriter, r *http.Request) {
	callerID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid partnership id")
		return
	}

	p, err := h.svc.DissolvePartnership(r.Context(), id, callerID)
	if err != nil {
		mapError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, p)
}

func (h *Handler) ListMyPartnerships(w http.ResponseWriter, r *http.Request) {
	callerID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	partnerships, err := h.svc.GetMyPartnerships(r.Context(), callerID)
	if err != nil {
		response.Problem(w, http.StatusInternalServerError, "Internal Server Error", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, map[string]interface{}{"partnerships": partnerships})
}

func (h *Handler) GetPartnershipStats(w http.ResponseWriter, r *http.Request) {
	callerID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid partnership id")
		return
	}

	stats, err := h.svc.GetPartnershipStats(r.Context(), id, callerID)
	if err != nil {
		mapError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, stats)
}

func (h *Handler) GetBestPartner(w http.ResponseWriter, r *http.Request) {
	callerID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	best, err := h.svc.GetBestPartner(r.Context(), callerID)
	if err != nil {
		response.Problem(w, http.StatusInternalServerError, "Internal Server Error", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, map[string]interface{}{"best_partner": best})
}

func mapError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		response.Problem(w, http.StatusNotFound, "Not Found", err.Error())
	case errors.Is(err, ErrSelfPartnership):
		response.Problem(w, http.StatusBadRequest, "Bad Request", err.Error())
	case errors.Is(err, ErrAlreadyExists), errors.Is(err, ErrMaxPartnerships), errors.Is(err, ErrInvalidTransition):
		response.Problem(w, http.StatusConflict, "Conflict", err.Error())
	case errors.Is(err, ErrForbidden):
		response.Problem(w, http.StatusForbidden, "Forbidden", err.Error())
	default:
		response.Problem(w, http.StatusInternalServerError, "Internal Server Error", err.Error())
	}
}
