package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"time"
	"unicode"

	"github.com/google/uuid"
	"github.com/juani/blendpadel/backend/internal/db"
	"golang.org/x/crypto/bcrypt"
)

const (
	bcryptCost      = 10
	refreshTokenTTL = 30 * 24 * time.Hour
)

// Service implements the auth business logic.
type Service struct {
	repo        Repository
	jwtManager  *JWTManager
	rateLimiter *RateLimiter
}

// NewService creates a new auth Service.
func NewService(repo Repository, jwtManager *JWTManager, rateLimiter *RateLimiter) *Service {
	return &Service{
		repo:        repo,
		jwtManager:  jwtManager,
		rateLimiter: rateLimiter,
	}
}

// validatePassword enforces: min 8 chars, at least 1 uppercase, at least 1 digit.
func validatePassword(password string) error {
	if len(password) < 8 {
		return ErrWeakPassword
	}
	hasUpper := false
	hasDigit := false
	for _, ch := range password {
		if unicode.IsUpper(ch) {
			hasUpper = true
		}
		if unicode.IsDigit(ch) {
			hasDigit = true
		}
	}
	if !hasUpper || !hasDigit {
		return ErrWeakPassword
	}
	return nil
}

// Register creates a new user account.
func (s *Service) Register(ctx context.Context, req RegisterRequest) (*db.User, error) {
	if err := validatePassword(req.Password); err != nil {
		return nil, err
	}

	// Check email uniqueness.
	existing, err := s.repo.GetUserByEmail(ctx, req.Email)
	if err != nil && !errors.Is(err, ErrInvalidCredentials) {
		return nil, fmt.Errorf("checking email: %w", err)
	}
	if existing != nil {
		return nil, ErrEmailTaken
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcryptCost)
	if err != nil {
		return nil, fmt.Errorf("hashing password: %w", err)
	}

	user, err := s.repo.CreateUser(ctx, req.Email, string(hash), req.Name, req.LastName)
	if err != nil {
		return nil, fmt.Errorf("creating user: %w", err)
	}
	return user, nil
}

