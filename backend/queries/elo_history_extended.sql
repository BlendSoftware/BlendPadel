-- name: GetELOHistoryWithOpponents :many
SELECT
    eh.id,
    eh.match_id,
    eh.elo_before,
    eh.elo_after,
    (eh.elo_after - eh.elo_before) AS delta,
    eh.created_at,
    u.id   AS opponent_id,
    u.name AS opponent_name
FROM elo_history eh
JOIN match_players mp ON mp.match_id = eh.match_id AND mp.player_id != $1
JOIN users u ON u.id = mp.player_id
WHERE eh.player_id = $1
  AND ($2::timestamptz IS NULL OR eh.created_at < $2)
ORDER BY eh.created_at DESC, eh.id DESC
LIMIT $3;
