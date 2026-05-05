# Troubleshooting Guide

This document covers common issues encountered during the deployment and operation of OpenTalib.

### ISSUE: Login returns 401 Unauthorized
- **CAUSE:** The `SUPABASE_AUTH_URL` is missing or incorrect in the production environment file.
- **FIX:** Ensure `SUPABASE_AUTH_URL` points directly to GoTrue (port 9999) and is present in `.next/standalone/.env.local`. Run:
  ```bash
  cp .env.local .next/standalone/.env.local
  systemctl restart opentalib
  ```

### ISSUE: Images or audio return 404 Not Found
- **CAUSE:** The media symlink is missing or pointing to the wrong persistent storage path.
- **FIX:** Recreate the symlink to the absolute path of your data directory:
  ```bash
  rm -rf .next/standalone/data
  ln -s /opt/opentalib-data .next/standalone/data
  ```

### ISSUE: ALLOW_LOCAL_NETWORKS has no effect
- **CAUSE:** The systemd service is not loading the environment file correctly, or `systemctl daemon-reload` was not run.
- **FIX:** Verify the `EnvironmentFile=` line exists in your `.service` file and points to the correct `.env.local`. Then run:
  ```bash
  systemctl daemon-reload
  systemctl restart opentalib
  ```

### ISSUE: Course generation times out (Cloudflare 524)
- **CAUSE:** The generation endpoint is not streaming responses correctly through the proxy.
- **FIX:** All OpenTalib generation routes use Server-Sent Events (SSE). Ensure your proxy/WAF supports streaming and verify that the response `Content-Type` is `text/event-stream`.

### ISSUE: Ollama local LLM blocked
- **CAUSE:** The SSRF guard is blocking connections to private/local IP addresses.
- **FIX:** Set `ALLOW_LOCAL_NETWORKS=true` in `.env.local` and ensure it is synced to `.next/standalone/.env.local`.

### ISSUE: generateShortTitle cannot connect to LLM
- **CAUSE:** `OLLAMA_BASE_URL` (or other provider URL) is missing from the standalone environment.
- **FIX:** Add the correct base URL to `.next/standalone/.env.local`:
  ```bash
  OLLAMA_BASE_URL=http://YOUR_SERVER_IP:11434/v1
  ```

### ISSUE: Malformed JSON from Ollama/Local Models
- **CAUSE:** Some smaller or older local models may output invalid JSON structures.
- **FIX:** OpenTalib includes an automatic `jsonrepair` utility in `lib/generation/json-repair.ts` that handles most of these cases. If it persists, consider using a more capable model like `llama3.1` or `qwen2.5`.

### ISSUE: PostgREST returns "relation does not exist"
- **CAUSE:** The database schema was updated, but the PostgREST schema cache is stale.
- **FIX:** Force PostgREST to reload its schema:
  ```bash
  sudo -u postgres psql -c "NOTIFY pgrst, 'reload schema';"
  ```

### ISSUE: Environment variables not loading in production
- **CAUSE:** Next.js standalone server reads environment variables from its own directory, not the repository root.
- **FIX:** Always sync your config: `cp .env.local .next/standalone/.env.local` after any changes.

### ISSUE: Images disappear after a new deployment
- **CAUSE:** Persistent media storage was not symlinked into the new build directory.
- **FIX:** Confirm the symlink exists after every deploy: `ls -la .next/standalone/data`.
