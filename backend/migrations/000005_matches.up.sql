CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR(30) NOT NULL DEFAULT 'pending_result',
    scheduled_at TIMESTAMPTZ NOT NULL,
    location GEOGRAPHY(Point, 4326),
    captain_a_id UUID NOT NULL REFERENCES users(id),
    captain_b_id UUID NOT NULL REFERENCES users(id),
    avg_elo INTEGER,
    sealed_by VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_location ON matches USING GIST(location);
CREATE INDEX idx_matches_scheduled ON matches(scheduled_at);

CREATE TABLE match_players (
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES users(id),
    team CHAR(1) NOT NULL CHECK (team IN ('A', 'B')),
    PRIMARY KEY (match_id, player_id)
);
CREATE INDEX idx_match_players_player ON match_players(player_id);

CREATE TABLE match_results (
    match_id UUID PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
    sets JSONB NOT NULL,
    winner_team CHAR(1) NOT NULL CHECK (winner_team IN ('A', 'B')),
    total_games_a INTEGER NOT NULL,
    total_games_b INTEGER NOT NULL,
    game_diff INTEGER NOT NULL,
    submitted_by UUID NOT NULL REFERENCES users(id),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES matches(id),
    raised_by UUID NOT NULL REFERENCES users(id),
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    resolved_by UUID REFERENCES users(id),
    resolution_result JSONB,
    penalized_player_id UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_disputes_status ON disputes(status);
CREATE INDEX idx_disputes_match ON disputes(match_id);
