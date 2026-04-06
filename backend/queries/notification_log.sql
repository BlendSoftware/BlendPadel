-- name: InsertNotificationLog :exec
INSERT INTO notification_log (player_id, notification_type, reference_id)
VALUES ($1, $2, $3);

-- name: CheckNotificationSent :one
SELECT EXISTS (
    SELECT 1 FROM notification_log
    WHERE player_id = $1
      AND notification_type = $2
      AND reference_id = $3
      AND sent_at > NOW() - $4::interval
) AS sent;
