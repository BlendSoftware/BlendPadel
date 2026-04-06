-- name: CreateReport :one
INSERT INTO conduct_reports (reporter_id, reported_id, match_id, reason)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetReportsByRegion :many
SELECT cr.*
FROM conduct_reports cr
JOIN matches m ON m.id = cr.match_id
WHERE m.region_id = $1
  AND (CASE WHEN $2::varchar = '' THEN TRUE ELSE cr.status = $2::varchar END)
ORDER BY cr.created_at DESC
LIMIT $3 OFFSET $4;

-- name: GetReportsByPlayer :many
SELECT *
FROM conduct_reports
WHERE reported_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: IsMatchParticipant :one
SELECT EXISTS(
    SELECT 1 FROM match_players WHERE match_id = $1 AND player_id = $2
);

-- name: IsMatchCompleted :one
SELECT EXISTS(
    SELECT 1 FROM matches WHERE id = $1 AND status = 'completed'
);

-- name: CountReportsByRegion :one
SELECT COUNT(*)
FROM conduct_reports cr
JOIN matches m ON m.id = cr.match_id
WHERE m.region_id = $1
  AND (CASE WHEN $2::varchar = '' THEN TRUE ELSE cr.status = $2::varchar END);
