package handlers

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"bloom/db"
	"bloom/email"
	"bloom/middleware"
	"bloom/token"
	"bloom/util"

	"golang.org/x/crypto/bcrypt"
)

const dailyCredits = 200.0

// checkDailyReset resets credits to 200 if the user hasn't been reset today (UTC).
func checkDailyReset(userID string) {
	today := time.Now().UTC().Format("2006-01-02")
	var lastReset string
	err := db.DB.QueryRow("SELECT last_credit_reset FROM users WHERE id = ?", userID).Scan(&lastReset)
	if err != nil {
		return
	}
	if lastReset == today {
		return
	}
	db.DB.Exec("UPDATE users SET credits = ?, last_credit_reset = ? WHERE id = ?", dailyCredits, today, userID)
}

type registerRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := util.Decode(r, &req); err != nil {
		util.JSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if req.Email == "" || !strings.Contains(req.Email, "@") {
		util.JSON(w, http.StatusBadRequest, map[string]string{"error": "invalid email"})
		return
	}
	if len(req.Password) < 8 {
		util.JSON(w, http.StatusBadRequest, map[string]string{"error": "password must be at least 8 characters"})
		return
	}

	// Check if email already exists and is verified
	var existingID string
	var verified int
	err := db.DB.QueryRow("SELECT id, verified FROM users WHERE email = ?", req.Email).Scan(&existingID, &verified)
	if err == nil {
		if verified == 1 {
			util.JSON(w, http.StatusConflict, map[string]string{"error": "an account with this email already exists"})
			return
		}
		// Unverified — re-send code
		sendNewCode(w, existingID, req.Email)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		util.JSON(w, http.StatusInternalServerError, map[string]string{"error": "server error"})
		return
	}

	userID := util.NewID()
	now := time.Now().UTC().Format(time.RFC3339)
	_, err = db.DB.Exec(
		"INSERT INTO users (id, email, password, verified, created_at) VALUES (?, ?, ?, 0, ?)",
		userID, req.Email, string(hash), now,
	)
	if err != nil {
		util.JSON(w, http.StatusInternalServerError, map[string]string{"error": "could not create account"})
		return
	}

	sendNewCode(w, userID, req.Email)
}

func sendNewCode(w http.ResponseWriter, userID, emailAddr string) {
	// Delete any existing codes for this user
	db.DB.Exec("DELETE FROM verify_codes WHERE user_id = ?", userID)

	code := util.SixDigitCode()
	expires := time.Now().UTC().Add(15 * time.Minute).Format(time.RFC3339)
	codeID := util.NewID()

	_, err := db.DB.Exec(
		"INSERT INTO verify_codes (id, user_id, code, expires_at) VALUES (?, ?, ?, ?)",
		codeID, userID, code, expires,
	)
	if err != nil {
		util.JSON(w, http.StatusInternalServerError, map[string]string{"error": "could not generate verification code"})
		return
	}

	if err := email.SendVerificationCode(emailAddr, "", code); err != nil {
		util.JSON(w, http.StatusInternalServerError, map[string]string{"error": "could not send verification email"})
		return
	}

	util.JSON(w, http.StatusOK, map[string]any{
		"message": "verification code sent",
		"email":   emailAddr,
	})
}

type verifyRequest struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

func Verify(w http.ResponseWriter, r *http.Request) {
	var req verifyRequest
	if err := util.Decode(r, &req); err != nil {
		util.JSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Code = strings.TrimSpace(req.Code)

	var userID string
	var verified int
	err := db.DB.QueryRow("SELECT id, verified FROM users WHERE email = ?", req.Email).Scan(&userID, &verified)
	if err == sql.ErrNoRows {
		util.JSON(w, http.StatusNotFound, map[string]string{"error": "account not found"})
		return
	}
	if verified == 1 {
		util.JSON(w, http.StatusBadRequest, map[string]string{"error": "account already verified"})
		return
	}

	var storedCode, expiresAt string
	err = db.DB.QueryRow(
		"SELECT code, expires_at FROM verify_codes WHERE user_id = ? ORDER BY expires_at DESC LIMIT 1",
		userID,
	).Scan(&storedCode, &expiresAt)
	if err == sql.ErrNoRows {
		util.JSON(w, http.StatusBadRequest, map[string]string{"error": "no verification code found — please register again"})
		return
	}

	expiry, _ := time.Parse(time.RFC3339, expiresAt)
	if time.Now().UTC().After(expiry) {
		util.JSON(w, http.StatusBadRequest, map[string]string{"error": "code has expired — please register again to get a new one"})
		return
	}

	if storedCode != req.Code {
		util.JSON(w, http.StatusBadRequest, map[string]string{"error": "incorrect code"})
		return
	}

	db.DB.Exec("UPDATE users SET verified = 1 WHERE id = ?", userID)
	db.DB.Exec("DELETE FROM verify_codes WHERE user_id = ?", userID)

	tok, err := token.Sign(userID)
	if err != nil {
		util.JSON(w, http.StatusInternalServerError, map[string]string{"error": "could not create session"})
		return
	}

	setTokenCookie(w, tok)
	util.JSON(w, http.StatusOK, map[string]any{
		"token":   tok,
		"user_id": userID,
	})
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := util.Decode(r, &req); err != nil {
		util.JSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	var userID, hash string
	var verified int
	err := db.DB.QueryRow(
		"SELECT id, password, verified FROM users WHERE email = ?", req.Email,
	).Scan(&userID, &hash, &verified)
	if err == sql.ErrNoRows {
		util.JSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid email or password"})
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)) != nil {
		util.JSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid email or password"})
		return
	}

	if verified == 0 {
		util.JSON(w, http.StatusForbidden, map[string]any{
			"error":            "email not verified",
			"needs_verificaton": true,
			"email":            req.Email,
		})
		return
	}

	tok, err := token.Sign(userID)
	if err != nil {
		util.JSON(w, http.StatusInternalServerError, map[string]string{"error": "could not create session"})
		return
	}

	setTokenCookie(w, tok)
	util.JSON(w, http.StatusOK, map[string]any{
		"token":   tok,
		"user_id": userID,
	})
}

func Logout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     "bloom_token",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	util.JSON(w, http.StatusOK, map[string]string{"message": "logged out"})
}

func Me(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	checkDailyReset(userID)
	var emailAddr string
	var isAdmin int
	var credits float64
	err := db.DB.QueryRow("SELECT email, is_admin, credits FROM users WHERE id = ?", userID).Scan(&emailAddr, &isAdmin, &credits)
	if err != nil {
		util.JSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
		return
	}
	util.JSON(w, http.StatusOK, map[string]any{
		"id":       userID,
		"email":    emailAddr,
		"is_admin": isAdmin == 1,
		"credits":  credits,
	})
}

func setTokenCookie(w http.ResponseWriter, tok string) {
	http.SetCookie(w, &http.Cookie{
		Name:     "bloom_token",
		Value:    tok,
		Path:     "/",
		MaxAge:   7 * 24 * 60 * 60,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
}

func GetCredits(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	checkDailyReset(userID)
	var credits float64
	err := db.DB.QueryRow("SELECT credits FROM users WHERE id = ?", userID).Scan(&credits)
	if err != nil {
		util.JSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
		return
	}
	util.JSON(w, http.StatusOK, map[string]any{
		"credits": credits,
	})
}
