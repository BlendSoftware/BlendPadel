package player

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/juani/blendpadel/backend/internal/db"
)

// trustLabel maps a numeric trust score to a human-readable category.
func trustLabel(score int32) string {
	switch {
	case score >= 90:
		return "Excelente"
	case score >= 70:
		return "Bueno"
	default:
		return "Bajo"
	}
}

// GetPublicProfile returns the appropriate profile view depending on whether the
// caller is viewing their own profile or another player's profile.
//
//   - Self-view (callerID == profileID): returns OwnProfileResponse with exact
//     trust_score, preferences, and status.
//   - Other-view: returns PublicProfileResponse with trust_label only; banned
//     players are hidden behind ErrNotFound.
func (s *Service) GetPublicProfile(ctx context.Context, callerID, profileID uuid.UUID) (interface{}, error) {
	if callerID == profileID {
		return s.getOwnProfileView(ctx, profileID)
	}
	return s.getPublicProfileView(ctx, profileID)
}

func (s *Service) getOwnProfileView(ctx context.Context, playerID uuid.UUID) (*OwnProfileResponse, error) {
	row, err := s.repo.GetOwnProfile(ctx, playerID)
	if err != nil {
		return nil, err
	}

	var prefs Preferences
	if len(row.Preferences) > 0 {
		if err := json.Unmarshal(row.Preferences, &prefs); err != nil {
			// Return defaults on unmarshal failure rather than failing the request.
			prefs = Preferences{RadarRadiusKM: 10, ELOMinDelta: -200, ELOMaxDelta: 200}
		}
	} else {
		prefs = Preferences{RadarRadiusKM: 10, ELOMinDelta: -200, ELOMaxDelta: 200}
	}

	return &OwnProfileResponse{
		PublicProfileResponse: PublicProfileResponse{
			ID:                  pgtypeToUUID(row.ID),
			Name:                row.Name.String,
			ELO:                 row.Elo,
			Gender:              row.Gender,
			TrustLabel:          trustLabel(row.TrustScore),
			ValidatedMatchCount: row.ValidatedMatchCount,
			RegionID:            pgtypeToUUID(row.RegionID),
		},
		TrustScore:  row.TrustScore,
		Preferences: prefs,
		Status:      row.Status,
		Email:       row.Email,
	}, nil
}

func (s *Service) getPublicProfileView(ctx context.Context, playerID uuid.UUID) (*PublicProfileResponse, error) {
	row, err := s.repo.GetPublicProfile(ctx, playerID)
	if err != nil {
		return nil, err
	}

	// Banned players appear as not found to other users.
	if row.Status == "banned_soft" || row.Status == "banned_hard" {
		return nil, ErrNotFound
	}

	return &PublicProfileResponse{
		ID:                  pgtypeToUUID(row.ID),
		Name:                row.Name.String,
		ELO:                 row.Elo,
		Gender:              row.Gender,
		TrustLabel:          trustLabel(row.TrustScore),
		ValidatedMatchCount: row.ValidatedMatchCount,
		RegionID:            pgtypeToUUID(row.RegionID),
	}, nil
}

// UpdatePreferences validates and persists the player's matchmaking preferences.
func (s *Service) UpdatePreferences(ctx context.Context, playerID uuid.UUID, req PreferencesRequest) (Preferences, error) {
	if req.RadarRadiusKM < 1 || req.RadarRadiusKM > 50 {
		return Preferences{}, fmt.Errorf("%w: radar_radius_km must be between 1 and 50", ErrInvalidPreferences)
	}
	if req.ELOMinDelta < -500 || req.ELOMinDelta > 0 {
		return Preferences{}, fmt.Errorf("%w: elo_min_delta must be between -500 and 0", ErrInvalidPreferences)
	}
	if req.ELOMaxDelta < 0 || req.ELOMaxDelta > 500 {
		return Preferences{}, fmt.Errorf("%w: elo_max_delta must be between 0 and 500", ErrInvalidPreferences)
	}

	prefs := Preferences{
		RadarRadiusKM: req.RadarRadiusKM,
		ELOMinDelta:   req.ELOMinDelta,
		ELOMaxDelta:   req.ELOMaxDelta,
	}

	if err := s.repo.UpdatePreferences(ctx, playerID, prefs); err != nil {
		return Preferences{}, fmt.Errorf("update preferences: %w", err)
	}

	return prefs, nil
}

