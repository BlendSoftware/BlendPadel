-- name: CreateRefreshToken :exec
INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
VALUES ($1, $2, $3, $4);

-- name: GetRefreshTokenByHash :one
SELECT * FROM refresh_tokens
WHERE token_hash = $1 AND revoked = FALSE AND expires_at > NOW();

-- name: GetRefreshTokenByHashAny :one
SELECT * FROM refresh_tokens
WHERE token_hash = $1;

-- name: RevokeRefreshToken :exec
UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1;

-- name: RevokeTokenFamily :exec
UPDATE refresh_tokens SET revoked = TRUE WHERE family_id = $1;

-- name: RevokeAllUserTokens :exec
UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1;
