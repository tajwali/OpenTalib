# Developer Handoff Note — `multiuser-dev` Branch

**Branch:** `multiuser-dev`
**Base:** `main` (diverged after commit `787e2d1`)
**Date:** 2026-04-13
**Author:** Gulmar Khan

---

## Overview

This branch adds full multi-user support to **OpenTalib**: Supabase authentication, role-based dashboards (student / teacher / admin), course persistence, exam generation, and a series of production stability fixes discovered during deployment on a self-hosted Supabase + Cloudflare tunnel setup.

---

## Feature Summary (44 commits)

### Phase 2 — Auth Foundation
- Supabase authentication (login, signup, session management)
- TTS proxy, `.env.example` scaffolding

### Phase 3–4 — Course Persistence & Roles
- Save generated courses to Supabase after generation (`classrooms` table)
- Role-based dashboards; signup flow assigns `student` / `teacher` / `admin` roles
- Schema migrations for `user_profiles`, `course_assignments`, `quiz_results`

### Phase 5–6 — Student Progress
- Capture quiz results when students answer questions
- Student progress dashboard: quiz scores, course access history

### Phase 7 — Teacher Dashboard
- Teacher dashboard: invite codes, student management, course assignment
- `POST /api/teacher/assign-course` — assign courses to students
- `GET /api/teacher/assign-course` — list all assignments with student/course details

### Phase 8 — Exams
- AI exam generation from course content
- Timed exam taking + results storage
- Teacher view of exam results per exam

### Phase 9–10 — Course Metadata
- Course subjects with AI classification (`classifySubject`)
- Grade field on courses and generation form
- AI-generated course titles (`generateCourseTitle`)

### Phase 11.1 — Profile Editing & Admin User Management
- Profile editing for all roles (display name, gender, password)
- Admin dashboard: view all users, create teacher accounts, change roles
- Admin uses GoTrue Admin REST API (`/admin/users`) — not Supabase cloud SDK

---

## Bug Fixes (Production Issues)

### 1. Login broken on prod — "Unexpected non-whitespace character after JSON at position 4"

**Root cause:** `SUPABASE_AUTH_URL` was missing from `.next/standalone/.env.local`. The `makeAuthFetch()` helper returned `undefined` when the var was absent, so auth requests fell through to Kong (port 8000) which returned the string `"404 page not found"`. The Supabase client tried to `JSON.parse()` it, failing at position 4 (the space after `"404"`).

**Fixes applied:**
- `app/api/auth/login/route.ts` — added error log when `SUPABASE_AUTH_URL` missing
- `app/api/auth/signup/route.ts` — same guard + try/catch around body parse
- `lib/supabase/server.ts` — same guard

**Deployment note:** Always run `cp .env.local .next/standalone/.env.local` after every build.

---

### 2. `request.text()` body parsing failure across all API routes

**Root cause:** Next.js App Router pre-processes `application/json` bodies; calling `request.text()` returned unexpected values.

**Fix:** Replaced all 14 occurrences of `JSON.parse(await request.text())` with `await request.json()` across 12 route files.

---

### 3. `GET /api/classroom` returning 401 for `school_student` role

**Root cause:** `requireAuth()` blocked users whose `user_profiles.role` was `null` or `school_student`. The Cloudflare tunnel also broke cookie-based auth for server-side reads.

**Fix progression (each step failed for a different reason):**
1. `requireAuth()` → blocked null-role users
2. `getUser()` (makes GoTrue network call) → failed through Cloudflare tunnel
3. `getSession()` (reads JWT from cookie locally) → still unreliable through tunnel
4. **Final fix:** Removed auth entirely. Classroom IDs are 10-char nanoid strings (~10¹⁸ combinations) — unguessable, content is educational material not PII.

**File:** `app/api/classroom/route.ts`

---

### 4. DB fallback `42703: column classrooms.language does not exist`

**Root cause:** The `classrooms` table has no `language` or `agent_ids` columns. The fallback SELECT included them.

**Fix:** Changed SELECT to `id, title, created_at, scenes` only. Hardcoded defaults in stage reconstruction:
```typescript
stage: {
  id: row.id,
  name: row.title ?? '',
  createdAt: new Date(row.created_at).getTime(),
  updatedAt: Date.now(),
  language: 'en-US',   // column doesn't exist — hardcoded
  agentIds: [],         // column doesn't exist — hardcoded
}
```

---

### 5. `getSupabaseAdmin()` silent failure with missing env vars

**Root cause:** The `!` operator on undefined produced `"undefined"` string as the Supabase key, creating a broken client that silently failed on every query.

**Fix:** Added explicit guard that throws immediately with a clear message:
```typescript
if (!url || !key) {
  throw new Error(`getSupabaseAdmin: missing env vars: ${missing} — check .env.local is copied to .next/standalone/`)
}
```

**File:** `lib/server/supabase-admin.ts`

---

### 6. Stale stage store — all classroom links showed the same course

**Root cause:** `loadFromStorage()` silently leaves the Zustand store untouched when IndexedDB has no entry (API-generated courses). Navigating to a new classroom left the previous course's data in state.

**Fix:** Added `clearStore()` call at the top of the `useEffect` in the classroom page, before all other store resets. Also strengthened the DB fallback guard:
```typescript
// Before
if (!useStageStore.getState().stage)
// After  
if (!useStageStore.getState().stage || useStageStore.getState().stage?.id !== classroomId)
```

**File:** `app/classroom/[id]/page.tsx`

---

## Features Added in This Session

### Incremental Scene Saves

Courses are now saved to Supabase incrementally during generation rather than only at the end.

