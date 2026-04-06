package player

// CalculateInitialELO computes the initial ELO rating for a player based on
// their questionnaire responses. It is a pure, deterministic function.
//
// Scoring table:
//
//	Base = 1000
//	Frequency:       nunca=-100, rara_vez=-100, 1_2_sem=0, 3_mas_sem=+100
//	Tournaments:     nunca=-50, amateur=+50, federado=+150
//	Paddle type:     iniciacion=-100, intermedia=0, avanzada=+100
//	Self-assessment: principiante=-100, intermedio=0, avanzado=+100, competitivo=+150
//
// Inconsistency rule:
//
//	If self_assessment >= avanzado AND frequency <= 1_2_sem → cap total delta to +50
//
// Clamp: max(800, min(result, 1400))
func CalculateInitialELO(req OnboardingRequest) int {
	const base = 1000

	// Frequency delta.
	var freqDelta int
	switch req.Frequency {
	case FrequencyNunca, FrequencyRaraVez:
		freqDelta = -100
	case Frequency1_2Sem:
		freqDelta = 0
	case Frequency3MasSem:
		freqDelta = +100
	}

	// Tournaments delta.
	var tournamentDelta int
	switch req.Tournaments {
	case TournamentsNunca:
		tournamentDelta = -50
	case TournamentsAmateur:
		tournamentDelta = +50
	case TournamentsFederado:
		tournamentDelta = +150
	}

	// Paddle type delta.
	var paddleDelta int
	switch req.PaddleType {
	case PaddleIniciacion:
		paddleDelta = -100
	case PaddleIntermedia:
		paddleDelta = 0
	case PaddleAvanzada:
		paddleDelta = +100
	}

	// Self-assessment delta.
	var selfDelta int
	switch req.SelfAssessment {
	case SelfPrincipiante:
		selfDelta = -100
	case SelfIntermedio:
		selfDelta = 0
	case SelfAvanzado:
		selfDelta = +100
	case SelfCompetitivo:
		selfDelta = +150
	}

	totalDelta := freqDelta + tournamentDelta + paddleDelta + selfDelta

	// Inconsistency check: overconfident player who barely plays.
	selfIsAdvanced := req.SelfAssessment == SelfAvanzado || req.SelfAssessment == SelfCompetitivo
	freqIsLow := req.Frequency == FrequencyNunca || req.Frequency == FrequencyRaraVez || req.Frequency == Frequency1_2Sem
	if selfIsAdvanced && freqIsLow && totalDelta > 50 {
		totalDelta = 50
	}

	result := base + totalDelta

	// Clamp.
	if result < 800 {
		result = 800
	}
	if result > 1400 {
		result = 1400
	}

	return result
}
