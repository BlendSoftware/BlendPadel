-- Add gender to users (mandatory, default 'male' for existing test data)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS gender VARCHAR(10) NOT NULL DEFAULT 'male'
    CHECK (gender IN ('male', 'female', 'other'));

-- Add match_type to matches
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS match_type VARCHAR(10) NOT NULL DEFAULT 'male'
    CHECK (match_type IN ('male', 'female', 'mixed'));

-- Add match_type to matchmaking_flares
ALTER TABLE matchmaking_flares
ADD COLUMN IF NOT EXISTS match_type VARCHAR(10) NOT NULL DEFAULT 'male'
    CHECK (match_type IN ('male', 'female', 'mixed'));
