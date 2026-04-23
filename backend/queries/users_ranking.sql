-- name: GetPlayerELO :one
SELECT id, elo, validated_match_count, elo_frozen FROM users WHERE id = $1;

-- name: UpdatePlayerELOAndCount :exec
UPDATE users SET elo = $2, validated_match_count = validated_match_count + 1, updated_at = NOW() WHERE id = $1;

-- name: FreezePlayerELO :exec
UPDATE users SET elo_frozen = true, updated_at = NOW() WHERE id = $1;

-- name: IncrementMatchCount :exec
UPDATE users SET validated_match_count = validated_match_count + 1, updated_at = NOW() WHERE id = $1;

-- name: UnfreezePlayerELO :exec
UPDATE users SET elo_frozen = false, updated_at = NOW() WHERE id = $1;

-- name: UpdateTrustScore :exec
UPDATE users SET trust_score = $2, updated_at = NOW() WHERE id = $1;

-- name: GetPlayerTrustScore :one
SELECT id, trust_score FROM users WHERE id = $1;
