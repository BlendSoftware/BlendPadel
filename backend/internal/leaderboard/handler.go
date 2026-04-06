package leaderboard

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/google/uuid"

	"github.com/juani/blendpadel/backend/internal/auth"
	"github.com/juani/blendpadel/backend/internal/platform/response"
)

// Handler holds HTTP handlers for the leaderboard domain.
type Handler struct {
	svc *Service
}

// NewHandler creates a new leaderboard Handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// GetRanking handles GET /rankings.
// Query params: region_id (optional UUID), limit (default 50, max 100), offset (default 0).
func (h *Handler) GetRanking(w http.ResponseWriter, r *http.Request) {
	callerID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	// Parse region_id — if absent, use caller's region from JWT claims.
	var regionID *uuid.UUID
	if raw := r.URL.Query().Get("region_id"); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid region_id")
			return
		}
		regionID = &id
	} else {
		// Fall back to the caller's region from JWT claims.
		claimsRegion := auth.GetRegionID(r.Context())
		regionID = claimsRegion
	}

	if regionID == nil {
		response.Problem(w, http.StatusUnprocessableEntity, "Unprocessable Entity", "region_id is required (pass as query param or complete player onboarding to set a region)")
		return
	}

	// Parse optional gender filter.
	genderFilter := r.URL.Query().Get("gender")
	if genderFilter != "" && genderFilter != "male" && genderFilter != "female" && genderFilter != "other" {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid gender filter; allowed: male, female, other")
		return
	}

	limit := parseInt32(r.URL.Query().Get("limit"), 50, 100)
	offset := parseInt32(r.URL.Query().Get("offset"), 0, 0)

	page, err := h.svc.GetRanking(r.Context(), callerID, regionID, genderFilter, limit, offset)
	if err != nil {
		response.Problem(w, http.StatusInternalServerError, "Internal Server Error", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, page)
}

// CreateRegion handles POST /admin/regions.
// Body: { "name": "string", "boundary_wkt": "POLYGON(...)" }
func (h *Handler) CreateRegion(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name        string `json:"name"`
		BoundaryWKT string `json:"boundary_wkt"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid request body")
		return
	}

	if req.Name == "" {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "name is required")
		return
	}

	region, err := h.svc.CreateRegion(r.Context(), req.Name, req.BoundaryWKT)
	if err != nil {
		response.Problem(w, http.StatusInternalServerError, "Internal Server Error", err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, region)
}

// GetRegions handles GET /regions (public, no auth required).
func (h *Handler) GetRegions(w http.ResponseWriter, r *http.Request) {
	regions, err := h.svc.GetRegions(r.Context())
	if err != nil {
		response.Problem(w, http.StatusInternalServerError, "Internal Server Error", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, map[string]interface{}{"regions": regions})
}

// ProjectELO handles GET /matches/projection.
// Query params: opponent_id (UUID, required), result (win|lose|draw, required).
func (h *Handler) ProjectELO(w http.ResponseWriter, r *http.Request) {
	callerID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	opponentIDStr := r.URL.Query().Get("opponent_id")
	if opponentIDStr == "" {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "opponent_id is required")
		return
	}
	opponentID, err := uuid.Parse(opponentIDStr)
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid opponent_id")
		return
	}

	result := r.URL.Query().Get("result")
	if result == "" {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "result is required (win|lose|draw)")
		return
	}

	projection, err := h.svc.ProjectELO(r.Context(), callerID, opponentID, result)
	if err != nil {
		if errors.Is(err, ErrUnknownResult) {
			response.Problem(w, http.StatusUnprocessableEntity, "Unprocessable Entity", err.Error())
			return
		}
		response.Problem(w, http.StatusInternalServerError, "Internal Server Error", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, projection)
}

// GetELOHistory handles GET /players/me/elo-history.
// Query params: cursor (int64 Unix nanoseconds, optional), limit (default 20, max 50).
func (h *Handler) GetELOHistory(w http.ResponseWriter, r *http.Request) {
	callerID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	var cursor *int64
	if raw := r.URL.Query().Get("cursor"); raw != "" {
		v, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid cursor")
			return
		}
		cursor = &v
	}

	limit := parseInt32(r.URL.Query().Get("limit"), 20, 50)

	page, err := h.svc.GetELOHistory(r.Context(), callerID, cursor, limit)
	if err != nil {
		response.Problem(w, http.StatusInternalServerError, "Internal Server Error", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, page)
}

// parseInt32 parses a string to int32 with a default value and optional max clamp.
// maxVal <= 0 means no upper bound.
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
