package handlers

import (
	"bufio"
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"bloom/db"
	"bloom/middleware"
	"bloom/presets"
	"bloom/util"
)

type createChatRequest struct {
	Title string `json:"title"`
	Model string `json:"model"`
}

type chatResponse struct {
	ID        string `json:"id"`
	UserID    string `json:"user_id"`
	Title     string `json:"title"`
	Model     string `json:"model"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

type attachment struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"`
	Data string `json:"data,omitempty"`
}

type toolCall struct {
	Name   string `json:"name"`
	Arg    string `json:"arg"`
	Status string `json:"status"`
	Title  string `json:"title"`
	Domain string `json:"domain"`
}

type messageResponse struct {
	ID          string       `json:"id"`
	Role        string       `json:"role"`
	Content     string       `json:"content"`
	CreatedAt   string       `json:"created_at"`
	Attachments []attachment `json:"attachments"`
	ToolCalls   []toolCall   `json:"tool_calls"`
}

type getChatResponse struct {
	chatResponse
	Messages []messageResponse `json:"messages"`
}

type chatMsg struct {
	Role    string      `json:"role"`
	Content interface{} `json:"content"`
}

type sendMessageRequest struct {
	Content            string       `json:"content"`
	PresetID           *string      `json:"presetId"`
	CustomInstructions *string      `json:"customInstructions"`
	Temperature        *float64     `json:"temperature"`
	MaxTokens          *int         `json:"maxTokens"`
	Regenerate         *bool        `json:"regenerate"`
	Attachments        []attachment `json:"attachments"`
}

