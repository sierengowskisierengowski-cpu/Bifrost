package main

import (
	"crypto/subtle"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

type HeimdallVerdict struct {
	ActionRequired string `json:"action_required"`
	Target         string `json:"target"`
	ThreatClass    string `json:"threat_class"`
	Reasoning      string `json:"reasoning"`
	EventID        int64  `json:"event_id"`
	SchemaVersion  string `json:"schema_version"`
	SessionID      string `json:"session_id"`
	SSHFingerprint string `json:"ssh_fingerprint"`
	CommandHash    string `json:"command_hash"`
}

type ActionResult struct {
	Success        bool   `json:"success"`
	ActionType     string `json:"action_type"`
	Target         string `json:"target"`
	RollbackData   string `json:"rollback_data"`
	ExecutedAt     string `json:"executed_at"`
	SessionID      string `json:"session_id"`
	SSHFingerprint string `json:"ssh_fingerprint"`
	CommandHash    string `json:"command_hash"`
}

const (
	frontendHeartbeatHeader           = "X-Bifrost-Client"
	frontendHeartbeatValue            = "tauri"
	frontendHeartbeatTimeout          = 30 * time.Second
	frontendWatchdogInterval          = 3 * time.Second
	honeypotPort                      = "2222/tcp"
	executorRateLimitWindowDefaultSec = 10
	executorRateLimitMaxDefault       = 30
)

var (
	frontendMu             sync.Mutex
	lastFrontendHeartbeat  time.Time
	frontendLockdownActive bool
	rateLimitMu            sync.Mutex
	rateLimitBuckets       = map[string][]time.Time{}
)

func startExecutor() {
	port := executorPort()
	log.Printf("[*] Bifrost Executor starting on port %s...", port)
	http.HandleFunc("/execute", handleVerdict)
	http.HandleFunc("/rollback", handleRollback)
	http.HandleFunc("/health", handleHealth)
	startFrontendWatchdog()
	log.Fatal(http.ListenAndServe("127.0.0.1:"+port, nil))
}

func executorToken() string {
	return strings.TrimSpace(os.Getenv("BIFROST_EXECUTOR_TOKEN"))
}

func rateLimitWindow() time.Duration {
	raw := strings.TrimSpace(os.Getenv("BIFROST_EXECUTOR_RATE_LIMIT_WINDOW_SEC"))
	if raw == "" {
		return time.Duration(executorRateLimitWindowDefaultSec) * time.Second
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 1 {
		return time.Duration(executorRateLimitWindowDefaultSec) * time.Second
	}
	return time.Duration(value) * time.Second
}

func rateLimitMax() int {
	raw := strings.TrimSpace(os.Getenv("BIFROST_EXECUTOR_RATE_LIMIT_MAX"))
	if raw == "" {
		return executorRateLimitMaxDefault
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 1 {
		return executorRateLimitMaxDefault
	}
	return value
}

func authorizeExecutorRequest(r *http.Request) bool {
	token := executorToken()
	if token == "" {
		log.Printf("[!] BIFROST_EXECUTOR_TOKEN unset — refusing executor requests")
		return false
	}
	provided := strings.TrimSpace(r.Header.Get("X-Bifrost-Token"))
	return subtle.ConstantTimeCompare([]byte(provided), []byte(token)) == 1
}

func handleVerdict(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if !authorizeExecutorRequest(r) {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if !allowExecutorRequest(r, "/execute") {
		http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Read error", http.StatusBadRequest)
		return
	}

	decoder := json.NewDecoder(strings.NewReader(string(body)))
	decoder.DisallowUnknownFields()
	var verdict HeimdallVerdict
	if err := decoder.Decode(&verdict); err != nil {
		http.Error(w, "Invalid verdict schema", http.StatusBadRequest)
		return
	}
	if !isValidVerdict(verdict) {
		http.Error(w, "Invalid verdict payload", http.StatusBadRequest)
		return
	}
	verdict.ActionRequired = strings.ToUpper(strings.TrimSpace(verdict.ActionRequired))

	go dispatchMitigation(verdict)

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"dispatched"}`))
}

func handleRollback(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if !authorizeExecutorRequest(r) {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if !allowExecutorRequest(r, "/rollback") {
		http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Read error", http.StatusBadRequest)
		return
	}

	var req struct {
		ActionID int64 `json:"action_id"`
	}
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	err = rollbackAction(req.ActionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"rolled_back"}`))
}

func allowExecutorRequest(r *http.Request, endpoint string) bool {
	key := endpoint + "|" + r.RemoteAddr
	now := time.Now()
	cutoff := now.Add(-rateLimitWindow())

	rateLimitMu.Lock()
	defer rateLimitMu.Unlock()

	bucket := rateLimitBuckets[key]
	filtered := bucket[:0]
	for _, ts := range bucket {
		if ts.After(cutoff) {
			filtered = append(filtered, ts)
		}
	}
	if len(filtered) >= rateLimitMax() {
		rateLimitBuckets[key] = filtered
		return false
	}
	filtered = append(filtered, now)
	rateLimitBuckets[key] = filtered
	return true
}

func isValidVerdict(v HeimdallVerdict) bool {
	action := strings.TrimSpace(strings.ToUpper(v.ActionRequired))
	if !isKnownVerdictAction(action) {
		return false
	}
	if v.EventID < 1 {
		return false
	}
	if strings.TrimSpace(v.SchemaVersion) == "" {
		return false
	}
	if strings.TrimSpace(v.SessionID) == "" {
		return false
	}
	if strings.TrimSpace(v.SSHFingerprint) == "" {
		return false
	}
	if strings.TrimSpace(v.CommandHash) == "" {
		return false
	}
	return true
}

func isKnownVerdictAction(action string) bool {
	if isAllowedAction(action) {
		return true
	}
	switch action {
	case "ALERT", "LOG", "NONE":
		return true
	default:
		return false
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	if strings.EqualFold(r.Header.Get(frontendHeartbeatHeader), frontendHeartbeatValue) {
		recordFrontendHeartbeat()
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"ok","component":"bifrost_executor"}`))
}

func startFrontendWatchdog() {
	frontendMu.Lock()
	if lastFrontendHeartbeat.IsZero() {
		lastFrontendHeartbeat = time.Now()
	}
	frontendMu.Unlock()
	ticker := time.NewTicker(frontendWatchdogInterval)
	go func() {
		for range ticker.C {
			evaluateFrontendHeartbeat()
		}
	}()
}

func recordFrontendHeartbeat() {
	frontendMu.Lock()
	lastFrontendHeartbeat = time.Now()
	active := frontendLockdownActive
	frontendMu.Unlock()
	if active {
		exitAutonomousLockdown()
	}
}

func evaluateFrontendHeartbeat() {
	frontendMu.Lock()
	last := lastFrontendHeartbeat
	frontendMu.Unlock()
	if time.Since(last) > frontendHeartbeatTimeout {
		enterAutonomousLockdown()
		return
	}
	exitAutonomousLockdown()
}

func enterAutonomousLockdown() {
	if !setLockdownState(true) {
		return
	}
	log.Printf("[!!!] AUTONOMOUS LOCKDOWN: monitoring interface offline > %s", frontendHeartbeatTimeout)
	cmd := exec.Command("sudo", "ufw", "deny", honeypotPort)
	if err := cmd.Run(); err != nil {
		log.Printf("[!] Lockdown failed for %s: %v", honeypotPort, err)
	}
}

func exitAutonomousLockdown() {
	if !setLockdownState(false) {
		return
	}
	log.Printf("[+] Lockdown cleared: monitoring interface restored")
	cmd := exec.Command("sudo", "ufw", "allow", honeypotPort)
	if err := cmd.Run(); err != nil {
		log.Printf("[!] Restore failed for %s: %v", honeypotPort, err)
	}
}

func setLockdownState(active bool) bool {
	frontendMu.Lock()
	defer frontendMu.Unlock()
	if frontendLockdownActive == active {
		return false
	}
	frontendLockdownActive = active
	return true
}

func dispatchMitigation(v HeimdallVerdict) {
	if v.Target == "" || v.Target == "null" {
		return
	}

	if !isAllowedAction(v.ActionRequired) {
		log.Printf("[!] SAFETY BLOCK: Unknown action %q", v.ActionRequired)
		return
	}

	log.Printf(
		"[!!!] AUTONOMOUS ACTION: %s targeting %s — %s",
		v.ActionRequired, v.Target, v.Reasoning,
	)

	var result ActionResult
	result.ActionType = v.ActionRequired
	result.Target = v.Target
	result.ExecutedAt = time.Now().UTC().Format(time.RFC3339)

	switch v.ActionRequired {
	case "KILL":
		result = killProcess(v)
	case "BLOCK":
		result = blockIP(v)
	case "QUARANTINE":
		result = quarantineFile(v)
	default:
		log.Printf("[*] Non-disruptive action: %s", v.ActionRequired)
		return
	}

	result.SessionID = v.SessionID
	result.SSHFingerprint = v.SSHFingerprint
	result.CommandHash = v.CommandHash
	logAction(v.EventID, result)
}

func killProcess(v HeimdallVerdict) ActionResult {
	result := ActionResult{
		ActionType: "KILL",
		Target:     v.Target,
		ExecutedAt: time.Now().UTC().Format(time.RFC3339),
	}

	pid, err := strconv.Atoi(v.Target)
	if err != nil {
		log.Printf("[!] Invalid PID: %v", err)
		result.Success = false
		return result
	}

	// Safety guard — refuse low PIDs and protected system range
	minPid := protectedPidMin()
	if pid <= 2 || pid < minPid {
		log.Printf("[!] SAFETY BLOCK: Refused to kill PID %d (min allowed %d)", pid, minPid)
		result.Success = false
		return result
	}

	// Read process info before killing for rollback record
	cmdline := ""
	cmdlinePath := fmt.Sprintf("/proc/%d/cmdline", pid)
	if data, err := os.ReadFile(cmdlinePath); err == nil {
		cmdline = string(data)
	}
	result.RollbackData = fmt.Sprintf(
		`{"pid":%d,"cmdline":"%s","note":"process_killed_cannot_restart"}`,
		pid, cmdline,
	)

	cmd := exec.Command("kill", "-9", strconv.Itoa(pid))
	if err := cmd.Run(); err != nil {
		log.Printf("[!] Kill failed for PID %d: %v", pid, err)
		result.Success = false
		return result
	}

	log.Printf("[+] Killed PID %d. Reason: %s", pid, v.Reasoning)
	result.Success = true
	return result
}

func blockIP(v HeimdallVerdict) ActionResult {
	result := ActionResult{
		ActionType: "BLOCK",
		Target:     v.Target,
		ExecutedAt: time.Now().UTC().Format(time.RFC3339),
	}

	if len(v.Target) > 45 {
		log.Printf("[!] IP too long — block aborted: %s", v.Target)
		result.Success = false
		return result
	}

	if net.ParseIP(v.Target) == nil {
		log.Printf("[!] Invalid IP — block aborted: %s", v.Target)
		result.Success = false
		return result
	}

	if !allowBlockPrivate() && isPrivateOrLoopbackIP(v.Target) {
		log.Printf("[!] SAFETY BLOCK: Refused RFC1918/loopback target %s", v.Target)
		result.Success = false
		return result
	}

	result.RollbackData = fmt.Sprintf(
		`{"ip":"%s","action":"ufw_deny","rollback":"ufw delete deny from %s"}`,
		v.Target, v.Target,
	)

	cmd := exec.Command("sudo", "ufw", "insert", "1", "deny", "from", v.Target)
	if err := cmd.Run(); err != nil {
		log.Printf("[!] UFW block failed for %s: %v", v.Target, err)
		result.Success = false
		return result
	}

	log.Printf("[+] Blocked IP: %s. Reason: %s", v.Target, v.Reasoning)
	result.Success = true
	return result
}

func quarantineFile(v HeimdallVerdict) ActionResult {
	result := ActionResult{
		ActionType: "QUARANTINE",
		Target:     v.Target,
		ExecutedAt: time.Now().UTC().Format(time.RFC3339),
	}

	if !validateQuarantineTarget(v.Target) {
		log.Printf("[!] SAFETY BLOCK: Invalid quarantine path: %s", v.Target)
		result.Success = false
		return result
	}

	if err := os.MkdirAll(quarantineZone(), 0700); err != nil {
		log.Printf("[!] Cannot create quarantine zone: %v", err)
		result.Success = false
		return result
	}

	originalName := filepath.Base(v.Target)
	destName := fmt.Sprintf(
		"%d_%s.quarantined",
		time.Now().UnixNano(), originalName,
	)
	destPath := filepath.Join(quarantineZone(), destName)

	result.RollbackData = fmt.Sprintf(
		`{"original":"%s","quarantined":"%s","rollback":"mv %s %s"}`,
		v.Target, destPath, destPath, v.Target,
	)

	if err := exec.Command("mv", v.Target, destPath).Run(); err != nil {
		log.Printf("[!] Quarantine move failed: %v", err)
		result.Success = false
		return result
	}

	// Strip all permissions — quarantined files must not be executable
	_ = exec.Command("chmod", "000", destPath).Run()

	log.Printf("[+] Quarantined: %s → %s", v.Target, destPath)
	result.Success = true
	return result
}

func logAction(eventID int64, result ActionResult) {
	db, err := sql.Open("sqlite3", executorDBPath())
	if err != nil {
		log.Printf("[!] Cannot open DB for action log: %v", err)
		return
	}
	defer db.Close()

	_, err = db.Exec(`
		INSERT INTO actions
		(event_id, action_type, target, session_id, ssh_fingerprint, command_hash, executed_at, success, rollback_data)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		eventID,
		result.ActionType,
		result.Target,
		result.SessionID,
		result.SSHFingerprint,
		result.CommandHash,
		result.ExecutedAt,
		result.Success,
		result.RollbackData,
	)
	if err != nil {
		log.Printf("[!] Action log write failed: %v", err)
	}
}

func rollbackAction(actionID int64) error {
	db, err := sql.Open("sqlite3", executorDBPath())
	if err != nil {
		return fmt.Errorf("DB open failed: %v", err)
	}
	defer db.Close()

	var actionType, rollbackData string
	err = db.QueryRow(`
		SELECT action_type, rollback_data
		FROM actions WHERE id = ?
	`, actionID).Scan(&actionType, &rollbackData)
	if err != nil {
		return fmt.Errorf("Action not found: %v", err)
	}

	log.Printf("[*] Rolling back action %d: %s", actionID, actionType)

	switch actionType {
	case "BLOCK":
		var data struct {
			IP string `json:"ip"`
		}
		if err := json.Unmarshal([]byte(rollbackData), &data); err == nil {
			if err := exec.Command("sudo", "ufw", "delete", "deny", "from", data.IP).Run(); err != nil {
				log.Printf("[!] Rollback failed for BLOCK on %s: %v", data.IP, err)
				return fmt.Errorf("rollback failed: %w", err)
			}
			log.Printf("[+] Rollback: Removed UFW block on %s", data.IP)
		} else {
			return fmt.Errorf("invalid rollback data for BLOCK")
		}
	case "QUARANTINE":
		var data struct {
			Original    string `json:"original"`
			Quarantined string `json:"quarantined"`
		}
		if err := json.Unmarshal([]byte(rollbackData), &data); err == nil {
			if err := exec.Command("mv", data.Quarantined, data.Original).Run(); err != nil {
				log.Printf("[!] Rollback failed for QUARANTINE %s: %v", data.Original, err)
				return fmt.Errorf("rollback failed: %w", err)
			}
			log.Printf("[+] Rollback: Restored %s", data.Original)
		} else {
			return fmt.Errorf("invalid rollback data for QUARANTINE")
		}
	case "KILL":
		log.Printf("[*] Cannot roll back process kill — process is gone.")
	}

	_, err = db.Exec(`
		UPDATE actions SET rolled_back = 1 WHERE id = ?
	`, actionID)
	return err
}
