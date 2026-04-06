package ranking_test

import (
	"math"
	"math/rand"
	"testing"

	"github.com/juani/blendpadel/backend/internal/ranking"
)

func TestCalcExpected(t *testing.T) {
	const epsilon = 0.001

	t.Run("equal ELOs returns 0.5", func(t *testing.T) {
		e := ranking.CalcExpected(1200, 1200)
		if math.Abs(e-0.5) > epsilon {
			t.Errorf("expected 0.5, got %.4f", e)
		}
	})

	t.Run("superior player has high expected (1400 vs 1000)", func(t *testing.T) {
		e := ranking.CalcExpected(1400, 1000)
		// E ≈ 1/(1+10^(-400/400)) = 1/(1+10^-1) = 1/1.1 ≈ 0.909
		want := 0.909
		if math.Abs(e-want) > epsilon {
			t.Errorf("expected ~%.3f, got %.4f", want, e)
		}
	})

	t.Run("inferior player has low expected (1000 vs 1400)", func(t *testing.T) {
		e := ranking.CalcExpected(1000, 1400)
		// E ≈ 0.091
		want := 0.091
		if math.Abs(e-want) > epsilon {
			t.Errorf("expected ~%.3f, got %.4f", want, e)
		}
	})

	t.Run("E_A + E_B = 1.0 for 10 random pairs", func(t *testing.T) {
		rng := rand.New(rand.NewSource(42))
		for i := 0; i < 10; i++ {
			eloA := 800 + rng.Intn(1600)
			eloB := 800 + rng.Intn(1600)
			ea := ranking.CalcExpected(eloA, eloB)
			eb := ranking.CalcExpected(eloB, eloA)
			sum := ea + eb
			if math.Abs(sum-1.0) > epsilon {
				t.Errorf("pair (%d,%d): E_A(%.4f)+E_B(%.4f)=%.4f, want 1.0", eloA, eloB, ea, eb, sum)
			}
		}
	})

	t.Run("extreme dominance (2000 vs 800) E close to 1.0", func(t *testing.T) {
		e := ranking.CalcExpected(2000, 800)
		if e < 0.99 {
			t.Errorf("expected E > 0.99, got %.4f", e)
		}
	})

	t.Run("same high ELO (2000 vs 2000) returns 0.5", func(t *testing.T) {
		e := ranking.CalcExpected(2000, 2000)
		if math.Abs(e-0.5) > epsilon {
			t.Errorf("expected 0.5, got %.4f", e)
		}
	})
}

func TestCalcMarginMultiplier(t *testing.T) {
	tests := []struct {
		name     string
		won      int
		lost     int
		expected float64
	}{
		{"6-4, 6-4 (diff 4) -> 1.2", 12, 8, 1.2},
		{"6-0, 6-0 (diff 12) -> 1.5", 12, 0, 1.5},
		{"7-6, 6-7, 7-6 (diff 1) -> 1.0", 20, 19, 1.0},
		{"6-4, 7-5 (diff 4) -> 1.2", 13, 9, 1.2},
		{"6-1, 6-0 (diff 11) -> 1.5", 12, 1, 1.5},
		{"7-6, 7-6 (diff 2) -> 1.0", 14, 12, 1.0},
		{"6-3, 6-4 (diff 5) -> 1.5", 12, 7, 1.5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := ranking.CalcMarginMultiplier(tt.won, tt.lost)
			if m != tt.expected {
				t.Errorf("CalcMarginMultiplier(%d, %d) = %.1f, want %.1f", tt.won, tt.lost, m, tt.expected)
			}
		})
	}
}

func TestCalcNewELO(t *testing.T) {
	t.Run("calibration (K=60): 1200 wins vs 1200, M=1.0 -> delta +30", func(t *testing.T) {
		// K=60, R=1, E=0.5, M=1.0 → delta = round(60 * (1-0.5) * 1.0) = 30
		newELO := ranking.CalcNewELO(1200, 1200, true, 4, 1.0)
		if newELO != 1230 {
			t.Errorf("expected 1230, got %d", newELO)
		}
	})

	t.Run("calibration (K=60): 1200 loses vs 1200, M=1.0 -> delta -30", func(t *testing.T) {
		newELO := ranking.CalcNewELO(1200, 1200, false, 4, 1.0)
		if newELO != 1170 {
			t.Errorf("expected 1170, got %d", newELO)
		}
	})

	t.Run("recurrent (K=20): 1200 wins vs 1200, M=1.0 -> delta +10", func(t *testing.T) {
		newELO := ranking.CalcNewELO(1200, 1200, true, 5, 1.0)
		if newELO != 1210 {
			t.Errorf("expected 1210, got %d", newELO)
		}
	})

	t.Run("upset: 1000 wins vs 1400, K=20, M=1.0 -> delta ~+18", func(t *testing.T) {
		// E = 1/(1+10^((1400-1000)/400)) = 1/(1+10^1) = 1/11 ≈ 0.0909
		// delta = round(20 * (1-0.0909) * 1.0) = round(20*0.9091) = round(18.18) = 18
		newELO := ranking.CalcNewELO(1000, 1400, true, 5, 1.0)
		if newELO != 1018 {
			t.Errorf("expected 1018, got %d", newELO)
		}
	})

	t.Run("favored: 1400 wins vs 1000, K=20, M=1.0 -> delta ~+2", func(t *testing.T) {
		// E = 1/(1+10^(-400/400)) = 1/(1+0.1) = 10/11 ≈ 0.9091
		// delta = round(20 * (1-0.9091) * 1.0) = round(20*0.0909) = round(1.818) = 2
		newELO := ranking.CalcNewELO(1400, 1000, true, 5, 1.0)
		if newELO != 1402 {
			t.Errorf("expected 1402, got %d", newELO)
		}
	})

	t.Run("with margin: 1200 wins vs 1200, M=1.5 -> delta > M=1.0 case", func(t *testing.T) {
		// K=20, R=1, E=0.5, M=1.5 → delta = round(20 * 0.5 * 1.5) = 15
		newELO15 := ranking.CalcNewELO(1200, 1200, true, 5, 1.5)
		newELO10 := ranking.CalcNewELO(1200, 1200, true, 5, 1.0)
		if newELO15 <= newELO10 {
			t.Errorf("M=1.5 (%d) should be greater than M=1.0 (%d)", newELO15, newELO10)
		}
		if newELO15 != 1215 {
			t.Errorf("expected 1215, got %d", newELO15)
		}
	})

	t.Run("K-factor boundary: matchCount=4 -> K=60", func(t *testing.T) {
		newELO := ranking.CalcNewELO(1200, 1200, true, 4, 1.0)
		// K=60, delta=30
		if newELO != 1230 {
			t.Errorf("expected 1230 (K=60), got %d", newELO)
		}
	})

	t.Run("K-factor boundary: matchCount=5 -> K=20", func(t *testing.T) {
		newELO := ranking.CalcNewELO(1200, 1200, true, 5, 1.0)
		// K=20, delta=10
		if newELO != 1210 {
			t.Errorf("expected 1210 (K=20), got %d", newELO)
		}
	})
}
