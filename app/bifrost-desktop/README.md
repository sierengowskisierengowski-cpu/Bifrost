# Bifrost Desktop

> Heimdall Never Sleeps.

A native desktop wrapper for the **Bifrost** security dashboard, built with
[Tauri v2](https://tauri.app). On launch it starts a local **Python guardian**
process; on exit it shuts the guardian down. The React frontend polls the
guardian's HTTP API at `http://127.0.0.1:8766` and falls back to mock data when
the guardian is unavailable.

---

## What's inside

```
bifrost-desktop/
├── index.html              # Vite entry
├── package.json            # frontend + Tauri CLI scripts
├── vite.config.ts          # base "./" so assets load over the tauri:// protocol
├── tsconfig.json
├── public/favicon.svg
├── src/                    # the full React + TypeScript frontend
└── src-tauri/              # the native Rust shell
    ├── Cargo.toml
    ├── build.rs
    ├── tauri.conf.json     # window, bundle targets [appimage], withGlobalTauri
    ├── capabilities/       # window + shell + notification permissions
    ├── icons/              # app icons
    └── src/
        ├── main.rs         # thin entry → bifrost_lib::run()
        └── lib.rs          # guardian process supervision + tray + commands
```

### Guardian lifecycle (Rust → Python)

`src-tauri/src/lib.rs` owns the guardian process:

- **start** automatically in `setup()` when the app launches.
- **stop** automatically on window close, tray "Quit", and app exit.
- Exposes four commands the frontend calls over `window.__TAURI__`:
  - `start_guardian` → `bool`
  - `stop_guardian` → `bool`
  - `guardian_status` → `bool` (true while the process is alive)
  - `get_guardian_port` → `number` (8766)

**Where the guardian entry is found** (first match wins):

1. `BIFROST_GUARDIAN` environment variable — absolute path to a script or binary.
2. Bundled resource: `<resources>/guardian/guardian` (preferred) or `guardian.py`.
3. Next to the executable: `<exe dir>/guardian/guardian` (preferred) or `guardian.py`.

The interpreter defaults to `python3` (override with `BIFROST_PYTHON`) for `.py`
entries. Binary guardians are launched directly with `--port 8766`.

> Bring your own guardian: drop your Python program at one of the paths above,
> or point `BIFROST_GUARDIAN` at it before launching.

---

## Prerequisites (Linux)

Install the Tauri system dependencies (Arch Linux):

```bash
sudo ./scripts/setup-linux-build-env.sh
```

This installs WebKit/GTK and other native libraries required by Tauri on Arch.
It also installs `patchelf`, `desktop-file-utils`, and `appstream` used by the
AppImage toolchain.

Then install the toolchains:

- **Rust** (stable): https://rustup.rs
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```
- **Node.js 18+** and **pnpm 11**:
  ```bash
  npm install -g pnpm@11
  ```

---

## Develop

```bash
pnpm install
pnpm desktop:dev      # = tauri dev (starts Vite on :5173 + the native window)
```

`pnpm dev` alone runs just the web frontend in a browser (mock-data mode).

## Build the AppImage

```bash
pnpm install
pnpm desktop:preflight
APPIMAGE_EXTRACT_AND_RUN=1 pnpm tauri build --bundles appimage
```

`desktop:preflight` installs/validates a linuxdeploy wrapper at
`~/.local/bin/linuxdeploy` that uses AppImage extract-and-run mode. This avoids
the common `failed to run linuxdeploy` failure on systems where FUSE is not
available at bundle time.

Artifact:

- `src-tauri/target/release/bundle/appimage/*.AppImage`

## Icons

The repo ships a generated icon set in `src-tauri/icons/`. The master vector
source is `src-tauri/icons/icon.svg`. To regenerate the raster/icon bundle:

```bash
pnpm tauri icon src-tauri/icons/icon.svg
```

This will refresh the platform assets (including `icon.ico` and `icon.icns`)
that Tauri bundles into the desktop installers.

---

## Notes

- The window is **frameless** (`decorations: false`); the in-app title bar
  provides minimize / maximize / close via Tauri window commands.
- `withGlobalTauri` is enabled, so the frontend talks to the runtime through
  `window.__TAURI__` with no extra npm SDK dependency.
- In a plain browser (no Tauri runtime) every native call no-ops safely and the
  dashboard runs on mock data — handy for frontend-only iteration.
- For reproducible desktop builds, commit `pnpm-lock.yaml`, prefer fixed Rust
  toolchains (for example via `rust-toolchain.toml`), and run
  `pnpm desktop:preflight` before AppImage bundling.
