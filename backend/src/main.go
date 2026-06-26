package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"bloom/config"
	"bloom/db"
	"bloom/handlers"
	"bloom/middleware"
	"bloom/util"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	args := os.Args[1:]

	if len(args) >= 1 && args[0] == "admin" {
		handleAdminCLI(args[1:])
		return
	}

	if len(args) >= 1 && args[0] == "user" {
		handleUserCLI(args[1:])
		return
	}

	config.Load()
	db.Init()

	mux := http.NewServeMux()

	// Auth routes
	mux.HandleFunc("POST /api/auth/register", handlers.Register)
	mux.HandleFunc("POST /api/auth/verify", handlers.Verify)
	mux.HandleFunc("POST /api/auth/login", handlers.Login)
	mux.HandleFunc("POST /api/auth/logout", handlers.Logout)
	mux.HandleFunc("GET /api/auth/me", middleware.Auth(handlers.Me))
	mux.HandleFunc("GET /api/auth/credits", middleware.Auth(handlers.GetCredits))

	// Chat routes
	mux.HandleFunc("GET /api/chats", middleware.Auth(handlers.ListChats))
	mux.HandleFunc("POST /api/chats", middleware.Auth(handlers.CreateChat))
	mux.HandleFunc("GET /api/chats/{id}", middleware.Auth(handlers.GetChat))
	mux.HandleFunc("DELETE /api/chats/{id}", middleware.Auth(handlers.DeleteChat))
	mux.HandleFunc("POST /api/chats/{id}/messages", middleware.Auth(handlers.SendMessage))

	// Presets routes
	mux.HandleFunc("GET /api/presets", handlers.ListPresets)

	// Admin routes
	mux.HandleFunc("GET /api/admin/users", middleware.Admin(handlers.AdminListUsers))
	mux.HandleFunc("GET /api/admin/me", middleware.Admin(handlers.AdminGetUser))
	mux.HandleFunc("POST /api/admin/users/{id}/admin", middleware.Admin(handlers.AdminToggleAdmin))
	mux.HandleFunc("DELETE /api/admin/users/{id}", middleware.Admin(handlers.AdminDeleteUser))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Bloom backend listening on :%s", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}

func handleAdminCLI(args []string) {
	if len(args) == 0 {
		printAdminUsage()
		return
	}

	subcommand := args[0]
	switch subcommand {
	case "add":
		if len(args) < 2 {
			fmt.Println("Usage: bloom admin add {username}")
			fmt.Println("  username is the part before @ in the email (e.g. for user@example.com, use 'user')")
			return
		}
		adminSetByUsername(args[1], true)
	case "remove":
		if len(args) < 2 {
			fmt.Println("Usage: bloom admin remove {username}")
			fmt.Println("  username is the part before @ in the email (e.g. for user@example.com, use 'user')")
			return
		}
		adminSetByUsername(args[1], false)
	case "list":
		adminListUsers()
	default:
		printAdminUsage()
	}
}

func printAdminUsage() {
	fmt.Println("Bloom Admin CLI")
	fmt.Println()
	fmt.Println("Usage:")
	fmt.Println("  bloom admin add {username}      Grant admin privileges to a user")
	fmt.Println("  bloom admin remove {username}   Revoke admin privileges from a user")
	fmt.Println("  bloom admin list                List all users and their admin status")
	fmt.Println()
	fmt.Println("  username is the part before @ in the email address.")
	fmt.Println("  Example: for user@example.com, use 'user'")
}

func adminSetByUsername(username string, grant bool) {
	config.Load()
	db.Init()

	// Search by email prefix (username) or full email
	var userID, email string
	var isAdmin int
	err := db.DB.QueryRow(
		"SELECT id, email, is_admin FROM users WHERE email LIKE ? OR email = ?",
		username+"@%", username,
	).Scan(&userID, &email, &isAdmin)
	if err != nil {
		fmt.Printf("User '%s' not found.\n", username)
		os.Exit(1)
	}

	if grant && isAdmin == 1 {
		fmt.Printf("User '%s' (%s) is already an admin.\n", username, email)
		return
	}
	if !grant && isAdmin == 0 {
		fmt.Printf("User '%s' (%s) is not an admin.\n", username, email)
		return
	}

	val := 0
	if grant {
		val = 1
	}
	_, err = db.DB.Exec("UPDATE users SET is_admin = ? WHERE id = ?", val, userID)
	if err != nil {
		fmt.Printf("Failed to update admin status: %v\n", err)
		os.Exit(1)
	}

	action := "granted"
	if !grant {
		action = "revoked"
	}
	fmt.Printf("Admin privileges %s for '%s' (%s).\n", action, username, email)
}

