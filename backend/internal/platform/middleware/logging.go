package middleware

import (
	"net/http"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

		next.ServeHTTP(ww, r)

		reqID, _ := r.Context().Value(requestIDKey).(string)

		var event *zerolog.Event
		if ww.statusCode >= 500 {
			event = log.Error()
		} else if ww.statusCode >= 400 {
			event = log.Warn()
		} else {
			event = log.Info()
		}

		event.
			Str("method", r.Method).
			Str("path", r.URL.Path).
			Int("status", ww.statusCode).
			Dur("latency", time.Since(start)).
			Str("request_id", reqID).
			Str("remote_addr", r.RemoteAddr).
			Msg("request")
	})
}

type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}
