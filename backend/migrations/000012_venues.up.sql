-- Venues table
CREATE TABLE venues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    address TEXT NOT NULL,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    court_count INT NOT NULL DEFAULT 1,
    phone VARCHAR(30),
    hours JSONB,
    region_id UUID REFERENCES regions(id),
    added_by UUID NOT NULL REFERENCES users(id),
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_venues_location ON venues USING GIST(location);
CREATE INDEX idx_venues_region ON venues(region_id);

-- Optional venue association on matches
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES venues(id);

-- Optional venue association on flares
ALTER TABLE matchmaking_flares
ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES venues(id);
