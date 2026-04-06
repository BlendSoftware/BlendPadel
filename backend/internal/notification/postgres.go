package notification

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/juani/blendpadel/backend/internal/db"
)

// postgresRepo is the PostgreSQL implementation of Repository.
type postgresRepo struct {
	q *db.Queries
}

// NewPostgresRepo creates a new Repository backed by the given sqlc Queries.
func NewPostgresRepo(q *db.Queries) Repository {
	return &postgresRepo{q: q}
}

func (r *postgresRepo) UpsertDeviceToken(ctx context.Context, playerID uuid.UUID, token, platform string) error {
	return r.q.UpsertDeviceToken(ctx, db.UpsertDeviceTokenParams{
		PlayerID: uuidToPg(playerID),
		Token:    token,
		Platform: platform,
	})
}

func (r *postgresRepo) DeleteDeviceToken(ctx context.Context, playerID uuid.UUID, token string) error {
	return r.q.DeleteDeviceToken(ctx, db.DeleteDeviceTokenParams{
		PlayerID: uuidToPg(playerID),
		Token:    token,
	})
}

func (r *postgresRepo) GetDeviceTokensByPlayer(ctx context.Context, playerID uuid.UUID) ([]string, error) {
	return r.q.GetDeviceTokensByPlayer(ctx, uuidToPg(playerID))
}

func (r *postgresRepo) InsertNotificationLog(ctx context.Context, playerID uuid.UUID, notifType NotificationType, referenceID uuid.UUID) error {
	return r.q.InsertNotificationLog(ctx, db.InsertNotificationLogParams{
		PlayerID:         uuidToPg(playerID),
		NotificationType: string(notifType),
		ReferenceID:      uuidToPg(referenceID),
	})
}

func (r *postgresRepo) CheckNotificationSent(ctx context.Context, playerID uuid.UUID, notifType NotificationType, referenceID uuid.UUID, dedupWindow time.Duration) (bool, error) {
	// Convert duration to pgtype.Interval (microseconds).
	interval := pgtype.Interval{
		Microseconds: dedupWindow.Microseconds(),
		Valid:        true,
	}
	return r.q.CheckNotificationSent(ctx, db.CheckNotificationSentParams{
		PlayerID:         uuidToPg(playerID),
		NotificationType: string(notifType),
		ReferenceID:      uuidToPg(referenceID),
		Column4:          interval,
	})
}

// --- helpers ---

func uuidToPg(id uuid.UUID) pgtype.UUID {
	return pgtype.UUID{Bytes: id, Valid: true}
}
