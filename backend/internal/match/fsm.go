package match

// validTransitions defines the allowed FSM state transitions for a match.
// Any transition not in this map is invalid.
var validTransitions = map[string]map[string]bool{
	StatusPendingResult: {
		StatusAwaitingConfirmation: true,
	},
	StatusAwaitingConfirmation: {
		StatusSealed:   true,
		StatusDisputed: true,
	},
	StatusDisputed: {
		StatusSealed: true,
	},
}

// ValidTransition returns true if transitioning from the given state to the
// target state is allowed by the match FSM.
func ValidTransition(from, to string) bool {
	if from == "" || to == "" {
		return false
	}
	targets, ok := validTransitions[from]
	if !ok {
		return false
	}
	return targets[to]
}
