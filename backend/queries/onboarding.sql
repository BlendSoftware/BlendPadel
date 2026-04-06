-- name: CreateOnboardingResponse :exec
INSERT INTO onboarding_responses (user_id, responses, calculated_elo)
VALUES ($1, $2, $3);

-- name: GetOnboardingResponse :one
SELECT id, user_id, responses, calculated_elo, created_at
FROM onboarding_responses
WHERE user_id = $1;
