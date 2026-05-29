package main

import (
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

const protectedPidMinDefault = 100

func protectedPidMin() int {
	raw := envOrDefault("BIFROST_PROTECTED_PID_MIN", "HEIMDALL_PROTECTED_PID_MIN")
	if raw != "" {
		if value, err := strconv.Atoi(raw); err == nil && value > 0 {
			return value
		}
	}
	return protectedPidMinDefault
}

func allowBlockPrivate() bool {
	value := strings.ToLower(envOrDefault(
		"BIFROST_ALLOW_BLOCK_PRIVATE",
		"HEIMDALL_ALLOW_BLOCK_PRIVATE",
	))
	return value == "1" || value == "true" || value == "yes"
}

func isPrivateOrLoopbackIP(ipStr string) bool {
	ip := net.ParseIP(strings.TrimSpace(ipStr))
	if ip == nil {
		return false
	}
	return ip.IsPrivate() || ip.IsLoopback() || ip.IsLinkLocalUnicast()
}

func isAllowedAction(action string) bool {
	switch action {
	case "KILL", "BLOCK", "QUARANTINE":
		return true
	default:
		return false
	}
}

func validateQuarantineTarget(path string) bool {
	path = strings.TrimSpace(path)
	if path == "" || !filepath.IsAbs(path) {
		return false
	}
	if strings.Contains(path, "..") {
		return false
	}
	clean := filepath.Clean(path)
	if clean != path {
		return false
	}
	return true
}

func envBoolDefaultTrue(name string) bool {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return true
	}
	lower := strings.ToLower(value)
	return lower == "1" || lower == "true" || lower == "yes"
}
