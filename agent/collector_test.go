package main

import (
	"bufio"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"
)

// ── helpers ──────────────────────────────────────────────────────────────────

// drainQueue collects envelopes from the channel until it is empty for at
// least `idle` duration or `max` items have been collected.
func drainQueue(queue <-chan TelemetryEnvelope, idle time.Duration) []TelemetryEnvelope {
	var out []TelemetryEnvelope
	timer := time.NewTimer(idle)
	defer timer.Stop()
	for {
		select {
		case env, ok := <-queue:
			if !ok {
				return out
			}
			out = append(out, env)
			// reset idle window each time a new item arrives
			if !timer.Stop() {
				select {
				case <-timer.C:
				default:
				}
			}
			timer.Reset(idle)
		case <-timer.C:
			return out
		}
	}
}

// sendLines writes newline-terminated lines to conn then closes the writer side.
func sendLines(t *testing.T, conn net.Conn, lines []string) {
	t.Helper()
	w := bufio.NewWriter(conn)
	for _, line := range lines {
		fmt.Fprintln(w, line)
	}
	if err := w.Flush(); err != nil {
		t.Logf("sendLines flush: %v", err)
	}
	conn.Close()
}

// ── handleConnection ─────────────────────────────────────────────────────────

func TestHandleConnection_SourceAndBoundaryDetection(t *testing.T) {
	cases := []struct {
		name         string
		line         string
		wantSource   string
		wantBoundary string
	}{
		{
			name:         "cowrie keyword sets HONEYPOT boundary",
			line:         `{"type":"cowrie_kex","severity":0.4}`,
			wantSource:   "cowrie",
			wantBoundary: "HONEYPOT",
		},
		{
			name:         "src_ip keyword sets HONEYPOT boundary",
			line:         `{"src_ip":"87.251.64.176","event":"login"}`,
			wantSource:   "cowrie",
			wantBoundary: "HONEYPOT",
		},
		{
			name:         "tetragon keyword sets tetragon source and HOST boundary",
			line:         `{"source":"tetragon","pid":1234}`,
			wantSource:   "tetragon",
			wantBoundary: "HOST",
		},
		{
			name:         "plain event defaults to kernel_extractor and HOST boundary",
			line:         `{"type":"execve","pid":5555}`,
			wantSource:   "kernel_extractor",
			wantBoundary: "HOST",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			queue := make(chan TelemetryEnvelope, 8)
			client, server := net.Pipe()

			go handleConnection(server, queue)
			sendLines(t, client, []string{tc.line})

			envs := drainQueue(queue, 500*time.Millisecond)
			if len(envs) != 1 {
				t.Fatalf("expected 1 envelope, got %d", len(envs))
			}
			if envs[0].Source != tc.wantSource {
				t.Errorf("Source: got %q, want %q", envs[0].Source, tc.wantSource)
			}
			if envs[0].Boundary != tc.wantBoundary {
				t.Errorf("Boundary: got %q, want %q", envs[0].Boundary, tc.wantBoundary)
			}
		})
	}
}

func TestHandleConnection_ParsesValidJSONIntoMap(t *testing.T) {
	queue := make(chan TelemetryEnvelope, 8)
	client, server := net.Pipe()

	go handleConnection(server, queue)
	sendLines(t, client, []string{`{"pid":1234,"type":"execve"}`})

	envs := drainQueue(queue, 500*time.Millisecond)
	if len(envs) != 1 {
		t.Fatalf("expected 1 envelope, got %d", len(envs))
	}
	if _, ok := envs[0].Raw.(map[string]interface{}); !ok {
		t.Errorf("expected Raw to be map[string]interface{}, got %T", envs[0].Raw)
	}
}

