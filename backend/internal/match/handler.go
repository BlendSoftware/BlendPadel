package match

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

// Handler holds HTTP handlers for the match domain.
type Handler struct {
	svc *Service
}

// NewHandler creates a new match Handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// CreateMatch handles POST /matches.
func (h *Handler) CreateMatch(w http.ResponseWriter, r *http.Request) {
	callerID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	var req CreateMatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid request body")
		return
	}

	match, err := h.svc.CreateMatch(r.Context(), callerID, req)
	if err != nil {
		mapError(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, match)
}

// SubmitResult handles POST /matches/{id}/result.
func (h *Handler) SubmitResult(w http.ResponseWriter, r *http.Request) {
	callerID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	matchID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid match id")
		return
	}

	var req SubmitResultRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid request body")
		return
	}

	if err := h.svc.SubmitResult(r.Context(), matchID, callerID, req); err != nil {
		mapError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"status": "awaiting_confirmation"})
}

// ConfirmMatch handles POST /matches/{id}/confirm.
func (h *Handler) ConfirmMatch(w http.ResponseWriter, r *http.Request) {
	callerID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	matchID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid match id")
		return
	}

	if err := h.svc.ConfirmMatch(r.Context(), matchID, callerID); err != nil {
		mapError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"status": "sealed"})
}

// DisputeMatch handles POST /matches/{id}/dispute.
func (h *Handler) DisputeMatch(w http.ResponseWriter, r *http.Request) {
	callerID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	matchID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid match id")
		return
	}

	var req DisputeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid request body")
		return
	}

	if err := h.svc.DisputeMatch(r.Context(), matchID, callerID, req); err != nil {
		mapError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"status": "disputed"})
}

// GetMatchDetail handles GET /matches/{id}.
func (h *Handler) GetMatchDetail(w http.ResponseWriter, r *http.Request) {
	_, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	matchID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid match id")
		return
	}

	result, err := h.svc.GetMatchDetail(r.Context(), matchID)
	if err != nil {
		mapError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, result)
}

// GetActiveMatches handles GET /players/{playerID}/matches/active.
func (h *Handler) GetActiveMatches(w http.ResponseWriter, r *http.Request) {
	_, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	playerID, err := uuid.Parse(chi.URLParam(r, "playerID"))
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid player id")
		return
	}

	items, err := h.svc.GetActiveMatches(r.Context(), playerID)
	if err != nil {
		mapError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, items)
}

// GetMatchHistory handles GET /players/{playerID}/matches.
func (h *Handler) GetMatchHistory(w http.ResponseWriter, r *http.Request) {
	_, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	playerID, err := uuid.Parse(chi.URLParam(r, "playerID"))
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid player id")
		return
	}

	limit := 10
	offset := 0

	if l := r.URL.Query().Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 {
			limit = v
		}
	}
	if p := r.URL.Query().Get("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 1 {
			offset = (v - 1) * limit
		}
	}

	items, err := h.svc.GetMatchHistory(r.Context(), playerID, limit, offset)
	if err != nil {
		mapError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, items)
}

// GetPendingDisputes handles GET /admin/disputes.
func (h *Handler) GetPendingDisputes(w http.ResponseWriter, r *http.Request) {
	disputes, err := h.svc.GetPendingDisputes(r.Context())
	if err != nil {
		mapError(w, err)
		return
	}

	result := make([]DisputeResponse, 0, len(disputes))
	for _, d := range disputes {
		result = append(result, disputeToResponse(d))
	}

	response.JSON(w, http.StatusOK, result)
}

// ResolveDispute handles POST /admin/disputes/{id}/resolve.
func (h *Handler) ResolveDispute(w http.ResponseWriter, r *http.Request) {
	moderatorID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	disputeID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid dispute id")
		return
	}

	var req ResolveDisputeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid request body")
		return
	}

	if err := h.svc.ResolveDispute(r.Context(), disputeID, moderatorID, req); err != nil {
		mapError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"status": "resolved"})
}

// CancelMatch handles POST /matches/{id}/cancel.
func (h *Handler) CancelMatch(w http.ResponseWriter, r *http.Request) {
	callerID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	idStr := chi.URLParam(r, "id")
	matchID, err := uuid.Parse(idStr)
	if err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid match id")
		return
	}

	if err := h.svc.CancelMatch(r.Context(), matchID, callerID); err != nil {
		mapError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"status": "cancelled"})
}

// --- helpers ---

func mapError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrMatchNotFound), errors.Is(err, ErrDisputeNotFound):
		response.Problem(w, http.StatusNotFound, "Not Found", err.Error())
	case errors.Is(err, ErrForbidden), errors.Is(err, ErrNotCaptain):
		response.Problem(w, http.StatusForbidden, "Forbidden", err.Error())
	case errors.Is(err, ErrInvalidTransition), errors.Is(err, ErrWindowClosed), errors.Is(err, ErrMatchNotCancellable):
		response.Problem(w, http.StatusConflict, "Conflict", err.Error())
	case errors.Is(err, ErrInvalidSets), errors.Is(err, ErrInvalidTeamComposition):
		response.Problem(w, http.StatusUnprocessableEntity, "Validation Error", err.Error())
	case errors.Is(err, ErrGenderMismatch):
		response.JSON(w, http.StatusUnprocessableEntity, map[string]string{
			"error_code": "GENDER_MISMATCH",
			"message":    err.Error(),
		})
	case errors.Is(err, ErrInvalidMatchType):
		response.Problem(w, http.StatusBadRequest, "Bad Request", err.Error())
	case errors.Is(err, ErrPlayerBanned):
		response.Problem(w, http.StatusForbidden, "Forbidden", err.Error())
	default:
		response.Problem(w, http.StatusInternalServerError, "Internal Server Error", err.Error())
	}
}

func disputeToResponse(d Dispute) DisputeResponse {
	return DisputeResponse{
		ID:                d.ID,
		MatchID:           d.MatchID,
		RaisedBy:          d.RaisedBy,
		Reason:            d.Reason,
		Status:            d.Status,
		ResolvedBy:        d.ResolvedBy,
		PenalizedPlayerID: d.PenalizedPlayerID,
		ResolvedAt:        d.ResolvedAt,
		CreatedAt:         d.CreatedAt,
	}
}
