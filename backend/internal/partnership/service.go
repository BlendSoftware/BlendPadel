package partnership

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) RequestPartnership(ctx context.Context, requesterID uuid.UUID, req CreateRequest) (*PartnershipResponse, error) {
	if requesterID == req.PartnerID {
		return nil, ErrSelfPartnership
	}

	// Check if partnership already exists in either direction.
	existing, err := s.repo.GetExisting(ctx, requesterID, req.PartnerID)
	if err != nil {
		return nil, fmt.Errorf("check existing partnership: %w", err)
	}
	if existing != nil && (existing.Status == StatusPending || existing.Status == StatusAccepted) {
		return nil, ErrAlreadyExists
	}

	// Check active partnership limit for requester.
	count, err := s.repo.CountActive(ctx, requesterID)
	if err != nil {
		return nil, fmt.Errorf("count active partnerships: %w", err)
	}
	if count >= MaxActivePartnerships {
		return nil, ErrMaxPartnerships
	}

	return s.repo.Create(ctx, requesterID, req.PartnerID)
}

func (s *Service) AcceptPartnership(ctx context.Context, partnershipID, callerID uuid.UUID) (*PartnershipResponse, error) {
	p, err := s.repo.GetByID(ctx, partnershipID)
	if err != nil {
		return nil, err
	}

	// Only the partner (not the requester) can accept.
	if callerID != p.PartnerID {
		return nil, fmt.Errorf("%w: only the partner can accept", ErrForbidden)
	}
	if p.Status != StatusPending {
		return nil, fmt.Errorf("%w: can only accept pending partnerships", ErrInvalidTransition)
	}

	// Check active limit for the accepting partner too.
	count, err := s.repo.CountActive(ctx, callerID)
	if err != nil {
		return nil, fmt.Errorf("count active partnerships: %w", err)
	}
	if count >= MaxActivePartnerships {
		return nil, ErrMaxPartnerships
	}

	return s.repo.UpdateStatus(ctx, partnershipID, StatusAccepted)
}

func (s *Service) RejectPartnership(ctx context.Context, partnershipID, callerID uuid.UUID) (*PartnershipResponse, error) {
	p, err := s.repo.GetByID(ctx, partnershipID)
	if err != nil {
		return nil, err
	}

	if callerID != p.PartnerID {
		return nil, fmt.Errorf("%w: only the partner can reject", ErrForbidden)
	}
	if p.Status != StatusPending {
		return nil, fmt.Errorf("%w: can only reject pending partnerships", ErrInvalidTransition)
	}

	return s.repo.UpdateStatus(ctx, partnershipID, StatusRejected)
}

func (s *Service) DissolvePartnership(ctx context.Context, partnershipID, callerID uuid.UUID) (*PartnershipResponse, error) {
	p, err := s.repo.GetByID(ctx, partnershipID)
	if err != nil {
		return nil, err
	}

	if callerID != p.RequesterID && callerID != p.PartnerID {
		return nil, fmt.Errorf("%w: only a participant can dissolve", ErrForbidden)
	}
	if p.Status != StatusAccepted {
		return nil, fmt.Errorf("%w: can only dissolve accepted partnerships", ErrInvalidTransition)
	}

	return s.repo.UpdateStatus(ctx, partnershipID, StatusDissolved)
}

func (s *Service) GetMyPartnerships(ctx context.Context, playerID uuid.UUID) ([]PartnershipResponse, error) {
	return s.repo.GetActiveByPlayer(ctx, playerID)
}

func (s *Service) GetSentRequests(ctx context.Context, playerID uuid.UUID) ([]SentRequestResponse, error) {
	items, err := s.repo.GetActiveByPlayer(ctx, playerID)
	if err != nil {
		return nil, err
	}

	result := make([]SentRequestResponse, 0, len(items))
	for _, item := range items {
		if item.Status != StatusPending || item.RequesterID != playerID {
			continue
		}
		result = append(result, SentRequestResponse{
			ID:     item.ID,
			Status: item.Status,
			RequestedUser: RequestedUser{
				ID:       item.PartnerID,
				FullName: item.PartnerName,
			},
			CreatedAt: item.CreatedAt,
		})
	}

	return result, nil
}

// GetPartnershipStats returns pair statistics for a partnership.
func (s *Service) GetPartnershipStats(ctx context.Context, partnershipID, callerID uuid.UUID) (*PairStatsResponse, error) {
	p, err := s.repo.GetByID(ctx, partnershipID)
	if err != nil {
		return nil, err
	}

	totalMatches, wins, err := s.repo.GetPairStats(ctx, p.RequesterID, p.PartnerID)
	if err != nil {
		return nil, fmt.Errorf("get pair stats: %w", err)
	}

	var winRate float64
	if totalMatches > 0 {
		winRate = float64(wins) / float64(totalMatches)
	}

	// Calculate current win streak.
	recentMatches, err := s.repo.GetPairRecentMatches(ctx, p.RequesterID, p.PartnerID)
	if err != nil {
		return nil, fmt.Errorf("get recent matches: %w", err)
	}
	streak := 0
	for _, won := range recentMatches {
		if won {
			streak++
		} else {
			break
		}
	}

	return &PairStatsResponse{
		TotalMatches:  totalMatches,
		Wins:          wins,
		WinRate:       winRate,
		CurrentStreak: streak,
	}, nil
}

// GetBestPartner returns the player's best partner (highest win rate, min 3 matches).
func (s *Service) GetBestPartner(ctx context.Context, playerID uuid.UUID) (*BestPartnerResponse, error) {
	return s.repo.GetBestPartner(ctx, playerID)
}
