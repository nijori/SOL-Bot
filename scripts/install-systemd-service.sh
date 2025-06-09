#!/bin/bash

# SOL Trading Bot systemd service installation script
# Usage: sudo ./scripts/install-systemd-service.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Error: This script must be run as root (use sudo)${NC}"
   exit 1
fi

echo -e "${GREEN}Installing SOL Trading Bot systemd service...${NC}"

# Create solbot user if it doesn't exist
if ! id "solbot" &>/dev/null; then
    echo -e "${YELLOW}Creating solbot user...${NC}"
    useradd --system --shell /bin/false --home-dir /opt/solbot --create-home solbot
    echo -e "${GREEN}✓ Created solbot user${NC}"
else
    echo -e "${GREEN}✓ solbot user already exists${NC}"
fi

# Create necessary directories
echo -e "${YELLOW}Creating directories...${NC}"
mkdir -p /opt/solbot/{data,logs}
chown -R solbot:solbot /opt/solbot
echo -e "${GREEN}✓ Created directories${NC}"

# Copy service file
echo -e "${YELLOW}Installing systemd service file...${NC}"
cp infra/systemd/bot.service /etc/systemd/system/
chmod 644 /etc/systemd/system/bot.service
echo -e "${GREEN}✓ Installed bot.service${NC}"

# Reload systemd
echo -e "${YELLOW}Reloading systemd daemon...${NC}"
systemctl daemon-reload
echo -e "${GREEN}✓ Reloaded systemd daemon${NC}"

# Enable service (but don't start it yet)
echo -e "${YELLOW}Enabling bot.service...${NC}"
systemctl enable bot.service
echo -e "${GREEN}✓ Enabled bot.service${NC}"

echo -e "${GREEN}"
echo "=========================================="
echo "✓ SOL Trading Bot service installed!"
echo "=========================================="
echo -e "${NC}"
echo "Next steps:"
echo "1. Deploy your application to /opt/solbot/"
echo "2. Ensure Node.js is installed and available at /usr/bin/node"
echo "3. Start the service: sudo systemctl start bot"
echo "4. Check status: sudo systemctl status bot"
echo "5. View logs: sudo journalctl -u bot -f"
echo ""
echo -e "${YELLOW}Note: The service is enabled but not started yet.${NC}" 