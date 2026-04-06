package ranking

import "math"

// CalcExpected returns the expected score (probability of winning) for a player
// given their own ELO and the rival's ELO.
// Formula: E = 1 / (1 + 10^((rivalELO - ownELO) / 400))
func CalcExpected(ownELO, rivalELO int) float64 {
	return 1.0 / (1.0 + math.Pow(10, float64(rivalELO-ownELO)/400.0))
}

// CalcMarginMultiplier returns the margin multiplier M based on the absolute
// difference between games won and games lost.
//
//	|diff| <= 2  → 1.0
//	|diff| 3-4   → 1.2
//	|diff| >= 5  → 1.5
func CalcMarginMultiplier(gamesWon, gamesLost int) float64 {
	diff := gamesWon - gamesLost
	if diff < 0 {
		diff = -diff
	}
	switch {
	case diff <= 2:
		return 1.0
	case diff <= 4:
		return 1.2
	default:
		return 1.5
	}
}

// CalcNewELO computes the new ELO for a player after a match.
//
//	K = 60 if matchCount < 5, else 20
//	R = 1 (win), 0 (loss)
//	E = CalcExpected(currentELO, rivalAvgELO)
//	newELO = currentELO + round(K * (R - E) * marginMult)
func CalcNewELO(currentELO, rivalAvgELO int, won bool, matchCount int, marginMult float64) int {
	k := 20.0
	if matchCount < 5 {
		k = 60.0
	}

	r := 0.0
	if won {
		r = 1.0
	}

	e := CalcExpected(currentELO, rivalAvgELO)
	delta := math.Round(k * (r - e) * marginMult)
	return currentELO + int(delta)
}