type agentRouterRequest struct {
	Model       string    `json:"model"`
	Messages    []chatMsg `json:"messages"`
	Temperature float64   `json:"temperature"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
	Stream      bool      `json:"stream"`
}

type agentRouterResponse struct {
	Choices []struct {
		Message struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

// ListChats returns all chats for the authenticated user, sorted by updated_at descending.
func ListChats(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	rows, err := db.DB.Query(
		"SELECT id, user_id, title, model, created_at, updated_at FROM chats WHERE user_id = ? ORDER BY updated_at DESC",
		userID,
	)
	if err != nil {
		util.JSON(w, http.StatusInternalServerError, map[string]string{"error": "database error"})
		return
	}
	defer rows.Close()

	chats := []chatResponse{}
	for rows.Next() {
		var c chatResponse
		err := rows.Scan(&c.ID, &c.UserID, &c.Title, &c.Model, &c.CreatedAt, &c.UpdatedAt)
		if err != nil {
			util.JSON(w, http.StatusInternalServerError, map[string]string{"error": "database error"})
			return
		}
		chats = append(chats, c)
	}

	util.JSON(w, http.StatusOK, chats)
}

// CreateChat initializes a new chat session.
func CreateChat(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req createChatRequest
	if err := util.Decode(r, &req); err != nil {
		util.JSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		req.Title = "Untitled Chat"
	}
	req.Model = strings.TrimSpace(req.Model)
	if req.Model == "" {
		req.Model = "claude-opus-4-8"
	}

	chatID := util.NewID()
	now := time.Now().UTC().Format(time.RFC3339)

	_, err := db.DB.Exec(
		"INSERT INTO chats (id, user_id, title, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
		chatID, userID, req.Title, req.Model, now, now,
	)
	if err != nil {
		util.JSON(w, http.StatusInternalServerError, map[string]string{"error": "could not create chat"})
		return
	}

	util.JSON(w, http.StatusCreated, chatResponse{
		ID:        chatID,
		UserID:    userID,
		Title:     req.Title,
		Model:     req.Model,
		CreatedAt: now,
		UpdatedAt: now,
	})
}

// GetChat fetches metadata and all messages of a specific chat.
func GetChat(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	chatID := r.PathValue("id")

	var c chatResponse
	err := db.DB.QueryRow(
		"SELECT id, user_id, title, model, created_at, updated_at FROM chats WHERE id = ? AND user_id = ?",
		chatID, userID,
	).Scan(&c.ID, &c.UserID, &c.Title, &c.Model, &c.CreatedAt, &c.UpdatedAt)
	if err == sql.ErrNoRows {
		util.JSON(w, http.StatusNotFound, map[string]string{"error": "chat not found"})
		return
	} else if err != nil {
		util.JSON(w, http.StatusInternalServerError, map[string]string{"error": "database error"})
		return
	}

	rows, err := db.DB.Query(
		"SELECT id, role, content, created_at, attachments, tool_calls FROM messages WHERE chat_id = ? ORDER BY created_at ASC",
		chatID,
	)
	if err != nil {
		util.JSON(w, http.StatusInternalServerError, map[string]string{"error": "database error"})
		return
	}
	defer rows.Close()

	messages := []messageResponse{}
	for rows.Next() {
		var m messageResponse
		var attachmentsStr sql.NullString
		var toolCallsStr sql.NullString
		err := rows.Scan(&m.ID, &m.Role, &m.Content, &m.CreatedAt, &attachmentsStr, &toolCallsStr)
		if err != nil {
			util.JSON(w, http.StatusInternalServerError, map[string]string{"error": "database error"})
			return
		}

		m.Attachments = []attachment{}
		if attachmentsStr.Valid && attachmentsStr.String != "" {
			var atts []attachment
			if errUnmarshal := json.Unmarshal([]byte(attachmentsStr.String), &atts); errUnmarshal == nil {
				m.Attachments = atts
			}
		}

		m.ToolCalls = []toolCall{}
		if toolCallsStr.Valid && toolCallsStr.String != "" {
			var tcs []toolCall
			if errUnmarshal := json.Unmarshal([]byte(toolCallsStr.String), &tcs); errUnmarshal == nil {
				m.ToolCalls = tcs
			}
		}

		messages = append(messages, m)
	}

	util.JSON(w, http.StatusOK, getChatResponse{
		chatResponse: c,
		Messages:     messages,
	})
}

// DeleteChat removes a chat session and its nested messages.
func DeleteChat(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	chatID := r.PathValue("id")

	var id string
	err := db.DB.QueryRow("SELECT id FROM chats WHERE id = ? AND user_id = ?", chatID, userID).Scan(&id)
	if err == sql.ErrNoRows {
		util.JSON(w, http.StatusNotFound, map[string]string{"error": "chat not found"})
		return
	} else if err != nil {
		util.JSON(w, http.StatusInternalServerError, map[string]string{"error": "database error"})
		return
	}

	_, err = db.DB.Exec("DELETE FROM messages WHERE chat_id = ?", chatID)
	if err != nil {
		util.JSON(w, http.StatusInternalServerError, map[string]string{"error": "could not delete chat messages"})
		return
	}

	_, err = db.DB.Exec("DELETE FROM chats WHERE id = ?", chatID)
	if err != nil {
		util.JSON(w, http.StatusInternalServerError, map[string]string{"error": "could not delete chat"})
		return
	}

	util.JSON(w, http.StatusOK, map[string]string{"message": "chat deleted"})
}

type dbMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

func fetchMentionedChatContext(mentionedChatID, userID string) (string, string, error) {
	var title string
	err := db.DB.QueryRow("SELECT title FROM chats WHERE id = ? AND user_id = ?", mentionedChatID, userID).Scan(&title)
	if err != nil {
		return "", "", err
	}

	rows, err := db.DB.Query(
		"SELECT role, content FROM messages WHERE chat_id = ? ORDER BY created_at DESC LIMIT 8",
		mentionedChatID,
	)
	if err != nil {
		return "", "", err
	}
	defer rows.Close()

	var msgs []dbMessage
	for rows.Next() {
		var role, content string
		if errScan := rows.Scan(&role, &content); errScan == nil {
			msgs = append(msgs, dbMessage{Role: role, Content: content})
		}
	}

	// Reverse to keep chronological order
	for i, j := 0, len(msgs)-1; i < j; i, j = i+1, j-1 {
		msgs[i], msgs[j] = msgs[j], msgs[i]
	}

	var sb strings.Builder
	for _, msg := range msgs {
		roleName := "User"
		if msg.Role == "assistant" {
			roleName = "Bloom (Assistant)"
		} else if msg.Role == "system" {
			roleName = "System"
		}
		sb.WriteString(fmt.Sprintf("[%s]: %s\n", roleName, msg.Content))
	}

	return title, sb.String(), nil
}

// SendMessage accepts a user message, calls AgentRouter for completions, and streams chunks.
func SendMessage(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	chatID := r.PathValue("id")

	var req sendMessageRequest
	if err := util.Decode(r, &req); err != nil {
		util.JSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	req.Content = strings.TrimSpace(req.Content)
	if req.Content == "" && len(req.Attachments) == 0 {
		util.JSON(w, http.StatusBadRequest, map[string]string{"error": "message content cannot be empty"})
		return
	}

	var chatModel string
	err := db.DB.QueryRow("SELECT model FROM chats WHERE id = ? AND user_id = ?", chatID, userID).Scan(&chatModel)
	if err == sql.ErrNoRows {
		util.JSON(w, http.StatusNotFound, map[string]string{"error": "chat not found"})
		return
	} else if err != nil {
		util.JSON(w, http.StatusInternalServerError, map[string]string{"error": "database error"})
		return
	}

	isRegen := req.Regenerate != nil && *req.Regenerate
	now := time.Now().UTC().Format(time.RFC3339)

	var isFirstMessage bool
	if !isRegen {
		var msgCount int
		err = db.DB.QueryRow("SELECT COUNT(*) FROM messages WHERE chat_id = ?", chatID).Scan(&msgCount)
		if err == nil && msgCount == 0 {
			isFirstMessage = true
		}
	}

	if isRegen {
		var lastMsgID, lastMsgRole string
		errLast := db.DB.QueryRow(
			"SELECT id, role FROM messages WHERE chat_id = ? ORDER BY created_at DESC LIMIT 1",
			chatID,
		).Scan(&lastMsgID, &lastMsgRole)
		if errLast == nil && lastMsgRole == "assistant" {
			_, errDel := db.DB.Exec("DELETE FROM messages WHERE id = ?", lastMsgID)
			if errDel != nil {
				util.JSON(w, http.StatusInternalServerError, map[string]string{"error": "could not delete previous reply"})
				return
			}
		}
	} else {
		userMsgID := util.NewID()
		var attsJSON []byte
		if len(req.Attachments) > 0 {
			attsJSON, _ = json.Marshal(req.Attachments)
		}
		_, err = db.DB.Exec(
			"INSERT INTO messages (id, chat_id, role, content, attachments, created_at) VALUES (?, ?, ?, ?, ?, ?)",
			userMsgID, chatID, "user", req.Content, string(attsJSON), now,
		)
		if err != nil {
			util.JSON(w, http.StatusInternalServerError, map[string]string{"error": "could not save message"})
			return
		}
		db.DB.Exec("UPDATE chats SET updated_at = ? WHERE id = ?", now, chatID)
	}

	if isFirstMessage {
		runes := []rune(req.Content)
		tempTitle := string(runes)
		if len(runes) > 10 {
			tempTitle = string(runes[:10])
		}
		_, err = db.DB.Exec("UPDATE chats SET title = ? WHERE id = ?", tempTitle, chatID)
		if err != nil {
			fmt.Printf("db error: failed to update temporary title: %v\n", err)
		}
		go generateAndSaveTitle(chatID, req.Content)
	}

	var messages []chatMsg
	sysPrompt := "You are Bloom, The AI For Everyone. Free. Forever. You are helpful, knowledgeable, and capable. Respond naturally and helpfully."
	if req.PresetID != nil && *req.PresetID != "" {
		if p := presets.GetByID(*req.PresetID); p != nil {
			sysPrompt = p.Prompt
		}
	}
	if req.CustomInstructions != nil && strings.TrimSpace(*req.CustomInstructions) != "" {
		sysPrompt += "\n\nAdditional Custom Instructions:\n" + strings.TrimSpace(*req.CustomInstructions)
	}

	var mentionContexts []string
	for _, att := range req.Attachments {
		if att.Type == "chat-mention" {
			title, contextStr, err := fetchMentionedChatContext(att.ID, userID)
			if err == nil && contextStr != "" {
				mentionContexts = append(mentionContexts, fmt.Sprintf("--- START OF MENTIONED CHAT CONTEXT: \"%s\" ---\n%s--- END OF MENTIONED CHAT CONTEXT: \"%s\" ---", title, contextStr, title))
			}
		}
	}

	if len(mentionContexts) > 0 {
		sysPrompt += "\n\nYou have been provided with context from mentioned chat conversation(s). Below is the history of the mentioned conversation(s):\n\n" + strings.Join(mentionContexts, "\n\n")
	}

	// Document the fetch tool in the system prompt
	toolPrompt := `

You have access to a tool called ` + "`fetch`" + `.
If you need to fetch or read the plain text/HTML content of any URL (such as a website or link provided by the user), you must output exactly:
<fetch url="BARE_DOMAIN"/>
Use only bare domains without any protocol — never include http:// or https://. For example: <fetch url="example.com"/>
You may output multiple fetch tags in a single response if you need to fetch multiple URLs. Do not output anything else in that turn. Once the content is fetched, the system will provide it to you so you can answer the user's prompt.

How the fetch tool works (do not narrate or explain this to the user):
- The system automatically probes both HTTP and HTTPS for each domain you request.
- If both protocols return identical content, you receive one result with a note that HTTP was omitted.
- If they differ, you receive two separate results — one per protocol.
- You do not control how many fetches are made. Just describe what the tool results show.
- Never claim you "didn't use the fetch tool" if tool results are present in the conversation.
- Never fabricate fetch outcomes. Only describe what the tool actually returned.`

	sysPrompt += toolPrompt

	messages = append(messages, chatMsg{Role: "system", Content: sysPrompt})

	rows, err := db.DB.Query("SELECT role, content, attachments FROM messages WHERE chat_id = ? ORDER BY created_at ASC", chatID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var role, content string
			var attachmentsStr sql.NullString
			if errScan := rows.Scan(&role, &content, &attachmentsStr); errScan == nil {
				var atts []attachment
				if attachmentsStr.Valid && attachmentsStr.String != "" {
					_ = json.Unmarshal([]byte(attachmentsStr.String), &atts)
				}

				if len(atts) > 0 {
					var contentParts []interface{}
					contentParts = append(contentParts, map[string]interface{}{
						"type": "text",
						"text": content,
					})
					for _, att := range atts {
						if att.Type == "image" && att.Data != "" {
							contentParts = append(contentParts, map[string]interface{}{
								"type": "image_url",
								"image_url": map[string]interface{}{
									"url": att.Data,
								},
							})
						}
					}
					messages = append(messages, chatMsg{Role: role, Content: contentParts})
				} else {
					messages = append(messages, chatMsg{Role: role, Content: content})
				}
			}
		}
	}

	// Deduct credits based on model multiplier
	modelMultipliers := map[string]float64{
		"claude-opus-4-8": 2.0,
		"claude-opus-4-7": 1.5,
		"claude-opus-4-6": 1.0,
		"gpt-5.5":         1.5,
		"glm-5.2":         0.5,
	}
	multiplier, ok := modelMultipliers[chatModel]
	if !ok {
		multiplier = 1.0
	}

	checkDailyReset(userID)

	var currentCredits float64
	err = db.DB.QueryRow("SELECT credits FROM users WHERE id = ?", userID).Scan(&currentCredits)
	if err != nil {
		util.JSON(w, http.StatusInternalServerError, map[string]string{"error": "could not fetch credits"})
		return
	}

	if currentCredits < multiplier {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusPaymentRequired)
		w.Write([]byte(`{"error":"insufficient credits"}`))
		return
	}

	_, err = db.DB.Exec("UPDATE users SET credits = credits - ? WHERE id = ?", multiplier, userID)
	if err != nil {
		fmt.Printf("db error: failed to deduct credits: %v\n", err)
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		util.JSON(w, http.StatusInternalServerError, map[string]string{"error": "streaming not supported"})
		return
	}

	// Agent loop: keep calling the LLM until it stops requesting tool calls
	const maxIterations = 10
	var allToolCalls []toolCall
	var finalContent string

	for iteration := 0; iteration < maxIterations; iteration++ {
		// Make LLM call
		respAR, err := callLLM(chatModel, messages)
		if err != nil {
			util.JSON(w, http.StatusBadGateway, map[string]string{"error": fmt.Sprintf("failed to call agent router: %v", err)})
			return
		}

		if respAR.StatusCode >= 400 {
			bodyBytes, _ := io.ReadAll(respAR.Body)
			respAR.Body.Close()
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(respAR.StatusCode)
			w.Write(bodyBytes)
			return
		}

		// Stream response and detect fetch tags
		accumulated, fetchURLs := streamLLMResponse(respAR.Body, w, flusher)
		respAR.Body.Close()

		// Deduplicate bare domain URLs
		seen := make(map[string]bool)
		var uniqueURLs []string
		for _, u := range fetchURLs {
			// Strip any protocol the LLM might have added
			domain := strings.TrimPrefix(u, "http://")
			domain = strings.TrimPrefix(domain, "https://")
			domain = strings.TrimSuffix(domain, "/")
			if domain != "" && !seen[domain] {
				seen[domain] = true
				uniqueURLs = append(uniqueURLs, domain)
			}
		}
		fetchURLs = uniqueURLs

		if len(fetchURLs) == 0 {
			// No tool calls — we're done
			finalContent = accumulated
			break
		}

		// Execute all fetches in parallel
		results := executeFetches(fetchURLs, w, flusher)

		// Record tool calls and build result messages
		var fetchTags []string
		var resultMsgs []chatMsg
		for _, fr := range results {
			allToolCalls = append(allToolCalls, toolCall{
				Name:   "fetch",
				Arg:    fr.url,
				Status: fr.status,
				Title:  fr.title,
				Domain: fr.domain,
			})
			fetchTags = append(fetchTags, fmt.Sprintf("<fetch url=\"%s\"/>", fr.url))
			resultMsgs = append(resultMsgs, chatMsg{Role: "user", Content: fr.resultMsg})
		}

		// Append assistant's tool request and results to conversation
		messages = append(messages, chatMsg{
			Role:    "assistant",
			Content: strings.Join(fetchTags, "\n"),
		})
		messages = append(messages, resultMsgs...)

		fmt.Printf("[DEBUG] SendMessage: Iteration %d completed, %d fetch(es) executed\n", iteration+1, len(fetchURLs))
	}

	// Save the final assistant message
	assistantMsgID := util.NewID()
	now = time.Now().UTC().Format(time.RFC3339)
	var tcsJSON []byte
	if len(allToolCalls) > 0 {
		tcsJSON, _ = json.Marshal(allToolCalls)
	}
	_, err = db.DB.Exec(
		"INSERT INTO messages (id, chat_id, role, content, tool_calls, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		assistantMsgID, chatID, "assistant", finalContent, string(tcsJSON), now,
	)
	if err != nil {
		fmt.Printf("db error: failed to save assistant response: %v\n", err)
	} else {
		db.DB.Exec("UPDATE chats SET updated_at = ? WHERE id = ?", now, chatID)
	}
}

// fetchResult holds the outcome of a single fetch execution.
type fetchResult struct {
	url       string
	title     string
	domain    string
	status    string
	resultMsg string
}

// callLLM makes a streaming POST request to AgentRouter and returns the response.
func callLLM(model string, messages []chatMsg) (*http.Response, error) {
	payload := agentRouterRequest{
		Model:       model,
		Messages:    messages,
		Temperature: 0.7,
		MaxTokens:   0,
		Stream:      true,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	reqAR, err := http.NewRequest("POST", "https://agentrouter.org/v1/chat/completions", bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	reqAR.Header.Set("Content-Type", "application/json")
	reqAR.Header.Set("Authorization", "Bearer "+os.Getenv("AGENTROUTER_API_KEY"))
	reqAR.Header.Set("Originator", "codex_cli_rs")
	reqAR.Header.Set("User-Agent", "codex_cli_rs/0.101.0 (Mac OS 26.0.1; arm64) Apple_Terminal/464")
	reqAR.Header.Set("Version", "0.101.0")

	client := &http.Client{}
	return client.Do(reqAR)
}

// streamLLMResponse reads an SSE stream, forwards chunks to the client, and detects <fetch> tool calls.
// Returns the accumulated content and all detected fetch URLs.
func streamLLMResponse(body io.Reader, w http.ResponseWriter, flusher http.Flusher) (string, []string) {
	reader := bufio.NewReader(body)
	var fullContent strings.Builder
	var fetchURLs []string
	fetchRe := regexp.MustCompile(`<fetch url="([^"]+)"\s*/?>`)

	for {
		line, err := reader.ReadBytes('\n')
		if err != nil {
			break
		}

		w.Write(line)
		flusher.Flush()

		lineStr := string(line)
		if strings.HasPrefix(lineStr, "data: ") {
			dataVal := strings.TrimPrefix(lineStr, "data: ")
			dataVal = strings.TrimSpace(dataVal)

			if dataVal == "[DONE]" {
				break
			}

			var chunk struct {
				Choices []struct {
					Delta struct {
						Content string `json:"content"`
					} `json:"delta"`
				} `json:"choices"`
			}

			if err := json.Unmarshal([]byte(dataVal), &chunk); err == nil {
				if len(chunk.Choices) > 0 {
					fullContent.WriteString(chunk.Choices[0].Delta.Content)
				}
			}
		}
	}

	// After streaming is complete, extract ALL fetch tags from the accumulated content
	accText := fullContent.String()
	matches := fetchRe.FindAllStringSubmatch(accText, -1)
	for _, m := range matches {
		if len(m) > 1 {
			fetchURLs = append(fetchURLs, m[1])
		}
	}

	return fullContent.String(), fetchURLs
}