func adminListUsers() {
	config.Load()
	db.Init()

	rows, err := db.DB.Query("SELECT email, is_admin, created_at FROM users ORDER BY created_at DESC")
	if err != nil {
		fmt.Printf("Failed to query users: %v\n", err)
		os.Exit(1)
	}
	defer rows.Close()

	fmt.Println("Users:")
	fmt.Println(strings.Repeat("-", 60))

	count := 0
	for rows.Next() {
		var email, createdAt string
		var isAdmin int
		if err := rows.Scan(&email, &isAdmin, &createdAt); err != nil {
			continue
		}
		status := "  "
		if isAdmin == 1 {
			status = "* "
		}
		fmt.Printf("  %s%s  (since %s)\n", status, email, createdAt[:10])
		count++
	}

	if count == 0 {
		fmt.Println("  No users found.")
	} else {
		fmt.Println(strings.Repeat("-", 60))
		fmt.Printf("  %d user(s) total. * = admin\n", count)
	}
}

func handleUserCLI(args []string) {
	if len(args) == 0 {
		printUserUsage()
		return
	}

	subcommand := args[0]
	switch subcommand {
	case "create":
		if len(args) < 3 {
			fmt.Println("Usage: bloom user create {email} {password}")
			return
		}
		userCreate(args[1], args[2])
	case "remove":
		if len(args) < 2 {
			fmt.Println("Usage: bloom user remove {email}")
			return
		}
		userRemove(args[1])
	case "list":
		userList()
	default:
		printUserUsage()
	}
}

func printUserUsage() {
	fmt.Println("Bloom User CLI")
	fmt.Println()
	fmt.Println("Usage:")
	fmt.Println("  bloom user create {email} {password}   Create a new user account")
	fmt.Println("  bloom user remove {email}              Delete a user by email")
	fmt.Println("  bloom user list                        List all users")
}

func userCreate(email, password string) {
	config.Load()
	db.Init()

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		fmt.Printf("Failed to hash password: %v\n", err)
		os.Exit(1)
	}

	id := util.NewID()
	_, err = db.DB.Exec(
		"INSERT INTO users (id, email, password, verified, created_at, is_admin) VALUES (?, ?, ?, 1, datetime('now'), 0)",
		id, email, string(hash),
	)
	if err != nil {
		fmt.Printf("Failed to create user: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("User created: %s\n", email)
}

func userRemove(email string) {
	config.Load()
	db.Init()

	result, err := db.DB.Exec("DELETE FROM users WHERE email = ?", email)
	if err != nil {
		fmt.Printf("Failed to delete user: %v\n", err)
		os.Exit(1)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		fmt.Printf("User '%s' not found.\n", email)
		os.Exit(1)
	}

	fmt.Printf("User '%s' deleted.\n", email)
}

func userList() {
	config.Load()
	db.Init()

	rows, err := db.DB.Query("SELECT email, is_admin, created_at FROM users ORDER BY created_at DESC")
	if err != nil {
		fmt.Printf("Failed to query users: %v\n", err)
		os.Exit(1)
	}
	defer rows.Close()

	fmt.Println("Users:")
	fmt.Println(strings.Repeat("-", 60))

	count := 0
	for rows.Next() {
		var email, createdAt string
		var isAdmin int
		if err := rows.Scan(&email, &isAdmin, &createdAt); err != nil {
			continue
		}
		status := "  "
		if isAdmin == 1 {
			status = "* "
		}
		fmt.Printf("  %s%s  (since %s)\n", status, email, createdAt[:10])
		count++
	}

	if count == 0 {
		fmt.Println("  No users found.")
	} else {
		fmt.Println(strings.Repeat("-", 60))
		fmt.Printf("  %d user(s) total. * = admin\n", count)
	}
}
