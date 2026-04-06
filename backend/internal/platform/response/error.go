package response

import "net/http"

// ProblemDetail implements RFC 7807
type ProblemDetail struct {
	Type   string `json:"type"`
	Title  string `json:"title"`
	Status int    `json:"status"`
	Detail string `json:"detail,omitempty"`
}

type ValidationProblem struct {
	ProblemDetail
	Errors []FieldError `json:"errors,omitempty"`
}

type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

func Problem(w http.ResponseWriter, status int, title, detail string) {
	JSON(w, status, ProblemDetail{
		Type:   "about:blank",
		Title:  title,
		Status: status,
		Detail: detail,
	})
}

func ValidationError(w http.ResponseWriter, errors []FieldError) {
	JSON(w, http.StatusUnprocessableEntity, ValidationProblem{
		ProblemDetail: ProblemDetail{
			Type:   "about:blank",
			Title:  "Validation Error",
			Status: http.StatusUnprocessableEntity,
			Detail: "One or more fields failed validation",
		},
		Errors: errors,
	})
}
