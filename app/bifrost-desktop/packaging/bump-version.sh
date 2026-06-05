#!/usr/bin/env bash
# Bump the Bifrost version in lockstep across every file that tracks it.
#
# Usage:
#   ./packaging/bump-version.sh 0.3.1
#
# After running this, build the app (see packaging/README.md), then run
# packaging/package-release.sh to produce the release tarball + refresh the
# PKGBUILD checksum and .SRCINFO.
set -euo pipefail

if [[ $# -ne 1 ]]; then
	echo "usage: $0 <new-version>   (e.g. $0 0.3.1)" >&2
	exit 1
fi

NEW="$1"
if ! [[ "$NEW" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
	echo "error: version must look like X.Y.Z (got '$NEW')" >&2
	exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
AUR_DIR="$SCRIPT_DIR/aur"

PKG_JSON="$DESKTOP_DIR/package.json"
TAURI_CONF="$DESKTOP_DIR/src-tauri/tauri.conf.json"
CARGO_TOML="$DESKTOP_DIR/src-tauri/Cargo.toml"
PKGBUILD="$AUR_DIR/PKGBUILD"

# package.json — first "version": "..."
sed -i "0,/\"version\": \"[^\"]*\"/s//\"version\": \"$NEW\"/" "$PKG_JSON"
# tauri.conf.json — first "version": "..."
sed -i "0,/\"version\": \"[^\"]*\"/s//\"version\": \"$NEW\"/" "$TAURI_CONF"
# Cargo.toml — first version = "..." (the [package] one)
sed -i "0,/^version = \"[^\"]*\"/s//version = \"$NEW\"/" "$CARGO_TOML"
# PKGBUILD — pkgver + reset pkgrel
sed -i "s/^pkgver=.*/pkgver=$NEW/" "$PKGBUILD"
sed -i "s/^pkgrel=.*/pkgrel=1/" "$PKGBUILD"

echo "Bumped to $NEW in:"
echo "  - $PKG_JSON"
echo "  - $TAURI_CONF"
echo "  - $CARGO_TOML"
echo "  - $PKGBUILD (pkgrel reset to 1)"
echo
echo "Next:"
echo "  1) cd $DESKTOP_DIR && pnpm install && pnpm tauri build"
echo "  2) ./packaging/package-release.sh"
