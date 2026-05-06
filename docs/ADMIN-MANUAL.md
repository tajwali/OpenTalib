# Administrator Manual

The Admin Dashboard provides high-level control over the **OpenTalib** platform, including user management, subject configuration, and system-wide statistics.

## First Time Setup

OpenTalib is designed for easy bootstrapping on a fresh installation:

1. **Initialize Database:**
   - On the server, run `pnpm db:setup`. This creates all necessary tables and inserts default subjects.
2. **Register the First User:**
   - Visit the `/signup` page in your browser.
   - You will see a banner indicating that you are the first user.
   - Fill out the form. Upon creation, this account will automatically be assigned the `admin` role.
3. **Configure the Platform:**
   - Once logged in, you will be directed to the Admin Dashboard.
   - **Manage Users:** You can now create additional accounts or change roles for existing users via the Users tab.
   - **Subject Settings:** Ensure default subjects are present. You can add custom subjects with emojis if needed.

## Accessing the Dashboard

Administrators can access the dashboard by logging in with an account that has the `admin` role. Upon login, you will be redirected to the Admin Dashboard.

## 1. User Management

The **Users** tab allows you to oversee all accounts on the platform.

### Creating Teacher Accounts
Since OpenTalib is designed as a managed platform, teacher accounts are typically created by an administrator:
1. Navigate to the **Users** tab.
2. Click **Create Teacher**.
3. Provide a Display Name, Email, and Password.
4. The account will be created with the `teacher` role and is ready for use.

### Managing Existing Users
- **Change Roles:** You can promote or demote any user to `admin`, `teacher`, `mature_student`, or `school_student`.
- **Ban/Unban:** Use the block icon to disable an account. Disabled users cannot log in.
- **Reset Password:** Administrators can force a password change for any user via the **Edit** (pencil) icon.
- **Delete User:** Permanently remove a user and their associated data.

> [!WARNING]
> You cannot delete or disable your own account.

## 2. Subject Management

The **Subjects** tab allows you to define the educational categories used for course classification.

- **Default Subjects:** Built-in subjects like Mathematics, Science, and History. These are essential for AI classification and cannot be deleted.
- **Custom Subjects:** Add your own subjects by providing an Emoji icon and a name. Teachers can select these when generating courses.

## 3. Platform Statistics

The **Statistics** tab provides real-time insights into platform usage:

- **Total Courses & Scenes:** Monitor the volume of educational content generated.
- **Storage Usage:** View the total disk space used by media files (images, audio) and the total file count.
- **User Distribution:** See a breakdown of users by role.
- **Recent Activity:** A log of the last 10 courses generated across the platform, including which teacher created them.

## 4. Maintenance & Infrastructure

### Service Ports
- **Next.js App:** Port 3000
- **Nginx Proxy:** Port 8000
- **GoTrue Auth:** Port 9999
- **PostgREST:** Port 3001
- **PostgreSQL:** Port 5432
- **Kokoro TTS:** Port 8880

### Updating the Platform
To update the production environment to the latest version of OpenTalib, run:
```bash
bash /opt/opentalib/update.sh
```
This script handles pulling the latest code, rebuilding the standalone application (including `postbuild.js` automation), and restarting all relevant services.

### Troubleshooting
- **Auth Issues:** Ensure `SUPABASE_AUTH_URL` points to port 9999 and `SUPABASE_URL` points to the proxied URL (usually port 8000).
- **Media Failures:** Verify `MEDIA_STORAGE_PATH` is set correctly in `.env.local`.
- **Kokoro TTS:** If narration fails, check the service status: `systemctl status kokoro-tts`. Test the endpoint: `curl http://localhost:8880/health`.
- **Logs:** Check application logs using `journalctl -u opentalib -f`.
