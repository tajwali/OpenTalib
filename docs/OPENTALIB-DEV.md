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
|  (React 19/UI)   |         |   Port 3001 (Internal) / 3000 (Proxy)      |
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
|  +-------------------+      +-------------------+      +---------------------+  |
+---------------------------------------------------------------------------------+
                                         ^
                                         | (Internal/External)
                                         |
                                  +------+----------------+
                                  |      Local LLM        |
                                  | (Ollama at .41:11434) |
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

---

## 3. Infrastructure (Environments)

### 3.1 Production Environment (All-in-One)
- **Host:** 192.168.10.142 (Ubuntu 24.04 LXC)
- **External URL:** `https://opentalib.tajwali.uk` (via Cloudflare Tunnel)
- **App Path:** `/opt/opentalib` (branch: `main`)
- **Data Path:** `/opt/opentalib-data` (Persistent media storage)
- **Services:**
  - `postgresql.service` (Port 5432)
  - `gotrue.service` (Port 9999)
  - `postgrest.service` (Port 3001)
  - `opentalib.service` (Port 3000)

### 3.2 Development Environment
- **Host:** 192.168.10.30 (Ubuntu 22.04 LXC)
- **App Path:** `/opt/openmaic-dev` (branch: `multiuser-dev`)
- **Database:** Connects to Shared Supabase at `192.168.10.129`.
- **Service:** `openmaic-dev.service` (Port 3001)

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
- **`admin`**: Full platform control (User management, system stats).
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
| `NEXT_PUBLIC_SUPABASE_URL` | YES | Port 3001 (PostgREST) or 8000 (Gateway) |
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
Generated images and audio are stored on the filesystem at `/opt/opentalib-data`.
The application directory `/opt/opentalib/.next/standalone/data` is a **symlink** to this path to ensure persistence across builds.

---

## 10. Operations

### 10.1 Deployment (Dev -> Prod)
1. Commit changes to `multiuser-dev`.
2. Merge into `main` and push.
3. SSH into 192.168.10.142.
4. `cd /opt/opentalib && git pull`.
5. `pnpm build`.
6. `cp -r .next/static .next/standalone/.next/`.
7. `cp -r public .next/standalone/`.
8. `cp .env.local .next/standalone/.env.local`.
9. `systemctl restart opentalib`.

### 10.2 Database Migrations
Always apply migrations in numerical order:
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