func TestHandleConnection_FallsBackToStringForInvalidJSON(t *testing.T) {
	queue := make(chan TelemetryEnvelope, 8)
	client, server := net.Pipe()

	go handleConnection(server, queue)
	sendLines(t, client, []string{`not valid json at all <<<`})

	envs := drainQueue(queue, 500*time.Millisecond)
	if len(envs) != 1 {
		t.Fatalf("expected 1 envelope, got %d", len(envs))
	}
	if _, ok := envs[0].Raw.(string); !ok {
		t.Errorf("expected Raw to be string for invalid JSON, got %T", envs[0].Raw)
	}
}

func TestHandleConnection_SkipsBlankLines(t *testing.T) {
	queue := make(chan TelemetryEnvelope, 8)
	client, server := net.Pipe()

	go handleConnection(server, queue)
	sendLines(t, client, []string{
		"",
		"   ",
		"\t",
		`{"pid":9,"type":"execve"}`, // only this should be enqueued
	})

	envs := drainQueue(queue, 500*time.Millisecond)
	if len(envs) != 1 {
		t.Errorf("expected 1 non-blank envelope, got %d", len(envs))
	}
}

func TestHandleConnection_MultipleEventsAllEnqueued(t *testing.T) {
	queue := make(chan TelemetryEnvelope, 16)
	client, server := net.Pipe()

	lines := []string{
		`{"type":"execve","pid":100}`,
		`{"type":"port_scan","pid":200}`,
		`{"src_ip":"87.251.64.1","pid":300}`,
	}
	go handleConnection(server, queue)
	sendLines(t, client, lines)

	envs := drainQueue(queue, 500*time.Millisecond)
	if len(envs) != len(lines) {
		t.Errorf("expected %d envelopes, got %d", len(lines), len(envs))
	}
}

func TestHandleConnection_GracefullyHandlesEarlyClose(t *testing.T) {
	queue := make(chan TelemetryEnvelope, 8)
	client, server := net.Pipe()

	done := make(chan struct{})
	go func() {
		defer close(done)
		handleConnection(server, queue)
	}()

	// Close the writer side immediately — server side receives EOF.
	client.Close()

	select {
	case <-done:
		// handleConnection returned cleanly
	case <-time.After(2 * time.Second):
		t.Error("handleConnection did not return after client closed connection")
	}
}

// ── dispatchWorker ────────────────────────────────────────────────────────────

func TestDispatchWorker_SetsTokenHeaderWhenEnvIsSet(t *testing.T) {
	const wantToken = "test-ingest-secret"
	t.Setenv("BIFROST_INGEST_TOKEN", wantToken)

	var (
		mu       sync.Mutex
		gotToken string
	)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		gotToken = r.Header.Get("X-Bifrost-Token")
		mu.Unlock()
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	queue := make(chan TelemetryEnvelope, 1)
	queue <- TelemetryEnvelope{Source: "test", Boundary: "HOST", Timestamp: "2026-01-01T00:00:00Z", Raw: "payload"}
	close(queue)

	dispatchWorker(queue, 1, srv.URL)

	mu.Lock()
	defer mu.Unlock()
	if gotToken != wantToken {
		t.Errorf("X-Bifrost-Token: got %q, want %q", gotToken, wantToken)
	}
}

func TestDispatchWorker_OmitsTokenHeaderWhenEnvIsUnset(t *testing.T) {
	os.Unsetenv("BIFROST_INGEST_TOKEN")

	var (
		mu           sync.Mutex
		headerSent   bool
	)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		_, headerSent = r.Header["X-Bifrost-Token"]
		mu.Unlock()
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	queue := make(chan TelemetryEnvelope, 1)
	queue <- TelemetryEnvelope{Source: "test", Boundary: "HOST", Timestamp: "2026-01-01T00:00:00Z", Raw: "payload"}
	close(queue)

	dispatchWorker(queue, 1, srv.URL)

	mu.Lock()
	defer mu.Unlock()
	if headerSent {
		t.Error("X-Bifrost-Token header must not be set when BIFROST_INGEST_TOKEN is unset")
	}
}

