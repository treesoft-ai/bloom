package handlers

import (
	"net/http"

	"bloom/presets"
	"bloom/util"
)

func ListPresets(w http.ResponseWriter, r *http.Request) {
	type presetResponse struct {
		ID          string `json:"id"`
		Name        string `json:"name"`
		Description string `json:"description"`
	}

	resp := make([]presetResponse, len(presets.List))
	for i, p := range presets.List {
		resp[i] = presetResponse{
			ID:          p.ID,
			Name:        p.Name,
			Description: p.Description,
		}
	}

	util.JSON(w, http.StatusOK, resp)
}
