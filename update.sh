#!/bin/bash
set -e
cd /opt/opentalib
git pull origin main
pnpm install
pnpm build
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
cp .env.local .next/standalone/.env.local
mkdir -p /opt/opentalib-data/classrooms
systemctl restart opentalib
echo -e "\033[0;32m✅ OpenTalib updated successfully\033[0m"
