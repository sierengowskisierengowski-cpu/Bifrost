# Bifrost — Arch Linux Installation Guide

> **One-download desktop install for Arch Linux.**
> After install you get a desktop/app-launcher icon, no terminal needed for normal use.

---

## What you get after install

| Item | Details |
|------|---------|
| Desktop icon | Appears in your app launcher (GNOME, KDE, XFCE, etc.) under *Utilities → Bifrost* |
| Launch | Click the icon — no terminal required |
| Guardian | Runs as a persistent background service by default |
| Tray icon | Bifrost sits in the system tray; right-click → *Quit Bifrost* to exit cleanly |
| Session-only mode | Optional — enable it in **Settings → Guardian Behavior** if you only want Guardian while the app is open |
| Config | `/etc/heimdall/heimdall_config.json` (created on install, never overwritten on upgrade) |
| Data / logs | `/var/lib/heimdall/` · `/var/log/heimdall/` |

---

## Step 1 — Download the package

Go to the [Releases page](https://github.com/sierengowskisierengowski-cpu/Bifrost/releases/latest) and download:

```
bifrost-0.3.0-1-x86_64.pkg.tar.zst
```

---

## Step 2 — Install with pacman

```bash
sudo pacman -U bifrost-0.3.0-1-x86_64.pkg.tar.zst
```

pacman will:
- install runtime dependencies (webkit2gtk, gtk3, Python, …) automatically
- place the desktop binary at `/usr/bin/bifrost`
- register the desktop entry → icon appears in your app launcher
- create default config at `/etc/heimdall/heimdall_config.json`
- install and start `bifrost-guardian.service` for persistent monitoring

---

## Step 3 — Launch Bifrost

Open your app launcher and click **Bifrost**, or run `bifrost` in a terminal.

The Bifrost dashboard opens. Guardian is already running in the background and stays active after you close the app window.

---

## Guardian: when does it run?

### Default behaviour (persistent background service)

```
Install Bifrost → Guardian service starts
Reboot machine → Guardian service starts again
Close app window → Guardian keeps running
```

This is the default and requires no extra configuration.

### Optional: session-only mode

If you only want Guardian while the desktop app is open, switch **Settings → Guardian Behavior → Session-only mode**.

In session-only mode:

```
Open app → Guardian runs
Close app → Guardian stops
Reboot machine → Guardian stays off until you open the app
```

### Service status

```bash
systemctl status bifrost-guardian.service
```

To start the persistent service manually:

```bash
sudo systemctl enable --now bifrost-guardian.service
```

> **Note:** The systemd service runs `bifrost-guardian` (the CLI wrapper at `/usr/bin/bifrost-guardian`), which uses the system Python installation and the bifrost source at `/usr/lib/bifrost/`. When session-only mode is enabled, the service stays enabled but exits immediately on boot so Guardian only runs with the desktop app.

---

## On reboot

- **Desktop app**: not auto-started on reboot by default. Launch from your app launcher when you want it.
- **Guardian**: auto-starts on reboot by default through `bifrost-guardian.service`, unless you have enabled session-only mode.

---

## Configuration

Edit `/etc/heimdall/heimdall_config.json` to configure Bifrost.

Key safety settings (all default to safe values):

| Setting | Default | Meaning |
|---------|---------|---------|
| `learning_mode` | `true` | Observe and log only — no alerts |
| `dry_run` | `true` | No enforcement actions |
| `autonomous_actions_enabled` | `false` | Fully manual |
| `confidence_threshold` | `0.85` | AI confidence required before flagging |

> Change these only when you are ready to operate in a more active mode.

---

## Upgrade

```bash
sudo pacman -U bifrost-<new-ver>-<rel>-x86_64.pkg.tar.zst
```

Your config at `/etc/heimdall/heimdall_config.json` is preserved (pacman marks it as a `.pacnew` if the default changes).

---

## Uninstall

```bash
sudo pacman -Rns bifrost
```

This removes the binary, desktop entry, Python source, and service unit. It does **not** remove:
- `/etc/heimdall/` (your config)
- `/var/lib/heimdall/` (your event database)
- `/var/log/heimdall/` (your logs)

Remove those manually if desired:

```bash
sudo rm -rf /etc/heimdall /var/lib/heimdall /var/log/heimdall
```

---

## Build from source (PKGBUILD)

If you prefer to build natively on your Arch system:

```bash
git clone https://github.com/sierengowskisierengowski-cpu/Bifrost.git
cd Bifrost/app/bifrost-desktop
makepkg -si
```

`makepkg` will install all build dependencies automatically and produce the same package.

---

## Tradeoffs and known gaps

| Item | Status |
|------|--------|
| Pre-built binary compatibility | Built on Ubuntu 22.04 (glibc 2.35). Tested on Arch Linux rolling release with compatible glibc (≥2.35). If you encounter library mismatches, build from source via PKGBUILD. |
| AUR submission | Not yet submitted. Use the direct download from Releases. |
| Autonomous response mode | Disabled by default (`dry_run: true`). Enable only in authorized environments. |
| eBPF / kernel telemetry | Requires root or `CAP_BPF`. The systemd service runs without a dedicated user by default; see `bifrost-guardian.service` drop-in docs to restrict privileges. |
