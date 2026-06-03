#!/usr/bin/env bash
set -euo pipefail

LINUXDEPLOY_URL="https://github.com/linuxdeploy/linuxdeploy/releases/download/continuous/linuxdeploy-x86_64.AppImage"
TOOLS_DIR="${HOME}/.local/bin"
LINUXDEPLOY_APPIMAGE="${TOOLS_DIR}/linuxdeploy.AppImage"
LINUXDEPLOY_WRAPPER="${TOOLS_DIR}/linuxdeploy"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[!] Missing required dependency: $1" >&2
    return 1
  fi
}

mkdir -p "${TOOLS_DIR}"

if [[ ! -x "${LINUXDEPLOY_APPIMAGE}" ]]; then
  echo "[*] Downloading linuxdeploy AppImage to ${LINUXDEPLOY_APPIMAGE}"
  curl -fsSL "${LINUXDEPLOY_URL}" -o "${LINUXDEPLOY_APPIMAGE}"
  chmod +x "${LINUXDEPLOY_APPIMAGE}"
fi

cat > "${LINUXDEPLOY_WRAPPER}" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
APPIMAGE_EXTRACT_AND_RUN=1 exec "${HOME}/.local/bin/linuxdeploy.AppImage" "$@"
EOF
chmod +x "${LINUXDEPLOY_WRAPPER}"

need_cmd patchelf
need_cmd desktop-file-validate
if ! command -v appstreamcli >/dev/null 2>&1 && ! command -v appstream-util >/dev/null 2>&1; then
  echo "[!] Missing appstreamcli/appstream-util (install appstream)" >&2
  exit 1
fi

if ! "${LINUXDEPLOY_WRAPPER}" --version >/dev/null 2>&1; then
  echo "[!] linuxdeploy wrapper failed. Try removing ~/.local/bin/linuxdeploy* and rerun." >&2
  exit 1
fi

echo "[+] AppImage prerequisites look good."
echo "[+] Using linuxdeploy wrapper: ${LINUXDEPLOY_WRAPPER}"
