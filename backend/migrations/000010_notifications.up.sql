CREATE TABLE device_tokens (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token        TEXT NOT NULL,
    platform     VARCHAR(10) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (player_id, token)
);

CREATE INDEX idx_device_tokens_player ON device_tokens(player_id);

CREATE TABLE notification_log (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    reference_id      UUID,
    sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_log_lookup
    ON notification_log(player_id, notification_type, reference_id);
