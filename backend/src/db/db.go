package db

import (
	"database/sql"
	"log"
	"os"
	"path/filepath"
	"runtime"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

func Init() {
	_, file, _, _ := runtime.Caller(0)
	backendDir := filepath.Dir(filepath.Dir(filepath.Dir(file)))
	dbPath := filepath.Join(backendDir, "database", "bloom.db")
	if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
		log.Fatalf("db: failed to create database directory: %v", err)
	}

	var err error
	DB, err = sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatalf("db: failed to open: %v", err)
	}

	if err = DB.Ping(); err != nil {
		log.Fatalf("db: failed to ping: %v", err)
	}

	// Enable WAL mode for better concurrent reads
	DB.Exec("PRAGMA journal_mode=WAL")
	DB.Exec("PRAGMA foreign_keys=ON")

	migrate()
	log.Printf("Database ready at %s", dbPath)
}

func migrate() {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id          TEXT PRIMARY KEY,
		email       TEXT UNIQUE NOT NULL,
		password    TEXT NOT NULL,
		verified    INTEGER NOT NULL DEFAULT 0,
		created_at  TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS verify_codes (
		id          TEXT PRIMARY KEY,
		user_id     TEXT NOT NULL,
		code        TEXT NOT NULL,
		expires_at  TEXT NOT NULL,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS sessions (
		id          TEXT PRIMARY KEY,
		user_id     TEXT NOT NULL,
		expires_at  TEXT NOT NULL,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS chats (
		id          TEXT PRIMARY KEY,
		user_id     TEXT NOT NULL,
		title       TEXT NOT NULL,
		model       TEXT NOT NULL,
		created_at  TEXT NOT NULL,
		updated_at  TEXT NOT NULL,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS messages (
		id          TEXT PRIMARY KEY,
		chat_id     TEXT NOT NULL,
		role        TEXT NOT NULL,
		content     TEXT NOT NULL,
		attachments TEXT,
		tool_calls  TEXT,
		created_at  TEXT NOT NULL,
		FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
	);
	`
	if _, err := DB.Exec(schema); err != nil {
		log.Fatalf("db: migration failed: %v", err)
	}

	// Add columns if they don't exist for existing db
	_, _ = DB.Exec("ALTER TABLE messages ADD COLUMN attachments TEXT")
	_, _ = DB.Exec("ALTER TABLE messages ADD COLUMN tool_calls TEXT")
	_, _ = DB.Exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0")
	_, _ = DB.Exec("ALTER TABLE users ADD COLUMN credits REAL NOT NULL DEFAULT 200")
	_, _ = DB.Exec("ALTER TABLE users ADD COLUMN last_credit_reset TEXT NOT NULL DEFAULT ''")
}
