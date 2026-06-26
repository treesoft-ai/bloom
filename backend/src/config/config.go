package config

import (
	"log"
	"os"
	"path/filepath"
	"runtime"

	"github.com/joho/godotenv"
)

func Load() {
	// Resolve env/.env relative to the repo root (two levels up from src/)
	_, file, _, _ := runtime.Caller(0)
	srcDir := filepath.Dir(filepath.Dir(file))
	envPath := filepath.Join(filepath.Dir(srcDir), "env", ".env")

	if err := godotenv.Load(envPath); err != nil {
		// Try working directory fallback
		if err2 := godotenv.Load(filepath.Join("backend", "env", ".env")); err2 != nil {
			log.Printf("Warning: could not load .env from %s: %v", envPath, err)
		}
	}

	required := []string{"JWT_SECRET", "AGENTROUTER_API_KEY", "AUTOSEND_API_KEY", "AUTOSEND_FROM_EMAIL"}
	for _, key := range required {
		if os.Getenv(key) == "" {
			log.Printf("Warning: environment variable %s is not set", key)
		}
	}
}
