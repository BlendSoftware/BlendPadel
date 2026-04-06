-- name: InsertELOHistory :one
INSERT INTO elo_history (player_id, match_id, elo_before, elo_after, delta, k_factor, type)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetELOHistory :many
SELECT * FROM elo_history WHERE player_id = $1 ORDER BY created_at DESC LIMIT $2;

-- name: GetELOHistoryByMatch :many
SELECT * FROM elo_history WHERE match_id = $1;
