<div align="center">

# Bifrost — AI-Powered Endpoint Detection & Response

**Version 0.3.0 | GowskiNet Security Lab | Joey Sierengowski**

[![Version](https://img.shields.io/badge/version-v0.3.0-purple)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()

*Heimdall Never Sleeps.*

</div>

## What is Bifrost?

Bifrost is an open-source, locally run endpoint detection and response platform focused on Linux security labs and authorized defense environments. It ingests host, honeypot, and network telemetry, performs local AI-assisted analysis, maps behavior to MITRE ATT&CK, and exposes a native desktop command center.

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

> Note: Gjallarhorn, Mjolnir, and Analyst Matrix are implemented backend modules and are referenced from the Guardian orchestration layer. Current UI surfaces their outputs through incident/live monitoring views rather than dedicated standalone pages.

## Operating Modes

- **Learning Mode:** observe and log only
- **Active Mode:** observe + alerting
- **Autonomous Mode:** observe + alert + defensive action when policy allows

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

### Option 1: Build from source

```bash
git clone https://github.com/sierengowskisierengowski-cpu/Bifrost.git
cd Bifrost
python3 -m pip install -r requirements.txt
```

Build the desktop app:

```bash
cd app/bifrost-desktop
pnpm install
pnpm tauri build
```

### Option 2: Download release binaries

If release binaries are published in GitHub Releases, download the Linux asset for `v0.3.0`, mark executable if required, and run it.

## Guardian Startup

From repository root:

```bash
python3 -m bifrost
```

Standalone Guardian service mode:

```bash
python3 -m bifrost.guardian --dashboard --dashboard-port 8766
```

## Packaging

Monolithic release packaging script:

```bash
./package_monolithic.sh
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
