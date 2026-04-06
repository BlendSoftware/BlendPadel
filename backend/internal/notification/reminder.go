package notification

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

// ReminderJob is a background goroutine that sends 4h confirmation reminders.
type ReminderJob struct {
	pool      *pgxpool.Pool
	notifSvc  *Service
	interval  time.Duration
}

// NewReminderJob creates a new ReminderJob.
func NewReminderJob(pool *pgxpool.Pool, notifSvc *Service, interval time.Duration) *ReminderJob {
	return &ReminderJob{
		pool:     pool,
		notifSvc: notifSvc,
		interval: interval,
	}
}

// Start runs the reminder loop until ctx is cancelled.
func (j *ReminderJob) Start(ctx context.Context) {
	ticker := time.NewTicker(j.interval)
	defer ticker.Stop()

	log.Info().Dur("interval", j.interval).Msg("reminder job started")

	for {
		select {
		case <-ctx.Done():
			log.Info().Msg("reminder job stopped")
			return
		case <-ticker.C:
			j.run(ctx)
		}
	}
}

// run queries matches that hit the 4h mark and sends reminders.
func (j *ReminderJob) run(ctx context.Context) {
	// Matches in awaiting_confirmation where result was submitted between 4h and 5h ago.
	// The 5h upper bound avoids re-sending on restarts for very old matches.
	const query = `
		SELECT m.id, m.captain_b_id
		FROM matches m
		JOIN match_results mr ON mr.match_id = m.id
		WHERE m.status = 'awaiting_confirmation'
		  AND mr.submitted_at < NOW() - INTERVAL '4 hours'
		  AND mr.submitted_at > NOW() - INTERVAL '5 hours'
	`

	rows, err := j.pool.Query(ctx, query)
	if err != nil {
		log.Error().Err(err).Msg("reminder job: query failed")
		return
	}
	defer rows.Close()

	type matchRow struct {
		matchID    uuid.UUID
		captainBID uuid.UUID
	}

	var pending []matchRow
	for rows.Next() {
		var r matchRow
		var matchIDBytes [16]byte
		var captainBBytes [16]byte
		if err := rows.Scan(&matchIDBytes, &captainBBytes); err != nil {
			log.Error().Err(err).Msg("reminder job: scan failed")
			continue
		}
		r.matchID = uuid.UUID(matchIDBytes)
		r.captainBID = uuid.UUID(captainBBytes)
		pending = append(pending, r)
	}
	if err := rows.Err(); err != nil {
		log.Error().Err(err).Msg("reminder job: rows error")
		return
	}

	for _, p := range pending {
		if err := j.notifSvc.SendReminder(ctx, p.captainBID, p.matchID); err != nil {
			log.Error().Err(err).
				Str("match_id", p.matchID.String()).
				Str("captain_b_id", p.captainBID.String()).
				Msg("reminder job: send reminder failed")
		}
	}

	if len(pending) > 0 {
		log.Info().Int("count", len(pending)).Msg("reminder job: reminders processed")
	}
}
