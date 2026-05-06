#!/bin/bash
set -e
cd /opt/opentalib
echo "Pulling latest code..."
git pull origin main
echo "Installing dependencies..."
pnpm install
echo "Building (postbuild runs automatically)..."
pnpm build
echo "Restarting service..."
systemctl restart opentalib
sleep 3
systemctl status opentalib | head -5
echo "✅ Update complete!"
