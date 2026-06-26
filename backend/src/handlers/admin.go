package handlers

import (
	"net/http"

	"bloom/db"
	"bloom/middleware"
	"bloom/util"
)

type adminUserInfo struct {
	ID      string `json:"id"`
	Email   string `json:"email"`
	Admin   bool   `json:"admin"`
	Created string `json:"created_at"`
}

type toggleAdminRequest struct {
	Admin bool `json:"admin"`
}

func AdminListUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := db.DB.Query("SELECT id, email, is_admin, created_at FROM users ORDER BY created_at DESC")
	if err != nil {
		util.JSON(w, http.StatusInternalServerError, map[string]string{"error": "could not query users"})
		return
	}
	defer rows.Close()

	users := []adminUserInfo{}
	for rows.Next() {
		var u adminUserInfo
		var adminInt int
		if err := rows.Scan(&u.ID, &u.Email, &adminInt, &u.Created); err != nil {
			continue
		}
		u.Admin = adminInt == 1
		users = append(users, u)
	}

	util.JSON(w, http.StatusOK, users)
}

func AdminToggleAdmin(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("id")
	if userID == "" {
		util.JSON(w, http.StatusBadRequest, map[string]string{"error": "user id required"})
		return
	}

	var req toggleAdminRequest
	if err := util.Decode(r, &req); err != nil {
		util.JSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	// Prevent removing own admin status
	callerID := middleware.GetUserID(r)
	if callerID == userID && !req.Admin {
		util.JSON(w, http.StatusBadRequest, map[string]string{"error": "cannot remove your own admin status"})
		return
	}

	var exists int
	err := db.DB.QueryRow("SELECT 1 FROM users WHERE id = ?", userID).Scan(&exists)
	if err != nil {
		util.JSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
		return
	}

	adminVal := 0
	if req.Admin {
		adminVal = 1
	}
	_, err = db.DB.Exec("UPDATE users SET is_admin = ? WHERE id = ?", adminVal, userID)
	if err != nil {
		util.JSON(w, http.StatusInternalServerError, map[string]string{"error": "could not update admin status"})
		return
	}

	util.JSON(w, http.StatusOK, map[string]any{
		"user_id": userID,
		"admin":   req.Admin,
	})
}

func AdminDeleteUser(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("id")
	if userID == "" {
		util.JSON(w, http.StatusBadRequest, map[string]string{"error": "user id required"})
		return
	}

	// Prevent deleting own account
	callerID := middleware.GetUserID(r)
	if callerID == userID {
		util.JSON(w, http.StatusBadRequest, map[string]string{"error": "cannot delete your own account"})
		return
	}

	result, err := db.DB.Exec("DELETE FROM users WHERE id = ?", userID)
	if err != nil {
		util.JSON(w, http.StatusInternalServerError, map[string]string{"error": "could not delete user"})
		return
	}
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		util.JSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
		return
	}

	util.JSON(w, http.StatusOK, map[string]string{"message": "user deleted"})
}

func AdminGetUser(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var u adminUserInfo
	var adminInt int
	err := db.DB.QueryRow("SELECT id, email, is_admin, created_at FROM users WHERE id = ?", userID).Scan(&u.ID, &u.Email, &adminInt, &u.Created)
	if err != nil {
		util.JSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
		return
	}
	u.Admin = adminInt == 1
	util.JSON(w, http.StatusOK, u)
}
