#!/usr/bin/env bash
set -euo pipefail
umask 022

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${TMPDIR:-/tmp}/bifrost-monolithic-build"
PYI_DIR="${BUILD_DIR}/pyinstaller"
BIN_DIR="${ROOT_DIR}/app/bifrost-desktop/src-tauri/binaries"

log() {
  echo "[*] $*"
}

die() {
  echo "[!] $*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

detect_target_triple() {
  local triple=""
  if command -v rustc >/dev/null 2>&1; then
    triple="$(rustc -vV | awk -F': ' '/host:/ {print $2; exit}')"
  fi
  if [[ -z "${triple}" ]] && command -v gcc >/dev/null 2>&1; then
    triple="$(gcc -dumpmachine)"
  fi
  if [[ -z "${triple}" ]] && command -v cc >/dev/null 2>&1; then
    triple="$(cc -dumpmachine)"
  fi
  if [[ -z "${triple}" ]]; then
    local arch
    arch="$(uname -m)"
    case "${arch}" in
      x86_64) triple="x86_64-unknown-linux-gnu" ;;
      aarch64|arm64) triple="aarch64-unknown-linux-gnu" ;;
      *) triple="${arch}-unknown-linux-gnu" ;;
    esac
  fi
  echo "${triple}"
}

require_cmd go
require_cmd python3
require_cmd pnpm
python3 -m PyInstaller --version >/dev/null 2>&1 || \
  die "PyInstaller not found. Install with: python3 -m pip install pyinstaller"

TARGET_TRIPLE="$(detect_target_triple)"
[[ -n "${TARGET_TRIPLE}" ]] || die "Unable to determine target triple"
log "Using target triple: ${TARGET_TRIPLE}"

rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}" "${PYI_DIR}" "${BIN_DIR}"

export GOOS=linux
export GOARCH="$(go env GOARCH)"
export CGO_ENABLED=1
if [[ "${GOARCH}" == "amd64" && -z "${GOAMD64:-}" ]]; then
  export GOAMD64=v3
fi
export CGO_CFLAGS="${CGO_CFLAGS:-} -O2 -pipe -march=native"
export CGO_LDFLAGS="${CGO_LDFLAGS:-} -Wl,-O2"

GO_LDFLAGS="-s -w"

log "Building log agent router sidecar..."
go build -trimpath -buildvcs=false -ldflags "${GO_LDFLAGS}" \
  -o "${BUILD_DIR}/log_agent_router" \
  "${ROOT_DIR}/agent/main.go" \
  "${ROOT_DIR}/agent/collector.go" \
  "${ROOT_DIR}/agent/executor.go" \
  "${ROOT_DIR}/agent/safety.go" \
  "${ROOT_DIR}/agent/paths.go"

log "Building executor sidecar..."
EXECUTOR_MAIN="${BUILD_DIR}/executor_main.go"
cat > "${EXECUTOR_MAIN}" <<'EOF'
package main

func main() {
	startExecutor()
}
EOF

go build -trimpath -buildvcs=false -ldflags "${GO_LDFLAGS}" \
  -o "${BUILD_DIR}/executor" \
  "${EXECUTOR_MAIN}" \
  "${ROOT_DIR}/agent/executor.go" \
  "${ROOT_DIR}/agent/safety.go" \
  "${ROOT_DIR}/agent/paths.go"

log "Packaging guardian sidecar..."
PYI_DIST="${PYI_DIR}/dist"
PYI_WORK="${PYI_DIR}/build"
PYI_SPEC="${PYI_DIR}/spec"
python3 -m PyInstaller --clean --noconfirm --onefile --strip \
  --name guardian \
  --distpath "${PYI_DIST}" \
  --workpath "${PYI_WORK}" \
  --specpath "${PYI_SPEC}" \
  "${ROOT_DIR}/bifrost/guardian.py"

log "Installing sidecar binaries..."
install -m 755 "${BUILD_DIR}/log_agent_router" \
  "${BIN_DIR}/log_agent_router-${TARGET_TRIPLE}"
install -m 755 "${BUILD_DIR}/executor" \
  "${BIN_DIR}/executor-${TARGET_TRIPLE}"
install -m 755 "${PYI_DIST}/guardian" \
  "${BIN_DIR}/guardian-${TARGET_TRIPLE}"

log "Building Tauri installer..."
pushd "${ROOT_DIR}/app/bifrost-desktop" >/dev/null
pnpm install
if [[ -n "${RUSTFLAGS:-}" ]]; then
  export RUSTFLAGS="${RUSTFLAGS} -C target-cpu=native"
else
  export RUSTFLAGS="-C target-cpu=native"
fi
pnpm tauri build
popd >/dev/null

log "Monolithic package build complete."
