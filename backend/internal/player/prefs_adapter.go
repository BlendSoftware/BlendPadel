package player

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"

	"github.com/juani/blendpadel/backend/internal/matchmaking"
	"github.com/juani/blendpadel/backend/internal/radar"
)

// PrefsAdapter implements radar.PlayerPreferencesFetcher using the player repository.
type PrefsAdapter struct {
	repo Repository
}

// NewPrefsAdapter creates a new PrefsAdapter.
func NewPrefsAdapter(repo Repository) *PrefsAdapter {
	return &PrefsAdapter{repo: repo}
}

func (a *PrefsAdapter) GetPreferences(ctx context.Context, userID uuid.UUID) (*radar.PlayerPreferences, error) {
	row, err := a.repo.GetOwnProfile(ctx, userID)
	if err != nil {
		return nil, err
	}

	var prefs Preferences
	if len(row.Preferences) > 0 {
		if err := json.Unmarshal(row.Preferences, &prefs); err != nil {
			return nil, err
		}
	}

	return &radar.PlayerPreferences{
		RadarRadiusKM: prefs.RadarRadiusKM,
		ELOMinDelta:   prefs.ELOMinDelta,
		ELOMaxDelta:   prefs.ELOMaxDelta,
	}, nil
}

func (a *PrefsAdapter) GetPlayerELO(ctx context.Context, userID uuid.UUID) (int32, error) {
	profile, err := a.repo.GetProfile(ctx, userID)
	if err != nil {
		return 0, err
	}
	return int32(profile.ELO), nil
}

func (a *PrefsAdapter) IsOnboardingComplete(ctx context.Context, playerID uuid.UUID) (bool, error) {
	profile, err := a.repo.GetProfile(ctx, playerID)
	if err != nil {
		return false, err
	}
	return profile.OnboardingCompleted, nil
}

func (a *PrefsAdapter) GetPlayerName(ctx context.Context, playerID uuid.UUID) (string, error) {
	profile, err := a.repo.GetProfile(ctx, playerID)
	if err != nil {
		return "", err
	}
	return profile.Name, nil
}

func (a *PrefsAdapter) GetMatchmakingPreferences(ctx context.Context, userID uuid.UUID) (*matchmaking.MatchmakingPreferences, error) {
	row, err := a.repo.GetOwnProfile(ctx, userID)
	if err != nil {
		return nil, err
	}

	var prefs Preferences
	if len(row.Preferences) > 0 {
		if err := json.Unmarshal(row.Preferences, &prefs); err != nil {
			return nil, err
		}
	}

	return &matchmaking.MatchmakingPreferences{
		RadarRadiusKM: prefs.RadarRadiusKM,
	}, nil
}
