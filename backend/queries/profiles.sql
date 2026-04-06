-- name: GetPublicProfile :one
SELECT id, name, elo, trust_score, validated_match_count, region_id, status, gender
FROM users
WHERE id = $1;

-- name: GetOwnProfile :one
SELECT id, name, email, elo, trust_score, validated_match_count, region_id, status, preferences, gender, created_at
FROM users
WHERE id = $1;

-- name: UpdatePreferences :exec
UPDATE users
SET preferences = $2, updated_at = NOW()
WHERE id = $1;
