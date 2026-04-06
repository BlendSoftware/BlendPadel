-- name: CreateVenue :one
INSERT INTO venues (name, address, location, court_count, phone, hours, region_id, added_by)
VALUES (
    @name,
    @address,
    ST_MakePoint(@lng, @lat)::geography,
    @court_count,
    @phone,
    @hours,
    @region_id,
    @added_by
)
RETURNING id, name, address, court_count, phone, hours, region_id, added_by, verified,
    ST_Y(location::geometry) AS lat,
    ST_X(location::geometry) AS lng,
    created_at, updated_at;

-- name: GetVenueByID :one
SELECT
    id, name, address, court_count, phone, hours, region_id, added_by, verified,
    ST_Y(location::geometry) AS lat,
    ST_X(location::geometry) AS lng,
    created_at, updated_at
FROM venues
WHERE id = @id;

-- name: GetVenuesNearby :many
SELECT
    id, name, address, court_count, phone, hours, region_id, added_by, verified,
    ST_Y(location::geometry) AS lat,
    ST_X(location::geometry) AS lng,
    ST_Distance(location, ST_MakePoint(@lng, @lat)::geography) AS distance_meters,
    created_at, updated_at
FROM venues
WHERE ST_DWithin(location, ST_MakePoint(@lng, @lat)::geography, @radius_meters)
ORDER BY distance_meters ASC
LIMIT @page_limit OFFSET @page_offset;

-- name: UpdateVenue :one
UPDATE venues
SET
    name = COALESCE(NULLIF(@name::varchar, ''), name),
    address = COALESCE(NULLIF(@address::text, ''), address),
    court_count = COALESCE(NULLIF(@court_count::int, 0), court_count),
    phone = COALESCE(NULLIF(@phone::varchar, ''), phone),
    hours = COALESCE(@hours::jsonb, hours),
    verified = @verified,
    updated_at = NOW()
WHERE id = @id
RETURNING id, name, address, court_count, phone, hours, region_id, added_by, verified,
    ST_Y(location::geometry) AS lat,
    ST_X(location::geometry) AS lng,
    created_at, updated_at;
