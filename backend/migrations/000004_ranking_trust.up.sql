CREATE TABLE elo_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES users(id),
    match_id UUID,
    elo_before INTEGER NOT NULL,
    elo_after INTEGER NOT NULL,
    delta INTEGER NOT NULL,
    k_factor INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'match_result',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_elo_history_player ON elo_history(player_id, created_at DESC);
CREATE INDEX idx_elo_history_match ON elo_history(match_id);

CREATE TABLE trust_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES users(id),
    event_type VARCHAR(30) NOT NULL,
    delta INTEGER NOT NULL,
    reference_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_trust_events_player ON trust_events(player_id, created_at DESC);
CREATE INDEX idx_trust_events_type ON trust_events(player_id, event_type, created_at);
