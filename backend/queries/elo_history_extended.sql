-- name: GetELOHistoryWithOpponents :many
SELECT
    eh.id,
    eh.match_id,
    eh.elo_before,
    eh.elo_after,
    (eh.elo_after - eh.elo_before) AS delta,
    eh.created_at,
    opp.opponent_id,
    opp.opponent_name
FROM elo_history eh
JOIN match_players my_mp ON my_mp.match_id = eh.match_id AND my_mp.player_id = $1
CROSS JOIN LATERAL (
    SELECT mp2.player_id AS opponent_id, u2.name AS opponent_name
    FROM match_players mp2
    JOIN users u2 ON u2.id = mp2.player_id
    WHERE mp2.match_id = eh.match_id
      AND mp2.team != my_mp.team
    ORDER BY u2.name
    LIMIT 1
) opp
WHERE eh.player_id = $1
  AND ($2::timestamptz IS NULL OR eh.created_at < $2)
ORDER BY eh.created_at DESC, eh.id DESC
LIMIT $3;
