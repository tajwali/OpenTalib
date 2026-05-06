# Troubleshooting Guide

This document covers common issues encountered during the deployment and operation of OpenTalib.

### ISSUE: Login returns 401 Unauthorized
- **CAUSE:** The `SUPABASE_AUTH_URL` is missing or incorrect in the production environment file.
- **FIX:** Ensure `SUPABASE_AUTH_URL` points directly to GoTrue (port 9999). Since `pnpm build` now automatically copies `.env.local` to the standalone directory, just update the root `.env.local` and run `bash update.sh`.

### ISSUE: Images or audio return 404 Not Found
- **CAUSE:** `MEDIA_STORAGE_PATH` is incorrect, or the storage directory is not writable.
- **FIX:** Verify `MEDIA_STORAGE_PATH` is set to an absolute path (e.g., `/opt/opentalib-data`) in `.env.local`. Ensure the directory exists and is writable by the app user:
  ```bash
  sudo chown -R $USER:$USER /opt/opentalib-data
  ```

### ISSUE: Kokoro TTS narration is silent or failing
- **CAUSE:** The `kokoro-tts` service is stopped or the port (8880) is blocked.
- **FIX:** Check service status: `systemctl status kokoro-tts`. Verify connectivity: `curl http://localhost:8880/health`. If it fails, restart the service: `systemctl restart kokoro-tts`.

### ISSUE: PostgREST returns "relation does not exist"
- **CAUSE:** The database schema was updated, but the PostgREST schema cache is stale.
- **FIX:** Force PostgREST to reload its schema:
  ```bash
  sudo -u postgres psql -c "NOTIFY pgrst, 'reload schema';"
  ```

### ISSUE: Ollama local LLM blocked
- **CAUSE:** The SSRF guard is blocking connections to private/local IP addresses.
- **FIX:** Set `ALLOW_LOCAL_NETWORKS=true` in `.env.local` and restart the application.

### ISSUE: General "Old Version" or "Missing Files" after build
- **CAUSE:** Manual copying of build artifacts was missed.
- **FIX:** Use the built-in `pnpm build` process which triggers `postbuild.js`. This script automatically handles copying `public/`, `.next/static/`, and `.env.local` to the standalone directory. For a complete clean update, run `bash update.sh`.

### ISSUE: Course generation times out (Cloudflare 524)
- **CAUSE:** The generation endpoint is not streaming responses correctly through the proxy.
- **FIX:** All OpenTalib generation routes use Server-Sent Events (SSE). Ensure your proxy/WAF supports streaming and verify that the response `Content-Type` is `text/event-stream`.

### ISSUE: Database tables are missing on new install
- **CAUSE:** The initial schema was not loaded.
- **FIX:** Run `pnpm db:setup` to initialize the database with all required tables and default subjects.
