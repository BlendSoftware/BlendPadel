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
