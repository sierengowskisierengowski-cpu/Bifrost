#!/usr/bin/env bash
# create-arch-pkg.sh
# Constructs a binary Arch Linux package (.pkg.tar.zst) from pre-built artifacts.
#
# Run AFTER package_monolithic.sh has successfully built the Tauri desktop
# binary. The resulting .pkg.tar.zst can be installed on Arch Linux with:
#   sudo pacman -U bifrost-<ver>-<rel>-x86_64.pkg.tar.zst
#
# No Arch toolchain is required; only GNU tar (or bsdtar) and zstd.

set -euo pipefail
umask 022

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCH=x86_64

# Read version metadata from the canonical PKGBUILD to avoid drift
PKGBUILD="${ROOT_DIR}/app/bifrost-desktop/PKGBUILD"
if [[ -f "${PKGBUILD}" ]]; then
  PKGNAME="$(grep -m1 '^pkgname=' "${PKGBUILD}" | cut -d= -f2)"
  PKGVER="$(grep -m1 '^pkgver=' "${PKGBUILD}" | cut -d= -f2)"
  PKGREL="$(grep -m1 '^pkgrel=' "${PKGBUILD}" | cut -d= -f2)"
else
  echo "[!] PKGBUILD not found at ${PKGBUILD}" >&2
  exit 1
fi

BINARY="${ROOT_DIR}/app/bifrost-desktop/src-tauri/target/release/bifrost"
ICON="${ROOT_DIR}/app/bifrost-desktop/src-tauri/icons/128x128@2x.png"
DESKTOP="${ROOT_DIR}/app/bifrost-desktop/bifrost.desktop"
INSTALL_SCRIPT="${ROOT_DIR}/app/bifrost-desktop/bifrost.install"
SERVICE="${ROOT_DIR}/bifrost-guardian.service"
CONFIG_DEFAULT="${ROOT_DIR}/packaging/heimdall_config.json.default"

# ─── Sanity checks ────────────────────────────────────────────────────────────
for f in "${BINARY}" "${ICON}" "${DESKTOP}" "${INSTALL_SCRIPT}" "${SERVICE}" "${CONFIG_DEFAULT}"; do
  [[ -f "${f}" ]] || { echo "[!] Missing: ${f}" >&2; exit 1; }
done
command -v zstd >/dev/null 2>&1 || { echo "[!] zstd not found. Install with: apt-get install zstd" >&2; exit 1; }

# ─── Build staging directory ──────────────────────────────────────────────────
PKG_STAGE="$(mktemp -d)"
trap 'rm -rf "${PKG_STAGE}"' EXIT

# Desktop binary
install -Dm755 "${BINARY}" "${PKG_STAGE}/usr/bin/bifrost"

# Python source (for the bifrost-guardian CLI companion)
install -dm755 "${PKG_STAGE}/usr/lib/bifrost"
cp -r "${ROOT_DIR}/bifrost" "${PKG_STAGE}/usr/lib/bifrost/bifrost"
cp -r "${ROOT_DIR}/heimdall" "${PKG_STAGE}/usr/lib/bifrost/heimdall"

# bifrost-guardian: shell wrapper that runs guardian via system Python
install -Dm755 /dev/stdin "${PKG_STAGE}/usr/bin/bifrost-guardian" <<'EOF'
#!/bin/bash
export PYTHONPATH=/usr/lib/bifrost${PYTHONPATH:+:$PYTHONPATH}
export HEIMDALL_CONFIG_PATH="${HEIMDALL_CONFIG_PATH:-/etc/heimdall/heimdall_config.json}"
exec python3 -m bifrost.guardian "$@"
EOF

# Default config (installed once on first install, never overwritten on upgrade)
install -dm755 "${PKG_STAGE}/etc/heimdall"
install -Dm644 "${CONFIG_DEFAULT}" "${PKG_STAGE}/etc/heimdall/heimdall_config.json"

# Runtime data / log directories (empty; created on install)
install -dm755 "${PKG_STAGE}/var/lib/heimdall"
install -dm755 "${PKG_STAGE}/var/log/heimdall"

# Desktop integration
install -Dm644 "${DESKTOP}" "${PKG_STAGE}/usr/share/applications/bifrost.desktop"
install -Dm644 "${ICON}"    "${PKG_STAGE}/usr/share/icons/hicolor/256x256/apps/bifrost.png"

# Systemd service (optional; NOT auto-enabled on install)
install -Dm644 "${SERVICE}" "${PKG_STAGE}/usr/lib/systemd/system/bifrost-guardian.service"

# ─── .PKGINFO ─────────────────────────────────────────────────────────────────
INSTALLED_SIZE="$(du -sb "${PKG_STAGE}" | awk '{print $1}')"
BUILDDATE="$(date +%s)"

cat > "${PKG_STAGE}/.PKGINFO" <<PKGINFO
pkgname = ${PKGNAME}
pkgbase = ${PKGNAME}
pkgver = ${PKGVER}-${PKGREL}
pkgdesc = Bifrost AI-powered EDR — Heimdall Never Sleeps.
url = https://github.com/sierengowskisierengowski-cpu/Bifrost
builddate = ${BUILDDATE}
packager = Bifrost CI <ci@bifrost>
size = ${INSTALLED_SIZE}
arch = ${ARCH}
license = MIT
depend = webkit2gtk-4.1
depend = gtk3
depend = libayatana-appindicator
depend = python
depend = python-pydantic
depend = python-openai
depend = python-requests
depend = python-psutil
PKGINFO

# ─── .INSTALL hooks ───────────────────────────────────────────────────────────
cp "${INSTALL_SCRIPT}" "${PKG_STAGE}/.INSTALL"

# ─── Create the archive ───────────────────────────────────────────────────────
OUTFILE="${ROOT_DIR}/${PKGNAME}-${PKGVER}-${PKGREL}-${ARCH}.pkg.tar.zst"

(
  cd "${PKG_STAGE}"
  tar --zstd -cf "${OUTFILE}" .PKGINFO .INSTALL usr etc var
)

echo "[*] Arch package created: ${OUTFILE}"
echo "    Install with: sudo pacman -U '${OUTFILE}'"
