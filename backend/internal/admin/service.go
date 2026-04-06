package admin

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/juani/blendpadel/backend/internal/auth"
)

const kpiCacheTTL = 5 * time.Minute

// kpiCache holds a cached KPI result with a timestamp.
type kpiCache struct {
	mu        sync.Mutex
	data      *KPIResponse
	fetchedAt time.Time
}

// Service provides admin business logic.
type Service struct {
	repo     Repository
	authRepo auth.Repository
	cache    kpiCache
}

// NewService creates a new admin Service.
func NewService(repo Repository, authRepo auth.Repository) *Service {
	return &Service{repo: repo, authRepo: authRepo}
}

// GetKPIs returns operational metrics, served from a 5-minute in-memory cache.
func (s *Service) GetKPIs(ctx context.Context) (*KPIResponse, error) {
	s.cache.mu.Lock()
	defer s.cache.mu.Unlock()

	if s.cache.data != nil && time.Since(s.cache.fetchedAt) < kpiCacheTTL {
		return s.cache.data, nil
	}

	kpis, err := s.repo.GetKPIs(ctx)
	if err != nil {
		return nil, fmt.Errorf("fetching kpis: %w", err)
	}

	s.cache.data = kpis
	s.cache.fetchedAt = time.Now()
	return kpis, nil
}

// ListModerators returns all users with role 'moderator'.
func (s *Service) ListModerators(ctx context.Context) ([]ModeratorResponse, error) {
	return s.repo.ListModerators(ctx)
}

// CreateModerator creates a new user with role 'moderator' and logs the action.
func (s *Service) CreateModerator(ctx context.Context, adminID uuid.UUID, req ModeratorRequest) (*ModeratorResponse, error) {
	mod, err := s.repo.CreateModerator(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("creating moderator: %w", err)
	}
	_ = s.repo.InsertAuditLog(ctx, adminID, "create_moderator", &mod.ID, map[string]any{
		"email":     mod.Email,
		"region_id": req.RegionID,
	})
	return mod, nil
}

// UpdateModerator updates a moderator's region and logs the action.
func (s *Service) UpdateModerator(ctx context.Context, adminID uuid.UUID, id uuid.UUID, req ModeratorRequest) (*ModeratorResponse, error) {
	mod, err := s.repo.UpdateModerator(ctx, id, req)
	if err != nil {
		return nil, err
	}
	_ = s.repo.InsertAuditLog(ctx, adminID, "update_moderator", &id, map[string]any{
		"region_id": req.RegionID,
	})
	return mod, nil
}

// DeleteModerator demotes a moderator to player role and logs the action.
func (s *Service) DeleteModerator(ctx context.Context, adminID uuid.UUID, id uuid.UUID) error {
	if err := s.repo.DeleteModerator(ctx, id); err != nil {
		return err
	}
	_ = s.repo.InsertAuditLog(ctx, adminID, "delete_moderator", &id, nil)
	return nil
}

// BanPlayer bans a player (soft or hard) and logs the action.
// Hard ban also revokes all refresh tokens for the player.
func (s *Service) BanPlayer(ctx context.Context, adminID uuid.UUID, playerID uuid.UUID, req BanRequest) error {
	var status string
	switch req.Type {
	case "soft":
		status = "banned_soft"
	case "hard":
		status = "banned_hard"
	default:
		return ErrInvalidBanType
	}

	if err := s.repo.BanPlayer(ctx, playerID, status); err != nil {
		return fmt.Errorf("banning player: %w", err)
	}

	if req.Type == "hard" {
		// Revoke all refresh tokens so the player is immediately logged out.
		if err := s.authRepo.RevokeAllUserTokens(ctx, playerID); err != nil {
			// Log but don't fail the ban.
			_ = err
		}
	}

	_ = s.repo.InsertAuditLog(ctx, adminID, "ban_player", &playerID, map[string]any{
		"ban_type": req.Type,
		"status":   status,
		"reason":   req.Reason,
	})
	return nil
}

// UnbanPlayer restores a player to active status and logs the action.
func (s *Service) UnbanPlayer(ctx context.Context, adminID uuid.UUID, playerID uuid.UUID) error {
	if err := s.repo.UnbanPlayer(ctx, playerID); err != nil {
		return fmt.Errorf("unbanning player: %w", err)
	}
	_ = s.repo.InsertAuditLog(ctx, adminID, "unban_player", &playerID, nil)
	return nil
}

// AdjustELO applies a manual ELO delta to a player, records history, and logs the action.
func (s *Service) AdjustELO(ctx context.Context, adminID uuid.UUID, playerID uuid.UUID, req ELOAdjustRequest) error {
	currentELO, err := s.repo.GetUserELO(ctx, playerID)
	if err != nil {
		return err
	}

	newELO := currentELO + req.Delta
	if newELO < 0 {
		newELO = 0
	}

	if err := s.repo.UpdateUserELO(ctx, playerID, newELO); err != nil {
		return fmt.Errorf("updating elo: %w", err)
	}

	if err := s.repo.InsertELOHistory(ctx, playerID, currentELO, newELO, newELO-currentELO); err != nil {
		// Non-fatal: log but proceed.
		_ = err
	}

	_ = s.repo.InsertAuditLog(ctx, adminID, "elo_adjust", &playerID, map[string]any{
		"elo_before": currentELO,
		"elo_after":  newELO,
		"delta":      req.Delta,
		"reason":     req.Reason,
	})
	return nil
}

// GetAuditLog returns a paginated list of audit log entries.
func (s *Service) GetAuditLog(ctx context.Context, adminID *uuid.UUID, limit, offset int32) (*AuditLogListResponse, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	entries, err := s.repo.ListAuditLog(ctx, adminID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("listing audit log: %w", err)
	}

	total, err := s.repo.CountAuditLog(ctx, adminID)
	if err != nil {
		return nil, fmt.Errorf("counting audit log: %w", err)
	}

	return &AuditLogListResponse{
		Entries: entries,
		Total:   total,
	}, nil
}
