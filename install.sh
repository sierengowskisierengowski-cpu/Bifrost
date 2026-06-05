#!/usr/bin/env bash
# Bifrost legacy installer helper (internal/advanced use)
# Primary user install path is: yay -S bifrost-bin
# This script preserves the older source-based service wiring flow.
# Usage: sudo bash install.sh

set -e

BIFROST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="/etc/systemd/system"
USER="${SUDO_USER:-nyx}"

echo "╔══════════════════════════════════════════╗"
echo "║     BIFROST LEGACY INSTALLER HELPER      ║"
echo "║   Prefer: yay -S bifrost-bin             ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Check root
if [[ $EUID -ne 0 ]]; then
    echo "[!] Run with sudo: sudo bash install.sh"
    exit 1
fi

echo "[*] Installing Python dependencies..."
pip install --break-system-packages --quiet \
    psutil openai requests paho-mqtt anthropic fastapi uvicorn pydantic

echo "[*] Building legacy Go collector..."
cd "$BIFROST_DIR/agent"
if command -v go &> /dev/null; then
    go build -o bifrost-agent .
    echo "[+] Legacy Go collector built."
else
    echo "[!] Go not found. Install Go first: sudo pacman -S go"
    exit 1
fi

echo "[*] Installing systemd services..."
cd "$BIFROST_DIR"

if [[ ! -f /etc/heimdall/bifrost_tokens.env ]]; then
    echo "[!] Token file missing. Run 'python setup.py' first, then:"
    echo "    sudo cp /etc/heimdall/bifrost_tokens.env /etc/heimdall/ 2>/dev/null || true"
    echo "    (setup.py writes tokens to your config directory)"
fi

# Update service files with correct user and paths
sed -i "s|User=nyx|User=$USER|g" bifrost-guardian.service
sed -i "s|Group=nyx|Group=$USER|g" bifrost-guardian.service
sed -i "s|/home/nyx|/home/$USER|g" bifrost-guardian.service
sed -i "s|User=nyx|User=$USER|g" bifrost-agent.service
sed -i "s|Group=nyx|Group=$USER|g" bifrost-agent.service
sed -i "s|/home/nyx|/home/$USER|g" bifrost-agent.service

cp bifrost-guardian.service "$SERVICE_DIR/"
cp bifrost-agent.service "$SERVICE_DIR/"

echo "[*] Creating required directories..."
mkdir -p /var/log/heimdall
mkdir -p /var/lib/heimdall/quarantine
mkdir -p /var/lib/heimdall
mkdir -p /etc/heimdall
chown -R "$USER:$USER" /var/log/heimdall
chown -R "$USER:$USER" /var/lib/heimdall
chown -R "$USER:$USER" /etc/heimdall
chmod 750 /var/log/heimdall
chmod 700 /var/lib/heimdall
chmod 700 /var/lib/heimdall/quarantine
chmod 750 /etc/heimdall

echo "[*] Reloading systemd..."
systemctl daemon-reload

echo "[*] Enabling services..."
systemctl enable bifrost-guardian.service
systemctl enable bifrost-agent.service

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         BIFROST INSTALLED                ║"
echo "║                                          ║"
echo "║  Run setup first:                        ║"
echo "║    python setup.py                       ║"
echo "║                                          ║"
echo "║  Then start:                             ║"
echo "║    sudo systemctl start bifrost-guardian ║"
echo "║    sudo systemctl start bifrost-agent    ║"
echo "║                                          ║"
echo "║  Check status:                           ║"
echo "║    sudo systemctl status bifrost-guardian║"
echo "║    journalctl -u bifrost-guardian -f     ║"
echo "║                                          ║"
echo "║  Heimdall Never Sleeps.                  ║"
echo "╚══════════════════════════════════════════╝"
