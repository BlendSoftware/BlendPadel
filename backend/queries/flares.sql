-- name: CreateFlare :one
INSERT INTO matchmaking_flares (player_id, location, scheduled_at, elo_min, elo_max, min_players, max_players, match_type, venue_id)
VALUES (@player_id, ST_MakePoint(@lng, @lat)::geography, @scheduled_at, @elo_min, @elo_max, @min_players, @max_players, @match_type, @venue_id)
RETURNING *;

-- name: GetActiveFlareByPlayer :one
SELECT * FROM matchmaking_flares
WHERE player_id = @player_id AND status = 'active'
LIMIT 1;

-- name: GetActiveFlares :many
SELECT
    f.id,
    f.player_id,
    f.scheduled_at,
    f.elo_min,
    f.elo_max,
    f.min_players,
    f.max_players,
    f.match_type,
    f.venue_id,
    f.status,
    f.match_id,
    f.expires_at,
    f.created_at,
    f.updated_at,
    p.name AS creator_name,
    ST_Y(f.location::geometry) AS lat,
    ST_X(f.location::geometry) AS lng,
    ST_Distance(f.location, ST_MakePoint(@lng, @lat)::geography) AS distance_meters,
    (SELECT COUNT(*)::INT FROM flare_respondents fr WHERE fr.flare_id = f.id) AS respondent_count
FROM matchmaking_flares f
JOIN users p ON p.id = f.player_id
JOIN users viewer ON viewer.id = @viewer_player_id
WHERE f.status = 'active'
  AND f.expires_at > NOW()
  AND ST_DWithin(f.location, ST_MakePoint(@lng, @lat)::geography, @radius_meters)
  AND f.elo_min <= viewer.elo
  AND f.elo_max >= viewer.elo
  AND p.trust_score >= @min_trust_score
  AND (
      f.created_at < @cursor_created_at
      OR (f.created_at = @cursor_created_at AND f.id < @cursor_id::uuid)
  )
ORDER BY f.created_at DESC, f.id DESC
LIMIT @page_size;

-- name: GetActiveFlaresByMatchType :many
SELECT
    f.id,
    f.player_id,
    f.scheduled_at,
    f.elo_min,
    f.elo_max,
    f.min_players,
    f.max_players,
    f.match_type,
    f.venue_id,
    f.status,
    f.match_id,
    f.expires_at,
    f.created_at,
    f.updated_at,
    p.name AS creator_name,
    ST_Y(f.location::geometry) AS lat,
    ST_X(f.location::geometry) AS lng,
    ST_Distance(f.location, ST_MakePoint(@lng, @lat)::geography) AS distance_meters,
    (SELECT COUNT(*)::INT FROM flare_respondents fr WHERE fr.flare_id = f.id) AS respondent_count
FROM matchmaking_flares f
JOIN users p ON p.id = f.player_id
JOIN users viewer ON viewer.id = @viewer_player_id
WHERE f.status = 'active'
  AND f.expires_at > NOW()
  AND f.match_type = @match_type
  AND ST_DWithin(f.location, ST_MakePoint(@lng, @lat)::geography, @radius_meters)
  AND f.elo_min <= viewer.elo
  AND f.elo_max >= viewer.elo
  AND p.trust_score >= @min_trust_score
  AND (
      f.created_at < @cursor_created_at
      OR (f.created_at = @cursor_created_at AND f.id < @cursor_id::uuid)
  )
ORDER BY f.created_at DESC, f.id DESC
LIMIT @page_size;

-- name: GetFlareByID :one
SELECT * FROM matchmaking_flares WHERE id = @id;

-- name: GetFlareByIDForUpdate :one
SELECT * FROM matchmaking_flares WHERE id = @id FOR UPDATE;

-- name: UpdateFlareStatus :one
UPDATE matchmaking_flares
SET status = @status, match_id = @match_id, updated_at = NOW()
WHERE id = @id
RETURNING *;

-- name: CancelFlare :one
UPDATE matchmaking_flares
SET status = 'cancelled', updated_at = NOW()
WHERE id = @id AND player_id = @player_id AND status = 'active'
RETURNING *;

-- name: ExpireOldFlares :execrows
UPDATE matchmaking_flares
SET status = 'expired', updated_at = NOW()
WHERE status = 'active' AND expires_at < NOW();

-- name: AddFlareRespondent :exec
INSERT INTO flare_respondents (flare_id, player_id) VALUES (@flare_id, @player_id)
ON CONFLICT DO NOTHING;

-- name: CountFlareRespondents :one
SELECT COUNT(*)::INT FROM flare_respondents WHERE flare_id = @flare_id;

-- name: GetFlareRespondents :many
SELECT player_id FROM flare_respondents WHERE flare_id = @flare_id;
