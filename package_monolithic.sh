#!/usr/bin/env bash
# Bifrost Monolithic Packaging Engine

TARGET_TRIPLET="x86_64-unknown-linux-gnu"
BIN_DIR="./app/bifrost-desktop/src-tauri/binaries"
mkdir -p "$BIN_DIR"

echo "[*] Compiling Go high-speed agent sidecar..."
GOOS=linux GOARCH=amd64 go build -o "$BIN_DIR/log_agent_router-$TARGET_TRIPLET" ./agent/main.go

echo "[*] Compiling Go mitigation executor sidecar..."
GOOS=linux GOARCH=amd64 go build -o "$BIN_DIR/executor-$TARGET_TRIPLET" ./agent/executor.go

echo "[*] Packaging Python Guardian binary via PyInstaller..."
pip install pyinstaller --quiet --break-system-packages 2>/dev/null || pip install pyinstaller --quiet
pyinstaller --onefile --distpath "$BIN_DIR" --name "guardian-$TARGET_TRIPLET" ./bifrost/guardian.py

echo "[*] Executing monolithic Tauri distribution build..."
cd ./app/bifrost-desktop
pnpm install
pnpm tauri build
