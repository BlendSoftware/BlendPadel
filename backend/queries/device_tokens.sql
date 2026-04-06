-- name: UpsertDeviceToken :exec
INSERT INTO device_tokens (player_id, token, platform, last_used_at)
VALUES ($1, $2, $3, NOW())
ON CONFLICT (player_id, token)
DO UPDATE SET platform = EXCLUDED.platform, last_used_at = NOW();

-- name: DeleteDeviceToken :exec
DELETE FROM device_tokens
WHERE player_id = $1 AND token = $2;

-- name: GetDeviceTokensByPlayer :many
SELECT token FROM device_tokens
WHERE player_id = $1
ORDER BY last_used_at DESC;
