package middleware

import (
	"context"
	"net/http"
	"strings"

	"bloom/db"
	"bloom/token"
	"bloom/util"
)

type contextKey string

const UserIDKey contextKey = "userID"

func Auth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var raw string

		// Check Authorization header first
		authHeader := r.Header.Get("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			raw = strings.TrimPrefix(authHeader, "Bearer ")
		}

		// Fall back to cookie
		if raw == "" {
			cookie, err := r.Cookie("bloom_token")
			if err == nil {
				raw = cookie.Value
			}
		}

		if raw == "" {
			util.JSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
			return
		}

		userID, err := token.Verify(raw)
		if err != nil {
			util.JSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid or expired session"})
			return
		}

		ctx := context.WithValue(r.Context(), UserIDKey, userID)
		next(w, r.WithContext(ctx))
	}
}

func Admin(next http.HandlerFunc) http.HandlerFunc {
	return Auth(func(w http.ResponseWriter, r *http.Request) {
		userID := GetUserID(r)
		var isAdmin int
		err := db.DB.QueryRow("SELECT is_admin FROM users WHERE id = ?", userID).Scan(&isAdmin)
		if err != nil || isAdmin != 1 {
			util.JSON(w, http.StatusForbidden, map[string]string{"error": "admin access required"})
			return
		}
		next(w, r)
	})
}

func GetUserID(r *http.Request) string {
	v, _ := r.Context().Value(UserIDKey).(string)
	return v
}
