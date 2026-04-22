package player

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/juani/blendpadel/backend/internal/auth"
	"github.com/juani/blendpadel/backend/internal/platform/response"
)

// Handler holds the HTTP handlers for the player domain.
type Handler struct {
	service *Service
}

// NewHandler creates a new player Handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// CompleteOnboarding handles POST /onboarding/questionnaire.
func (h *Handler) CompleteOnboarding(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing user identity")
		return
	}

	var req OnboardingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid JSON body")
		return
	}

	if err := validateOnboardingRequest(req); err != nil {
		response.ValidationError(w, []response.FieldError{{Field: err.field, Message: err.message}})
		return
	}

	resp, err := h.service.CompleteOnboarding(r.Context(), userID, req)
	if err != nil {
		h.writeError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, resp)
}

// GetProfile handles GET /players/me.
func (h *Handler) GetProfile(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing user identity")
		return
	}

	profile, err := h.service.GetProfile(r.Context(), userID)
	if err != nil {
		h.writeError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, profile)
}

// UpdateProfile handles PUT /players/me.
func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing user identity")
		return
	}

	var req UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid JSON body")
		return
	}

	if err := h.service.UpdateProfile(r.Context(), userID, req); err != nil {
		h.writeError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"message": "profile updated successfully"})
}

// UploadAvatar handles POST /players/me/avatar.
func (h *Handler) UploadAvatar(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing user identity")
		return
	}

	// Limit parse to 6MB to detect oversized files (service enforces 5MB after parse).
	if err := r.ParseMultipartForm(6 * 1024 * 1024); err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "too large") {
			response.Problem(w, http.StatusRequestEntityTooLarge, "Payload Too Large", "image is too large; max size is 5MB")
			return
		}
		response.Problem(w, http.StatusBadRequest, "Bad Request", "failed to parse multipart form")
		return
	}

	file, header, err := r.FormFile("avatar")
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "avatar file is required")
		return
	}
	defer file.Close()

	publicURL, err := h.service.UploadAvatar(r.Context(), userID, file, header)
	if err != nil {
		h.writeError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"avatar_url": publicURL})
}

// GetPublicProfile handles GET /players/{id}.
// Returns OwnProfileResponse for self-view, PublicProfileResponse for other players.
func (h *Handler) GetPublicProfile(w http.ResponseWriter, r *http.Request) {
	callerID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing user identity")
		return
	}

	rawID := chi.URLParam(r, "id")
	profileID, err := uuid.Parse(rawID)
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid player ID format")
		return
	}

	profile, err := h.service.GetPublicProfile(r.Context(), callerID, profileID)
	if err != nil {
		h.writeError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, profile)
}

// UpdatePreferences handles PUT /players/me/preferences.
func (h *Handler) UpdatePreferences(w http.ResponseWriter, r *http.Request) {
	callerID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing user identity")
		return
	}

	var req PreferencesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid JSON body")
		return
	}

	prefs, err := h.service.UpdatePreferences(r.Context(), callerID, req)
	if err != nil {
		h.writeError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, prefs)
}

// ReportConduct handles POST /matches/{id}/report.
func (h *Handler) ReportConduct(w http.ResponseWriter, r *http.Request) {
	callerID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing user identity")
		return
	}

	rawMatchID := chi.URLParam(r, "id")
	matchID, err := uuid.Parse(rawMatchID)
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid match ID format")
		return
	}

	var req ReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid JSON body")
		return
	}

	report, err := h.service.ReportConduct(r.Context(), callerID, matchID, req)
	if err != nil {
		h.writeError(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, report)
}

// GetAdminReports handles GET /admin/reports.
// Requires RequireRole("moderator", "superadmin") and RequireRegion middleware.
func (h *Handler) GetAdminReports(w http.ResponseWriter, r *http.Request) {
	regionID := auth.GetRegionID(r.Context())
	if regionID == nil {
		// SuperAdmin without a region gets an empty list (no region to filter by).
		// For now, require region for the endpoint to function correctly.
		response.Problem(w, http.StatusForbidden, "Forbidden", "no region assigned to this account")
		return
	}

	statusFilter := r.URL.Query().Get("status")

	limitStr := r.URL.Query().Get("limit")
	limit := int32(20)
	if limitStr != "" {
		v, err := strconv.Atoi(limitStr)
		if err != nil || v < 1 {
			response.Problem(w, http.StatusBadRequest, "Bad Request", "limit must be a positive integer")
			return
		}
		if v > 100 {
			v = 100
		}
		limit = int32(v)
	}

	offsetStr := r.URL.Query().Get("offset")
	offset := int32(0)
	if offsetStr != "" {
		v, err := strconv.Atoi(offsetStr)
		if err != nil || v < 0 {
			response.Problem(w, http.StatusBadRequest, "Bad Request", "offset must be a non-negative integer")
			return
		}
		offset = int32(v)
	}

	result, err := h.service.GetAdminReports(r.Context(), *regionID, statusFilter, limit, offset)
	if err != nil {
		h.writeError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, result)
}

