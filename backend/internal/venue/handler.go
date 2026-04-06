package venue

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/juani/blendpadel/backend/internal/auth"
	"github.com/juani/blendpadel/backend/internal/platform/response"
)

// Handler holds HTTP handlers for the venue domain.
type Handler struct {
	svc *Service
}

// NewHandler creates a new venue Handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// ListVenues handles GET /venues.
// Query params: lat (required), lng (required), radius_km (default 10), limit (default 20), offset (default 0).
func (h *Handler) ListVenues(w http.ResponseWriter, r *http.Request) {
	latStr := r.URL.Query().Get("lat")
	lngStr := r.URL.Query().Get("lng")
	if latStr == "" || lngStr == "" {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "lat and lng are required")
		return
	}

	lat, err := strconv.ParseFloat(latStr, 64)
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid lat")
		return
	}
	lng, err := strconv.ParseFloat(lngStr, 64)
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid lng")
		return
	}

	radiusKm := parseFloat64(r.URL.Query().Get("radius_km"), 10)
	limit := parseInt32(r.URL.Query().Get("limit"), 20, 100)
	offset := parseInt32(r.URL.Query().Get("offset"), 0, 0)

	venues, err := h.svc.GetVenuesNearby(r.Context(), lat, lng, radiusKm, limit, offset)
	if err != nil {
		response.Problem(w, http.StatusInternalServerError, "Internal Server Error", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, map[string]interface{}{"venues": venues})
}

// GetVenue handles GET /venues/{id}.
func (h *Handler) GetVenue(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid venue id")
		return
	}

	v, err := h.svc.GetVenue(r.Context(), id)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.Problem(w, http.StatusNotFound, "Not Found", "venue not found")
			return
		}
		response.Problem(w, http.StatusInternalServerError, "Internal Server Error", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, v)
}

// CreateVenue handles POST /venues.
func (h *Handler) CreateVenue(w http.ResponseWriter, r *http.Request) {
	callerID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	var req CreateVenueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid JSON body")
		return
	}

	v, err := h.svc.CreateVenue(r.Context(), callerID, req)
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, v)
}

// UpdateVenue handles PUT /venues/{id}.
func (h *Handler) UpdateVenue(w http.ResponseWriter, r *http.Request) {
	callerID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	callerRole := auth.GetRole(r.Context())

	idStr := chi.URLParam(r, "id")
	venueID, err := uuid.Parse(idStr)
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid venue id")
		return
	}

	var req UpdateVenueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid JSON body")
		return
	}

	v, err := h.svc.UpdateVenue(r.Context(), callerID, callerRole, venueID, req)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.Problem(w, http.StatusNotFound, "Not Found", "venue not found")
			return
		}
		if errors.Is(err, ErrForbidden) {
			response.Problem(w, http.StatusForbidden, "Forbidden", err.Error())
			return
		}
		response.Problem(w, http.StatusInternalServerError, "Internal Server Error", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, v)
}

// --- helpers ---

func parseFloat64(s string, defaultVal float64) float64 {
	if s == "" {
		return defaultVal
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return defaultVal
	}
	return v
}

func parseInt32(s string, defaultVal, maxVal int32) int32 {
	if s == "" {
		return defaultVal
	}
	v, err := strconv.ParseInt(s, 10, 32)
	if err != nil || v < 0 {
		return defaultVal
	}
	result := int32(v)
	if maxVal > 0 && result > maxVal {
		return maxVal
	}
	return result
}