// ReportConduct validates and creates a conduct report for a completed match.
func (s *Service) ReportConduct(ctx context.Context, reporterID uuid.UUID, matchID uuid.UUID, req ReportRequest) (ReportResponse, error) {
	completed, err := s.repo.IsMatchCompleted(ctx, matchID)
	if err != nil {
		return ReportResponse{}, fmt.Errorf("check match completed: %w", err)
	}
	if !completed {
		return ReportResponse{}, ErrMatchNotCompleted
	}

	reporterParticipant, err := s.repo.IsMatchParticipant(ctx, matchID, reporterID)
	if err != nil {
		return ReportResponse{}, fmt.Errorf("check reporter participant: %w", err)
	}
	if !reporterParticipant {
		return ReportResponse{}, ErrNotParticipant
	}

	reportedParticipant, err := s.repo.IsMatchParticipant(ctx, matchID, req.ReportedID)
	if err != nil {
		return ReportResponse{}, fmt.Errorf("check reported participant: %w", err)
	}
	if !reportedParticipant {
		return ReportResponse{}, fmt.Errorf("reported player is not a participant of this match")
	}

	if req.Reason == "" {
		return ReportResponse{}, fmt.Errorf("reason is required")
	}
	if len(req.Reason) > 500 {
		return ReportResponse{}, fmt.Errorf("reason exceeds 500 characters")
	}

	report, err := s.repo.CreateReport(ctx, db.CreateReportParams{
		ReporterID: pgtype.UUID{Bytes: reporterID, Valid: true},
		ReportedID: pgtype.UUID{Bytes: req.ReportedID, Valid: true},
		MatchID:    pgtype.UUID{Bytes: matchID, Valid: true},
		Reason:     req.Reason,
	})
	if err != nil {
		if errors.Is(err, ErrAlreadyReported) {
			return ReportResponse{}, ErrAlreadyReported
		}
		return ReportResponse{}, fmt.Errorf("create report: %w", err)
	}

	return ReportResponse{
		ID:         pgtypeToUUID(report.ID),
		ReporterID: pgtypeToUUID(report.ReporterID),
		ReportedID: pgtypeToUUID(report.ReportedID),
		MatchID:    pgtypeToUUID(report.MatchID),
		Reason:     report.Reason,
		Status:     report.Status,
		CreatedAt:  report.CreatedAt.Time,
	}, nil
}

// GetAdminReports returns paginated conduct reports filtered by the moderator's region.
// When regionID is nil (superadmin), returns reports across all regions.
// statusFilter can be "pending", "reviewed", "dismissed", or empty for all.
func (s *Service) GetAdminReports(ctx context.Context, regionID *uuid.UUID, statusFilter string, limit, offset int32) (ReportListResponse, error) {
	if statusFilter != "" && statusFilter != "pending" && statusFilter != "reviewed" && statusFilter != "dismissed" {
		return ReportListResponse{}, fmt.Errorf("invalid status filter: must be one of pending, reviewed, dismissed")
	}

	if regionID == nil {
		total, err := s.repo.CountAllReports(ctx, statusFilter)
		if err != nil {
			return ReportListResponse{}, fmt.Errorf("count reports: %w", err)
		}
		rows, err := s.repo.GetAllReports(ctx, statusFilter, limit, offset)
		if err != nil {
			return ReportListResponse{}, fmt.Errorf("get reports: %w", err)
		}
		reports := make([]ReportResponse, 0, len(rows))
		for _, row := range rows {
			reports = append(reports, ReportResponse{
				ID:         pgtypeToUUID(row.ID),
				ReporterID: pgtypeToUUID(row.ReporterID),
				ReportedID: pgtypeToUUID(row.ReportedID),
				MatchID:    pgtypeToUUID(row.MatchID),
				Reason:     row.Reason,
				Status:     row.Status,
				CreatedAt:  row.CreatedAt.Time,
			})
		}
		return ReportListResponse{Reports: reports, Total: total}, nil
	}

	moderatorRegionID := *regionID

	total, err := s.repo.CountReportsByRegion(ctx, moderatorRegionID, statusFilter)
	if err != nil {
		return ReportListResponse{}, fmt.Errorf("count reports: %w", err)
	}

	rows, err := s.repo.GetReportsByRegion(ctx, moderatorRegionID, statusFilter, limit, offset)
	if err != nil {
		return ReportListResponse{}, fmt.Errorf("get reports: %w", err)
	}

	reports := make([]ReportResponse, 0, len(rows))
	for _, row := range rows {
		reports = append(reports, ReportResponse{
			ID:         pgtypeToUUID(row.ID),
			ReporterID: pgtypeToUUID(row.ReporterID),
			ReportedID: pgtypeToUUID(row.ReportedID),
			MatchID:    pgtypeToUUID(row.MatchID),
			Reason:     row.Reason,
			Status:     row.Status,
			CreatedAt:  row.CreatedAt.Time,
		})
	}

	return ReportListResponse{
		Reports: reports,
		Total:   total,
	}, nil
}
