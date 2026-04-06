-- name: CreateUser :one
INSERT INTO users (email, password_hash, name, role, status, trust_score)
VALUES ($1, $2, $3, 'player', 'calibration', 80)
RETURNING *;

-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = $1;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;

-- name: UpdateUserPassword :exec
UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1;

-- name: UpdatePlayerStatus :exec
UPDATE users SET status = $2, updated_at = NOW() WHERE id = $1;