// executeFetches runs multiple fetch URLs in parallel and sends SSE tool_call events to the client.
// For each bare domain, it fetches both http:// and https:// in parallel.
// If both return identical content, a single result is returned with a note.
// If they differ, two separate results are returned.
func executeFetches(urls []string, w http.ResponseWriter, flusher http.Flusher) []fetchResult {
	type protocolResult struct {
		protocol  string
		title     string
		domain    string
		bodyText  string
		status    string
		fetchErr  error
	}

	type domainJob struct {
		index int
		domain string
	}

	type domainOutcome struct {
		index   int
		domain  string
		results []fetchResult
	}

	// Send "running" events for all fetches
	for _, u := range urls {
		runningUpdate := map[string]interface{}{
			"choices": []map[string]interface{}{
				{
					"delta": map[string]interface{}{
						"tool_call": map[string]interface{}{
							"name":   "fetch",
							"arg":    u,
							"status": "running",
						},
					},
				},
			},
		}
		runningBytes, _ := json.Marshal(runningUpdate)
		w.Write([]byte("data: " + string(runningBytes) + "\n\n"))
	}
	flusher.Flush()

	// Execute all domains concurrently
	ch := make(chan domainOutcome, len(urls))
	for i, u := range urls {
		go func(idx int, domain string) {
			// Fetch both protocols in parallel
			protocolCh := make(chan protocolResult, 2)
			for _, scheme := range []string{"https", "http"} {
				go func(s string) {
					fullURL := s + "://" + domain
					title, host, bodyText, fetchErr := fetchURL_func(fullURL)
					status := "done"
					if fetchErr != nil {
						status = "error"
					}
					protocolCh <- protocolResult{
						protocol: s,
						title:    title,
						domain:   host,
						bodyText: bodyText,
						status:   status,
						fetchErr: fetchErr,
					}
				}(scheme)
			}

			// Collect both results
			var httpsResult, httpResult protocolResult
			for j := 0; j < 2; j++ {
				pr := <-protocolCh
				if pr.protocol == "https" {
					httpsResult = pr
				} else {
					httpResult = pr
				}
			}

			var results []fetchResult

			// If both succeeded and body text is identical, return a single result
			bothSucceeded := httpsResult.status == "done" && httpResult.status == "done"
			identical := bothSucceeded && httpsResult.bodyText == httpResult.bodyText

			if identical {
				toolResultMsg := fmt.Sprintf(
					"[Tool Result for fetch %s (Title: %s, Domain: %s):\n%s\n]\n\nNote: HTTP was not included in this response because the HTTPS and HTTP responses were identical.",
					domain, httpsResult.title, httpsResult.domain, httpsResult.bodyText,
				)
				results = append(results, fetchResult{
					url:       domain,
					title:     httpsResult.title,
					domain:    httpsResult.domain,
					status:    "done",
					resultMsg: toolResultMsg,
				})
				fmt.Printf("[DEBUG] Fetch %s: HTTPS and HTTP responses identical, returning single result\n", domain)
			} else {
				// Return both as separate results with protocol-prefixed URLs for uniqueness
				if httpsResult.status == "done" {
					toolResultMsg := fmt.Sprintf(
						"[Tool Result for fetch %s via HTTPS (Title: %s, Domain: %s):\n%s\n]",
						domain, httpsResult.title, httpsResult.domain, httpsResult.bodyText,
					)
					results = append(results, fetchResult{
						url:       "https://" + domain,
						title:     httpsResult.title,
						domain:    httpsResult.domain,
						status:    "done",
						resultMsg: toolResultMsg,
					})
				} else {
					errMsg := fmt.Sprintf("[Tool Result for fetch %s via HTTPS: Error fetching page: %v]", domain, httpsResult.fetchErr)
					results = append(results, fetchResult{
						url:       "https://" + domain,
						domain:    domain,
						status:    "error",
						resultMsg: errMsg,
					})
					fmt.Printf("[DEBUG] Fetch %s via HTTPS failed: %v\n", domain, httpsResult.fetchErr)
				}

				if httpResult.status == "done" {
					toolResultMsg := fmt.Sprintf(
						"[Tool Result for fetch %s via HTTP (Title: %s, Domain: %s):\n%s\n]",
						domain, httpResult.title, httpResult.domain, httpResult.bodyText,
					)
					results = append(results, fetchResult{
						url:       "http://" + domain,
						title:     httpResult.title,
						domain:    httpResult.domain,
						status:    "done",
						resultMsg: toolResultMsg,
					})
				} else {
					errMsg := fmt.Sprintf("[Tool Result for fetch %s via HTTP: Error fetching page: %v]", domain, httpResult.fetchErr)
					results = append(results, fetchResult{
						url:       "http://" + domain,
						domain:    domain,
						status:    "error",
						resultMsg: errMsg,
					})
					fmt.Printf("[DEBUG] Fetch %s via HTTP failed: %v\n", domain, httpResult.fetchErr)
				}
			}

			ch <- domainOutcome{index: idx, domain: domain, results: results}
		}(i, u)
	}

	// Collect results in order. We need to flatten since one domain can produce 1 or 2 results.
	// Use a slice of slices to preserve order, then flatten.
	outcomes := make([]domainOutcome, len(urls))
	for range urls {
		o := <-ch
		outcomes[o.index] = o
	}

	var allResults []fetchResult
	for _, o := range outcomes {
		allResults = append(allResults, o.results...)
	}

	// Send "done" events for all results
	for _, r := range allResults {
		doneUpdate := map[string]interface{}{
			"choices": []map[string]interface{}{
				{
					"delta": map[string]interface{}{
						"tool_call": map[string]interface{}{
							"name":   "fetch",
							"arg":    r.url,
							"status": r.status,
							"title":  r.title,
							"domain": r.domain,
						},
					},
				},
			},
		}
		doneBytes, _ := json.Marshal(doneUpdate)
		w.Write([]byte("data: " + string(doneBytes) + "\n\n"))
	}
	flusher.Flush()

	return allResults
}

