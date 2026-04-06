DROP TABLE IF EXISTS refresh_tokens;

ALTER TABLE users
    DROP COLUMN IF EXISTS name,
    DROP COLUMN IF EXISTS trust_score;
