-- name: CreateDispute :one
INSERT INTO disputes (match_id, raised_by, reason)
VALUES ($1, $2, $3)
RETURNING id, match_id, raised_by, reason, status, resolved_by, resolution_result, penalized_player_id, resolved_at, created_at;

-- name: GetDisputeByMatch :one
SELECT id, match_id, raised_by, reason, status, resolved_by, resolution_result, penalized_player_id, resolved_at, created_at
FROM disputes
WHERE match_id = $1;

-- name: GetDisputesByStatus :many
SELECT id, match_id, raised_by, reason, status, resolved_by, resolution_result, penalized_player_id, resolved_at, created_at
FROM disputes
WHERE status = $1
ORDER BY created_at ASC;

-- name: GetDisputeByID :one
SELECT id, match_id, raised_by, reason, status, resolved_by, resolution_result, penalized_player_id, resolved_at, created_at
FROM disputes
WHERE id = $1;

-- name: ResolveDispute :exec
UPDATE disputes
SET
    resolved_by = $2,
    resolution_result = $3,
    penalized_player_id = $4,
    resolved_at = NOW(),
    status = 'resolved'
WHERE id = $1;
