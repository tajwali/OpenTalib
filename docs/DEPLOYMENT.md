# Deployment Guide

This guide provides step-by-step instructions for self-hosting **OpenTalib** on a private server (e.g., Ubuntu, Proxmox LXC) or using Docker.

## System Requirements

- **CPU:** 2 Cores (minimum)
- **Memory:** 4GB RAM (recommended for build process)
- **Disk:** 30GB+ available space
- **Operating System:** Ubuntu 22.04 LTS (recommended)

---

## METHOD 1 — Manual Ubuntu 22.04 (Primary)

### Step 1: Install Node.js 20 and pnpm

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pnpm
```

### Step 2: Install PostgreSQL 15

```bash
sudo apt-get update
sudo apt-get install -y postgresql-15
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### Step 3: Install GoTrue (Auth)
GoTrue is the authentication engine. It should run on port **9999**.

1. Download the binary or use a container. For a manual setup, ensure it is configured to listen on port 9999 and connected to your PostgreSQL instance.
2. Create a systemd service for GoTrue to ensure it starts on boot.

### Step 4: Install PostgREST
PostgREST provides the RESTful API for your database. It should run on port **3001**.

1. Download the PostgREST binary.
2. Configure it with your PostgreSQL connection string.
3. Create a systemd service for PostgREST on port 3001.

### Step 5: Clone and Install OpenTalib

```bash
git clone https://github.com/tajwali/OpenTalib.git /opt/opentalib
cd /opt/opentalib
pnpm install
```

### Step 6: Configure .env.local

Copy the example and fill in your values. Refer to the `.env.example` file for detailed explanations.

```bash
cp .env.example .env.local
nano .env.local
```

> [!IMPORTANT]
> **NEXT_PUBLIC_SUPABASE_URL** points to the Kong gateway (port 8000).
> **SUPABASE_AUTH_URL** points DIRECTLY to GoTrue (port 9999).
> Getting this wrong will cause 401 Unauthorized errors during login.

### Step 7: Build the Application

```bash
pnpm build
```

### Step 8: Standalone Mode Preparation
Next.js standalone mode requires specific files to be moved into the standalone directory.

```bash
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
cp .env.local .next/standalone/.env.local
```

### Step 9: Media Storage Setup
Required for storing generated images and audio.

```bash
sudo mkdir -p /opt/opentalib-data/classrooms
sudo ln -s /opt/opentalib-data /opt/opentalib/.next/standalone/data
sudo chown -R $USER:$USER /opt/opentalib-data
```

### Step 10: Run Database Migrations
Run all 6 migrations in order using `psql`:

```bash
cd supabase/migrations
for f in *.sql; do sudo -u postgres psql -d postgres -f "$f"; done
```

### Step 11: Create Systemd Service
Create the file `/etc/systemd/system/opentalib.service`:

```ini
[Unit]
Description=OpenTalib Production
After=network.target

[Service]
WorkingDirectory=/opt/opentalib/.next/standalone
ExecStart=/usr/bin/node /opt/opentalib/.next/standalone/server.js
EnvironmentFile=/opt/opentalib/.next/standalone/.env.local
Restart=always
User=root

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable opentalib
sudo systemctl start opentalib
```

### Step 12: Promote First User to Admin
After registering at `/signup`, promote your user via SQL:

```bash
sudo -u postgres psql -d postgres -c "UPDATE public.user_profiles SET role = 'admin' WHERE id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');"
```

---

## METHOD 2 — Docker Compose

### Step 1: Install Docker and Docker Compose
Follow the official Docker documentation for Ubuntu.

### Step 2: Clone Repo and Configure

```bash
git clone https://github.com/tajwali/OpenTalib.git
cd OpenTalib
cp .env.example .env.local
# Fill in your .env.local values
```

### Step 3: Start the Stack

```bash
docker compose up -d
```

### Step 4: Run Migrations

```bash
docker exec -i opentalib_db_1 psql -U postgres < supabase/migrations/001_phase4_schema.sql
# ... repeat for all 6 migrations in order
```

### Step 5: Promote Admin

```bash
docker exec -it opentalib_db_1 psql -U postgres -c "UPDATE public.user_profiles SET role = 'admin' WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@example.com');"
```

---

## METHOD 3 — Proxmox LXC

### Step 1: Create LXC Container
1. Create a new LXC container in Proxmox using an **Ubuntu 22.04** template.
2. Allocate at least **4GB RAM**, **2 CPUs**, and **30GB disk**.
3. Ensure "Unprivileged container" is checked (standard security).

### Step 2: Follow Method 1
Log into your LXC console and follow all steps in **METHOD 1 — Manual Ubuntu**.

### Step 3: External Access (Cloudflare Tunnel)
If you need to access your OpenTalib instance from outside your local network:
1. Install `cloudflared` inside the LXC.
2. Authenticate and create a tunnel pointing to `http://localhost:3000`.

---

## VERIFICATION SECTION

After deployment, verify your installation:

1. **Check Connectivity:**
   `curl -I http://localhost:3000` should return `HTTP/1.1 200 OK`.
2. **Check Service Status:**
   `systemctl status opentalib` should show `active (running)`.
3. **Register and Login:**
   - Visit `/signup` and create an account.
   - Promote the account to admin via SQL (as shown in Step 12 of Method 1).
   - Log in and confirm you reach the Admin Dashboard.
4. **Test Course Generation:**
   - Go to the Teacher or Mature Student dashboard.
   - Generate a test course. It should take 2-5 minutes.
   - Confirm that images load correctly and audio plays.

---

## Updating OpenTalib

To update to the latest version:

```bash
git pull
pnpm install
pnpm build
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
cp .env.local .next/standalone/.env.local
sudo systemctl restart opentalib
```