// generateAndSaveTitle runs asynchronously to call AgentRouter with glm-5.2 and saves the generated title.
func generateAndSaveTitle(chatID string, firstMsgContent string) {
	sysPrompt := "Write a 3-word title for the message below. Answer with only the title."
	payload := agentRouterRequest{
		Model: "glm-5.2",
		Messages: []chatMsg{
			{Role: "system", Content: sysPrompt},
			{Role: "user", Content: firstMsgContent},
		},
		Temperature: 0.7,
		Stream:      false,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		fmt.Printf("title gen error: failed to marshal payload: %v\n", err)
		return
	}

	reqAR, err := http.NewRequest("POST", "https://agentrouter.org/v1/chat/completions", bytes.NewReader(payloadBytes))
	if err != nil {
		fmt.Printf("title gen error: failed to create request: %v\n", err)
		return
	}

	reqAR.Header.Set("Content-Type", "application/json")
	reqAR.Header.Set("Authorization", "Bearer "+os.Getenv("AGENTROUTER_API_KEY"))
	reqAR.Header.Set("Originator", "codex_cli_rs")
	reqAR.Header.Set("User-Agent", "codex_cli_rs/0.101.0 (Mac OS 26.0.1; arm64) Apple_Terminal/464")
	reqAR.Header.Set("Version", "0.101.0")

	client := &http.Client{Timeout: 15 * time.Second}
	respAR, err := client.Do(reqAR)
	if err != nil {
		fmt.Printf("title gen error: request failed: %v\n", err)
		return
	}
	defer respAR.Body.Close()

	if respAR.StatusCode >= 400 {
		bodyBytes, _ := io.ReadAll(respAR.Body)
		fmt.Printf("title gen error: AgentRouter returned status %d: %s\n", respAR.StatusCode, string(bodyBytes))
		return
	}

	var res agentRouterResponse
	if err := json.NewDecoder(respAR.Body).Decode(&res); err != nil {
		fmt.Printf("title gen error: failed to decode response: %v\n", err)
		return
	}

	if len(res.Choices) == 0 {
		fmt.Println("title gen error: no choices in response")
		return
	}

	generatedTitle := strings.TrimSpace(res.Choices[0].Message.Content)
	generatedTitle = strings.Trim(generatedTitle, `"'`)
	if generatedTitle == "" {
		fmt.Println("title gen error: empty title generated")
		return
	}

	_, err = db.DB.Exec("UPDATE chats SET title = ? WHERE id = ?", generatedTitle, chatID)
	if err != nil {
		fmt.Printf("title gen error: failed to update database: %v\n", err)
	} else {
		fmt.Printf("title gen: successfully generated title '%s' for chat %s\n", generatedTitle, chatID)
	}
}

