package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/juani/blendpadel/backend/internal/admin"
	"github.com/juani/blendpadel/backend/internal/feed"
	"github.com/juani/blendpadel/backend/internal/auth"
	"github.com/juani/blendpadel/backend/internal/db"
	"github.com/juani/blendpadel/backend/internal/leaderboard"
	"github.com/juani/blendpadel/backend/internal/match"
	"github.com/juani/blendpadel/backend/internal/matchmaking"
	"github.com/juani/blendpadel/backend/internal/notification"
	"github.com/juani/blendpadel/backend/internal/partnership"
	"github.com/juani/blendpadel/backend/internal/platform/config"
	"github.com/juani/blendpadel/backend/internal/platform/database"
	mw "github.com/juani/blendpadel/backend/internal/platform/middleware"
	"github.com/juani/blendpadel/backend/internal/platform/response"
	"github.com/juani/blendpadel/backend/internal/player"
	"github.com/juani/blendpadel/backend/internal/radar"
	"github.com/juani/blendpadel/backend/internal/ranking"
	"github.com/juani/blendpadel/backend/internal/trust"
	"github.com/juani/blendpadel/backend/internal/venue"
	"github.com/juani/blendpadel/backend/migrations"
)

const version = "0.1.0"

func main() {
	cfg := config.Load()

	lvl, err := zerolog.ParseLevel(cfg.LogLevel)
	if err != nil {
		lvl = zerolog.DebugLevel
	}
	zerolog.SetGlobalLevel(lvl)
	log.Logger = zerolog.New(os.Stdout).With().Timestamp().Logger()

	log.Info().Str("version", version).Msg("BlendPadel API starting")

	// Ensure uploads/avatars directory exists on startup.
	avatarsDir := filepath.Join(cfg.UploadDir, "avatars")
	if err := os.MkdirAll(avatarsDir, 0755); err != nil {
		log.Fatal().Err(err).Str("dir", avatarsDir).Msg("failed to create uploads/avatars directory")
	}

	// Server-lifetime context, cancelled on shutdown signal.
	serverCtx, serverCancel := context.WithCancel(context.Background())
	defer serverCancel()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Warn().Err(err).Msg("database connection failed, starting in degraded mode")
	}
	if pool != nil {
		defer pool.Close()

		if err := database.RunMigrations(cfg.DatabaseURL, migrations.FS()); err != nil {
			log.Fatal().Err(err).Msg("failed to run migrations")
		}
		log.Info().Msg("migrations applied successfully")
	}

	r := chi.NewRouter()
	r.Use(mw.RequestID)
	r.Use(mw.Logger)
	r.Use(mw.Recovery)
	r.Use(mw.CORS(cfg.CORSOrigins))

	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		response.JSON(w, http.StatusOK, map[string]string{
			"service": "blendpadel-api",
			"version": version,
		})
	})

	r.Get("/health", healthHandler(pool))

	// Auth routes — only wired when DB is available.
	if pool != nil {
		jwtSecret := cfg.JWTSecretKey
		if jwtSecret == "" {
			log.Warn().Msg("JWT_SECRET_KEY not set; using insecure default — set it in production")
			jwtSecret = "change-me-in-production-please"
		}

		queries := db.New(pool)
		authRepo := auth.NewPostgresRepo(queries)
		jwtMgr := auth.NewJWTManager(jwtSecret, time.Hour)
		rateLimiter := auth.NewRateLimiter(context.Background(), 50, 15*time.Minute) // TODO: revert to 5 for production
		authSvc := auth.NewService(authRepo, jwtMgr, rateLimiter)
		authHandler := auth.NewHandler(authSvc)

		authMw := auth.AuthMiddleware(jwtMgr)
		rateLimitMw := auth.RateLimitMiddleware(rateLimiter)

		auth.RegisterRoutes(r, authHandler, authMw, rateLimitMw)
		log.Info().Msg("auth routes registered")

		// Player routes.
		playerRepo := player.NewPostgresRepo(queries)
		playerSvc := player.NewService(playerRepo, cfg.UploadDir)
		playerHandler := player.NewHandler(playerSvc)
		requireModerator := auth.RequireRole("moderator", "superadmin")
		requireRegion := auth.RequireRegion()
		player.RegisterRoutes(r, playerHandler, authMw, requireModerator, requireRegion)
		log.Info().Msg("player routes registered")

		// Ranking and trust services.
		rankingRepo := ranking.NewPostgresRepo(queries)
		rankingSvc := ranking.NewService(pool, rankingRepo)
		trustRepo := trust.NewPostgresRepo(queries)
		trustSvc := trust.NewService(trustRepo)

		// Match routes.
		matchRepo := match.NewPostgresRepo(queries, pool)
		matchSvc := match.NewService(matchRepo, rankingSvc, trustSvc)
		matchHandler := match.NewHandler(matchSvc)
		match.RegisterRoutes(r, matchHandler, authMw)
		log.Info().Msg("match routes registered")

		// Auto-sealer goroutine.
		sealer := match.NewAutoSealer(matchSvc, 5*time.Minute)
		go sealer.Start(serverCtx)
		log.Info().Msg("auto-sealer started")

		// Radar routes.
		radarRepo := radar.NewPostgresRadarRepo(queries)
		radarSvc := radar.NewService(radarRepo)
		radarSvc.SetPreferencesFetcher(player.NewPrefsAdapter(playerRepo))
		radarHandler := radar.NewHandler(radarSvc)
		r.Group(func(r chi.Router) {
			r.Use(authMw)
			radar.RegisterRoutes(r, radarHandler)
		})
		log.Info().Msg("radar routes registered")

		// Leaderboard routes (rankings, regions, ELO history, projection).
		leaderboardRepo := leaderboard.NewPostgresRepo(queries)
		leaderboardSvc := leaderboard.NewService(leaderboardRepo, rankingRepo)
		leaderboardHandler := leaderboard.NewHandler(leaderboardSvc)
		leaderboard.RegisterRoutes(r, leaderboardHandler, authMw, auth.RequireRole("superadmin"))
		log.Info().Msg("leaderboard routes registered")

		// Matchmaking routes.
		matchmakingFlareRepo := matchmaking.NewPostgresFlareRepo(pool, queries)
		matchmakingSvc := matchmaking.NewService(matchmakingFlareRepo, matchSvc, pool)
		prefsAdapter := player.NewPrefsAdapter(playerRepo)
		matchmakingSvc.SetPreferencesFetcher(prefsAdapter)
		matchmakingSvc.SetPlayerChecker(prefsAdapter)
		matchmakingHandler := matchmaking.NewHandler(matchmakingSvc)
		r.Group(func(r chi.Router) {
			r.Use(authMw)
			matchmaking.RegisterRoutes(r, matchmakingHandler)
		})
		log.Info().Msg("matchmaking routes registered")

		// Flare expirer goroutine.
		flareExpirer := matchmaking.NewFlareExpirer(matchmakingSvc, 5*time.Minute)
		go flareExpirer.Start(serverCtx)
		log.Info().Msg("flare expirer started")

		// Venue routes.
		venueRepo := venue.NewPostgresRepo(queries)
		venueSvc := venue.NewService(venueRepo)
		venueHandler := venue.NewHandler(venueSvc)
		venue.RegisterRoutes(r, venueHandler, authMw)
		log.Info().Msg("venue routes registered")

		// Wire venue coords fetcher into match service.
		matchSvc.SetVenueCoordsFetcher(venue.NewCoordsAdapter(venueRepo))

		// Partnership routes.
		partnershipRepo := partnership.NewPostgresRepo(queries)
		partnershipSvc := partnership.NewService(partnershipRepo)
		partnershipHandler := partnership.NewHandler(partnershipSvc)
		partnership.RegisterRoutes(r, partnershipHandler, authMw)
		log.Info().Msg("partnership routes registered")

		// Feed routes.
		feedRepo := feed.NewPostgresRepo(queries)
		feedSvc := feed.NewService(feedRepo)
		feedHandler := feed.NewHandler(feedSvc)
		feed.RegisterRoutes(r, feedHandler, authMw)
		log.Info().Msg("feed routes registered")

		// Admin routes.
		adminRepo := admin.NewPostgresRepo(queries)
		adminSvc := admin.NewService(adminRepo, authRepo)
		adminH := admin.NewHandler(adminSvc)
		r.Group(func(r chi.Router) {
			r.Use(authMw)
			r.Use(auth.RequireRole("superadmin"))
			r.Get("/admin/kpis", adminH.GetKPIs)
			r.Get("/admin/audit-log", adminH.GetAuditLog)
			r.Get("/admin/moderators", adminH.ListModerators)
			r.Post("/admin/moderators", adminH.CreateModerator)
			r.Put("/admin/moderators/{id}", adminH.UpdateModerator)
			r.Delete("/admin/moderators/{id}", adminH.DeleteModerator)
			r.Post("/admin/players/{id}/ban", adminH.BanPlayer)
			r.Post("/admin/players/{id}/unban", adminH.UnbanPlayer)
			r.Post("/admin/players/{id}/elo-adjust", adminH.AdjustELO)
		})
		log.Info().Msg("admin routes registered")

		// Notification infrastructure (MockNotifier for MVP).
		notifRepo := notification.NewPostgresRepo(queries)
		mockNotifier := notification.NewMockNotifier()
		notifSvc := notification.NewService(notifRepo, mockNotifier)

		// Wire match service notification hook.
		matchSvc.SetNotificationHook(buildMatchNotifHook(notifSvc, feedSvc))

		// Wire trust service notification hook.
		trustSvc.SetNotificationHook(buildTrustNotifHook(notifSvc))

		// Notification routes.
		notifHandler := notification.NewHandler(notifSvc)
		notification.RegisterRoutes(r, notifHandler, authMw)
		log.Info().Msg("notification routes registered")

		// Reminder job goroutine.
		reminderJob := notification.NewReminderJob(pool, notifSvc, 5*time.Minute)
		go reminderJob.Start(serverCtx)
		log.Info().Msg("reminder job started")
	}

	// Static file server for uploaded avatars.
	r.Handle("/uploads/*", http.StripPrefix("/uploads/", http.FileServer(http.Dir(cfg.UploadDir))))

	srv := &http.Server{
		Addr:         ":" + cfg.AppPort,
		Handler:      r,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Info().Str("port", cfg.AppPort).Msg("server listening")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("server failed")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	// Cancel server context to stop background goroutines (e.g. auto-sealer).
	serverCancel()

	log.Info().Msg("shutting down server")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatal().Err(err).Msg("server forced shutdown")
	}
	log.Info().Msg("server stopped")
}

