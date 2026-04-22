-- name: GetPlayerProfile :one
SELECT
    id,
    email,
    name,
    last_name,
    role,
    status,
    elo,
    avatar_url,
    onboarding_completed,
    validated_match_count,
    elo_frozen,
    region_id,
    trust_score,
    gender,
    created_at,
    updated_at,
    ST_Y(location::geometry) AS latitude,
    ST_X(location::geometry) AS longitude
FROM users
WHERE id = $1;

-- name: UpdatePlayerProfile :exec
UPDATE users
SET
    last_name = $2,
    location  = ST_MakePoint($4, $3)::geography,
    updated_at = NOW()
WHERE id = $1;

-- name: UpdatePlayerELO :exec
UPDATE users
SET elo = $2, updated_at = NOW()
WHERE id = $1;

-- name: UpdatePlayerAvatar :exec
UPDATE users
SET avatar_url = $2, updated_at = NOW()
WHERE id = $1;

-- name: SetOnboardingCompleted :exec
UPDATE users
SET onboarding_completed = TRUE, elo = $2, gender = $3, updated_at = NOW()
WHERE id = $1;

-- name: GetPlayersByRegion :many
SELECT
    id,
    email,
    name,
    last_name,
    role,
    status,
    elo,
    avatar_url,
    onboarding_completed,
    validated_match_count,
    elo_frozen,
    region_id,
    trust_score,
    created_at,
    updated_at,
    ST_Y(location::geometry) AS latitude,
    ST_X(location::geometry) AS longitude
FROM users
WHERE region_id = $1 AND status = 'active'
ORDER BY elo DESC;

-- name: SearchPlayersByName :many
SELECT id, name, elo, avatar_url, gender
FROM users
WHERE LOWER(name) LIKE LOWER('%' || @query || '%')
  AND status IN ('active', 'calibration')
ORDER BY elo DESC
LIMIT @search_limit;

-- name: GetPlayerGenders :many
SELECT id, gender
FROM users
WHERE id = ANY($1::uuid[]);

-- name: GetPlayerELOs :many
SELECT id, elo
FROM users
WHERE id = ANY($1::uuid[]);

-- name: GetPlayerStatuses :many
SELECT id, status
FROM users
WHERE id = ANY($1::uuid[]);

-- name: UpdatePlayerNameOnly :exec
UPDATE users SET
    name = COALESCE(NULLIF(@name::varchar, ''), name),
    last_name = COALESCE(NULLIF(@last_name::varchar, ''), last_name),
    updated_at = NOW()
WHERE id = @id;
