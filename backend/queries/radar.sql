-- name: GetRadarMatches :many
-- Radar: open matches within radius + ELO range + trust filter
-- Cursor-based pagination on (scheduled_at, id)
SELECT
    m.id,
    m.captain_a_id                                                                          AS captain_id,
    ca.name                                                                                  AS captain_name,
    ST_Y(m.location::geometry)::float8                                                       AS lat,
    ST_X(m.location::geometry)::float8                                                       AS lng,
    ST_Distance(m.location, ST_MakePoint($2, $1)::geography)::float8                        AS distance_meters,
    m.avg_elo,
    m.scheduled_at,
    COUNT(mp.player_id)::int4                                                                AS joined_count
FROM matches m
JOIN users ca ON ca.id = m.captain_a_id
JOIN users viewer ON viewer.id = $8
LEFT JOIN match_players mp ON mp.match_id = m.id
WHERE m.status = 'pending_result'
  AND m.scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '48 hours'
  AND m.location IS NOT NULL
  AND ST_DWithin(m.location, ST_MakePoint($2, $1)::geography, $3)
  AND m.avg_elo BETWEEN $4 AND $5
  AND (ca.trust_score >= 70 OR viewer.trust_score < 70)
  AND (
      $6::timestamptz IS NULL
      OR (m.scheduled_at, m.id) > ($6::timestamptz, $7::uuid)
  )
GROUP BY m.id, ca.name, viewer.trust_score
ORDER BY m.scheduled_at ASC, m.id ASC
LIMIT $9;

-- name: GetRadarAlerts :many
-- Radar alerts: matches within radius and next 1 hour, trust filter, no ELO filter
SELECT
    m.id,
    m.captain_a_id                                                                          AS captain_id,
    ca.name                                                                                  AS captain_name,
    ST_Y(m.location::geometry)::float8                                                       AS lat,
    ST_X(m.location::geometry)::float8                                                       AS lng,
    ST_Distance(m.location, ST_MakePoint($2, $1)::geography)::float8                        AS distance_meters,
    m.avg_elo,
    m.scheduled_at,
    COUNT(mp.player_id)::int4                                                                AS joined_count
FROM matches m
JOIN users ca ON ca.id = m.captain_a_id
JOIN users viewer ON viewer.id = $3
LEFT JOIN match_players mp ON mp.match_id = m.id
WHERE m.status = 'pending_result'
  AND m.scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '1 hour'
  AND m.location IS NOT NULL
  AND ST_DWithin(m.location, ST_MakePoint($2, $1)::geography, $4)
  AND (ca.trust_score >= 70 OR viewer.trust_score < 70)
GROUP BY m.id, ca.name, viewer.trust_score
ORDER BY m.scheduled_at ASC;
