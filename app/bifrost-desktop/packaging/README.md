# Bifrost release & AUR auto-update

This is the **Arch-correct** way to "push an update and have the app update
itself." On Arch, updates go through `pacman`/an AUR helper — not a built-in
self-updater. So the flow is: publish a new version → update the `bifrost-bin`
AUR package → `yay -Syu` on your machine pulls it in.

## One-time setup

Publish the `bifrost-bin` package to the AUR once:

```bash
git clone ssh://aur@aur.archlinux.org/bifrost-bin.git
cp packaging/aur/PKGBUILD packaging/aur/.SRCINFO bifrost-bin/
cp packaging/aur/bifrost-bin.desktop bifrost-bin/   # if AUR build needs it
cd bifrost-bin && git add -A && git commit -m 'initial bifrost-bin' && git push
```

After that, anyone (including you) can install with `yay -S bifrost-bin`.

## Every release

From `bifrost-desktop/`:

```bash
# 1. Bump the version everywhere (package.json, tauri.conf.json, Cargo.toml, PKGBUILD)
./packaging/bump-version.sh 0.3.1

# 2. Build the desktop binary
pnpm install
pnpm tauri build

# 3. Package the binary + refresh the PKGBUILD checksum and .SRCINFO
./packaging/package-release.sh
```

`package-release.sh` writes `packaging/dist/bifrost-<version>-x86_64.tar.gz` and
updates `packaging/aur/PKGBUILD` (`sha256sums`) and `packaging/aur/.SRCINFO`.

Then:

1. On GitHub, create a Release tagged `v0.3.1` and **upload that tarball** as an
   asset (the PKGBUILD downloads it from
   `releases/download/v0.3.1/bifrost-0.3.1-x86_64.tar.gz`).
2. Copy the updated `PKGBUILD` + `.SRCINFO` into your AUR clone, then
   `git commit` and `git push`.
3. On any machine: `yay -Syu` (or `paru -Syu`) installs the new version.

## Notes

- This packages a **pre-built binary** (`-bin` convention), so users don't
  recompile Rust — they just download your release.
- The tarball contains exactly three files: `bifrost` (binary),
  `bifrost-bin.desktop`, and `bifrost.png`. The PKGBUILD's `package()` and
  `package-release.sh`'s staging must always agree on those names.
- The runtime deps (`webkit2gtk-4.1`, `gtk3`, `libayatana-appindicator`) match a
  standard Tauri 2 app with the tray-icon feature. If a future Tauri upgrade
  changes the WebKit version, update `depends` in the PKGBUILD.
- The Python Guardian backend is separate and can be installed alongside this
  desktop package; it is not bundled in this package.
