-- name: InsertTrustEvent :one
INSERT INTO trust_events (player_id, event_type, delta, reference_id)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetTrustEvents :many
SELECT * FROM trust_events WHERE player_id = $1 ORDER BY created_at DESC LIMIT $2;

-- name: GetMonthlyRecoverySum :one
SELECT COALESCE(SUM(delta), 0)::integer AS total
FROM trust_events
WHERE player_id = $1
  AND event_type = 'match_completed'
  AND created_at >= date_trunc('month', NOW());

-- name: CountRecentDisputes :one
SELECT COUNT(*)::integer AS count
FROM trust_events
WHERE player_id = $1
  AND event_type IN ('dispute', 'systematic_dispute')
  AND created_at >= NOW() - INTERVAL '30 days';
