<div align="center">

# Bifrost — AI-Powered Linux Endpoint Detection & Response

**Version 0.3.0 | Open Source | Arch Linux Native**

*Heimdall Never Sleeps.*

</div>

## What Bifrost is right now

Bifrost is an open-source AI-powered Endpoint Detection and Response system built for Linux. It monitors your network in real time, classifies threats using local AI inference, and can take autonomous defensive action when you explicitly configure it to do so.

This is a **local-first** stack:

- **No cloud dependency for analysis**
- **No account required**
- **No external SaaS needed to classify events**
- **Built and tested against real attackers, not simulated traffic**

Bifrost combines a Python Guardian backend, a native Tauri desktop application, local Ollama inference, deception traps, incident tracking, attacker fingerprinting, and multi-channel alerting into one Linux-native defensive platform.

## Real-world validation

- **23,000+ events** captured from live attackers
- **64+ unique adversary IPs** tracked
- **Doppelgänger detection** identified **6 actors** using **30+ IP masks**
- Real malware captured: **Redtail cryptominer**, **mdrfckr SSH backdoor botnet**, and **DNS tunneling C2**
- **Top attacker:** Iran — `91.40.62.224` with **3,964+ hits**

## Core architecture

### Guardian

Guardian is the Python backend and operational core of Bifrost.

It ingests telemetry from:

- **Cowrie honeypot**
- **auditd**
- **process watcher**

It classifies every event using **Ollama** with the local model:

- `qwen2.5:1.5b-instruct`

Guardian runs as a **systemd service** and exposes the data consumed by the desktop app.

### Desktop App

The desktop client is built with:

- **Tauri v2**
- **React**
- **TypeScript**
- **Vite**

It is currently documented and packaged as an **Arch Linux native** application.

Install path priority for users:

1. **AUR package:** `bifrost-bin`
2. **Build from source**

## What the app currently includes

### Overview

The overview page provides:

- total events
- incidents
- blocked percentage
- unique attackers
- activity timeline
- recent incidents

### Heimdall Speaks

A natural-language AI posture summary layer that:

- narrates security posture in plain English
- supports time ranges: **1H / 24H / 7D / 30D / ALL**
- includes an **Ask Heimdall** panel for natural-language security Q&A

### Incidents

A full incident log with:

- severity
- MITRE technique
- attacker IP
- action taken

### Attackers

Tracks **64+ adversaries** and includes **Doppelgänger detection** using:

- **HASSH**
- **JA4**

This is used to identify the same actor rotating across multiple IP addresses.

### Live Monitor

A real-time stream of security events.

### Timeline

A time-based view of observed attack activity.

### MITRE ATT&CK

A full framework-oriented detection view with:

- mapped techniques
- plain-English explanations

### Gjallarhorn

The Nine Realms multi-channel broadcaster for critical alerts:

- **Asgard** — journald
- **Midgard** — desktop notifications
- **Vanaheim** — Discord / Slack webhook
- **Muspelheim** — Twilio SMS
- **Helheim** — custom HTTP endpoint

### Mjolnir

The deception trap system for high-signal detection:

- fake AWS credentials
- fake database config
- decoy SSH keys
- canary documents

Any access to these assets triggers a high-severity alert.

### Analyst Matrix

A local AI inference panel that shows:

- active model
- response time
- success rate
- MITRE tags from recent analysis

It also supports on-demand analysis triggering.

### Settings

Settings currently document support for:

- Guardian behavior: **learning / dry run / autonomous**
- confidence threshold
- dashboard preferences
- security controls including strong password and biometric support through **fprintd / Howdy**
- personalization including operator name and casual greeting style
- Guardian Status card

### Screensaver

Two documented modes:

- **Rainbow Bridge** — animated mode
- **Ops Center** — full-screen live attack data display with multiple scrolling streams, real-time stats, top adversary, and attack type ticker

### Marquee ticker

A smooth-scrolling top bar showing:

- Model
- RAM
- CPU
- Uptime
- Active Attackers
- Events Today
- Blocked %

### Personalized greeting

Optional casual greeting with time-of-day and threat-level awareness.

Example:

> What's good [name], bridge held overnight.

### Hidden BIFROST terminal

Typing `BIFROST` in the terminal unlocks the hidden ASCII power-user console for:

- advanced configuration
- raw log viewing
- IP ban / unban
- mode switching

## Requirements

- **Arch Linux**
- **Python 3.11+**
- **pnpm**
- **Rust / Cargo**
- **Ollama**
- Ollama model: **`qwen2.5:1.5b-instruct`**

## Install

### AUR (recommended)

```bash
yay -S bifrost-bin
```

Update later with:

```bash
yay -Syu
```

### Build from source

```bash
git clone https://github.com/sierengowskisierengowski-cpu/Bifrost
cd Bifrost/app/bifrost-desktop
pnpm install
pnpm tauri build
```

## How it runs right now

### Guardian runtime

Guardian is intended to run as a background **systemd** service:

```bash
sudo systemctl enable --now bifrost-guardian.service
```

The current service entry launches:

```bash
/usr/bin/bifrost-guardian --dashboard --dashboard-host 127.0.0.1 --dashboard-port 8766
```

### Desktop runtime

The desktop app is a **Tauri v2** shell over the React frontend.

Current build/runtime characteristics:

- `vite.config.ts` uses `base: "./"` so assets load correctly in the Tauri runtime
- `tauri.conf.json` is wired to `pnpm dev` for development and `pnpm build` before desktop bundling
- the desktop package scripts currently include:
  - `pnpm dev`
  - `pnpm build`
  - `pnpm desktop:dev`
  - `pnpm desktop:build`
  - `pnpm tauri`
- frontend dev server port is **5173**
- Guardian dashboard/API port is **8766**

### Desktop build notes

```bash
cd app/bifrost-desktop
pnpm install
pnpm tauri build
```

Important notes for the current build:

- **`vite.config.ts` already uses the correct `base: "./"` fix** for Tauri asset loading
- If your environment prompts for native build script trust, run **`pnpm approve-builds`** before building
- This repository should be documented as **Arch Linux native first**

## Screenshots

Screenshots live in `docs/screenshots/`.

Current repository screenshots should be treated as **pre-release captures for verification**, not generic placeholders. Refresh them before public launch if any UI changed after those captures were taken.

## Security and safe defaults

Bifrost should be operated in authorized defensive environments only.

Recommended posture before enabling autonomous actions:

- validate your telemetry sources
- verify your confidence threshold
- review alert routing destinations
- verify deception assets are placed intentionally
- test response actions in dry-run mode first

## Roadmap — v0.4.0

- **Hofund AI companion** — separate sarcastic Norse AI that monitors and alerts in its own voice
- **WireGuard remote access integration**
- **GNI T-800 skull hardware integration**
- **Flathub submission**
- **Auto-updater via AUR**

## License

MIT License. See `LICENSE`.
