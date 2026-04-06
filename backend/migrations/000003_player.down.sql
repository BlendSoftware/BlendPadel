DROP TABLE IF EXISTS onboarding_responses;

DROP INDEX IF EXISTS idx_users_location;
DROP INDEX IF EXISTS idx_users_elo;
DROP INDEX IF EXISTS idx_users_region;

ALTER TABLE users
    DROP COLUMN IF EXISTS last_name,
    DROP COLUMN IF EXISTS location,
    DROP COLUMN IF EXISTS region_id,
    DROP COLUMN IF EXISTS elo,
    DROP COLUMN IF EXISTS avatar_url,
    DROP COLUMN IF EXISTS onboarding_completed,
    DROP COLUMN IF EXISTS validated_match_count,
    DROP COLUMN IF EXISTS elo_frozen;
