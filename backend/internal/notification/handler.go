package notification

import (
	"encoding/json"
	"net/http"

	"github.com/juani/blendpadel/backend/internal/auth"
	"github.com/juani/blendpadel/backend/internal/platform/response"
)

// Handler holds HTTP handlers for notification-related endpoints.
type Handler struct {
	svc *Service
}

// NewHandler creates a new notification Handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// registerDeviceTokenRequest is the request body for device token registration.
type registerDeviceTokenRequest struct {
	Token    string `json:"token"`
	Platform string `json:"platform"`
}

// deleteDeviceTokenRequest is the request body for device token deletion.
type deleteDeviceTokenRequest struct {
	Token string `json:"token"`
}

// RegisterDeviceToken handles POST /players/me/device-token.
func (h *Handler) RegisterDeviceToken(w http.ResponseWriter, r *http.Request) {
	playerID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	var req registerDeviceTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid request body")
		return
	}

	if req.Token == "" {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "token is required")
		return
	}

	if req.Platform == "" {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "platform is required")
		return
	}

	if req.Platform != "ios" && req.Platform != "android" && req.Platform != "web" {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "platform must be ios, android, or web")
		return
	}

	if err := h.svc.UpsertDeviceToken(r.Context(), playerID, req.Token, req.Platform); err != nil {
		response.Problem(w, http.StatusInternalServerError, "Internal Server Error", "failed to register device token")
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"status": "registered"})
}

// DeleteDeviceToken handles DELETE /players/me/device-token.
func (h *Handler) DeleteDeviceToken(w http.ResponseWriter, r *http.Request) {
	playerID, ok := auth.GetUserID(r.Context())
	if !ok {
		response.Problem(w, http.StatusUnauthorized, "Unauthorized", "missing authentication")
		return
	}

	var req deleteDeviceTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "invalid request body")
		return
	}

	if req.Token == "" {
		response.Problem(w, http.StatusBadRequest, "Bad Request", "token is required")
		return
	}

	if err := h.svc.DeleteDeviceToken(r.Context(), playerID, req.Token); err != nil {
		response.Problem(w, http.StatusInternalServerError, "Internal Server Error", "failed to delete device token")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
