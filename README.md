<div align="center">

# Bifrost — AI-Powered Endpoint Detection & Response

**Version 0.3.0 | GowskiNet Security Lab | Joey Sierengowski**

[![Version](https://img.shields.io/badge/version-v0.3.0-purple)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()

*Heimdall Never Sleeps.*

</div>

## What is Bifrost?

Bifrost is an open-source, locally run endpoint detection and response platform focused on Linux security labs and authorized defense environments. It ingests host, honeypot, and network telemetry, applies local AI-assisted analysis, and presents findings through a desktop command center backed by Guardian.

## Purpose

Bifrost is built for operators who want local-first security telemetry and response logic without shipping data to cloud services.

## How It's Built

- **Guardian (Python):** ingestion, detection, policy gating, and local APIs
- **Desktop App (Tauri v2 + React + TypeScript):** Norse rainbow bridge themed dashboard
- **AI Inference (Ollama):** local model execution and MITRE ATT&CK mapping
- **Storage:** local SQLite event database

## Core Modules

- **Guardian:** main watchdog process and orchestration layer
- **Gjallarhorn (`bifrost/gjallarhorn.py`):** alert dispatch integration (webhook/SMS fallback paths)
- **Mjolnir (`bifrost/mjolnir.py`):** active deception asset deployment helpers
- **Analyst Matrix (`bifrost/analyst_matrix.py`):** model tier selection by RAM + structured AI analysis

> Note: Gjallarhorn, Mjolnir, and Analyst Matrix are implemented backend modules and are referenced from the Guardian orchestration layer. Current UI surfaces their outputs through incident/live monitoring workflows.

## Operating Modes

- **Learning Mode:** observe and log only
- **Active Mode:** observe + alerting
- **Autonomous Mode:** observe + alert + defensive action when policy allows

## Production Validation Stats

- v0.3.0 validation assets and screenshots are being finalized before public release.
- Repository documentation reflects the audited pre-release desktop/guardian packaging flow.
- Screenshot refresh remains pending Joey's validated capture set.

## Key Features

- Norse rainbow bridge dashboard (Tauri desktop app)
- Three operating modes: Learning, Active, Autonomous
- Local Ollama inference
- Guardian agent supervision (CLI and desktop)
- MITRE ATT&CK mapping in analysis pipeline
- Live monitoring and incident tracking
- Gjallarhorn / Mjolnir / Analyst Matrix module support

## Tech Stack

- Python 3.11+
- Tauri v2, React 19, TypeScript, Vite
- Rust + Cargo
- Go sidecars
- SQLite
- Ollama

## Requirements

- Linux environment
- Python 3.11+
- Node.js 18+ and pnpm
- Rust + Cargo
- Go 1.21+
- Ollama with at least one model installed

## Installation

### Arch Linux — One-Download Install (Recommended)

Download the pre-built Arch package from [GitHub Releases](https://github.com/sierengowskisierengowski-cpu/Bifrost/releases/latest):

```bash
# Download the latest .pkg.tar.zst from the Releases page, then:
sudo pacman -U bifrost-0.3.0-1-x86_64.pkg.tar.zst
```

After install:
- **Bifrost appears in your app launcher** (no terminal needed for normal use)
- Click the **Bifrost** icon to open the dashboard
- **Guardian runs as a persistent background service by default**
- **Guardian auto-starts on boot** unless you switch to session-only mode in Settings

> See [docs/arch-install.md](docs/arch-install.md) for the complete installation guide, Guardian persistence details, and upgrade instructions.

### Option 2: Build from source (Arch)

```bash
git clone https://github.com/sierengowskisierengowski-cpu/Bifrost.git
cd Bifrost/app/bifrost-desktop
makepkg -si
```

### Option 3: Build the desktop app manually

```bash
git clone https://github.com/sierengowskisierengowski-cpu/Bifrost.git
cd Bifrost
python3 -m pip install -r requirements.txt
cd app/bifrost-desktop
pnpm install
pnpm tauri build
```

## Guardian Lifecycle

**Default desktop behavior:** Guardian runs as a persistent background service, so monitoring stays active even when the app window is closed.

**Session-only mode:** In **Settings → Guardian Behavior**, enable **Session-only mode** to stop Guardian when the app closes and skip persistent background startup on reboot.

**Standalone mode (terminal):**

```bash
python3 -m bifrost.guardian --dashboard --dashboard-port 8766
```

Or if installed via pacman:

```bash
bifrost-guardian --dashboard --dashboard-port 8766
```

**Persistent background service (default):**

```bash
sudo systemctl enable --now bifrost-guardian.service
```

Guardian runs at boot and continues running even when the desktop app is closed unless you switch to session-only mode in Settings.

## Packaging

### Arch Linux package (CI-produced)

The release workflow automatically builds `bifrost-<ver>-<rel>-x86_64.pkg.tar.zst` using `scripts/create-arch-pkg.sh`. This package is uploaded to GitHub Releases on every push to `main`.

### Manual monolithic build (produces sidecar binaries + Tauri binary)

```bash
./package_monolithic.sh
```

### Create Arch package from local build

```bash
./package_monolithic.sh          # build everything first
scripts/create-arch-pkg.sh       # then package for Arch
```

## Screenshots

Repository screenshots are placeholders and need refresh for v0.3.0.

- **TODO (release media):** replace dashboard screenshots after app validation.
- **Owner note:** Joey will provide updated screenshots after validation.

## Configuration

Bifrost reads config from `/etc/heimdall/heimdall_config.json` or `~/.config/bifrost/config.json`.

Important safety settings:

- `learning_mode` (default `true`)
- `dry_run` (default `true`)
- `autonomous_actions_enabled` (default `false`)
- `confidence_threshold` (default `0.85`)

## Legal Disclaimer

Bifrost is for authorized defensive use only. You are responsible for lawful deployment and for reviewing autonomous-response behavior before enabling enforcement modes.

## License

MIT License — see `LICENSE`.
