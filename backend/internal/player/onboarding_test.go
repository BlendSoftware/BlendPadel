package player

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCalculateInitialELO(t *testing.T) {
	tests := []struct {
		name     string
		req      OnboardingRequest
		expected int
	}{
		{
			name: "principiante total: nunca juega, sin torneos, paleta iniciacion, principiante",
			// Base=1000, freq=-100, tournaments=-50, paddle=-100, self=-100 → 650 → clamped 800
			req: OnboardingRequest{
				Frequency:      FrequencyNunca,
				Tournaments:    TournamentsNunca,
				PaddleType:     PaddleIniciacion,
				SelfAssessment: SelfPrincipiante,
			},
			expected: 800,
		},
		{
			name: "competitivo total: 3+/sem, federado, paleta avanzada, competitivo",
			// Base=1000, freq=+100, tournaments=+150, paddle=+100, self=+150 → 1500 → clamped 1400
			req: OnboardingRequest{
				Frequency:      Frequency3MasSem,
				Tournaments:    TournamentsFederado,
				PaddleType:     PaddleAvanzada,
				SelfAssessment: SelfCompetitivo,
			},
			expected: 1400,
		},
		{
			name: "intermedio balanced: 1_2_sem, nunca torneos, intermedia, intermedio",
			// Base=1000, freq=0, tournaments=-50, paddle=0, self=0 → 950
			req: OnboardingRequest{
				Frequency:      Frequency1_2Sem,
				Tournaments:    TournamentsNunca,
				PaddleType:     PaddleIntermedia,
				SelfAssessment: SelfIntermedio,
			},
			expected: 950,
		},
		{
			name: "inconsistencia: competitivo + rara vez → ELO conservador (delta capped a +50)",
			// Without cap: freq=-100, tournaments=+150, paddle=+100, self=+150 → delta=+300 → 1300
			// With cap (selfIsAdvanced && freqIsLow): delta=+50 → 1050
			req: OnboardingRequest{
				Frequency:      FrequencyRaraVez,
				Tournaments:    TournamentsFederado,
				PaddleType:     PaddleAvanzada,
				SelfAssessment: SelfCompetitivo,
			},
			expected: 1050,
		},
		{
			name: "inconsistencia: avanzado + 1_2_sem también activa el cap",
			// Without cap: freq=0, tournaments=+50, paddle=+100, self=+100 → delta=+250 → 1250
			// With cap (avanzado && 1_2_sem is low): delta=+50 → 1050
			req: OnboardingRequest{
				Frequency:      Frequency1_2Sem,
				Tournaments:    TournamentsAmateur,
				PaddleType:     PaddleAvanzada,
				SelfAssessment: SelfAvanzado,
			},
			expected: 1050,
		},
		{
			name: "clamp superior: resultado > 1400 → 1400",
			// 3+/sem +100, federado +150, avanzada +100, competitivo +150 → delta=500 → 1500 → 1400
			req: OnboardingRequest{
				Frequency:      Frequency3MasSem,
				Tournaments:    TournamentsFederado,
				PaddleType:     PaddleAvanzada,
				SelfAssessment: SelfCompetitivo,
			},
			expected: 1400,
		},
		{
			name: "clamp inferior: resultado < 800 → 800",
			// nunca=-100, nunca=-50, iniciacion=-100, principiante=-100 → delta=-350 → 650 → 800
			req: OnboardingRequest{
				Frequency:      FrequencyNunca,
				Tournaments:    TournamentsNunca,
				PaddleType:     PaddleIniciacion,
				SelfAssessment: SelfPrincipiante,
			},
			expected: 800,
		},
		{
			name: "jugador activo amateur intermedio: 3+/sem, amateur, intermedia, intermedio",
			// freq=+100, tournaments=+50, paddle=0, self=0 → delta=+150 → 1150
			req: OnboardingRequest{
				Frequency:      Frequency3MasSem,
				Tournaments:    TournamentsAmateur,
				PaddleType:     PaddleIntermedia,
				SelfAssessment: SelfIntermedio,
			},
			expected: 1150,
		},
		{
			name: "jugador rara vez sin torneos paleta intermedia intermedio",
			// freq=-100, tournaments=-50, paddle=0, self=0 → delta=-150 → 850
			req: OnboardingRequest{
				Frequency:      FrequencyRaraVez,
				Tournaments:    TournamentsNunca,
				PaddleType:     PaddleIntermedia,
				SelfAssessment: SelfIntermedio,
			},
			expected: 850,
		},
		{
			name: "frecuencia alta con autoevalucacion avanzada no activa inconsistencia (freq alta)",
			// 3+/sem no es low, so no cap: freq=+100, tournaments=+50, paddle=+100, self=+100 → delta=+350 → 1350
			req: OnboardingRequest{
				Frequency:      Frequency3MasSem,
				Tournaments:    TournamentsAmateur,
				PaddleType:     PaddleAvanzada,
				SelfAssessment: SelfAvanzado,
			},
			expected: 1350,
		},
		{
			// 1_2_sem=0, nunca=-50, avanzada=+100, principiante=-100 → delta=-50 → 950
			name: "jugador 1_2_sem sin torneos paleta avanzada principiante autoevaluacion",
			req: OnboardingRequest{
				Frequency:      Frequency1_2Sem,
				Tournaments:    TournamentsNunca,
				PaddleType:     PaddleAvanzada,
				SelfAssessment: SelfPrincipiante,
			},
			expected: 950,
		},
		{
			name: "inconsistencia con nunca frecuencia: avanzado + nunca activa cap",
			// Without cap: freq=-100, tournaments=+150, paddle=+100, self=+100 → delta=+250 > 50 → cap → 1050
			req: OnboardingRequest{
				Frequency:      FrequencyNunca,
				Tournaments:    TournamentsFederado,
				PaddleType:     PaddleAvanzada,
				SelfAssessment: SelfAvanzado,
			},
			expected: 1050,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CalculateInitialELO(tt.req)
			assert.Equal(t, tt.expected, got)
		})
	}
}
