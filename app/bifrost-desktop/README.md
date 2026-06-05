# Bifrost Desktop

> Heimdall Never Sleeps.

Bifrost Desktop is the native Linux desktop command center for the Bifrost security stack.

It is built with:

- **Tauri v2**
- **React**
- **TypeScript**
- **Vite**

It connects to the local Guardian backend and presents the current Bifrost experience: overview metrics, incidents, attackers, live monitoring, MITRE mapping, Heimdall Speaks, settings, and full-screen display modes.

## Current runtime model

The desktop app is a native shell around the frontend and works with the local Guardian service.

Current known runtime details from this repository:

- frontend dev server runs on **port 5173**
- Guardian dashboard/API runs on **port 8766**
- `tauri.conf.json` uses:
  - `beforeDevCommand: pnpm dev`
  - `devUrl: http://localhost:5173`
  - `beforeBuildCommand: pnpm build`
  - `frontendDist: ../dist`
- `vite.config.ts` already includes the important Tauri asset fix:
  - `base: "./"`

## Build requirements

- Arch Linux
- pnpm
- Rust / Cargo
- Python 3.11+
- Ollama with `qwen2.5:1.5b-instruct`

If your environment prompts for native dependency approval, run:

```bash
pnpm approve-builds
```

before building.

## Install dependencies

```bash
pnpm install
```

## Development

```bash
pnpm desktop:dev
```

This starts the Vite frontend and opens the Tauri shell.

For frontend-only development:

```bash
pnpm dev
```

## Production build

```bash
pnpm tauri build
```

You can also use:

```bash
pnpm desktop:build
```

## Important prerelease note

The current `package.json` defines both:

- `desktop:build`: `tauri build`
- `tauri`: `tauri`

That means `pnpm tauri build` and `pnpm desktop:build` are both valid with the current repo state.

## Arch-first install path

The user-facing recommended install path for the desktop app is:

```bash
yay -S bifrost-bin
```

Update with:

```bash
yay -Syu
```

## What not to document here

This desktop README should stay aligned with the current prerelease packaging direction:

- no Windows instructions
- no macOS instructions
- no Docker install path for the desktop app
- no AppImage guidance
- no `.deb` guidance

## Notes

- The app is currently documented as **Arch Linux native first**
- `vite.config.ts` is already fixed for proper Tauri asset loading
- Any older docs implying different packaging targets should be treated as stale unless updated elsewhere in the repository