func healthHandler(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		dbStatus := "disconnected"
		status := http.StatusServiceUnavailable

		if pool != nil {
			ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
			defer cancel()

			if err := pool.Ping(ctx); err == nil {
				dbStatus = "connected"
				status = http.StatusOK
			}
		}

		result := map[string]string{
			"status":  "ok",
			"db":      dbStatus,
			"version": version,
		}

		if status != http.StatusOK {
			result["status"] = "degraded"
		}

		response.JSON(w, status, result)
	}
}

// buildMatchNotifHook returns a NotificationHookFn that dispatches match events to notifications and feed.
func buildMatchNotifHook(svc *notification.Service, feedSvc *feed.Service) match.NotificationHookFn {
	return func(ctx context.Context, event string, data map[string]interface{}) {
		switch event {
		case "result_submitted":
			matchID, ok1 := data["match_id"].(uuid.UUID)
			captainBID, ok2 := data["captain_b_id"].(uuid.UUID)
			if !ok1 || !ok2 {
				log.Warn().Str("event", event).Msg("notification hook: missing uuid data")
				return
			}
			if err := svc.SendResultValidation(ctx, captainBID, matchID); err != nil {
				log.Error().Err(err).Str("event", event).Msg("notification hook: send failed")
			}

		case "match_sealed":
			matchID, ok1 := data["match_id"].(uuid.UUID)
			eloResults, ok2 := data["elo_results"].([]ranking.ELOResult)
			if !ok1 || !ok2 {
				return
			}
			const eloChangeThreshold = 50
			for _, r := range eloResults {
				delta := r.Delta
				if delta < 0 {
					delta = -delta
				}
				if delta >= eloChangeThreshold {
					if err := svc.SendELOChange(ctx, r.PlayerID, r.Delta, matchID); err != nil {
						log.Error().Err(err).Str("player_id", r.PlayerID.String()).Msg("notification hook: ELO change send failed")
					}
				}
				// Generate feed events (win streak, milestones). Fire-and-forget.
				feedSvc.CheckAndGenerateEvents(ctx, r.PlayerID, nil, 0)
			}
		}
	}
}

// buildTrustNotifHook returns a TrustNotificationHookFn that sends trust warning notifications.
func buildTrustNotifHook(svc *notification.Service) trust.TrustNotificationHookFn {
	return func(ctx context.Context, playerID uuid.UUID, newScore int) {
		if err := svc.SendTrustWarning(ctx, playerID, newScore); err != nil {
			log.Error().Err(err).Str("player_id", playerID.String()).Msg("trust notification hook: send failed")
		}
	}
}