func TestDispatchWorker_PostsJSONBody(t *testing.T) {
	os.Unsetenv("BIFROST_INGEST_TOKEN")

	var (
		mu          sync.Mutex
		gotCT       string
		gotMethod   string
	)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		gotCT = r.Header.Get("Content-Type")
		gotMethod = r.Method
		mu.Unlock()
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	queue := make(chan TelemetryEnvelope, 1)
	queue <- TelemetryEnvelope{Source: "test", Boundary: "HOST", Timestamp: "2026-01-01T00:00:00Z", Raw: "data"}
	close(queue)

	dispatchWorker(queue, 1, srv.URL)

	mu.Lock()
	defer mu.Unlock()
	if gotMethod != http.MethodPost {
		t.Errorf("method: got %q, want POST", gotMethod)
	}
	if !strings.Contains(gotCT, "application/json") {
		t.Errorf("Content-Type: got %q, want application/json", gotCT)
	}
}

func TestDispatchWorker_ContinuesOnConnectionFailure(t *testing.T) {
	os.Unsetenv("BIFROST_INGEST_TOKEN")

	// Nothing is listening on port 1 — every dial returns ECONNREFUSED immediately.
	queue := make(chan TelemetryEnvelope, 3)
	for i := 0; i < 3; i++ {
		queue <- TelemetryEnvelope{Source: "test", Boundary: "HOST", Timestamp: "2026-01-01T00:00:00Z", Raw: "x"}
	}
	close(queue)

	done := make(chan struct{})
	go func() {
		defer close(done)
		dispatchWorker(queue, 1, "http://127.0.0.1:1")
	}()

	select {
	case <-done:
		// all items were processed (with errors) and the worker exited cleanly
	case <-time.After(15 * time.Second):
		t.Error("dispatchWorker did not exit cleanly after repeated connection failures")
	}
}

// ── authorizeExecutorRequest ──────────────────────────────────────────────────

func TestAuthorizeExecutorRequest_AllowsValidToken(t *testing.T) {
	const token = "correct-executor-token"
	t.Setenv("BIFROST_EXECUTOR_TOKEN", token)

	r := httptest.NewRequest(http.MethodPost, "/execute", nil)
	r.Header.Set("X-Bifrost-Token", token)

	if !authorizeExecutorRequest(r) {
		t.Error("expected true for matching token, got false")
	}
}

func TestAuthorizeExecutorRequest_RejectsWrongToken(t *testing.T) {
	t.Setenv("BIFROST_EXECUTOR_TOKEN", "real-token")

	r := httptest.NewRequest(http.MethodPost, "/execute", nil)
	r.Header.Set("X-Bifrost-Token", "wrong-token")

	if authorizeExecutorRequest(r) {
		t.Error("expected false for wrong token, got true")
	}
}

func TestAuthorizeExecutorRequest_RejectsMissingHeader(t *testing.T) {
	t.Setenv("BIFROST_EXECUTOR_TOKEN", "real-token")

	r := httptest.NewRequest(http.MethodPost, "/execute", nil)
	// No X-Bifrost-Token header set

	if authorizeExecutorRequest(r) {
		t.Error("expected false when header is absent, got true")
	}
}

func TestAuthorizeExecutorRequest_RejectsWhenNoTokenConfigured(t *testing.T) {
	os.Unsetenv("BIFROST_EXECUTOR_TOKEN")

	r := httptest.NewRequest(http.MethodPost, "/execute", nil)
	r.Header.Set("X-Bifrost-Token", "any-value")

	if authorizeExecutorRequest(r) {
		t.Error("expected false when BIFROST_EXECUTOR_TOKEN is unset, got true")
	}
}

func TestAuthorizeExecutorRequest_RejectsEmptyTokenHeader(t *testing.T) {
	t.Setenv("BIFROST_EXECUTOR_TOKEN", "real-token")

	r := httptest.NewRequest(http.MethodPost, "/execute", nil)
	r.Header.Set("X-Bifrost-Token", "")

	if authorizeExecutorRequest(r) {
		t.Error("expected false for empty token header, got true")
	}
}

