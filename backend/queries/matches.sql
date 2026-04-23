-- name: CreateMatch :one
INSERT INTO matches (status, scheduled_at, location, captain_a_id, captain_b_id, avg_elo, match_type, venue_id)
VALUES (
    'pending_result',
    $1,
    ST_MakePoint($3, $2)::geography,
    $4,
    $5,
    $6,
    $7,
    $8
)
RETURNING id, status, scheduled_at, captain_a_id, captain_b_id, avg_elo, match_type, venue_id, sealed_by, created_at, updated_at;

-- name: GetMatchByID :one
SELECT id, status, scheduled_at, captain_a_id, captain_b_id, avg_elo, match_type, venue_id, sealed_by, created_at, updated_at
FROM matches
WHERE id = $1;

-- name: UpdateMatchStatus :exec
UPDATE matches
SET status = $2, sealed_by = $3, updated_at = NOW()
WHERE id = $1;

-- name: UpdateMatchStatusCAS :one
UPDATE matches
SET status = $3, sealed_by = $4, updated_at = NOW()
WHERE id = $1 AND status = $2
RETURNING id;

-- name: GetMatchesAwaitingConfirmation :many
SELECT m.id, m.status, m.scheduled_at, m.captain_a_id, m.captain_b_id, m.avg_elo, m.match_type, m.venue_id, m.sealed_by, m.created_at, m.updated_at
FROM matches m
JOIN match_results mr ON mr.match_id = m.id
WHERE m.status = 'awaiting_confirmation'
AND mr.submitted_at < NOW() - INTERVAL '6 hours';

-- name: GetMatchesByPlayer :many
SELECT m.id, m.status, m.scheduled_at, m.captain_a_id, m.captain_b_id, m.avg_elo, m.match_type, m.venue_id, m.sealed_by, m.created_at, m.updated_at
FROM matches m
JOIN match_players mp ON mp.match_id = m.id
WHERE mp.player_id = $1 AND m.status = 'sealed'
ORDER BY m.created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetActiveMatchesByPlayer :many
SELECT m.id, m.status, m.scheduled_at, m.captain_a_id, m.captain_b_id, m.avg_elo, m.match_type, m.venue_id, m.sealed_by, m.created_at, m.updated_at
FROM matches m
JOIN match_players mp ON mp.match_id = m.id
WHERE mp.player_id = $1 AND m.status != 'sealed' AND m.status != 'cancelled'
ORDER BY m.scheduled_at ASC;

-- name: GetMatchByIDForUpdate :one
SELECT id, status, scheduled_at, captain_a_id, captain_b_id, avg_elo, match_type, venue_id, sealed_by, created_at, updated_at
FROM matches
WHERE id = $1
FOR UPDATE;

-- name: UpdateMatchResult :exec
UPDATE match_results
SET sets = $2, winner_team = $3, total_games_a = $4, total_games_b = $5, game_diff = $6
WHERE match_id = $1;
