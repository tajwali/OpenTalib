# OpenTalib Developer Documentation (Single Source of Truth)

This document serves as the comprehensive technical reference for the **OpenTalib** project. It is intended for developers (human and AI) to understand the architecture, patterns, infrastructure, and operational procedures of the stack.

---

## 1. Project Overview

**OpenTalib** is an open-source, multi-user Learning Management System (LMS) powered by multi-agent AI. It transforms static educational content or PDFs into immersive interactive classrooms featuring AI teachers, student agents, real-time discussions, and automated assessments.

- **Forked From:** [OpenMAIC](https://github.com/THU-MAIC/OpenMAIC) by Tsinghua University (March 2026).
- **License:** **AGPL-3.0** (Must be preserved in all forks and deployments).
- **Core Enhancements over OpenMAIC:**
  - Full Multi-User system with persistent accounts.
  - Role-Based Access Control (RBAC): Admin, Teacher, School Student, Mature Student.
  - Persistent database storage via Supabase (PostgreSQL).
  - Teacher-Student linking and course assignments.
  - AI-generated exams and timed assessments.
  - Production-ready deployment scripts (Systemd, Standalone mode).
  - Incremental course saving during generation.

---

## 2. Architecture

### 2.1 System Diagram
```text
                                  +---------------------------------------+
                                  |            Cloud/External             |
                                  |  (Gemini, OpenAI, Anthropic, Tavily)  |
                                  +------------------^--------------------+
                                                     |
                                                     | (HTTPS/API)
                                                     |
+------------------+         +-----------------------v--------------------+
|                  |         |           Next.js Application              |
|     Browser      | <-----> |   (App Router, Server Actions, API)        |
|  (React 19/UI)   |         |   Port 3000 (Internal)                     |
|                  |         +-----------+---------------^---------+------+
+------------------+                     |               |         |
                                         |               |         | (Local Disk)
                                         |               |         |
         +-------------------------------+               |    +----v-------------+
         |                                               |    |  Media Storage   |
         | (Auth/REST)                                   |    | /opt/opentalib-data|
         |                                               |    +------------------+
+--------v-----------------------------------------------+------------------------+
|                                Supabase Stack                                   |
|  +-------------------+      +-------------------+      +---------------------+  |
|  |      GoTrue       |      |     PostgREST     |      |     PostgreSQL      |  |
|  |  (Auth Engine)    | <--> |   (RESTful API)   | <--> |  (Database Layer)   |  |
|  |     Port 9999     |      |     Port 3001     |      |      Port 5432      |  |
|  +---------^---------+      +---------^---------+      +---------------------+  |
|            |                          |                                         |
|  +---------v--------------------------v----------+      +---------------------+  |
|  |             Nginx Reverse Proxy               |      |     Kokoro TTS      |  |
|  |               Port 8000 / 443                 | <--> |   (Voice Service)   |  |
|  +-----------------------------------------------+      |      Port 8880      |  |
+--------------------------------------------------------+---------------------+  |
                                         ^                                         |
                                         | (Internal/External)                     |
                                         |                                         |
                                  +------+----------------+                        |
                                  |      Local LLM        |                        |
                                  | (Ollama at .41:11434) | <----------------------+
                                  +-----------------------+
```

### 2.2 Technology Stack
- **Frontend/Backend:** Next.js 16.1 (App Router), React 19.
- **State Management:** Zustand (Client), Supabase (Server/Persistent).
- **Database:** PostgreSQL 15.
- **Authentication:** Supabase GoTrue (JWT, Cookies).
- **Styling:** Tailwind CSS 4.
- **Runtime:** Node.js 20.x, pnpm 10.x.
- **Deployment:** Standalone mode, Systemd, Proxmox LXC.

### 2.3 Supabase Proxy
To ensure browser-side Supabase accessibility, all client-side requests are routed through a Next.js API proxy:
- **Client URL:** `SUPABASE_URL` points to `https://talib.tajwali.uk/api/supabase`.
- **Route Handler:** `app/api/supabase/[...path]/route.ts` proxies requests to the internal Supabase gateway (localhost:8000).
- **Benefits:** Keeps Supabase behind the same domain/tunnel, simplifies CSP, and ensures consistent accessibility regardless of whether the code runs on server or browser.

---

## 3. Infrastructure (Environments)

### 3.1 Production Environment (All-in-One)
- **Host:** 192.168.10.142 (Ubuntu 24.04 LXC)
- **External URL:** `https://talib.tajwali.uk` (via Cloudflare Tunnel)
- **App Path:** `/opt/opentalib` (branch: `main`)
- **Data Path:** `/opt/opentalib-data` (Persistent media storage, configured via `MEDIA_STORAGE_PATH`)
- **Services:**
  - `postgresql.service` (Port 5432 - PostgreSQL 15)
  - `gotrue.service` (Port 9999 - GoTrue Auth)
  - `postgrest.service` (Port 3001 - PostgREST)
  - `nginx.service` (Port 8000 - Local Proxy)
  - `kokoro-tts.service` (Port 8880 - Local Voice Narration)
  - `opentalib.service` (Port 3000 - Next.js Application)

### 3.2 Development Environment
- **Host:** 192.168.10.30 (Ubuntu 22.04 LXC)
- **App Path:** `/opt/opentalib-dev` (branch: `multiuser-dev`)
- **Database:** Connects to Shared Supabase at `192.168.10.129`.
- **Service:** `opentalib-dev.service` (Port 3001)

### 3.3 Shared Services
- **Shared Supabase:** 192.168.10.129 (External DB/Auth for dev LXC).
- **Shared Ollama:** 192.168.10.41:11434 (LLM provider for all environments).
- **Proxmox Host:** 192.168.1.92 (Nodes/Containers manager).

---

## 4. File Structure

```text
OpenTalib/
├── app/                  # Next.js App Router Pages and API Routes
│   ├── api/              # Server-side API endpoints
│   │   ├── admin/        # (NEW) Admin-only management endpoints
│   │   ├── auth/         # (NEW) Login, Signup, Logout (GoTrue proxy)
│   │   ├── generate/     # AI generation (Images, TTS, Content)
│   │   ├── teacher/      # (NEW) Teacher-specific logic
│   │   └── user/         # (NEW) Generic user progress/classrooms
│   ├── classroom/        # Classroom viewer pages
│   ├── login/            # (NEW) Auth pages
│   ├── signup/           # (NEW) Auth pages
│   └── dashboard/        # (NEW) Unified dashboard entry point
├── components/           # React Components
│   ├── dashboard/        # (NEW) Admin, Teacher, Student Dashboards
│   ├── stage/            # Classroom/Stage UI components
│   └── ui/               # Shared Shadcn UI components
├── lib/                  # Shared Business Logic & Utilities
│   ├── ai/               # LLM provider adapters and resolution
│   ├── auth/             # (NEW) Auth helpers (get-user-role)
│   ├── server/           # (NEW/MODIFIED) Server-only logic (RBAC, storage, SSRF)
│   ├── supabase/         # (NEW) Supabase SSR client config
│   └── types/            # TypeScript interfaces
├── supabase/             # Database artifacts
│   └── migrations/       # (NEW) All SQL schema migrations (001 to 006)
├── public/               # Static assets (logos, banners)
├── docs/                 # Documentation
├── scripts/              # Useful dev/ops scripts
├── .env.example          # Annotated environment template
├── next.config.ts        # (MODIFIED) Standalone build & security headers
└── docker-compose.yml    # Containerized stack config
```

---

## 5. Database Schema

OpenTalib uses a relational schema in the `public` and `auth` (managed by GoTrue) schemas.

### 5.1 Key Tables (`public` schema)
- **`user_profiles`**: Links to `auth.users`. Stores `role`, `display_name`, `invite_code`, `grade`, and `teacher_id`.
- **`classrooms`**: Stores generated courses. Columns: `id`, `title`, `scenes` (JSONB), `topic`, `status`, `subject_id`, `grade`, `language`.
- **`course_assignments`**: Links `classrooms` to `school_student` users. Tracked by `assigned_by` (Teacher).
- **`subjects`**: Educational categories (Math, Science, etc.) with icons.
- **`course_progress`**: Tracks which scenes a user has completed in a specific classroom.
- **`quiz_results`**: Detailed scores and answers for in-course quizzes.
- **`exams`**: AI-generated standalone assessments.
- **`exam_results`**: Student performance on exams.
- **`platform_settings`**: System-wide configuration.

---

## 6. Authentication & Authorization

### 6.1 GoTrue Integration
The app uses Supabase GoTrue for authentication. Because self-hosted GoTrue runs on a different port (9999) than the gateway (8000), a custom `fetch` rewriter is used in `lib/supabase/server.ts` and `app/api/auth/login/route.ts` to route `/auth/v1` calls correctly.

### 6.2 The `createClient()` Pattern
Found in `lib/supabase/server.ts`. It initializes the `@supabase/ssr` client with cookie persistence.
- **`getSession()`**: Reads JWT from cookies locally. Used for performance-critical checks.
- **`getUser()`**: Makes a network call to GoTrue to verify the user. Required for security-sensitive operations.

### 6.3 RBAC (Role-Based Access Control)
Roles are enforced using `lib/server/require-role.ts`.
- **First User:** The first account created on a fresh installation automatically becomes an `admin`. The UI displays a banner/note during this process.
- **admin**: Full platform control (User management, system stats).

- **`teacher`**: Can generate courses, manage their own students, and assign courses.
- **`mature_student`**: Self-directed learners. Can generate their own courses.
- **`school_student`**: Can only access courses assigned by their teacher.

---

## 7. Critical Code Patterns

### 7.1 Role Check Pattern (API)
Every protected API route must use `requireRole`.
```typescript
import { requireRole } from '@/lib/server/require-role';

export async function POST(req: Request) {
  const auth = await requireRole(['teacher', 'admin']);
  if ('error' in auth) return auth.error;
  
  const userId = auth.user.id;
  // logic...
}
```

### 7.2 POST Body Parsing (Next.js 16 Bug)
In Next.js 16, standard `request.json()` can sometimes hang or fail. Use `request.json()` but ensure a `try/catch` and appropriate content-type headers. (Note: The project previously used `request.text()` but migrated to `request.json()` for stability).

### 7.3 Model Resolution
Models are resolved in this order: `x-model` header -> `DEFAULT_MODEL` env var -> Hardcoded fallback.
Utility: `lib/server/resolve-model.ts`.

---

## 8. Environment Variables

| Variable | Required | Description |
| :--- | :--- | :--- |
| `SUPABASE_URL` | YES | `https://talib.tajwali.uk/api/supabase` (Browser proxy) |
| `SUPABASE_AUTH_URL` | YES | **CRITICAL:** Port 9999 (Direct GoTrue) |
| `SUPABASE_SERVICE_KEY` | YES | Service role key for admin DB operations |
| `SUPABASE_JWT_SECRET` | YES | Must match GoTrue/PostgREST config |
| `GOOGLE_API_KEY` | YES | For default Gemini models |
| `ALLOW_LOCAL_NETWORKS` | NO | Set to `true` to allow private IP LLMs (Ollama) |
| `IMAGE_NANO_BANANA_API_KEY`| YES | API Key for image generation |

---

## 9. AI & Media Configuration

### 9.1 Provider Format
Models are specified as `provider:model-id` (e.g., `google:gemini-2.0-flash`).

### 9.2 Ollama Integration
Requires `ALLOW_LOCAL_NETWORKS=true` and `OLLAMA_BASE_URL=http://192.168.10.41:11434/v1`.

### 9.3 Media Storage
Generated images and audio are stored on the filesystem.
- **Environment Variable:** `MEDIA_STORAGE_PATH` (e.g., `/opt/opentalib-data`).
- This path should be outside the application directory to ensure media survives rebuilds.

### 9.4 Kokoro TTS Integration
Local voice narration is provided by Kokoro TTS (running on port 8880).
- **Auto-Selection:** Voices are selected automatically based on the user's gender profile.
- **Voices:** `af_sarah` (female), `am_adam` (male).
- **Status:** `systemctl status kokoro-tts`.
- **Health Check:** `curl http://localhost:8880/health`.

---

## 10. Operations

### 10.1 Deployment (Using Scripts)
- **Installation:** Use `bash install.sh` on a fresh Ubuntu 24.04 LXC. This installs all dependencies (Node.js, PostgreSQL, GoTrue, PostgREST, Nginx, Kokoro TTS) and generates JWT secrets automatically.
- **Update Production:** Run `bash /opt/opentalib/update.sh`. This script pulls the latest code from `main`, builds it, and restarts the services.

### 10.2 Build Process (`pnpm build`)
The build process is now fully automated via `postbuild.js`:
1. `pnpm build` triggers Next.js standalone build.
2. `postbuild.js` runs automatically after the build completes.
3. It copies `public/`, `.next/static/`, and `.env.local` to the standalone directory.
4. No manual file copying or symlinks are required anymore.

### 10.3 Database Setup
- **Initial Setup:** Run `pnpm db:setup` on a fresh installation to create all tables and insert default subjects.
- **Incremental Migrations:** Apply manual SQL migrations if needed:
  `sudo -u postgres psql -d postgres < supabase/migrations/00X_name.sql`

---

## 11. Known Issues & Gotchas

- **Auth 401/404:** Usually caused by `SUPABASE_AUTH_URL` missing from `.next/standalone/.env.local`.
- **Media 404:** Symlink at `.next/standalone/data` is broken or missing.
- **SSRF Guard:** Blocks private IPs by default. Must enable `ALLOW_LOCAL_NETWORKS` for local Ollama.
- **PostgREST Cache:** If you add a table, run `NOTIFY pgrst, 'reload schema';` or restart PostgREST.

---

## 12. Development Workflow

### 12.1 Local Setup
1. `pnpm install`.
2. `cp .env.example .env.local`.
3. `pnpm dev`.

### 12.2 Testing
- **Unit:** `pnpm test`.
- **E2E:** `pnpm test:e2e` (Requires live Supabase connection).

---

## 13. Adding New Features

### 13.1 New API Route
1. Create a new directory and `route.ts` in `app/api/`.
2. Wrap logic in `requireRole([...])` for protection.
3. Use `apiSuccess`/`apiError` helpers for consistent JSON responses.

### 13.2 New Database Table
1. Create a new `.sql` file in `supabase/migrations/` with a sequential number (e.g., `007_new_table.sql`).
2. Include `GRANT ALL` for `authenticated` and `service_role`.
3. Apply to dev and prod databases.

### 13.3 New Dashboard Component
1. Add to `components/dashboard/`.
2. Update `app/page.tsx` switch statement to render it based on the user's role.

### 13.4 New AI Provider
1. Add adapter logic in `lib/ai/` (if needed) or update `lib/server/provider-config.ts`.
2. Add prefix (e.g., `CUSTOM_`) to `.env.local`.

---

## 14. Rebranding Notes

This project was rebranded from **OpenMAIC** to **OpenTalib** in May 2026.
- The name "OpenTalib" reflects the focus on persistent, multi-user education ("Talib" meaning student/seeker of knowledge).
- All instances of "OpenMAIC" in the UI and documentation have been updated.
- Original credits to Tsinghua University (THU-MAIC) are maintained in the README.

---

## 14. Test Accounts

| Role | Email |
| :--- | :--- |
| **Admin** | `tajwali@gmail.com` |
| **Teacher** | `teacher@test.com` |
| **Student** | `student@test.com` |

---

*Assisted-by: Gemini CLI (Model: Gemini 2.0 Flash)*
