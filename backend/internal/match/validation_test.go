package match_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/juani/blendpadel/backend/internal/match"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateSets(t *testing.T) {
	t.Run("valid 2-set win team A", func(t *testing.T) {
		sets := []match.SetScore{
			{TeamAGames: 6, TeamBGames: 4},
			{TeamAGames: 7, TeamBGames: 5},
		}
		err := match.ValidateSets(sets)
		require.NoError(t, err)
	})

	t.Run("valid 2-set win team B", func(t *testing.T) {
		sets := []match.SetScore{
			{TeamAGames: 4, TeamBGames: 6},
			{TeamAGames: 5, TeamBGames: 7},
		}
		err := match.ValidateSets(sets)
		require.NoError(t, err)
	})

	t.Run("valid 3-set match", func(t *testing.T) {
		sets := []match.SetScore{
			{TeamAGames: 6, TeamBGames: 4},
			{TeamAGames: 4, TeamBGames: 6},
			{TeamAGames: 7, TeamBGames: 5},
		}
		err := match.ValidateSets(sets)
		require.NoError(t, err)
	})

	t.Run("invalid: 1 set only", func(t *testing.T) {
		sets := []match.SetScore{
			{TeamAGames: 6, TeamBGames: 4},
		}
		err := match.ValidateSets(sets)
		assert.Error(t, err)
	})

	t.Run("invalid: 4 sets", func(t *testing.T) {
		sets := []match.SetScore{
			{TeamAGames: 6, TeamBGames: 4},
			{TeamAGames: 6, TeamBGames: 4},
			{TeamAGames: 6, TeamBGames: 4},
			{TeamAGames: 6, TeamBGames: 4},
		}
		err := match.ValidateSets(sets)
		assert.Error(t, err)
	})

	t.Run("invalid: negative games", func(t *testing.T) {
		sets := []match.SetScore{
			{TeamAGames: -1, TeamBGames: 6},
			{TeamAGames: 6, TeamBGames: 4},
		}
		err := match.ValidateSets(sets)
		assert.Error(t, err)
	})

	t.Run("invalid: games > 7", func(t *testing.T) {
		sets := []match.SetScore{
			{TeamAGames: 8, TeamBGames: 6},
			{TeamAGames: 6, TeamBGames: 4},
		}
		err := match.ValidateSets(sets)
		assert.Error(t, err)
	})

	t.Run("invalid: both teams win same number of sets (2-set split not possible, caught in 3-set)", func(t *testing.T) {
		// 3 sets: each team wins 1.5? Not possible with 3 sets. But consider 2 sets where each wins 1 — that would be a draw which is invalid.
		// Simulate: A wins set1, B wins set2, but only 2 sets → no clear winner
		sets := []match.SetScore{
			{TeamAGames: 6, TeamBGames: 4},
			{TeamAGames: 4, TeamBGames: 6},
		}
		err := match.ValidateSets(sets)
		assert.Error(t, err)
	})

	t.Run("invalid: empty sets", func(t *testing.T) {
		err := match.ValidateSets([]match.SetScore{})
		assert.Error(t, err)
	})
}

func TestCalculateResult(t *testing.T) {
	t.Run("6-4, 7-5 → winner A, 13-9, diff 4", func(t *testing.T) {
		sets := []match.SetScore{
			{TeamAGames: 6, TeamBGames: 4},
			{TeamAGames: 7, TeamBGames: 5},
		}
		winner, totalA, totalB, diff := match.CalculateResult(sets)
		assert.Equal(t, "A", winner)
		assert.Equal(t, 13, totalA)
		assert.Equal(t, 9, totalB)
		assert.Equal(t, 4, diff)
	})

	t.Run("6-0, 6-0 → winner A, 12-0, diff 12", func(t *testing.T) {
		sets := []match.SetScore{
			{TeamAGames: 6, TeamBGames: 0},
			{TeamAGames: 6, TeamBGames: 0},
		}
		winner, totalA, totalB, diff := match.CalculateResult(sets)
		assert.Equal(t, "A", winner)
		assert.Equal(t, 12, totalA)
		assert.Equal(t, 0, totalB)
		assert.Equal(t, 12, diff)
	})

	t.Run("4-6, 5-7 → winner B, 9-13, diff 4", func(t *testing.T) {
		sets := []match.SetScore{
			{TeamAGames: 4, TeamBGames: 6},
			{TeamAGames: 5, TeamBGames: 7},
		}
		winner, totalA, totalB, diff := match.CalculateResult(sets)
		assert.Equal(t, "B", winner)
		assert.Equal(t, 9, totalA)
		assert.Equal(t, 13, totalB)
		assert.Equal(t, 4, diff)
	})

	t.Run("6-4, 4-6, 7-5 → winner A (3 sets), diff 4", func(t *testing.T) {
		sets := []match.SetScore{
			{TeamAGames: 6, TeamBGames: 4},
			{TeamAGames: 4, TeamBGames: 6},
			{TeamAGames: 7, TeamBGames: 5},
		}
		winner, totalA, totalB, diff := match.CalculateResult(sets)
		assert.Equal(t, "A", winner)
		assert.Equal(t, 17, totalA)
		assert.Equal(t, 15, totalB)
		assert.Equal(t, 2, diff)
	})
}

