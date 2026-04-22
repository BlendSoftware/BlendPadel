package radar

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/juani/blendpadel/backend/internal/auth"
	"github.com/juani/blendpadel/backend/internal/platform/response"
)

// Handler holds HTTP handlers for the radar domain.
type Handler struct {
	svc *Service
}

// NewHandler creates a new radar Handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// GetMatches handles GET /radar/matches
func (h *Handler) GetMatches(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing or invalid authentication")
		return
	}

	lat, err := parseRequiredFloat(r, "lat")
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "lat is required and must be a valid float")
		return
	}

	lng, err := parseRequiredFloat(r, "lng")
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "lng is required and must be a valid float")
		return
	}

	radiusKm := 0.0
	radiusExplicit := false
	if v := r.URL.Query().Get("radius_km"); v != "" {
		radiusKm, err = strconv.ParseFloat(v, 64)
		if err != nil {
			response.Problem(w, http.StatusBadRequest, "Bad Request", "radius_km must be a valid float")
			return
		}
		radiusExplicit = true
	}

	var eloMin, eloMax int32
	eloExplicit := false
	if v := r.URL.Query().Get("elo_min"); v != "" {
		n, err := strconv.ParseInt(v, 10, 32)
		if err != nil {
			response.Problem(w, http.StatusBadRequest, "Bad Request", "elo_min must be a valid integer")
			return
		}
		eloMin = int32(n)
		eloExplicit = true
	}
	if v := r.URL.Query().Get("elo_max"); v != "" {
		n, err := strconv.ParseInt(v, 10, 32)
		if err != nil {
			response.Problem(w, http.StatusBadRequest, "Bad Request", "elo_max must be a valid integer")
			return
		}
		eloMax = int32(n)
		eloExplicit = true
	}

	// Apply player preferences as defaults when params not explicitly provided.
	if h.svc.prefsFetcher != nil && (!radiusExplicit || !eloExplicit) {
		prefs, pErr := h.svc.prefsFetcher.GetPreferences(r.Context(), userID)
		if pErr == nil && prefs != nil {
			if !radiusExplicit && prefs.RadarRadiusKM > 0 {
				radiusKm = float64(prefs.RadarRadiusKM)
			}
			if !eloExplicit && (prefs.ELOMinDelta != 0 || prefs.ELOMaxDelta != 0) {
				playerELO, eErr := h.svc.prefsFetcher.GetPlayerELO(r.Context(), userID)
				if eErr == nil {
					eloMin = playerELO + prefs.ELOMinDelta
					eloMax = playerELO + prefs.ELOMaxDelta
				}
			}
		}
	}

	if radiusKm <= 0 {
		radiusKm = DefaultRadiusKm
	}

	var cursor *RadarCursor
	if v := r.URL.Query().Get("cursor"); v != "" {
		cursor, err = DecodeCursor(v)
		if err != nil {
			response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid cursor")
			return
		}
	}

	var pageSize int32
	if v := r.URL.Query().Get("page_size"); v != "" {
		n, err := strconv.ParseInt(v, 10, 32)
		if err != nil {
			response.Problem(w, http.StatusBadRequest, "Bad Request", "page_size must be a valid integer")
			return
		}
		pageSize = int32(n)
	}

	result, err := h.svc.GetMatches(r.Context(), GetMatchesParams{
		ViewerUserID: userID,
		Lat:          lat,
		Lng:          lng,
		RadiusKm:     radiusKm,
		ELOMin:       eloMin,
		ELOMax:       eloMax,
		Cursor:       cursor,
		PageSize:     pageSize,
	})
	if err != nil {
		if errors.Is(err, ErrInvalidRadius) || errors.Is(err, ErrInvalidELORange) {
			response.Problem(w, http.StatusBadRequest, "Bad Request", err.Error())
			return
		}
		response.Problem(w, http.StatusInternalServerError, "Internal Server Error", "failed to fetch radar matches")
		return
	}

	response.JSON(w, http.StatusOK, result)
}

// GetAlerts handles GET /radar/alerts
func (h *Handler) GetAlerts(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing or invalid authentication")
		return
	}

	lat, err := parseRequiredFloat(r, "lat")
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "lat is required and must be a valid float")
		return
	}

	lng, err := parseRequiredFloat(r, "lng")
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "lng is required and must be a valid float")
		return
	}

	alertRadiusKm := 0.0
	if v := r.URL.Query().Get("radius_km"); v != "" {
		alertRadiusKm, err = strconv.ParseFloat(v, 64)
		if err != nil {
			response.Problem(w, http.StatusBadRequest, "Bad Request", "radius_km must be a valid float")
			return
		}
	}
	if alertRadiusKm <= 0 && h.svc.prefsFetcher != nil {
		prefs, pErr := h.svc.prefsFetcher.GetPreferences(r.Context(), userID)
		if pErr == nil && prefs != nil && prefs.RadarRadiusKM > 0 {
			alertRadiusKm = float64(prefs.RadarRadiusKM)
		}
	}

	result, err := h.svc.GetAlerts(r.Context(), GetAlertsParams{
		ViewerUserID:  userID,
		Lat:           lat,
		Lng:           lng,
		RadiusKm:      alertRadiusKm,
	})
	if err != nil {
		response.Problem(w, http.StatusInternalServerError, "Internal Server Error", "failed to fetch radar alerts")
		return
	}

	response.JSON(w, http.StatusOK, result)
}

// parseRequiredFloat parses a required float64 query param.
func parseRequiredFloat(r *http.Request, key string) (float64, error) {
	v := r.URL.Query().Get(key)
	if v == "" {
		return 0, errors.New("missing required param: " + key)
	}
	return strconv.ParseFloat(v, 64)
}