// ── IP validation (isPrivateOrLoopbackIP + blockIP guards) ───────────────────

func TestIsPrivateOrLoopbackIP_PrivateAndLoopback(t *testing.T) {
	cases := []string{
		"192.168.1.1",
		"192.168.0.0",
		"10.0.0.1",
		"10.255.255.254",
		"172.16.0.1",
		"172.31.255.255",
		"127.0.0.1",
		"127.1.2.3",
		"::1",
		"169.254.0.1", // link-local
	}
	for _, ip := range cases {
		if !isPrivateOrLoopbackIP(ip) {
			t.Errorf("expected %s to be private/loopback, got false", ip)
		}
	}
}

func TestIsPrivateOrLoopbackIP_PublicIPs(t *testing.T) {
	cases := []string{
		"8.8.8.8",
		"1.1.1.1",
		"185.220.101.45",
		"93.184.216.34",
		"2001:4860:4860::8888",
	}
	for _, ip := range cases {
		if isPrivateOrLoopbackIP(ip) {
			t.Errorf("expected %s to be public, got private/loopback", ip)
		}
	}
}

func TestIsPrivateOrLoopbackIP_InvalidStrings(t *testing.T) {
	cases := []string{"not-an-ip", "", "999.999.999.999", "abc", "256.0.0.1"}
	for _, ip := range cases {
		if isPrivateOrLoopbackIP(ip) {
			t.Errorf("expected false for invalid IP %q, got true", ip)
		}
	}
}

func TestBlockIP_RejectsTooLongString(t *testing.T) {
	v := HeimdallVerdict{
		ActionRequired: "BLOCK",
		Target:         strings.Repeat("x", 46), // exceeds 45-char limit
	}
	result := blockIP(v)
	if result.Success {
		t.Error("expected Success=false for over-length target, got true")
	}
}

func TestBlockIP_RejectsNonIPString(t *testing.T) {
	cases := []string{"not-an-ip", "example.com", "abc123", "300.1.1.1"}
	for _, bad := range cases {
		v := HeimdallVerdict{ActionRequired: "BLOCK", Target: bad}
		if blockIP(v).Success {
			t.Errorf("expected Success=false for non-IP %q, got true", bad)
		}
	}
}

func TestBlockIP_RejectsPrivateIPWhenNotAllowed(t *testing.T) {
	os.Unsetenv("BIFROST_ALLOW_BLOCK_PRIVATE")
	os.Unsetenv("HEIMDALL_ALLOW_BLOCK_PRIVATE")

	cases := []string{"192.168.1.100", "10.0.0.5", "172.16.50.1"}
	for _, ip := range cases {
		v := HeimdallVerdict{ActionRequired: "BLOCK", Target: ip}
		if blockIP(v).Success {
			t.Errorf("expected Success=false for RFC1918 target %s, got true", ip)
		}
	}
}

func TestBlockIP_RejectsLoopbackWhenNotAllowed(t *testing.T) {
	os.Unsetenv("BIFROST_ALLOW_BLOCK_PRIVATE")
	os.Unsetenv("HEIMDALL_ALLOW_BLOCK_PRIVATE")

	v := HeimdallVerdict{ActionRequired: "BLOCK", Target: "127.0.0.1"}
	if blockIP(v).Success {
		t.Error("expected Success=false for loopback target, got true")
	}
}

func TestBlockIP_ActionResultTargetPreserved(t *testing.T) {
	// Verify that result.Target always reflects the input target, even on failure.
	v := HeimdallVerdict{ActionRequired: "BLOCK", Target: "not-an-ip"}
	result := blockIP(v)
	if result.Target != v.Target {
		t.Errorf("result.Target: got %q, want %q", result.Target, v.Target)
	}
	if result.ActionType != "BLOCK" {
		t.Errorf("result.ActionType: got %q, want BLOCK", result.ActionType)
	}
}
