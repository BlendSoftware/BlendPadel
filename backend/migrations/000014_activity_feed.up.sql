CREATE TABLE activity_feed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES users(id),
    event_type VARCHAR(30) NOT NULL,
    content JSONB NOT NULL,
    region_id UUID REFERENCES regions(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_feed_region ON activity_feed(region_id, created_at DESC);
CREATE INDEX idx_activity_feed_player ON activity_feed(player_id, created_at DESC);
