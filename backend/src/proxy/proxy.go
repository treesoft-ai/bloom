package proxy

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
)

const agentRouterBase = "https://agentrouter.org"

// NewReverseProxy returns an http.Handler that forwards requests to AgentRouter
// with the Codex CLI headers required to bypass the client restriction.
func NewReverseProxy() http.Handler {
	target, _ := url.Parse(agentRouterBase)
	rp := httputil.NewSingleHostReverseProxy(target)

	original := rp.Director
	rp.Director = func(req *http.Request) {
		original(req)
		req.Host = target.Host
		req.Header.Set("Originator", "codex_cli_rs")
		req.Header.Set("User-Agent", "codex_cli_rs/0.101.0 (Mac OS 26.0.1; arm64) Apple_Terminal/464")
		req.Header.Set("Version", "0.101.0")
		// Forward the real API key
		req.Header.Set("Authorization", "Bearer "+os.Getenv("AGENTROUTER_API_KEY"))
	}

	return rp
}
