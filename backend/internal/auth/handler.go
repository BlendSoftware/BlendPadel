package auth

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/juani/blendpadel/backend/internal/platform/response"
)

// Handler holds the HTTP handlers for the auth domain.
type Handler struct {
	service *Service
}

// NewHandler creates a new auth Handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// Register handles POST /auth/register.
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid JSON body")
		return
	}

	user, err := h.service.Register(r.Context(), req)
	if err != nil {
		h.writeError(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, map[string]interface{}{
		"id":          user.ID,
		"email":       user.Email,
		"name":        user.Name,
		"role":        user.Role,
		"status":      user.Status,
		"trust_score": user.TrustScore,
	})
}

// Login handles POST /auth/login.
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid JSON body")
		return
	}

	ip := extractIP(r)
	resp, err := h.service.Login(r.Context(), req, ip)
	if err != nil {
		h.writeError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, resp)
}

// Refresh handles POST /auth/refresh.
func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req RefreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid JSON body")
		return
	}

	resp, err := h.service.Refresh(r.Context(), req)
	if err != nil {
		h.writeError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, resp)
}

// Logout handles POST /auth/logout.
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	var req RefreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid JSON body")
		return
	}

	if err := h.service.Logout(r.Context(), req.RefreshToken); err != nil {
		h.writeError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"message": "logged out successfully"})
}

// ChangePassword handles PUT /auth/password.
func (h *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing user identity")
		return
	}

	var req ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid JSON body")
		return
	}

	if err := h.service.ChangePassword(r.Context(), userID, req); err != nil {
		h.writeError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"message": "password changed successfully"})
}

// writeError maps domain errors to RFC 7807 problem details.
func (h *Handler) writeError(w http.ResponseWriter, err error) {
	var rateLimitErr *RateLimitError
	switch {
	case errors.As(err, &rateLimitErr):
		w.Header().Set("Retry-After", rateLimitErr.RetryAfter.String())
		response.Problem(w, http.StatusTooManyRequests, "Too Many Requests", err.Error())
	case errors.Is(err, ErrInvalidCredentials):
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "invalid credentials")
	case errors.Is(err, ErrEmailTaken):
		response.Problem(w, http.StatusConflict, "Conflict", "email is already registered")
	case errors.Is(err, ErrWeakPassword):
		response.ValidationError(w, []response.FieldError{
			{Field: "password", Message: "password must be at least 8 characters with 1 uppercase letter and 1 digit"},
		})
	case errors.Is(err, ErrTokenExpired):
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "token expired or invalid")
	case errors.Is(err, ErrTokenReused):
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "token reuse detected, all sessions invalidated")
	case errors.Is(err, ErrForbidden):
		response.Problem(w, http.StatusForbidden, "Forbidden", "access denied")
	default:
		response.Problem(w, http.StatusInternalServerError, "Internal Server Error", "an unexpected error occurred")
	}
}
