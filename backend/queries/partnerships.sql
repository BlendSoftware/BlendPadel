-- name: CreatePartnership :one
INSERT INTO player_partnerships (requester_id, partner_id)
VALUES (@requester_id, @partner_id)
RETURNING id, requester_id, partner_id, status, created_at, updated_at;

-- name: GetPartnershipByID :one
SELECT id, requester_id, partner_id, status, created_at, updated_at
FROM player_partnerships
WHERE id = @id;

-- name: GetExistingPartnership :one
SELECT id, requester_id, partner_id, status, created_at, updated_at
FROM player_partnerships
WHERE (requester_id = @player_a AND partner_id = @player_b)
   OR (requester_id = @player_b AND partner_id = @player_a)
LIMIT 1;

-- name: CountActivePartnershipsByPlayer :one
SELECT COUNT(*)::INT
FROM player_partnerships
WHERE (requester_id = @player_id OR partner_id = @player_id)
  AND status = 'accepted';

-- name: GetActivePartnershipsByPlayer :many
SELECT
    pp.id,
    pp.requester_id,
    pp.partner_id,
    pp.status,
    pp.created_at,
    pp.updated_at,
    u.name AS partner_name,
    u.elo AS partner_elo
FROM player_partnerships pp
JOIN users u ON u.id = CASE
    WHEN pp.requester_id = @player_id THEN pp.partner_id
    ELSE pp.requester_id
END
WHERE (pp.requester_id = @player_id OR pp.partner_id = @player_id)
  AND pp.status IN ('accepted', 'pending')
ORDER BY pp.created_at DESC;

-- name: UpdatePartnershipStatus :one
UPDATE player_partnerships
SET status = @status, updated_at = NOW()
WHERE id = @id
RETURNING id, requester_id, partner_id, status, created_at, updated_at;
