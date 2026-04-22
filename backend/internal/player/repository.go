package player

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"

	"github.com/juani/blendpadel/backend/internal/db"
)

// Sentinel errors for the player domain.
var (
	ErrNotFound              = errors.New("player not found")
	ErrOnboardingAlreadyDone = errors.New("onboarding already completed")
	ErrInvalidCoordinates    = errors.New("coordinates out of Mendoza bounds")
	ErrInvalidMIME           = errors.New("unsupported file type; allowed: image/jpeg, image/png, image/webp")
	ErrFileTooLarge          = errors.New("file exceeds maximum allowed size of 5MB")
)

// Repository defines the data-access contract for the player domain.
type Repository interface {
	// GetProfile returns the full player profile for the given user ID.
	GetProfile(ctx context.Context, userID uuid.UUID) (*PlayerProfile, error)

	// UpdateProfile sets last_name and location (lat/lng) for the user.
	UpdateProfile(ctx context.Context, userID uuid.UUID, lastName string, lat, lng float64) error

	// UpdateProfileNameOnly sets name and last_name without touching coordinates.
	UpdateProfileNameOnly(ctx context.Context, userID uuid.UUID, name, lastName string) error

	// UpdateAvatar updates the avatar_url field for the user.
	UpdateAvatar(ctx context.Context, userID uuid.UUID, avatarURL string) error

	// CompleteOnboarding marks onboarding as complete and stores the calculated ELO and gender.
	CompleteOnboarding(ctx context.Context, userID uuid.UUID, elo int, gender string) error

	// SaveOnboardingResponses persists the raw questionnaire answers.
	SaveOnboardingResponses(ctx context.Context, userID uuid.UUID, responses json.RawMessage, calculatedELO int) error

	// GetOnboardingResponses retrieves stored onboarding answers for the user.
	GetOnboardingResponses(ctx context.Context, userID uuid.UUID) (*OnboardingResponseRecord, error)

	// --- EPIC 08: Perfil ---

	// GetPublicProfile fetches the minimal profile fields for a public view.
	GetPublicProfile(ctx context.Context, playerID uuid.UUID) (*db.GetPublicProfileRow, error)

	// GetOwnProfile fetches the full profile including preferences for the owner.
	GetOwnProfile(ctx context.Context, playerID uuid.UUID) (*db.GetOwnProfileRow, error)

	// UpdatePreferences overwrites the player's preferences JSONB column.
	UpdatePreferences(ctx context.Context, playerID uuid.UUID, prefs Preferences) error

	// CreateReport inserts a new conduct report.
	CreateReport(ctx context.Context, arg db.CreateReportParams) (db.ConductReport, error)

	// GetReportsByRegion returns paginated reports for matches in the given region.
	// Pass an empty string for statusFilter to return all statuses.
	GetReportsByRegion(ctx context.Context, regionID uuid.UUID, statusFilter string, limit, offset int32) ([]db.ConductReport, error)

	// IsMatchParticipant returns true if the player was in the given match.
	IsMatchParticipant(ctx context.Context, matchID, playerID uuid.UUID) (bool, error)

	// IsMatchCompleted returns true if the match status is 'completed'.
	IsMatchCompleted(ctx context.Context, matchID uuid.UUID) (bool, error)

	// CountReportsByRegion returns the total count for pagination.
	// Pass an empty string for statusFilter to count all statuses.
	CountReportsByRegion(ctx context.Context, regionID uuid.UUID, statusFilter string) (int64, error)

	// SearchByName returns players matching the given name query (case-insensitive, partial match).
	SearchByName(ctx context.Context, query string, limit int32) ([]PlayerSearchResult, error)
}
