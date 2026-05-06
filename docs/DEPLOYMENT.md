# Deployment Guide

This guide provides step-by-step instructions for hosting **OpenTalib** on a private server (e.g., Ubuntu, Proxmox LXC).

## System Requirements

- **CPU:** 2 Cores (minimum)
- **Memory:** 4GB RAM (recommended for build process)
- **Disk:** 30GB+ available space
- **Operating System:** Ubuntu 24.04 LTS (recommended)

---

## METHOD 1 — The One-Command Installer (Recommended)

OpenTalib includes a comprehensive `install.sh` script that automates the installation of all dependencies, including Node.js, PostgreSQL, GoTrue, PostgREST, Nginx, and Kokoro TTS.

### Step 1: Clone the Repository

```bash
git clone https://github.com/tajwali/OpenTalib.git /opt/opentalib
cd /opt/opentalib
```

### Step 2: Run the Installer

```bash
bash install.sh
```

The script will:
1. Install all system dependencies.
2. Setup PostgreSQL and generate JWT secrets automatically.
3. Install and configure GoTrue, PostgREST, and Nginx.
4. Setup Kokoro TTS for local voice narration.
5. Ask for your `GOOGLE_API_KEY` and `SITE_URL`.
6. Perform the initial build and start all services.

### Step 3: Database Initialization

Once the installer completes, run the database setup script:

```bash
pnpm db:setup
```

### Step 4: Access and Admin Setup

1. Visit your `SITE_URL` in a browser.
2. Go to `/signup`.
3. The first user to register automatically becomes the **Administrator**. No manual SQL commands are required.

---

## METHOD 2 — Manual Installation (Step-by-Step)

If you prefer to install components individually, follow these steps.

### Step 1: Infrastructure Services
OpenTalib requires several background services:
- **PostgreSQL 15** (Port 5432)
- **GoTrue Auth** (Port 9999)
- **PostgREST** (Port 3001)
- **Nginx Proxy** (Port 8000)
- **Kokoro TTS** (Port 8880)

### Step 2: Configure Environment

```bash
cp .env.example .env.local
nano .env.local
```

| Variable | Description |
| :--- | :--- |
| `SUPABASE_URL` | Set to `http://localhost:8000/api/supabase` |
| `SUPABASE_AUTH_URL` | Set to `http://localhost:9999` |
| `MEDIA_STORAGE_PATH` | Absolute path for persistent data (e.g., `/opt/opentalib-data`) |

### Step 3: Build the Application

```bash
pnpm install
pnpm build
```

> [!NOTE]
> **Automation:** `pnpm build` automatically executes `postbuild.js`, which copies `public/`, `.next/static/`, and `.env.local` into the `.next/standalone` directory. No manual copying or symlinks are needed.

### Step 4: Systemd Service
Create `/etc/systemd/system/opentalib.service`:

```ini
[Unit]
Description=OpenTalib Next.js App
After=network.target

[Service]
WorkingDirectory=/opt/opentalib/.next/standalone
ExecStart=/usr/bin/node server.js
EnvironmentFile=/opt/opentalib/.next/standalone/.env.local
Restart=always
User=root

[Install]
WantedBy=multi-user.target
```

---

## Updating OpenTalib

To update a production instance to the latest version, simply run the update script:

```bash
bash /opt/opentalib/update.sh
```

This script automates the `git pull`, `pnpm install`, `pnpm build`, and service restart process.

---

## Troubleshooting Connectivity

- **External Access:** We recommend using a Cloudflare Tunnel pointing to `http://localhost:3000`.
- **Nginx Proxy:** All internal Supabase traffic is proxied through Nginx on port 8000.
- **Kokoro TTS:** Verify the service with `curl http://localhost:8880/health`.
- **First Admin:** If you missed the first-user auto-promotion, you can manually promote a user:
  ```bash
  sudo -u postgres psql -d postgres -c "UPDATE public.user_profiles SET role = 'admin' WHERE id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');"
  ```
