package trust

// IsVisibleTo returns true if a target player with targetTrust is visible to
// a viewer with viewerTrust.
//
// Visibility rule: a player with Trust < ThresholdVisible is hidden from
// players with Trust >= ThresholdVisible. The filter is bidirectional from
// the high-trust viewer's perspective — they don't see low-trust players.
// Low-trust viewers can see everyone.
func IsVisibleTo(viewerTrust, targetTrust int) bool {
	// If viewer is above threshold and target is below, not visible.
	if viewerTrust >= ThresholdVisible && targetTrust < ThresholdVisible {
		return false
	}
	return true
}

// clamp restricts a value to [min, max].
func clamp(v, min, max int) int {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}
