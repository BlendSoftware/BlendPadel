package auth

import "errors"

// Domain errors for the auth package.
var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrEmailTaken         = errors.New("email already taken")
	ErrTokenExpired       = errors.New("token expired or invalid")
	ErrTokenReused        = errors.New("token reuse detected")
	ErrWeakPassword       = errors.New("password does not meet requirements")
	ErrForbidden          = errors.New("forbidden")
	ErrRegionMismatch     = errors.New("region mismatch")
	ErrRateLimited        = errors.New("too many requests")
)
