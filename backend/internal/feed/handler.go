package feed

import (
	"net/http"
	"strconv"

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

// GetFeed handles GET /feed.
// Query params: region_id (required), limit (default 20), offset (default 0).
func (h *Handler) GetFeed(w http.ResponseWriter, r *http.Request) {
	_, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	regionIDStr := r.URL.Query().Get("region_id")
	if regionIDStr == "" {
		// Fall back to caller's region from JWT.
		claimsRegion := auth.GetRegionID(r.Context())
		if claimsRegion == nil {
			response.Problem(w, http.StatusBadRequest, "Bad Request", "region_id is required")
			return
		}
		regionIDStr = claimsRegion.String()
	}

	regionID, err := uuid.Parse(regionIDStr)
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid region_id")
		return
	}

	limit := parseInt32(r.URL.Query().Get("limit"), 20, 50)
	offset := parseInt32(r.URL.Query().Get("offset"), 0, 0)

	items, err := h.svc.GetFeed(r.Context(), regionID, limit, offset)
	if err != nil {
		response.Problem(w, http.StatusInternalServerError, "Internal Server Error", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, map[string]interface{}{"items": items})
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
