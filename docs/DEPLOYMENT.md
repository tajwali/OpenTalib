# Deployment Guide

This guide provides instructions for self-hosting **OpenTalib** on a private server (Ubuntu 22.04) or within a Proxmox LXC container.

## System Requirements

- **CPU:** 2 Cores (minimum), 4 Cores (recommended).
- **Memory:** 4GB RAM (minimum), 8GB+ (recommended for build performance).
- **Disk:** 40GB+ available space (for persistent media).

---

## Single-Host Production Setup (Standard)

OpenTalib 2.0 is optimized for a unified deployment where the application, database, and auth stack all run on the same host.

### 1. Install Node.js & Tooling
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pnpm
```

### 2. Install PostgreSQL 15+
```bash
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### 3. Deploy Supabase Stack (Self-Hosted)
OpenTalib requires the core Supabase services (GoTrue, PostgREST). 
- **GoTrue (Auth):** Must run on port `9999`.
- **PostgREST (API):** Must run on port `3001`.
- **Database:** PostgreSQL on port `5432`.

Ensure these services are configured to communicate with each other on the local network.

### 4. Clone and Install
```bash
git clone https://github.com/tajwali/OpenTalib.git /opt/opentalib
cd /opt/opentalib
pnpm install
```

### 5. Environment Configuration
Copy `.env.example` to `.env.local` and fill in your keys.

```bash
cp .env.example .env.local
nano .env.local
```

**Critical Variables:**
- `SUPABASE_URL`: `http://localhost:8000` (Main proxy).
- `SUPABASE_AUTH_URL`: `http://localhost:9999` (Direct GoTrue access).
- `SUPABASE_SERVICE_KEY`: Service role key for admin operations.
- `GOOGLE_API_KEY`: Required for Gemini and TTS.
- `MEDIA_STORAGE_PATH`: `/opt/opentalib-data` (Persistent storage).

### 6. Persistent Media Storage
```bash
sudo mkdir -p /opt/opentalib-data/classrooms
sudo chown -R $USER:$USER /opt/opentalib-data
```

### 7. Build for Production
OpenTalib uses Next.js Standalone mode for maximum stability.
```bash
pnpm build
# Sync assets to standalone directory
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
cp .env.local .next/standalone/.env.local
```

### 8. Systemd Service
Create `/etc/systemd/system/opentalib.service`:
```ini
[Unit]
Description=OpenTalib Production Server
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/opentalib/.next/standalone
ExecStart=/usr/bin/node server.js
EnvironmentFile=/opt/opentalib/.next/standalone/.env.local
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable opentalib
sudo systemctl start opentalib
```

---

## Database Migrations
Migrations are located in `supabase/migrations/`. Apply them to your `postgres` database in numerical/alphabetical order:
```bash
sudo -u postgres psql -d postgres -f supabase/migrations/001_phase4_schema.sql
# ... apply remaining files
```

## Proxmox LXC Note
If deploying in Proxmox, use a **Privileged** container if you plan to mount NFS/SMB shares for media storage, or an **Unprivileged** container for standard local storage. Ensure the container has nested virtualization enabled for potential local LLM usage.
