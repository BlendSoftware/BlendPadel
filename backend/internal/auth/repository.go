package auth

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/juani/blendpadel/backend/internal/db"
)

// Repository defines the persistence operations needed by the auth service.
type Repository interface {
	CreateUser(ctx context.Context, email, passwordHash, name string) (*db.User, error)
	GetUserByEmail(ctx context.Context, email string) (*db.User, error)
	GetUserByID(ctx context.Context, userID uuid.UUID) (*db.User, error)
	UpdatePassword(ctx context.Context, userID uuid.UUID, newHash string) error

	CreateRefreshToken(ctx context.Context, userID uuid.UUID, tokenHash string, familyID uuid.UUID, expiresAt time.Time) error
	GetRefreshToken(ctx context.Context, tokenHash string) (*db.RefreshToken, error)
	GetRefreshTokenAny(ctx context.Context, tokenHash string) (*db.RefreshToken, error)
	RevokeToken(ctx context.Context, tokenID uuid.UUID) error
	RevokeTokenFamily(ctx context.Context, familyID uuid.UUID) error
	RevokeAllUserTokens(ctx context.Context, userID uuid.UUID) error
}
