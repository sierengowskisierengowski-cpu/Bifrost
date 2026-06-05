#!/usr/bin/env bash
# Package an already-built Bifrost binary into the release tarball that the
# bifrost-bin AUR package downloads, then refresh the PKGBUILD checksum and
# regenerate .SRCINFO.
#
# Run this AFTER `pnpm tauri build` has produced the release binary.
#
# Usage:
#   ./packaging/package-release.sh
#
# Output:
#   packaging/dist/bifrost-<version>-x86_64.tar.gz   <- upload to the GitHub Release
#   aur/PKGBUILD + aur/.SRCINFO updated              <- commit & push to the AUR
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
AUR_DIR="$SCRIPT_DIR/aur"
DIST_DIR="$SCRIPT_DIR/dist"

TAURI_CONF="$DESKTOP_DIR/src-tauri/tauri.conf.json"
BIN="$DESKTOP_DIR/src-tauri/target/release/bifrost"
ICON="$DESKTOP_DIR/src-tauri/icons/icon.png"
DESKTOP_FILE="$AUR_DIR/bifrost-bin.desktop"
PKGBUILD="$AUR_DIR/PKGBUILD"

# Read the version straight out of tauri.conf.json (no jq dependency).
VER="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$TAURI_CONF" | head -n1)"
if [[ -z "$VER" ]]; then
        echo "error: could not read version from $TAURI_CONF" >&2
        exit 1
fi

if [[ ! -x "$BIN" ]]; then
        echo "error: built binary not found at $BIN" >&2
        echo "       run 'pnpm tauri build' in $DESKTOP_DIR first." >&2
        exit 1
fi

# Guard against a partial bump: the PKGBUILD release URL must point at the same
# version we are about to build a tarball for.
PKGVER="$(sed -n 's/^pkgver=\(.*\)/\1/p' "$PKGBUILD" | head -n1)"
if [[ "$PKGVER" != "$VER" ]]; then
        echo "error: version mismatch — tauri.conf.json is '$VER' but PKGBUILD pkgver is '$PKGVER'." >&2
        echo "       run ./packaging/bump-version.sh $VER first." >&2
        exit 1
fi

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

install -Dm755 "$BIN" "$STAGE/bifrost"
install -Dm644 "$DESKTOP_FILE" "$STAGE/bifrost-bin.desktop"
install -Dm644 "$ICON" "$STAGE/bifrost.png"

mkdir -p "$DIST_DIR"
TARBALL="$DIST_DIR/bifrost-${VER}-x86_64.tar.gz"
tar -czf "$TARBALL" -C "$STAGE" bifrost bifrost-bin.desktop bifrost.png

SHA="$(sha256sum "$TARBALL" | awk '{print $1}')"
sed -i "s/^sha256sums=.*/sha256sums=('$SHA')/" "$PKGBUILD"

# Regenerate .SRCINFO from the PKGBUILD. A stale .SRCINFO is a common AUR
# publish failure, so treat a missing makepkg as a hard error.
if ! command -v makepkg >/dev/null 2>&1; then
        echo "error: makepkg not found — run this on Arch so .SRCINFO can be regenerated." >&2
        exit 1
fi
( cd "$AUR_DIR" && makepkg --printsrcinfo > .SRCINFO )
echo "Regenerated $AUR_DIR/.SRCINFO"

echo
echo "Release v$VER packaged:"
echo "  tarball : $TARBALL"
echo "  sha256  : $SHA"
echo
echo "Next:"
echo "  1) Create GitHub Release 'v$VER' and upload: $TARBALL"
echo "  2) Copy PKGBUILD + .SRCINFO into your AUR clone and:"
echo "       git commit -am 'bifrost-bin $VER' && git push"
echo "  3) On your machine: yay -Syu   (picks up the new version)"
