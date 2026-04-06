package feed

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// GetFeed returns the activity feed for a region.
func (s *Service) GetFeed(ctx context.Context, regionID uuid.UUID, limit, offset int32) ([]FeedEventResponse, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 50 {
		limit = 50
	}
	return s.repo.GetFeedByRegion(ctx, regionID, limit, offset)
}

// CheckAndGenerateEvents checks for achievements after a match is sealed.
// Called for each player in the match. Errors are logged but not propagated.
func (s *Service) CheckAndGenerateEvents(ctx context.Context, playerID uuid.UUID, regionID *uuid.UUID, validatedMatchCount int) {
	s.checkWinStreak(ctx, playerID, regionID)
	s.checkMatchMilestone(ctx, playerID, regionID, validatedMatchCount)
}

func (s *Service) checkWinStreak(ctx context.Context, playerID uuid.UUID, regionID *uuid.UUID) {
	streak, err := s.repo.GetPlayerWinStreak(ctx, playerID)
	if err != nil {
		log.Error().Err(err).Str("player", playerID.String()).Msg("feed: failed to get win streak")
		return
	}

	if streak < 3 {
		return
	}

	// Dedup: don't create if we already generated a win streak event in last 24h.
	has, err := s.repo.HasRecentEvent(ctx, playerID, EventWinStreak)
	if err != nil {
		log.Error().Err(err).Msg("feed: failed to check recent event")
		return
	}
	if has {
		return
	}

	content, _ := json.Marshal(map[string]interface{}{
		"streak": streak,
	})
	if err := s.repo.CreateEvent(ctx, playerID, EventWinStreak, content, regionID); err != nil {
		log.Error().Err(err).Msg("feed: failed to create win streak event")
		return
	}

	log.Info().Str("player", playerID.String()).Int("streak", streak).Msg("feed: win streak event created")
}

func (s *Service) checkMatchMilestone(ctx context.Context, playerID uuid.UUID, regionID *uuid.UUID, matchCount int) {
	isMilestone := false
	for _, threshold := range milestoneThresholds {
		if matchCount == threshold {
			isMilestone = true
			break
		}
	}
	if !isMilestone {
		return
	}

	content, _ := json.Marshal(map[string]interface{}{
		"milestone": matchCount,
	})
	if err := s.repo.CreateEvent(ctx, playerID, EventMatchMilestone, content, regionID); err != nil {
		log.Error().Err(err).Msg(fmt.Sprintf("feed: failed to create milestone event for %d matches", matchCount))
	}
}
