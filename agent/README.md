# Bifrost Agent

The Go agent in this repository is a local execution and collection component used alongside the broader Bifrost stack.

## What it is in the current prerelease

Bifrost as a product is now positioned around the **Guardian** Python backend and the **Bifrost Desktop** Tauri application.

Within that architecture, the Go agent should be understood as a supporting runtime component for local collection and execution behavior, not the primary product entrypoint.

## Current role

The agent source in this directory provides supporting logic for:

- local collection
- execution handling
- path and environment handling
- safety gating

Current source files include:

- `main.go`
- `collector.go`
- `executor.go`
- `paths.go`
- `safety.go`

## Relationship to Guardian

Guardian is the documented Python backend that:

- ingests Cowrie honeypot, auditd, and process watcher data
- classifies every event with Ollama local AI using `qwen2.5:1.5b-instruct`
- runs as a systemd-managed service
- feeds the desktop experience

The Go agent is therefore part of the lower-level operational stack, while Guardian remains the main documented control and analysis layer.

## Build

From this directory:

```bash
go build -o bifrost-agent .
```

## Notes

- This repository's primary user-facing install path is currently the **Arch Linux desktop path**
- User-facing prerelease docs should point operators first to the root `README.md` and `app/bifrost-desktop/README.md`
- Any older wording that treats the Go agent as the full product should be considered stale
