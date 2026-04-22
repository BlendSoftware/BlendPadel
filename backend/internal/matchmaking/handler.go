package matchmaking

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

// Handler holds HTTP handlers for the matchmaking domain.
type Handler struct {
	svc *Service
}

// NewHandler creates a new matchmaking Handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// CreateFlare handles POST /matchmaking/flares.
func (h *Handler) CreateFlare(w http.ResponseWriter, r *http.Request) {
	playerID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	var req CreateFlareRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid JSON body")
		return
	}

	flare, err := h.svc.CreateFlare(r.Context(), playerID, req)
	if err != nil {
		switch {
		case errors.Is(err, ErrActiveFlareExists):
			response.Problem(w, http.StatusConflict, "Conflict", "player already has an active flare")
		case errors.Is(err, ErrOnboardingRequired):
			response.Problem(w, http.StatusUnprocessableEntity, "Unprocessable Entity", err.Error())
		default:
			response.Problem(w, http.StatusBadRequest, "Bad Request", err.Error())
		}
		return
	}

	response.JSON(w, http.StatusCreated, flare)
}

// GetMyFlare handles GET /matchmaking/flares/mine.
// Returns the caller's active flare (if any), without location/ELO filters.
func (h *Handler) GetMyFlare(w http.ResponseWriter, r *http.Request) {
	playerID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	flare, err := h.svc.GetMyActiveFlare(r.Context(), playerID)
	if err != nil {
		response.Problem(w, http.StatusInternalServerError, "Internal Server Error", err.Error())
		return
	}

	if flare == nil {
		response.JSON(w, http.StatusOK, nil)
		return
	}

	response.JSON(w, http.StatusOK, flare)
}

// ListFlares handles GET /matchmaking/flares.
func (h *Handler) ListFlares(w http.ResponseWriter, r *http.Request) {
	viewerID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

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

	radiusKm := 0.0
	radiusExplicit := false
	if s := r.URL.Query().Get("radius_km"); s != "" {
		radiusKm, err = strconv.ParseFloat(s, 64)
		if err != nil {
			response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid radius_km")
			return
		}
		radiusExplicit = true
	}

	if !radiusExplicit && h.svc.prefsFetcher != nil {
		prefs, pErr := h.svc.prefsFetcher.GetMatchmakingPreferences(r.Context(), viewerID)
		if pErr == nil && prefs != nil && prefs.RadarRadiusKM > 0 {
			radiusKm = float64(prefs.RadarRadiusKM)
		}
	}
	if radiusKm <= 0 {
		radiusKm = 10.0
	}

	pageSize := int32(20)
	if s := r.URL.Query().Get("page_size"); s != "" {
		n, err := strconv.ParseInt(s, 10, 32)
		if err != nil {
			response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid page_size")
			return
		}
		pageSize = int32(n)
	}

	var cursor *string
	if c := r.URL.Query().Get("cursor"); c != "" {
		cursor = &c
	}

	matchType := r.URL.Query().Get("match_type")

	list, err := h.svc.GetFlares(r.Context(), viewerID, GetFlaresParams{
		Lat:       lat,
		Lng:       lng,
		RadiusKm:  radiusKm,
		Cursor:    cursor,
		PageSize:  pageSize,
		ViewerID:  viewerID,
		MatchType: matchType,
	})
	if err != nil {
		response.Problem(w, http.StatusInternalServerError, "Internal Server Error", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, list)
}

// RespondToFlare handles POST /matchmaking/flares/{id}/respond.
func (h *Handler) RespondToFlare(w http.ResponseWriter, r *http.Request) {
	playerID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	idStr := chi.URLParam(r, "id")
	flareID, err := uuid.Parse(idStr)
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid flare id")
		return
	}

	flare, err := h.svc.RespondToFlare(r.Context(), flareID, playerID)
	if err != nil {
		switch {
		case errors.Is(err, ErrFlareNotFound):
			response.Problem(w, http.StatusNotFound, "Not Found", "flare not found")
		case errors.Is(err, ErrFlareNotActive):
			response.Problem(w, http.StatusConflict, "Conflict", "flare is not active")
		case errors.Is(err, ErrAlreadyRespondent):
			response.Problem(w, http.StatusConflict, "Conflict", "already a respondent")
		default:
			response.Problem(w, http.StatusInternalServerError, "Internal Server Error", err.Error())
		}
		return
	}

	response.JSON(w, http.StatusOK, flare)
}

// CancelFlare handles DELETE /matchmaking/flares/{id}.
func (h *Handler) CancelFlare(w http.ResponseWriter, r *http.Request) {
	playerID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	idStr := chi.URLParam(r, "id")
	flareID, err := uuid.Parse(idStr)
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid flare id")
		return
	}

	if err := h.svc.CancelFlare(r.Context(), flareID, playerID); err != nil {
		switch {
		case errors.Is(err, ErrFlareNotFound):
			response.Problem(w, http.StatusNotFound, "Not Found", "flare not found or not owned by you")
		case errors.Is(err, ErrNotFlareOwner):
			response.Problem(w, http.StatusForbidden, "Forbidden", "flare not owned by you")
		default:
			response.Problem(w, http.StatusInternalServerError, "Internal Server Error", err.Error())
		}
		return
	}

	response.JSON(w, http.StatusNoContent, nil)
}
