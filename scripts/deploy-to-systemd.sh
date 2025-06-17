#!/bin/bash

# SOL Trading Bot deployment script for systemd
# Usage: sudo ./scripts/deploy-to-systemd.sh

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

echo -e "${GREEN}Deploying SOL Trading Bot to systemd environment...${NC}"

# Stop service if running
if systemctl is-active --quiet bot.service; then
    echo -e "${YELLOW}Stopping bot.service...${NC}"
    systemctl stop bot.service
    echo -e "${GREEN}✓ Stopped bot.service${NC}"
fi

# Create backup of existing deployment
if [ -d "/opt/solbot/src" ]; then
    echo -e "${YELLOW}Creating backup...${NC}"
    mv /opt/solbot/src /opt/solbot/src.backup.$(date +%Y%m%d_%H%M%S)
    echo -e "${GREEN}✓ Created backup${NC}"
fi

# Copy application files
echo -e "${YELLOW}Copying application files...${NC}"
cp -r src /opt/solbot/
cp package*.json /opt/solbot/
cp tsconfig*.json /opt/solbot/

# Copy environment file if exists
if [ -f ".env" ]; then
    cp .env /opt/solbot/
    echo -e "${GREEN}✓ Copied .env file${NC}"
fi

# Set ownership
chown -R solbot:solbot /opt/solbot
echo -e "${GREEN}✓ Set file ownership${NC}"

# Install dependencies (if package.json changed)
echo -e "${YELLOW}Installing dependencies...${NC}"
cd /opt/solbot
sudo -u solbot npm ci --production
echo -e "${GREEN}✓ Installed dependencies${NC}"

# Build if needed (TypeScript compilation)
if [ -f "tsconfig.json" ]; then
    echo -e "${YELLOW}Building TypeScript...${NC}"
    sudo -u solbot npm run build 2>/dev/null || echo -e "${YELLOW}Warning: Build failed or no build script${NC}"
fi

# Start service
echo -e "${YELLOW}Starting bot.service...${NC}"
systemctl start bot.service
echo -e "${GREEN}✓ Started bot.service${NC}"

# Wait a moment and check status
sleep 3
if systemctl is-active --quiet bot.service; then
    echo -e "${GREEN}"
    echo "=========================================="
    echo "✓ Deployment successful!"
    echo "=========================================="
    echo -e "${NC}"
    echo "Service status:"
    systemctl status bot.service --no-pager -l
    echo ""
    echo "To view logs: sudo journalctl -u bot -f"
else
    echo -e "${RED}"
    echo "=========================================="
    echo "✗ Deployment failed!"
    echo "=========================================="
    echo -e "${NC}"
    echo "Service status:"
    systemctl status bot.service --no-pager -l
    echo ""
    echo "Check logs: sudo journalctl -u bot -n 50"
    exit 1
fi 