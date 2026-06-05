# Bifrost v0.3.0 Release Notes

## Release focus

Bifrost v0.3.0 is the current pre-release documentation and product positioning refresh for the Linux-native desktop command center and Guardian backend.

This release documents Bifrost as it actually stands right now:

- an open-source AI-powered Linux Endpoint Detection and Response platform
- local AI inference through Ollama using `qwen2.5:1.5b-instruct`
- Arch Linux native desktop delivery via Tauri v2 + React
- systemd-managed Guardian backend
- real-world validation against live attackers

## Real-world stats

- **23,000+ events** captured from live attackers
- **64+ unique adversary IPs** tracked
- **6 actors** identified using **30+ IP masks** through Doppelgänger detection
- Real malware captured:
  - **Redtail cryptominer**
  - **mdrfckr SSH backdoor botnet**
  - **DNS tunneling C2**
- **Top attacker:** Iran — `91.40.62.224` with **3,964+ hits**

## Full feature set documented in v0.3.0

### Guardian

- Python backend
- Ingests from Cowrie honeypot, auditd, and process watcher
- Classifies every event with Ollama local AI
- Runs as a systemd service

### Desktop App

- Tauri v2 + React + TypeScript
- Arch Linux native
- Installable through pacman/AUR workflows

### User-facing surfaces

- **Overview** — total events, incidents, blocked %, unique attackers, timeline, recent incidents
- **Heimdall Speaks** — natural-language posture narration with time-range selector and chat panel
- **Incidents** — full incident log with severity, MITRE technique, attacker IP, action taken
- **Attackers** — adversary tracking with Doppelgänger detection via HASSH and JA4
- **Live Monitor** — real-time event stream
- **Timeline** — attack activity over time
- **MITRE ATT&CK** — mapped techniques with plain-English explanations
- **Analyst Matrix** — local AI inference panel with active model, response time, success rate, MITRE tags, and on-demand analysis
- **Settings** — mode selection, confidence threshold, dashboard preferences, password and biometric security support, personalization, Guardian status
- **Screensaver** — Rainbow Bridge or Ops Center mode
- **Marquee ticker** — model, RAM, CPU, uptime, active attackers, events today, blocked %
- **Personalized greeting** — optional casual operator greeting aware of time and threat level
- **Hidden BIFROST terminal** — advanced config, raw logs, ban/unban, and mode switching

### Defensive modules

- **Gjallarhorn** — multi-channel broadcaster for journald, desktop notifications, Discord/Slack webhook, Twilio SMS, and custom HTTP endpoints
- **Mjolnir** — deception trap system with fake AWS credentials, fake DB config, decoy SSH keys, and canary documents

## Install guidance

### Recommended

```bash
yay -S bifrost-bin
```

### Update

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

## Requirements

- Arch Linux
- Python 3.11+
- pnpm
- Rust/Cargo
- Ollama
- `qwen2.5:1.5b-instruct`

## Prerelease notes

- This is a **pre-release documentation hardening pass**
- Legacy or stale install messaging should be considered superseded by the current Arch/AUR-first guidance
- The desktop build documentation now reflects the current Vite/Tauri configuration and runtime behavior
- `vite.config.ts` already includes the Tauri asset-base fix with `base: "./"`
- Some repository screenshots may need a final verification pass before public release if the UI changed after capture

## Roadmap — v0.4.0

- Hofund AI companion
- WireGuard remote access integration
- GNI T-800 skull hardware integration
- Flathub submission
- Auto-updater via AUR
