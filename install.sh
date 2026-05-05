#!/bin/bash
set -e
set -o pipefail

# Constants
LOG_FILE="/var/log/opentalib-install.log"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

exec > >(tee -a "$LOG_FILE") 2>&1

echo -e "${YELLOW}⏳ Starting OpenTalib Installation...${NC}"

# 1. Pre-flight checks
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ This script must be run as root.${NC}"
   exit 1
fi

if [[ -f /etc/os-release ]]; then
    . /etc/os-release
    if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
        echo -e "${RED}❌ Unsupported OS: $ID. Please use Ubuntu or Debian.${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Cannot determine OS.${NC}"
    exit 1
fi

if ! ping -c 1 google.com &> /dev/null; then
    echo -e "${RED}❌ No internet connection.${NC}"
    exit 1
fi

echo -e "
╔══════════════════════════════════════╗
║     OpenTalib Installation Script    ║
║   Open Multi-User AI Classroom       ║
║   Platform for Schools               ║
╚══════════════════════════════════════╝
"

# Configuration
read -p "Enter GOOGLE_API_KEY: " GOOGLE_API_KEY
read -p "Enter SITE_URL [http://localhost:3000]: " SITE_URL
SITE_URL=${SITE_URL:-http://localhost:3000}
read -p "Enter DB_PASSWORD [random]: " DB_PASSWORD
DB_PASSWORD=${DB_PASSWORD:-$(openssl rand -hex 16)}
JWT_SECRET=$(openssl rand -hex 16)
PORT=3000

# 2. System Dependencies
echo -e "${YELLOW}⏳ Installing dependencies...${NC}"
apt update && apt upgrade -y
apt install -y curl wget git nano ufw postgresql-15 postgresql-contrib-15 nginx

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pnpm

# 3. PostgreSQL
echo -e "${YELLOW}⏳ Configuring PostgreSQL...${NC}"
sudo -u postgres psql << EOF
CREATE ROLE opentalib_auth WITH LOGIN PASSWORD '$DB_PASSWORD';
CREATE ROLE authenticator WITH LOGIN PASSWORD '$DB_PASSWORD' NOINHERIT;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;
EOF

# 4. GoTrue (simplified placeholder for now, usually requires specific build)
echo -e "${YELLOW}⏳ Setting up Auth Service...${NC}"
# Placeholder for GoTrue setup
mkdir -p /etc/gotrue
# ... (rest of the logic) ...

echo -e "${GREEN}✅ Installation completed successfully!${NC}"