func TestValidateMatchType(t *testing.T) {
	assert.NoError(t, match.ValidateMatchType("male"))
	assert.NoError(t, match.ValidateMatchType("female"))
	assert.NoError(t, match.ValidateMatchType("mixed"))
	assert.ErrorIs(t, match.ValidateMatchType("invalid"), match.ErrInvalidMatchType)
	assert.ErrorIs(t, match.ValidateMatchType(""), match.ErrInvalidMatchType)
}

func TestValidateTeamComposition(t *testing.T) {
	male1, male2 := uuid.New(), uuid.New()
	male3, male4 := uuid.New(), uuid.New()
	female1, female2 := uuid.New(), uuid.New()
	female3, female4 := uuid.New(), uuid.New()
	other1 := uuid.New()

	genders := map[uuid.UUID]string{
		male1: "male", male2: "male", male3: "male", male4: "male",
		female1: "female", female2: "female", female3: "female", female4: "female",
		other1: "other",
	}

	t.Run("valid male match", func(t *testing.T) {
		err := match.ValidateTeamComposition(match.MatchTypeMale, []uuid.UUID{male1, male2}, []uuid.UUID{male3, male4}, genders)
		require.NoError(t, err)
	})

	t.Run("valid female match", func(t *testing.T) {
		err := match.ValidateTeamComposition(match.MatchTypeFemale, []uuid.UUID{female1, female2}, []uuid.UUID{female3, female4}, genders)
		require.NoError(t, err)
	})

	t.Run("valid mixed match", func(t *testing.T) {
		err := match.ValidateTeamComposition(match.MatchTypeMixed, []uuid.UUID{male1, female1}, []uuid.UUID{male2, female2}, genders)
		require.NoError(t, err)
	})

	t.Run("valid mixed match with other gender", func(t *testing.T) {
		err := match.ValidateTeamComposition(match.MatchTypeMixed, []uuid.UUID{male1, other1}, []uuid.UUID{male2, female2}, genders)
		require.NoError(t, err)
	})

	t.Run("invalid male match with female player", func(t *testing.T) {
		err := match.ValidateTeamComposition(match.MatchTypeMale, []uuid.UUID{male1, female1}, []uuid.UUID{male3, male4}, genders)
		assert.ErrorIs(t, err, match.ErrInvalidTeamComposition)
		assert.Contains(t, err.Error(), "all players must be male")
	})

	t.Run("invalid male match with other gender", func(t *testing.T) {
		err := match.ValidateTeamComposition(match.MatchTypeMale, []uuid.UUID{male1, other1}, []uuid.UUID{male3, male4}, genders)
		assert.ErrorIs(t, err, match.ErrInvalidTeamComposition)
	})

	t.Run("invalid female match with male player", func(t *testing.T) {
		err := match.ValidateTeamComposition(match.MatchTypeFemale, []uuid.UUID{female1, male1}, []uuid.UUID{female3, female4}, genders)
		assert.ErrorIs(t, err, match.ErrInvalidTeamComposition)
		assert.Contains(t, err.Error(), "all players must be female")
	})

	t.Run("invalid mixed match single gender team", func(t *testing.T) {
		err := match.ValidateTeamComposition(match.MatchTypeMixed, []uuid.UUID{male1, male2}, []uuid.UUID{male3, female1}, genders)
		assert.ErrorIs(t, err, match.ErrInvalidTeamComposition)
		assert.Contains(t, err.Error(), "mixed matches require at least one player of each gender per team")
	})

	t.Run("invalid mixed match all female team", func(t *testing.T) {
		err := match.ValidateTeamComposition(match.MatchTypeMixed, []uuid.UUID{female1, female2}, []uuid.UUID{male1, female3}, genders)
		assert.ErrorIs(t, err, match.ErrInvalidTeamComposition)
	})
}

func TestIsLateCancellation(t *testing.T) {
	t.Run("2 hours before match is late", func(t *testing.T) {
		scheduledAt := time.Now().Add(2 * time.Hour)
		assert.True(t, match.IsLateCancellation(scheduledAt))
	})

	t.Run("30 minutes before match is late", func(t *testing.T) {
		scheduledAt := time.Now().Add(30 * time.Minute)
		assert.True(t, match.IsLateCancellation(scheduledAt))
	})

	t.Run("match already passed is late", func(t *testing.T) {
		scheduledAt := time.Now().Add(-1 * time.Hour)
		assert.True(t, match.IsLateCancellation(scheduledAt))
	})

	t.Run("exactly 3 hours before is NOT late", func(t *testing.T) {
		scheduledAt := time.Now().Add(3*time.Hour + 1*time.Minute)
		assert.False(t, match.IsLateCancellation(scheduledAt))
	})

	t.Run("5 hours before match is NOT late", func(t *testing.T) {
		scheduledAt := time.Now().Add(5 * time.Hour)
		assert.False(t, match.IsLateCancellation(scheduledAt))
	})

	t.Run("24 hours before match is NOT late", func(t *testing.T) {
		scheduledAt := time.Now().Add(24 * time.Hour)
		assert.False(t, match.IsLateCancellation(scheduledAt))
	})
}
