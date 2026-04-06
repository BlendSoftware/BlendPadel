package config

import (
	"os"
	"strings"
)

type Config struct {
	AppPort      string
	DatabaseURL  string
	LogLevel     string
	CORSOrigins  []string
	UploadDir    string
	JWTSecretKey string
}

func Load() Config {
	return Config{
		AppPort:      getEnv("APP_PORT", "8080"),
		DatabaseURL:  getEnv("DATABASE_URL", "postgresql://blendpadel:password@localhost:5432/blendpadel?sslmode=disable"),
		LogLevel:     getEnv("LOG_LEVEL", "debug"),
		CORSOrigins:  strings.Split(getEnv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173"), ","),
		UploadDir:    getEnv("UPLOAD_DIR", "./uploads"),
		JWTSecretKey: getEnv("JWT_SECRET_KEY", ""),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
