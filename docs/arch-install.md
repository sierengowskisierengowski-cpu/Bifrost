# Bifrost — Arch Linux Install & Runtime Guide

Bifrost is an **open-source AI-powered Linux EDR** built for Arch Linux:
- **Guardian** = Python backend service
- **Desktop app** = Tauri v2 + React
- **Local AI** = Ollama with `qwen2.5:1.5b-instruct`
- **Validation posture** = built and tested against real attackers

## Primary install path (recommended)

```bash
yay -S bifrost-bin
```

## Secondary path (build from source)

```bash
git clone https://github.com/sierengowskisierengowski-cpu/Bifrost.git
cd Bifrost/app/bifrost-desktop
pnpm install
pnpm tauri build
```

If `pnpm` prompts for blocked native build steps, run:

```bash
pnpm approve-builds
```

## Runtime defaults

- Guardian service/API dashboard: `127.0.0.1:8766`
- Vite dev server: `http://127.0.0.1:5173`
- Vite asset base: `"./"`

## Developer commands

From `app/bifrost-desktop`:

```bash
pnpm dev
pnpm desktop:dev
pnpm build
pnpm desktop:build
pnpm tauri build
```

## Guardian service behavior

Guardian runs as `bifrost-guardian.service` in persistent mode by default.

Check status:

```bash
systemctl status bifrost-guardian.service
```

Enable/start manually:

```bash
sudo systemctl enable --now bifrost-guardian.service
```

## Configuration and data

- Config: `/etc/heimdall/heimdall_config.json`
- Data: `/var/lib/heimdall/`
- Logs: `/var/log/heimdall/`

Safe defaults:
- `learning_mode: true`
- `dry_run: true`
- `autonomous_actions_enabled: false`
- `confidence_threshold: 0.85`

## Upgrade

```bash
yay -Syu
```

## Uninstall

```bash
sudo pacman -Rns bifrost-bin
```

Optional full cleanup:

```bash
sudo rm -rf /etc/heimdall /var/lib/heimdall /var/log/heimdall
```
