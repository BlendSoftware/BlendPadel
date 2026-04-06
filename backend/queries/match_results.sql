-- name: InsertMatchResult :one
INSERT INTO match_results (match_id, sets, winner_team, total_games_a, total_games_b, game_diff, submitted_by)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING match_id, sets, winner_team, total_games_a, total_games_b, game_diff, submitted_by, submitted_at;

-- name: GetMatchResult :one
SELECT match_id, sets, winner_team, total_games_a, total_games_b, game_diff, submitted_by, submitted_at
FROM match_results
WHERE match_id = $1;