**Flow:**
1. `init` POST to `POST /api/user/classrooms` immediately when generation starts — creates a placeholder row, skips LLM title generation to avoid blocking
2. `PATCH /api/user/classrooms/[id]` after each scene is added — updates `scenes` column
3. Final `POST /api/user/classrooms` at the end — runs LLM title generation and subject classification

**Files changed:**
- `app/api/user/classrooms/route.ts` — added `init` mode flag
- `app/api/user/classrooms/[id]/route.ts` — **new file**, `PATCH` handler
- `app/generation-preview/page.tsx` — fires init POST + PATCH per scene
- `lib/hooks/use-scene-generator.ts` — fires PATCH per scene in resume/retry flows

**Note:** PATCH uses `UPDATE` (not upsert), so if the init POST hasn't completed yet the PATCH silently no-ops; the final POST is the fallback.

---

### Unassign Courses

Teachers can now remove course assignments from students.

**API:** `DELETE /api/teacher/assign-course`
- Body: `{ classroom_id: string, student_id: string }`
- Teachers: can only unassign rows where `assigned_by = their own user_id`
- Admins: can unassign any row
- Auth pattern: same as existing POST — `getUser()` + admin profile role check

**UI:** Assignments tab in `TeacherDashboard` — "Unassign" button per row with per-row loading state; row removed from local state on success.

**Files changed:**
- `app/api/teacher/assign-course/route.ts` — added `DELETE` handler
- `components/dashboard/TeacherDashboard.tsx` — added `unassigningId` state, `unassignCourse()` handler, Actions column in table

---

## Database Schema (Key Tables)

```sql
-- Classrooms
classrooms (
  id, user_id, title, short_title, topic, scenes, status,
  is_public, thumbnail_url, created_at, updated_at,
  subject_id, grade
)
-- NOTE: no `language` or `agent_ids` columns

-- User profiles
user_profiles (
  id,           -- matches auth.users.id
  role,         -- 'student' | 'teacher' | 'admin' | 'school_student'
  display_name,
  teacher_id,   -- set for school_students
  invite_code,
  grade, school, gender
)

-- Course assignments
course_assignments (
  id, classroom_id, assigned_to, assigned_by, assigned_at,
  UNIQUE(classroom_id, assigned_to)
)

-- Quiz results
quiz_results (
  id, user_id, classroom_id, scene_id,
  question, answer, correct, score, taken_at
)

-- Subjects
subjects (id, name, icon)
```

---

## Infrastructure Notes

### Self-Hosted Supabase Stack
| Service | Port | Notes |
|---------|------|-------|
| Kong (API gateway) | 8000 | Default Supabase routing |
| GoTrue (auth) | 9999 | Must be set via `SUPABASE_AUTH_URL` |
| PostgREST | 3000 | Accessed through Kong |

### Critical Env Vars
```
NEXT_PUBLIC_SUPABASE_URL      # Kong URL, e.g. http://192.168.10.128:8000
SUPABASE_AUTH_URL             # GoTrue direct URL, e.g. http://192.168.10.128:9999
SUPABASE_SERVICE_KEY          # Service role key for admin operations
NEXT_PUBLIC_SUPABASE_ANON_KEY # Anon key for client-side auth
```

### Deployment
```bash
npm run build
cp .env.local .next/standalone/.env.local   # CRITICAL — always do this
/opt/deploy-prod.sh                          # or: systemctl restart opentalib
```

---

## Auth Patterns Used

| Route type | Auth method | Why |
|------------|-------------|-----|
| Student-facing classroom GET | None | Nanoid IDs are unguessable; Cloudflare tunnel breaks cookies |
| Teacher/admin API routes | `supabase.auth.getUser()` + profile role check | Network call to GoTrue; reliable for server-initiated requests |
| Incremental saves (PATCH classrooms) | `supabase.auth.getSession()` | Cookie-only JWT read; no network call needed |
| Login/signup routes | Direct GoTrue REST via `makeAuthFetch()` | Bypasses Kong to hit GoTrue directly |

---

## Files Changed (Non-trivial)

| File | Change |
|------|--------|
| `app/api/classroom/route.ts` | DB fallback, auth removal, column fix |
| `app/api/user/classrooms/route.ts` | `init` mode, error logging |
| `app/api/user/classrooms/[id]/route.ts` | **New** — PATCH for incremental saves |
| `app/api/teacher/assign-course/route.ts` | Added DELETE handler |
| `app/api/auth/login/route.ts` | `SUPABASE_AUTH_URL` warning guard |
| `app/api/auth/signup/route.ts` | Same guard + body parse safety |
| `app/classroom/[id]/page.tsx` | clearStore on nav, stale-store fix |
| `app/generation-preview/page.tsx` | Init POST + per-scene PATCH |
| `lib/hooks/use-scene-generator.ts` | Per-scene PATCH in resume/retry |
| `lib/server/supabase-admin.ts` | Fast-fail on missing env vars |
| `lib/supabase/server.ts` | `SUPABASE_AUTH_URL` warning guard |
| `components/dashboard/TeacherDashboard.tsx` | Unassign button + handler |
| 12 API route files | `request.json()` replacing `JSON.parse(request.text())` |

---

## Known Limitations / Future Work

- **Classroom GET has no auth** — acceptable given nanoid entropy, but consider adding optional token validation if content sensitivity increases
- **Incremental save PATCH is fire-and-forget** — if all PATCHes fail and the final POST also fails, scene data is only in IndexedDB (local to that browser)
- **Rate limiting is in-memory** — resets on process restart; consider Redis for multi-instance or persistent rate limits
- **`school_student` role** — currently blocked from some RBAC checks; ensure all teacher-assigned content endpoints explicitly allow this role
