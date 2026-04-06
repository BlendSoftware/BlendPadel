package player

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
)

// Questionnaire option constants.
const (
	// Frequency options.
	FrequencyNunca     = "nunca"
	FrequencyRaraVez   = "rara_vez"
	Frequency1_2Sem    = "1_2_sem"
	Frequency3MasSem   = "3_mas_sem"

	// Tournament options.
	TournamentsNunca    = "nunca"
	TournamentsAmateur  = "amateur"
	TournamentsFederado = "federado"

	// Paddle type options.
	PaddleIniciacion = "iniciacion"
	PaddleIntermedia = "intermedia"
	PaddleAvanzada   = "avanzada"

	// Self-assessment options.
	SelfPrincipiante = "principiante"
	SelfIntermedio   = "intermedio"
	SelfAvanzado     = "avanzado"
	SelfCompetitivo  = "competitivo"

	// Calibration matches required before ELO stabilizes.
	CalibrationMatchesTotal = 5
)

// Gender constants.
const (
	GenderMale   = "male"
	GenderFemale = "female"
	GenderOther  = "other"
)

// OnboardingRequest holds the questionnaire answers.
type OnboardingRequest struct {
	Frequency      string `json:"frequency"`
	Tournaments    string `json:"tournaments"`
	PaddleType     string `json:"paddle_type"`
	SelfAssessment string `json:"self_assessment"`
	YearsPlaying   int    `json:"years_playing"`
	Gender         string `json:"gender"`
}

// OnboardingResponseDTO is what the API returns after onboarding.
type OnboardingResponseDTO struct {
	ELO                       int    `json:"elo"`
	OnboardingCompleted       bool   `json:"onboarding_completed"`
	CalibrationMatchesRemaining int  `json:"calibration_matches_remaining"`
}

// UpdateProfileRequest holds fields to update the player profile.
type UpdateProfileRequest struct {
	Name      string   `json:"name,omitempty"`
	LastName  string   `json:"last_name"`
	Latitude  *float64 `json:"latitude,omitempty"`
	Longitude *float64 `json:"longitude,omitempty"`
}

// ProfileResponse holds the public profile of a player.
type ProfileResponse struct {
	ID                          uuid.UUID  `json:"id"`
	Email                       string     `json:"email"`
	Name                        string     `json:"name"`
	LastName                    string     `json:"last_name,omitempty"`
	Role                        string     `json:"role"`
	Status                      string     `json:"status"`
	ELO                         int        `json:"elo"`
	Gender                      string     `json:"gender"`
	AvatarURL                   string     `json:"avatar_url,omitempty"`
	OnboardingCompleted         bool       `json:"onboarding_completed"`
	ValidatedMatchCount         int        `json:"validated_match_count"`
	EloFrozen                   bool       `json:"elo_frozen"`
	TrustScore                  int        `json:"trust_score"`
	CalibrationMatchesRemaining int        `json:"calibration_matches_remaining"`
	CreatedAt                   time.Time  `json:"created_at"`
}

// PlayerProfile is the internal domain model fetched from the DB.
type PlayerProfile struct {
	ID                  uuid.UUID
	Email               string
	Name                string
	LastName            string
	Role                string
	Status              string
	ELO                 int
	Gender              string
	AvatarURL           string
	OnboardingCompleted bool
	ValidatedMatchCount int
	EloFrozen           bool
	TrustScore          int
	Latitude            *float64
	Longitude           *float64
	CreatedAt           time.Time
}

// OnboardingResponseRecord is the internal model for stored onboarding answers.
type OnboardingResponseRecord struct {
	ID            uuid.UUID
	UserID        uuid.UUID
	Responses     json.RawMessage
	CalculatedELO int
	CreatedAt     time.Time
}

// --- EPIC 08: Perfil ---

// Sentinel errors for EPIC 08 features.
var (
	ErrNotParticipant     = errors.New("not a participant of this match")
	ErrMatchNotCompleted  = errors.New("match is not completed")
	ErrAlreadyReported    = errors.New("already reported this match")
	ErrInvalidPreferences = errors.New("invalid preferences values")
	ErrInvalidGender      = errors.New("invalid gender value; allowed: male, female, other")
	ErrGenderRequired     = errors.New("gender is required")
)

// Preferences holds the player's matchmaking preferences stored as JSONB.
type Preferences struct {
	RadarRadiusKM int32 `json:"radar_radius_km"`
	ELOMinDelta   int32 `json:"elo_min_delta"`
	ELOMaxDelta   int32 `json:"elo_max_delta"`
}

// PublicProfileResponse is the view of another player's profile (trust_label only, no score).
type PublicProfileResponse struct {
	ID                  uuid.UUID `json:"id"`
	Name                string    `json:"name"`
	ELO                 int32     `json:"elo"`
	Gender              string    `json:"gender"`
	TrustLabel          string    `json:"trust_label"`
	ValidatedMatchCount int32     `json:"validated_match_count"`
	RegionID            uuid.UUID `json:"region_id"`
}

// OwnProfileResponse is the full profile visible only to the profile owner.
type OwnProfileResponse struct {
	PublicProfileResponse
	TrustScore  int32       `json:"trust_score"`
	Preferences Preferences `json:"preferences"`
	Status      string      `json:"status"`
	Email       string      `json:"email"`
}

// PreferencesRequest is the body for PUT /players/me/preferences.
type PreferencesRequest struct {
	RadarRadiusKM int32 `json:"radar_radius_km"`
	ELOMinDelta   int32 `json:"elo_min_delta"`
	ELOMaxDelta   int32 `json:"elo_max_delta"`
}

// ReportRequest is the body for POST /matches/{id}/report.
type ReportRequest struct {
	ReportedID uuid.UUID `json:"reported_id"`
	Reason     string    `json:"reason"`
}

// ReportResponse is returned after a conduct report is created or listed.
type ReportResponse struct {
	ID         uuid.UUID `json:"id"`
	ReporterID uuid.UUID `json:"reporter_id"`
	ReportedID uuid.UUID `json:"reported_id"`
	MatchID    uuid.UUID `json:"match_id"`
	Reason     string    `json:"reason"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"created_at"`
}

// ReportListResponse is the paginated list of conduct reports for admins.
type ReportListResponse struct {
	Reports []ReportResponse `json:"reports"`
	Total   int64            `json:"total"`
}

// PlayerSearchResult is a lightweight player result for search-by-name.
type PlayerSearchResult struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	ELO       int32     `json:"elo"`
	AvatarURL string    `json:"avatar_url,omitempty"`
	Gender    string    `json:"gender"`
}
