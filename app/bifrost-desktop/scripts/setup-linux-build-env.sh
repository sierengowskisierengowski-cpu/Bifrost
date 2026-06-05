#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root (for example: sudo $0)" >&2
  exit 1
fi

pacman -S --noconfirm webkit2gtk-4.1 gtk3 base-devel libayatana-appindicator fuse2
echo "Linux build dependencies installed for Tauri desktop builds."
