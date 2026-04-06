package auth

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/juani/blendpadel/backend/internal/db"
)

// postgresRepo implements Repository using sqlc-generated queries.
type postgresRepo struct {
	q *db.Queries
}

// NewPostgresRepo creates a new Repository backed by PostgreSQL.
func NewPostgresRepo(q *db.Queries) Repository {
	return &postgresRepo{q: q}
}

func (r *postgresRepo) CreateUser(ctx context.Context, email, passwordHash, name string) (*db.User, error) {
	user, err := r.q.CreateUser(ctx, db.CreateUserParams{
		Email:        email,
		PasswordHash: passwordHash,
		Name:         pgtype.Text{String: name, Valid: name != ""},
	})
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *postgresRepo) GetUserByEmail(ctx context.Context, email string) (*db.User, error) {
	user, err := r.q.GetUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}
	return &user, nil
}

func (r *postgresRepo) GetUserByID(ctx context.Context, userID uuid.UUID) (*db.User, error) {
	pgUUID := pgtype.UUID{Bytes: userID, Valid: true}
	user, err := r.q.GetUserByID(ctx, pgUUID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}
	return &user, nil
}

func (r *postgresRepo) UpdatePassword(ctx context.Context, userID uuid.UUID, newHash string) error {
	return r.q.UpdateUserPassword(ctx, db.UpdateUserPasswordParams{
		ID:           pgtype.UUID{Bytes: userID, Valid: true},
		PasswordHash: newHash,
	})
}

func (r *postgresRepo) CreateRefreshToken(ctx context.Context, userID uuid.UUID, tokenHash string, familyID uuid.UUID, expiresAt time.Time) error {
	return r.q.CreateRefreshToken(ctx, db.CreateRefreshTokenParams{
		UserID:    pgtype.UUID{Bytes: userID, Valid: true},
		TokenHash: tokenHash,
		FamilyID:  pgtype.UUID{Bytes: familyID, Valid: true},
		ExpiresAt: pgtype.Timestamptz{Time: expiresAt, Valid: true},
	})
}

func (r *postgresRepo) GetRefreshToken(ctx context.Context, tokenHash string) (*db.RefreshToken, error) {
	token, err := r.q.GetRefreshTokenByHash(ctx, tokenHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTokenExpired
		}
		return nil, err
	}
	return &token, nil
}

func (r *postgresRepo) GetRefreshTokenAny(ctx context.Context, tokenHash string) (*db.RefreshToken, error) {
	token, err := r.q.GetRefreshTokenByHashAny(ctx, tokenHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTokenExpired
		}
		return nil, err
	}
	return &token, nil
}

func (r *postgresRepo) RevokeToken(ctx context.Context, tokenID uuid.UUID) error {
	return r.q.RevokeRefreshToken(ctx, pgtype.UUID{Bytes: tokenID, Valid: true})
}

func (r *postgresRepo) RevokeTokenFamily(ctx context.Context, familyID uuid.UUID) error {
	return r.q.RevokeTokenFamily(ctx, pgtype.UUID{Bytes: familyID, Valid: true})
}

func (r *postgresRepo) RevokeAllUserTokens(ctx context.Context, userID uuid.UUID) error {
	return r.q.RevokeAllUserTokens(ctx, pgtype.UUID{Bytes: userID, Valid: true})
}
