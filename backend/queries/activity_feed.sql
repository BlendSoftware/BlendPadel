-- name: CreateFeedEvent :one
INSERT INTO activity_feed (player_id, event_type, content, region_id)
VALUES (@player_id, @event_type, @content, @region_id)
RETURNING id, player_id, event_type, content, region_id, created_at;

-- name: GetFeedByRegion :many
SELECT
    af.id,
    af.player_id,
    af.event_type,
    af.content,
    af.region_id,
    af.created_at,
    u.name AS player_name
FROM activity_feed af
JOIN users u ON u.id = af.player_id
WHERE af.region_id = @region_id
ORDER BY af.created_at DESC
LIMIT @page_limit OFFSET @page_offset;

-- name: GetRecentPlayerEventByType :one
SELECT id, created_at
FROM activity_feed
WHERE player_id = @player_id
  AND event_type = @event_type
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 1;

-- name: GetPlayerWinStreak :many
SELECT
    CASE WHEN mr.winner_team = mp.team THEN TRUE ELSE FALSE END AS won
FROM match_players mp
JOIN matches m ON m.id = mp.match_id AND m.status = 'sealed'
JOIN match_results mr ON mr.match_id = mp.match_id
WHERE mp.player_id = @player_id
ORDER BY m.created_at DESC
LIMIT 10;
