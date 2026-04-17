package player

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
)

const (
	// maxAvatarSize is 5 MB.
	maxAvatarSize = 5 * 1024 * 1024

	// Mendoza bounding box.
	mendozaLatMin = -35.5
	mendozaLatMax = -32.0
	mendozaLngMin = -70.5
	mendozaLngMax = -67.5
)

// allowedMIMETypes for avatar uploads.
var allowedMIMETypes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
}

// mimeToExt maps MIME type to file extension.
var mimeToExt = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

// Service holds the business logic for the player domain.
type Service struct {
	repo      Repository
	uploadDir string
}

// NewService creates a new player Service.
func NewService(repo Repository, uploadDir string) *Service {
	return &Service{repo: repo, uploadDir: uploadDir}
}

// ValidateGender checks if the given gender value is valid.
func ValidateGender(gender string) error {
	switch gender {
	case GenderMale, GenderFemale, GenderOther:
		return nil
	case "":
		return ErrGenderRequired
	default:
		return ErrInvalidGender
	}
}

// CompleteOnboarding validates, calculates ELO, and stores the onboarding data.
func (s *Service) CompleteOnboarding(ctx context.Context, userID uuid.UUID, req OnboardingRequest) (*OnboardingResponseDTO, error) {
	// Validate gender.
	if err := ValidateGender(req.Gender); err != nil {
		return nil, err
	}

	// Check if onboarding is already completed.
	profile, err := s.repo.GetProfile(ctx, userID)
	if err != nil {
		return nil, err
	}
	if profile.OnboardingCompleted {
		return nil, ErrOnboardingAlreadyDone
	}

	calculatedELO := CalculateInitialELO(req)

	// Persist the raw questionnaire answers.
	rawResponses, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal onboarding request: %w", err)
	}
	if err := s.repo.SaveOnboardingResponses(ctx, userID, rawResponses, calculatedELO); err != nil {
		return nil, fmt.Errorf("save onboarding responses: %w", err)
	}

	// Mark user as onboarding completed and set ELO + gender.
	if err := s.repo.CompleteOnboarding(ctx, userID, calculatedELO, req.Gender); err != nil {
		return nil, fmt.Errorf("complete onboarding: %w", err)
	}

	remaining := CalibrationMatchesTotal - profile.ValidatedMatchCount
	if remaining < 0 {
		remaining = 0
	}

	return &OnboardingResponseDTO{
		ELO:                         calculatedELO,
		OnboardingCompleted:         true,
		CalibrationMatchesRemaining: remaining,
	}, nil
}

// UpdateProfile validates coordinates (if provided) and updates the player profile.
func (s *Service) UpdateProfile(ctx context.Context, userID uuid.UUID, req UpdateProfileRequest) error {
	var lat, lng float64
	hasCoords := req.Latitude != nil && req.Longitude != nil

	if hasCoords {
		lat = *req.Latitude
		lng = *req.Longitude
		if lat < mendozaLatMin || lat > mendozaLatMax ||
			lng < mendozaLngMin || lng > mendozaLngMax {
			return ErrInvalidCoordinates
		}
	}

	if hasCoords {
		return s.repo.UpdateProfile(ctx, userID, req.LastName, lat, lng)
	}
	// Update only name fields, no coordinates
	return s.repo.UpdateProfileNameOnly(ctx, userID, req.Name, req.LastName)
}

// GetProfile fetches and transforms the player profile.
func (s *Service) GetProfile(ctx context.Context, userID uuid.UUID) (*ProfileResponse, error) {
	profile, err := s.repo.GetProfile(ctx, userID)
	if err != nil {
		return nil, err
	}

	remaining := CalibrationMatchesTotal - profile.ValidatedMatchCount
	if remaining < 0 {
		remaining = 0
	}

	return &ProfileResponse{
		ID:                          profile.ID,
		Email:                       profile.Email,
		Name:                        profile.Name,
		LastName:                    profile.LastName,
		Role:                        profile.Role,
		Status:                      profile.Status,
		ELO:                         profile.ELO,
		Gender:                      profile.Gender,
		AvatarURL:                   profile.AvatarURL,
		OnboardingCompleted:         profile.OnboardingCompleted,
		ValidatedMatchCount:         profile.ValidatedMatchCount,
		EloFrozen:                   profile.EloFrozen,
		TrustScore:                  profile.TrustScore,
		CalibrationMatchesRemaining: remaining,
		CreatedAt:                   profile.CreatedAt,
	}, nil
}

// UploadAvatar validates, saves the avatar file, and updates the DB.
func (s *Service) UploadAvatar(ctx context.Context, userID uuid.UUID, file multipart.File, header *multipart.FileHeader) (string, error) {
	// Validate size.
	if header.Size > maxAvatarSize {
		return "", ErrFileTooLarge
	}

	// Read first 512 bytes for MIME detection.
	buf := make([]byte, 512)
	n, err := file.Read(buf)
	if err != nil && err != io.EOF {
		return "", fmt.Errorf("read file header: %w", err)
	}
	buf = buf[:n]

	detectedMIME := http.DetectContentType(buf)
	// DetectContentType may return e.g. "image/jpeg; charset=utf-8" — strip params.
	mimeType, _, _ := mime.ParseMediaType(detectedMIME)
	if !allowedMIMETypes[mimeType] {
		return "", ErrInvalidMIME
	}

	// Seek back to beginning.
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return "", fmt.Errorf("seek file: %w", err)
	}

	ext := mimeToExt[mimeType]
	filename := fmt.Sprintf("%s_%d%s", userID.String(), time.Now().UnixNano(), ext)
	avatarDir := filepath.Join(s.uploadDir, "avatars")
	destPath := filepath.Join(avatarDir, filename)

	// Ensure directory exists.
	if err := os.MkdirAll(avatarDir, 0755); err != nil {
		return "", fmt.Errorf("create avatars dir: %w", err)
	}

	// Delete previous avatar if one exists.
	profile, err := s.repo.GetProfile(ctx, userID)
	if err == nil && profile.AvatarURL != "" {
		// Extract relative path from URL, e.g. "/uploads/avatars/foo.jpg" → "avatars/foo.jpg"
		rel := strings.TrimPrefix(profile.AvatarURL, "/uploads/")
		oldPath := filepath.Join(s.uploadDir, rel)
		_ = os.Remove(oldPath) // ignore error; file may not exist
	}

	// Write the new file.
	dst, err := os.Create(destPath)
	if err != nil {
		return "", fmt.Errorf("create avatar file: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		return "", fmt.Errorf("write avatar file: %w", err)
	}

	publicURL := "/uploads/avatars/" + filename
	if err := s.repo.UpdateAvatar(ctx, userID, publicURL); err != nil {
		return "", fmt.Errorf("update avatar url: %w", err)
	}

	return publicURL, nil
}

// SearchByName returns players matching the given name query.
func (s *Service) SearchByName(ctx context.Context, query string, excludeIDs []uuid.UUID, matchType string) ([]PlayerSearchResult, error) {
	results, err := s.repo.SearchByName(ctx, query)
	if err != nil {
		return nil, err
	}

	excluded := make([]uuid.UUID, 0, len(excludeIDs))
	excluded = append(excluded, excludeIDs...)

	filtered := make([]PlayerSearchResult, 0, len(results))
	for _, player := range results {
		if slices.Contains(excluded, player.ID) {
			continue
		}

		switch matchType {
		case "male":
			if player.Gender != GenderMale {
				continue
			}
		case "female":
			if player.Gender != GenderFemale {
				continue
			}
		}

		filtered = append(filtered, player)
	}

	return filtered, nil
}
