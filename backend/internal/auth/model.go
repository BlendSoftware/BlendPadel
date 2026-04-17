package auth

import (
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// RegisterRequest is the DTO for user registration.
type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
	LastName string `json:"last_name"`
}

// LoginRequest is the DTO for user login.
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// LoginResponse is returned on successful login or token refresh.
type LoginResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"` // seconds
}

// RefreshRequest is the DTO for token refresh.
type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// ChangePasswordRequest is the DTO for changing password.
type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

// Claims extends jwt.RegisteredClaims with app-specific fields.
type Claims struct {
	jwt.RegisteredClaims
	Role     string     `json:"role"`
	RegionID *uuid.UUID `json:"region_id,omitempty"`
}
