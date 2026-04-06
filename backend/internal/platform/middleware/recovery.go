package middleware

import (
	"net/http"
	"runtime/debug"

	"github.com/rs/zerolog/log"

	"github.com/juani/blendpadel/backend/internal/platform/response"
)

func Recovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				log.Error().
					Interface("panic", err).
					Str("stack", string(debug.Stack())).
					Msg("panic recovered")

				response.Problem(w, http.StatusInternalServerError, "Internal Server Error", "An unexpected error occurred")
			}
		}()

		next.ServeHTTP(w, r)
	})
}