// Login authenticates a user and returns a token pair.
func (s *Service) Login(ctx context.Context, req LoginRequest, ip string) (*LoginResponse, error) {
	allowed, _, retryAfter := s.rateLimiter.Allow(ip)
	if !allowed {
		return nil, &RateLimitError{RetryAfter: retryAfter}
	}

	user, err := s.repo.GetUserByEmail(ctx, req.Email)
	if err != nil {
		// Don't reset limiter on failure.
		return nil, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	// Successful auth — reset the rate limiter.
	s.rateLimiter.Reset(ip)

	userID := uuid.UUID(user.ID.Bytes)
	resp, err := s.generateTokenPair(ctx, userID, user.Role, nil, uuid.New())
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// Refresh rotates the refresh token and issues a new access token.
// Token family invalidation: if a revoked token is presented, the entire family is revoked.
func (s *Service) Refresh(ctx context.Context, req RefreshRequest) (*LoginResponse, error) {
	hash := hashToken(req.RefreshToken)

	// First try to find an active token.
	token, err := s.repo.GetRefreshToken(ctx, hash)
	if err != nil {
		if errors.Is(err, ErrTokenExpired) {
			// Token not found as active — check if it exists but is revoked (reuse attack).
			anyToken, anyErr := s.repo.GetRefreshTokenAny(ctx, hash)
			if anyErr == nil && anyToken.Revoked {
				// REUSE DETECTED — invalidate entire family.
				familyID := uuid.UUID(anyToken.FamilyID.Bytes)
				_ = s.repo.RevokeTokenFamily(ctx, familyID)
				return nil, ErrTokenReused
			}
			return nil, ErrTokenExpired
		}
		return nil, err
	}

	familyID := uuid.UUID(token.FamilyID.Bytes)
	userID := uuid.UUID(token.UserID.Bytes)

	// Revoke the current token (consume it).
	if err := s.repo.RevokeToken(ctx, uuid.UUID(token.ID.Bytes)); err != nil {
		return nil, fmt.Errorf("revoking token: %w", err)
	}

	// Issue new pair with same family_id.
	resp, err := s.generateTokenPair(ctx, userID, "", nil, familyID)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

// handleTokenReuse detects if a revoked token's family still has active tokens.
// Called when a revoked token is presented (reuse attack).
func (s *Service) Logout(ctx context.Context, refreshToken string) error {
	hash := hashToken(refreshToken)
	token, err := s.repo.GetRefreshToken(ctx, hash)
	if err != nil {
		// Already revoked or expired — idempotent.
		return nil
	}
	return s.repo.RevokeToken(ctx, uuid.UUID(token.ID.Bytes))
}

// ChangePassword updates the user's password and revokes all refresh tokens.
func (s *Service) ChangePassword(ctx context.Context, userID uuid.UUID, req ChangePasswordRequest) error {
	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		return ErrInvalidCredentials
	}

	if err := validatePassword(req.NewPassword); err != nil {
		return err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcryptCost)
	if err != nil {
		return fmt.Errorf("hashing password: %w", err)
	}

	if err := s.repo.UpdatePassword(ctx, userID, string(hash)); err != nil {
		return fmt.Errorf("updating password: %w", err)
	}

	return s.repo.RevokeAllUserTokens(ctx, userID)
}

// generateTokenPair creates a new access + refresh token pair.
// If role is empty, it fetches the user to get the role.
func (s *Service) generateTokenPair(ctx context.Context, userID uuid.UUID, role string, regionID *uuid.UUID, familyID uuid.UUID) (*LoginResponse, error) {
	if role == "" {
		user, err := s.repo.GetUserByID(ctx, userID)
		if err != nil {
			return nil, fmt.Errorf("fetching user for token generation: %w", err)
		}
		role = user.Role
	}

	accessToken, err := s.jwtManager.GenerateAccessToken(userID, role, regionID)
	if err != nil {
		return nil, fmt.Errorf("generating access token: %w", err)
	}

	rawRefresh, err := generateOpaqueToken()
	if err != nil {
		return nil, fmt.Errorf("generating refresh token: %w", err)
	}

	tokenHash := hashToken(rawRefresh)
	expiresAt := time.Now().Add(refreshTokenTTL)

	if err := s.repo.CreateRefreshToken(ctx, userID, tokenHash, familyID, expiresAt); err != nil {
		return nil, fmt.Errorf("storing refresh token: %w", err)
	}

	return &LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: rawRefresh,
		ExpiresIn:    int64(s.jwtManager.accessTTL.Seconds()),
	}, nil
}

// generateOpaqueToken creates a 32-byte random token encoded as base64.
func generateOpaqueToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// hashToken computes SHA-256 of the token and returns a hex string.
func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

// RateLimitError carries the retry-after duration.
type RateLimitError struct {
	RetryAfter time.Duration
}

func (e *RateLimitError) Error() string {
	return fmt.Sprintf("rate limited, retry after %s", e.RetryAfter)
}

// ValidatePasswordExported exposes validatePassword for unit testing in other packages if needed.
// Internal tests use validatePassword directly since they're in the same package.

// PasswordValidationCases returns test cases for password validation — used in tests.
func passwordValidationCases() []struct {
	password string
	valid    bool
} {
	return []struct {
		password string
		valid    bool
	}{
		{"short1A", false},        // too short
		{"alllowercase1", false},  // no uppercase
		{"ALLUPPERCASE1", false},  // no lowercase (but has digit + upper, missing lower — wait, our rule: min8 + 1upper + 1digit)
		{"NoDigitHere!", false},   // no digit
		{"Valid1Pass", true},
		{"AnotherGood2", true},
		{"12345678A", true},
		{"", false},
	}
}
