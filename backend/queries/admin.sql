-- name: GetKPIs :one
SELECT
    (SELECT COUNT(*) FROM users WHERE role = 'player')::BIGINT                                        AS total_players,
    (SELECT COUNT(*) FROM users WHERE role = 'player' AND status = 'active')::BIGINT                  AS active_players,
    (SELECT COUNT(*) FROM users WHERE status IN ('banned_soft', 'banned_hard'))::BIGINT               AS banned_players,
    (SELECT COUNT(*) FROM matches)::BIGINT                                                            AS total_matches,
    (SELECT COUNT(*) FROM matches WHERE status = 'completed')::BIGINT                                 AS completed_matches,
    (SELECT COUNT(*) FROM disputes WHERE status = 'pending')::BIGINT                                  AS pending_disputes,
    COALESCE((SELECT AVG(elo) FROM users WHERE role = 'player' AND status = 'active'), 0)::FLOAT8     AS avg_elo,
    (SELECT COUNT(*) FROM users WHERE role = 'moderator')::BIGINT                                     AS total_moderators;

-- name: ListModerators :many
SELECT id, email, name, last_name, role, status, region_id, created_at
FROM users
WHERE role = 'moderator'
ORDER BY created_at ASC;

-- name: CreateModerator :one
INSERT INTO users (email, password_hash, name, last_name, role, status, region_id, trust_score)
VALUES ($1, $2, $3, $4, 'moderator', 'active', $5, 80)
RETURNING id, email, name, last_name, role, status, region_id, created_at;

-- name: UpdateModerator :one
UPDATE users
SET region_id = $2, updated_at = NOW()
WHERE id = $1 AND role = 'moderator'
RETURNING id, email, name, last_name, role, status, region_id, created_at;

-- name: DeleteModerator :exec
UPDATE users
SET role = 'player', region_id = NULL, updated_at = NOW()
WHERE id = $1 AND role = 'moderator';

-- name: BanPlayer :exec
UPDATE users
SET status = $2, updated_at = NOW()
WHERE id = $1;

-- name: UnbanPlayer :exec
UPDATE users
SET status = 'active', updated_at = NOW()
WHERE id = $1;

-- name: GetUserELO :one
SELECT elo FROM users WHERE id = $1;

-- name: UpdateUserELO :exec
UPDATE users SET elo = $2, updated_at = NOW() WHERE id = $1;

-- name: InsertAuditLog :exec
INSERT INTO admin_audit_log (admin_id, action, target_user_id, details)
VALUES ($1, $2, $3, $4);

-- name: ListAuditLog :many
SELECT id, admin_id, action, target_user_id, details, created_at
FROM admin_audit_log
WHERE ($1::UUID IS NULL OR admin_id = $1)
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountAuditLog :one
SELECT COUNT(*)::BIGINT FROM admin_audit_log
WHERE ($1::UUID IS NULL OR admin_id = $1);
