CREATE TABLE matchmaking_flares (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location     GEOGRAPHY(POINT, 4326) NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    elo_min      INT NOT NULL DEFAULT 0,
    elo_max      INT NOT NULL DEFAULT 3000,
    min_players  INT NOT NULL DEFAULT 2,
    max_players  INT NOT NULL DEFAULT 4,
    status       TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'matched', 'cancelled', 'expired')),
    match_id     UUID REFERENCES matches(id),
    expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE flare_respondents (
    flare_id  UUID NOT NULL REFERENCES matchmaking_flares(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (flare_id, player_id)
);

CREATE INDEX idx_flares_player_id ON matchmaking_flares(player_id);
CREATE INDEX idx_flares_status_expires ON matchmaking_flares(status, expires_at);
CREATE INDEX idx_flares_location ON matchmaking_flares USING GIST(location);
CREATE UNIQUE INDEX idx_flares_one_active_per_player
    ON matchmaking_flares(player_id)
    WHERE status = 'active';
