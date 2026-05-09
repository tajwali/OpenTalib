# Administrator Manual

The Admin Dashboard provides high-level control over the **OpenTalib** platform, including user management, subject configuration, and system-wide statistics.

## First Time Setup

After a fresh installation of OpenTalib, follow these steps to bootstrap your administrator account:

1. **Register as a User:**
   - Visit the `/signup` page in your browser.
   - Register as an "Independent Learner" (Mature Student).
2. **Promote to Admin via SQL:**
   - On your server, execute the following SQL command to promote your account:
     ```bash
     sudo -u postgres psql -d postgres -c "
     UPDATE public.user_profiles 
     SET role = 'admin' 
     WHERE id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');"
     ```
3. **Login and Configure:**
   - Log out if you were logged in, then log back in. You will now be directed to the Admin Dashboard.

---

## 1. User Management

The **Users** tab allows you to oversee all accounts on the platform.

### Creating Teacher Accounts
1. Navigate to the **Users** tab.
2. Click **Create Teacher**.
3. Provide a Display Name, Email, and Password.
4. The account will be created with the `teacher` role and is ready for use.

### Managing Existing Users
- **Change Roles:** Promote or demote any user to `admin`, `teacher`, `mature_student`, or `school_student`.
- **Ban/Unban:** Use the block icon to disable an account. Disabled users cannot log in.
- **Reset Password:** Administrators can force a password change for any user via the **Edit** (pencil) icon.

---

## 2. Subject Management

The **Subjects** tab allows you to define the educational categories used for course classification.

- **Default Subjects:** Built-in subjects like Mathematics, Science, and History.
- **Custom Subjects:** Add your own subjects by providing an Emoji icon and a name.

---

## 3. Platform Statistics

The **Statistics** tab provides real-time insights into platform usage:
- **Total Courses & Scenes:** Monitor the volume of educational content.
- **Storage Usage:** View total disk space used by generated media files.
- **User Distribution:** Breakdown of users by role.

---

## 4. Troubleshooting for Admins

### SSE Streaming (Very Important)
OpenTalib relies on Server-Sent Events (SSE) for course generation. If your platform is behind a proxy (like Nginx or Cloudflare), ensure that buffering is disabled, otherwise generation will appear to hang and then fail.

### Configuration Sync
Whenever you change `.env.local`, you must copy it to the standalone directory for it to take effect:
```bash
cp .env.local /opt/opentalib/.next/standalone/.env.local
systemctl restart opentalib
```
