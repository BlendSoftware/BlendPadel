-- Add region_id to matches (needed for admin reports filtering by region)
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id);

-- Add preferences column to users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{"radar_radius_km": 10, "elo_min_delta": -200, "elo_max_delta": 200}'::jsonb;

-- Create conduct_reports table
CREATE TABLE conduct_reports (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    match_id      UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    reason        TEXT NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'reviewed', 'dismissed')),
    moderator_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_report_per_match UNIQUE (reporter_id, match_id)
);

CREATE INDEX idx_conduct_reports_status ON conduct_reports (status);
CREATE INDEX idx_conduct_reports_reported ON conduct_reports (reported_id);
CREATE INDEX idx_conduct_reports_match ON conduct_reports (match_id);
