-- name: GetPairStats :one
SELECT
    COUNT(*)::INT AS total_matches,
    COUNT(*) FILTER (WHERE mr.winner_team = mp1.team)::INT AS wins
FROM match_players mp1
JOIN match_players mp2 ON mp1.match_id = mp2.match_id
    AND mp1.team = mp2.team
    AND mp1.player_id != mp2.player_id
JOIN matches m ON m.id = mp1.match_id AND m.status = 'sealed'
JOIN match_results mr ON mr.match_id = mp1.match_id
WHERE mp1.player_id = @player_a AND mp2.player_id = @player_b;

-- name: GetPairRecentMatches :many
SELECT
    mp1.match_id,
    CASE WHEN mr.winner_team = mp1.team THEN TRUE ELSE FALSE END AS won
FROM match_players mp1
JOIN match_players mp2 ON mp1.match_id = mp2.match_id
    AND mp1.team = mp2.team
    AND mp1.player_id != mp2.player_id
JOIN matches m ON m.id = mp1.match_id AND m.status = 'sealed'
JOIN match_results mr ON mr.match_id = mp1.match_id
WHERE mp1.player_id = @player_a AND mp2.player_id = @player_b
ORDER BY m.created_at DESC
LIMIT 50;

-- name: GetBestPartner :one
WITH pair_stats AS (
    SELECT
        mp2.player_id AS partner_id,
        COUNT(*)::INT AS total_matches,
        COUNT(*) FILTER (WHERE mr.winner_team = mp1.team)::INT AS wins
    FROM match_players mp1
    JOIN match_players mp2 ON mp1.match_id = mp2.match_id
        AND mp1.team = mp2.team
        AND mp1.player_id != mp2.player_id
    JOIN matches m ON m.id = mp1.match_id AND m.status = 'sealed'
    JOIN match_results mr ON mr.match_id = mp1.match_id
    WHERE mp1.player_id = @player_id
    GROUP BY mp2.player_id
    HAVING COUNT(*) >= 3
)
SELECT
    ps.partner_id,
    u.name AS partner_name,
    u.elo AS partner_elo,
    ps.total_matches,
    ps.wins,
    ROUND(ps.wins::NUMERIC / ps.total_matches * 100)::INT AS win_rate_pct
FROM pair_stats ps
JOIN users u ON u.id = ps.partner_id
ORDER BY ps.wins::NUMERIC / ps.total_matches DESC, ps.total_matches DESC
LIMIT 1;