// fetchURL_func retrieves the HTML content of a page, extracts its title, domain, and plain text content.
func fetchURL_func(targetURL string) (title string, domain string, bodyText string, err error) {
	parsed, err := url.Parse(targetURL)
	if err != nil {
		return "", "", "", err
	}
	domain = parsed.Hostname()

	client := &http.Client{Timeout: 8 * time.Second}
	req, err := http.NewRequest("GET", targetURL, nil)
	if err != nil {
		return "", domain, "", err
	}
	// Mimic a browser User-Agent so we don't get blocked by Cloudflare/WAFs
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	resp, err := client.Do(req)
	if err != nil {
		return "", domain, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return "", domain, "", fmt.Errorf("HTTP status %d", resp.StatusCode)
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", domain, "", err
	}

	htmlContent := string(bodyBytes)

	// Extract page title using regex
	titleReg := regexp.MustCompile(`(?i)<title[^>]*>(.*?)</title>`)
	matches := titleReg.FindStringSubmatch(htmlContent)
	if len(matches) > 1 {
		title = strings.TrimSpace(matches[1])
	} else {
		title = targetURL
	}

	// Clean up HTML tags to get pure plain text body
	// 1. Remove script/style contents
	scriptReg := regexp.MustCompile(`(?is)<script[^>]*>.*?</script>`)
	cleanText := scriptReg.ReplaceAllString(htmlContent, "")

	styleReg := regexp.MustCompile(`(?is)<style[^>]*>.*?</style>`)
	cleanText = styleReg.ReplaceAllString(cleanText, "")

	// 2. Strip all remaining HTML tags
	tagReg := regexp.MustCompile(`<[^>]+>`)
	cleanText = tagReg.ReplaceAllString(cleanText, " ")

	// 3. Normalize whitespace & decode HTML entities minimally
	cleanText = strings.Join(strings.Fields(cleanText), " ")
	cleanText = strings.ReplaceAll(cleanText, "&nbsp;", " ")
	cleanText = strings.ReplaceAll(cleanText, "&amp;", "&")
	cleanText = strings.ReplaceAll(cleanText, "&lt;", "<")
	cleanText = strings.ReplaceAll(cleanText, "&gt;", ">")

	// Limit length of plain text context sent to LLM
	if len(cleanText) > 6000 {
		cleanText = cleanText[:6000] + "... [Content Truncated]"
	}

	return title, domain, cleanText, nil
}
