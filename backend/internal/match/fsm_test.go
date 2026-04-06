package match_test

import (
	"testing"

	"github.com/juani/blendpadel/backend/internal/match"
	"github.com/stretchr/testify/assert"
)

func TestValidTransition(t *testing.T) {
	tests := []struct {
		name  string
		from  string
		to    string
		valid bool
	}{
		// Valid transitions.
		{"pending_result → awaiting_confirmation", match.StatusPendingResult, match.StatusAwaitingConfirmation, true},
		{"awaiting_confirmation → sealed", match.StatusAwaitingConfirmation, match.StatusSealed, true},
		{"awaiting_confirmation → disputed", match.StatusAwaitingConfirmation, match.StatusDisputed, true},
		{"disputed → sealed", match.StatusDisputed, match.StatusSealed, true},

		// Invalid transitions.
		{"pending_result → sealed", match.StatusPendingResult, match.StatusSealed, false},
		{"pending_result → disputed", match.StatusPendingResult, match.StatusDisputed, false},
		{"sealed → anything", match.StatusSealed, match.StatusPendingResult, false},
		{"sealed → disputed", match.StatusSealed, match.StatusDisputed, false},
		{"disputed → pending_result", match.StatusDisputed, match.StatusPendingResult, false},
		{"disputed → awaiting_confirmation", match.StatusDisputed, match.StatusAwaitingConfirmation, false},
		{"awaiting_confirmation → pending_result", match.StatusAwaitingConfirmation, match.StatusPendingResult, false},
		{"empty → anything", "", match.StatusSealed, false},
		{"anything → empty", match.StatusPendingResult, "", false},
		{"same state pending_result", match.StatusPendingResult, match.StatusPendingResult, false},
		{"same state sealed", match.StatusSealed, match.StatusSealed, false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := match.ValidTransition(tc.from, tc.to)
			assert.Equal(t, tc.valid, got, "ValidTransition(%q, %q)", tc.from, tc.to)
		})
	}
}
