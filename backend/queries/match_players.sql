-- name: InsertMatchPlayer :exec
INSERT INTO match_players (match_id, player_id, team)
VALUES ($1, $2, $3);

-- name: GetMatchPlayers :many
SELECT match_id, player_id, team
FROM match_players
WHERE match_id = $1;

-- name: GetMatchPlayersByTeam :many
SELECT match_id, player_id, team
FROM match_players
WHERE match_id = $1 AND team = $2;

-- name: GetMatchPlayersHydrated :many
-- Returns match players joined with user profile so the API can serve name/elo/avatar
-- without requiring a client-side cache lookup for calibration-stage players.
SELECT
    mp.match_id,
    mp.player_id,
    mp.team,
    u.name,
    COALESCE(u.last_name, '')  AS last_name,
    u.elo,
    u.gender,
    COALESCE(u.avatar_url, '') AS avatar_url,
    u.status
FROM match_players mp
JOIN users u ON u.id = mp.player_id
WHERE mp.match_id = $1;
