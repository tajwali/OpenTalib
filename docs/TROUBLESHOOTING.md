# Troubleshooting Guide

This guide provides solutions to common issues encountered during the setup and operation of **OpenTalib**.

---

## 1. Authentication Issues

### Symptom: Login returns "401 Unauthorized" or "Invalid credentials"
- **Potential Cause:** `SUPABASE_AUTH_URL` is incorrectly configured.
- **Fix:** Ensure `SUPABASE_AUTH_URL` in `.env.local` points directly to your GoTrue service (usually port `9999`).
- **Action:** Sync the config: `cp .env.local /opt/opentalib/.next/standalone/.env.local` and restart the service.

### Symptom: Students cannot sign up with an Invite Code
- **Potential Cause:** The teacher's invite code is invalid or the database schema for `user_profiles` is missing the `teacher_id` column.
- **Fix:** Verify the teacher's code on their dashboard. Check that all database migrations in `supabase/migrations/` have been applied.

---

## 2. Course Generation Issues

### Symptom: Generation hangs at 0% or "Generating Outline..."
- **Potential Cause:** SSE (Server-Sent Events) streaming is being buffered by a proxy (Nginx or Cloudflare).
- **Fix:** Disable buffering for API routes. In Nginx: `proxy_buffering off;`.
- **Potential Cause:** API key for Google Gemini is missing or invalid.
- **Fix:** Check server logs using `journalctl -u opentalib -f`.

### Symptom: "Local network access blocked" when using Ollama
- **Potential Cause:** SSRF protection is blocking requests to private IPs.
- **Fix:** Set `ALLOW_LOCAL_NETWORKS=true` in your `.env.local` file.

---

## 3. Media & Assets

### Symptom: Images or Audio return "404 Not Found"
- **Potential Cause:** The media symlink is missing in the standalone directory.
- **Fix:** Run the following commands:
  ```bash
  cd /opt/opentalib/.next/standalone/public
  ln -s /opt/opentalib-data data
  ```
- **Potential Cause:** Incorrect permissions on the storage directory.
- **Fix:** `chown -R root:root /opt/opentalib-data` (or the user running the service).

---

## 4. Performance & Build

### Symptom: `pnpm build` fails with "JavaScript heap out of memory"
- **Fix:** Increase the memory limit for the Node process:
  ```bash
  export NODE_OPTIONS="--max-old-space-size=4096"
  pnpm build
  ```

### Symptom: Application is slow after a fresh restart
- **Cause:** Next.js ISR/Static pages are being re-generated on the first request.
- **Fix:** This is normal behavior for the first visit to each page after a build.

---

## 5. Getting More Help

If your issue is not listed here:
1. **Check Logs:** `journalctl -u opentalib -n 100 --no-pager`
2. **Check Database:** Verify tables exist using `\dt` in `psql`.
3. **Verify Env:** `cat /opt/opentalib/.next/standalone/.env.local`
