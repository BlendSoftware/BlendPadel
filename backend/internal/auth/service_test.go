package auth

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestValidatePassword(t *testing.T) {
	cases := []struct {
		name     string
		password string
		wantErr  bool
	}{
		{"too short", "Short1", true},
		{"no uppercase", "alllowercase1", true},
		{"no digit", "NoDigitHere!", true},
		{"empty", "", true},
		{"exactly 8 valid", "Valid1Pa", false},
		{"long valid", "AnotherGood2Password", false},
		{"digits and upper only", "12345678A", false},
		{"boundary 7 chars", "Short1A", true},
		{"boundary 8 chars no upper", "short123", true},
		{"boundary 8 chars no digit", "ShortABC", true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := validatePassword(tc.password)
			if tc.wantErr {
				assert.ErrorIs(t, err, ErrWeakPassword)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