// SearchPlayers handles GET /players/search?q=...
func (h *Handler) SearchPlayers(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		response.JSON(w, http.StatusOK, []PlayerSearchResult{})
		return
	}

	excludeIDs, err := parseExcludeIDs(r.URL.Query().Get("exclude_ids"))
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid exclude_ids")
		return
	}

	matchType := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("match_type")))

	var limit int32
	if v := r.URL.Query().Get("limit"); v != "" {
		n, parseErr := strconv.ParseInt(v, 10, 32)
		if parseErr != nil {
			response.Problem(w, http.StatusBadRequest, "Bad Request", "limit must be a valid integer")
			return
		}
		limit = int32(n)
	}

	results, err := h.service.SearchByName(r.Context(), q, excludeIDs, matchType, limit)
	if err != nil {
		h.writeError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, results)
}

func parseExcludeIDs(raw string) ([]uuid.UUID, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, nil
	}
	parts := strings.Split(raw, ",")
	ids := make([]uuid.UUID, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" {
			continue
		}
		id, err := uuid.Parse(trimmed)
		if err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, nil
}

// writeError maps domain errors to RFC 7807 problem details.
func (h *Handler) writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		response.Problem(w, http.StatusNotFound, "Not Found", "player profile not found")
	case errors.Is(err, ErrOnboardingAlreadyDone):
		response.Problem(w, http.StatusConflict, "Conflict", "onboarding already completed")
	case errors.Is(err, ErrInvalidCoordinates):
		response.ValidationError(w, []response.FieldError{
			{Field: "latitude/longitude", Message: "coordinates must be within Mendoza bounds: lat [-35.5, -32.0], lng [-70.5, -67.5]"},
		})
	case errors.Is(err, ErrInvalidMIME):
		response.Problem(w, http.StatusUnsupportedMediaType, "Unsupported Media Type", ErrInvalidMIME.Error())
	case errors.Is(err, ErrFileTooLarge):
		response.Problem(w, http.StatusRequestEntityTooLarge, "Payload Too Large", ErrFileTooLarge.Error())
	case errors.Is(err, ErrNotParticipant):
		response.Problem(w, http.StatusForbidden, "Forbidden", ErrNotParticipant.Error())
	case errors.Is(err, ErrMatchNotCompleted):
		response.Problem(w, http.StatusUnprocessableEntity, "Unprocessable Entity", ErrMatchNotCompleted.Error())
	case errors.Is(err, ErrAlreadyReported):
		response.Problem(w, http.StatusConflict, "Conflict", ErrAlreadyReported.Error())
	case errors.Is(err, ErrInvalidGender):
		response.ValidationError(w, []response.FieldError{
			{Field: "gender", Message: ErrInvalidGender.Error()},
		})
	case errors.Is(err, ErrGenderRequired):
		response.ValidationError(w, []response.FieldError{
			{Field: "gender", Message: ErrGenderRequired.Error()},
		})
	case errors.Is(err, ErrInvalidPreferences):
		// Extract the wrapped message for the validation detail.
		response.ValidationError(w, []response.FieldError{
			{Field: "preferences", Message: err.Error()},
		})
	default:
		response.Problem(w, http.StatusInternalServerError, "Internal Server Error", fmt.Sprintf("an unexpected error occurred: %v", err))
	}
}

// validationError is a small helper to pass field + message together.
type validationError struct {
	field   string
	message string
}

func validateOnboardingRequest(req OnboardingRequest) *validationError {
	validFrequencies := map[string]bool{
		FrequencyNunca: true, FrequencyRaraVez: true, Frequency1_2Sem: true, Frequency3MasSem: true,
	}
	validTournaments := map[string]bool{
		TournamentsNunca: true, TournamentsAmateur: true, TournamentsFederado: true,
	}
	validPaddles := map[string]bool{
		PaddleIniciacion: true, PaddleIntermedia: true, PaddleAvanzada: true,
	}
	validSelf := map[string]bool{
		SelfPrincipiante: true, SelfIntermedio: true, SelfAvanzado: true, SelfCompetitivo: true,
	}

	if !validFrequencies[req.Frequency] {
		return &validationError{field: "frequency", message: "invalid frequency value"}
	}
	if !validTournaments[req.Tournaments] {
		return &validationError{field: "tournaments", message: "invalid tournaments value"}
	}
	if !validPaddles[req.PaddleType] {
		return &validationError{field: "paddle_type", message: "invalid paddle_type value"}
	}
	if !validSelf[req.SelfAssessment] {
		return &validationError{field: "self_assessment", message: "invalid self_assessment value"}
	}
	return nil
}
