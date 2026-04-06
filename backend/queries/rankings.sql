-- name: GetRankingByRegion :many
SELECT
    u.id,
    u.name,
    u.elo,
    u.validated_match_count,
    RANK() OVER (ORDER BY u.elo DESC) AS rank
FROM users u
WHERE u.region_id = $1
  AND u.status = 'active'
ORDER BY u.elo DESC
LIMIT $2 OFFSET $3;

-- name: GetPlayerRank :one
SELECT r.rank
FROM (
    SELECT
        u.id AS uid,
        RANK() OVER (ORDER BY u.elo DESC) AS rank
    FROM users u
    WHERE u.region_id = (SELECT region_id FROM users WHERE users.id = $1)
      AND u.status = 'active'
) r
WHERE r.uid = $1;

-- name: GetRankingByRegionAndGender :many
SELECT
    u.id,
    u.name,
    u.elo,
    u.validated_match_count,
    u.gender,
    RANK() OVER (ORDER BY u.elo DESC) AS rank
FROM users u
WHERE u.region_id = $1
  AND u.status = 'active'
  AND u.gender = $4
ORDER BY u.elo DESC
LIMIT $2 OFFSET $3;

-- name: GetPlayerRankByGender :one
SELECT r.rank
FROM (
    SELECT
        u.id AS uid,
        RANK() OVER (ORDER BY u.elo DESC) AS rank
    FROM users u
    WHERE u.region_id = (SELECT region_id FROM users WHERE users.id = $1)
      AND u.status = 'active'
      AND u.gender = $2
) r
WHERE r.uid = $1;

-- name: GetAllRegions :many
SELECT id, name FROM regions ORDER BY name;

-- name: CreateRegion :one
INSERT INTO regions (name, boundary)
VALUES ($1, ST_GeomFromText($2, 4326))
RETURNING id, name;
