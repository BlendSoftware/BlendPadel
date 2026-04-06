package trust_test

import (
	"testing"

	"github.com/juani/blendpadel/backend/internal/trust"
)

func TestIsVisibleTo(t *testing.T) {
	tests := []struct {
		name        string
		viewerTrust int
		targetTrust int
		wantVisible bool
	}{
		{"both above threshold", 80, 80, true},
		{"target below threshold, viewer above", 80, 65, false},
		{"both below threshold", 65, 65, true},
		{"viewer below threshold sees everyone", 65, 80, true},
		{"exact threshold both", 70, 70, true},
		{"viewer at threshold, target just below", 70, 69, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := trust.IsVisibleTo(tt.viewerTrust, tt.targetTrust)
			if got != tt.wantVisible {
				t.Errorf("IsVisibleTo(%d, %d) = %v, want %v",
					tt.viewerTrust, tt.targetTrust, got, tt.wantVisible)
			}
		})
	}
}
