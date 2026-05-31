#!/usr/bin/env bash
set -euo pipefail

LINUXDEPLOY_URL="https://github.com/linuxdeploy/linuxdeploy/releases/download/continuous/linuxdeploy-x86_64.AppImage"
LINUXDEPLOY_SHA256_URL="${LINUXDEPLOY_URL}.sha256"
LINUXDEPLOY_BIN="/usr/local/bin/linuxdeploy"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root (for example: sudo $0)" >&2
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1 || [[ ! -f /etc/debian_version ]]; then
  echo "This script supports Debian/Ubuntu systems with apt-get." >&2
  exit 1
fi

apt-get update
apt-get install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libglib2.0-dev \
  patchelf

if [[ ! -x "${LINUXDEPLOY_BIN}" ]]; then
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "${tmp_dir}"' EXIT

  wget -O "${tmp_dir}/linuxdeploy" "${LINUXDEPLOY_URL}"
  wget -O "${tmp_dir}/linuxdeploy.sha256" "${LINUXDEPLOY_SHA256_URL}"
  expected_sha="$(awk '{print $1}' "${tmp_dir}/linuxdeploy.sha256")"
  actual_sha="$(sha256sum "${tmp_dir}/linuxdeploy" | awk '{print $1}')"

  if [[ -z "${expected_sha}" || "${expected_sha}" != "${actual_sha}" ]]; then
    echo "linuxdeploy checksum verification failed." >&2
    exit 1
  fi

  install -Dm755 "${tmp_dir}/linuxdeploy" "${LINUXDEPLOY_BIN}"
fi

echo "Linux build dependencies installed. linuxdeploy path: ${LINUXDEPLOY_BIN}"
