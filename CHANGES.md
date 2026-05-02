# CHANGES.md — OpenTalib Modifications from OpenMAIC

> This document details all changes made to transform OpenMAIC into OpenTalib.
> 
> **OpenTalib is based on [OpenMAIC](https://github.com/THU-MAIC/OpenMAIC) by Tsinghua University MAIC team (AGPL-3.0).**

---

## Overview

OpenMAIC was a **single-user AI classroom generation tool**. OpenTalib transforms it into a **multi-user school management platform** with full authentication, role-based access control, teacher dashboards, student tracking, and institution-wide administration.

This is not a simple feature addition — it's a fundamental architectural shift from single-user browser-based to multi-user server-backed system.

---

## Major Architectural Changes

### 1. Authentication System (NEW)

**OpenMAIC:** Used localStorage-based ACCESS_CODE system for browser access control.

**OpenTalib:** Full multi-user authentication:
- Supabase GoTrue authentication service
- Cookie-based sessions (Cloudflare-compatible)
- 4 user roles: admin, teacher, school_student, mature_student
- User profiles with extended attributes (gender for TTS, grade, teacher assignment)
- Login/signup flow with role selection
- Session validation on all protected routes

**Files Added:**
- `app/login/page.tsx` — Login page
- `app/signup/page.tsx` — Signup with role selection
- `app/api/auth/login/` — Login API endpoint
- `app/api/auth/logout/` — Logout endpoint
- `app/api/auth/signup/` — Signup endpoint
- `lib/supabase/server.ts` — Supabase client setup
- `lib/server/require-role.ts` — RBAC middleware

### 2. Database (PostgreSQL/Supabase)

**OpenMAIC:** Courses stored in browser IndexedDB only. No persistent backend storage.

**OpenTalib:** All data persists in PostgreSQL via Supabase:

**Tables Added:**
- `user_profiles` — Extended user data (role, display_name, gender, grade, teacher_id, invite_code)
- `classrooms` — Courses with metadata (title, short_title, grade, subject_id, created_at)
- `course_assignments` — Teacher assigns course to student (classroom_id, assigned_to, assigned_by, due_date)
- `subjects` — Subject categories (name, icon, is_default, created_by)
- `course_progress` — Student progress tracking (user_id, classroom_id, scenes_completed, completion status)
- `quiz_results` — Quiz and exam results (user_id, classroom_id, scene_id, answers, percentage)
- `exams` — Exam definitions (title, course_id, question_count, time_limit)
- `exam_results` — Exam attempt results (user_id, exam_id, score, timestamp)

**Impact:** Courses now survive browser refresh/device change. Multi-device access supported.

### 3. Role-Based Access Control (NEW)

**OpenMAIC:** No user roles. Everyone could do everything.

**OpenTalib:** Four distinct user roles with permissions:

```
ADMIN
├── View/edit/delete all users
├── Ban/unban users
├── Reset any password
├── Manage subjects (add/delete)
├── View platform statistics
└── Generate courses

TEACHER
├── Generate courses
├── Manage own students (via invite code)
├── Edit student name/grade/password
├── Assign courses to students
├── View student analytics
└── Create and manage exams

SCHOOL_STUDENT
├── View only ASSIGNED courses
├── Take quizzes within courses
├── Take assigned exams
├── View own progress
└── Edit own profile

MATURE_STUDENT
├── Generate own courses
├── View own courses
├── Create own exams
├── Take own exams
├── Add custom subjects
└── Edit own profile
```

**Files Added:**
- `lib/server/require-role.ts` — Role validation middleware
- `components/dashboard/AdminDashboard.tsx` — Admin interface
- `components/dashboard/TeacherDashboard.tsx` — Teacher interface
- `components/dashboard/SchoolStudentDashboard.tsx` — School student interface
- `components/dashboard/MatureStudentDashboard.tsx` — Mature student interface
- `app/page.tsx` — Role-based dashboard router

### 4. Media Persistence (Cross-Device)

**OpenMAIC:** All images and audio stored in browser memory/localStorage. Lost when browser cleared.

**OpenTalib:** Server-side media storage:
- AI-generated images saved to `/opt/openmaic-data/classrooms/{courseId}/media/`
- TTS audio saved to `/opt/openmaic-data/classrooms/{courseId}/audio/`
- Served via `/api/classroom-media/{courseId}/{type}/{filename}`
- Symlink-based persistence: survives server restarts and deploys

**Files Added:**
- `app/api/user/classrooms/media/route.ts` — Media upload endpoint
- `app/api/classroom-media/[id]/route.ts` — Media serving endpoint
- `lib/media/media-orchestrator.ts` — Image generation + upload orchestration
- `lib/audio/tts-client.ts` — TTS generation + upload

**Impact:** Images/audio now work across devices. Mobile users can access their courses.

### 5. Course Assignments (NEW)

**OpenMAIC:** No concept of course assignment. One user, one course.

**OpenTalib:** Teachers assign specific courses to specific students:
- Teacher clicks "Assign" on any course
- Selects which students to assign to
- Students see assigned courses on their dashboard
- Due dates supported
- Automatic assignment notifications planned

**Files Added:**
- `app/api/teacher/assign-course/` — Assignment API endpoints
- `app/api/user/assigned-classrooms/route.ts` — Get student's assigned courses
- `components/dashboard/StudentAssignments.tsx` — Student course list

### 6. Grade System (NEW)

**OpenMAIC:** No grade concept. Single user generating for themselves.

**OpenTalib:** Grade-aware system for K-12:
- Grades 1-12 stored in user_profiles (for students) and classrooms
- Course generation considers student grade for appropriate difficulty
- Students filtered by grade (see only grade-appropriate + ungraded courses)
- Grade badges on course cards
- Grade-aware LLM prompting

**Files Added:**
- `lib/server/grade-utils.ts` — Grade filtering and validation
- `components/GradeBadge.tsx` — Visual grade indicator
- Grade fields in `app/api/user/profile/` endpoints

### 7. Subject Classification (NEW)

**OpenMAIC:** No subject system. Courses were just "my courses".

**OpenTalib:** Subject categorization:
- Default subjects: Mathematics, Physics, Chemistry, Biology, Computer Science, History, Geography, English, Islamic Studies, Other
- Admin can add custom subjects
- AI automatically classifies generated courses
- Subject filter dropdowns across dashboards
- Teachers can add custom subjects for their courses

**Files Added:**
- `app/api/subjects/route.ts` — Subject CRUD
- `app/api/admin/subjects/` — Admin subject management
- `components/SubjectFilter.tsx` — Subject dropdown filter

### 8. Admin Dashboard (NEW)

**OpenMAIC:** No admin panel. No user management concept.

**OpenTalib:** Full admin interface:
- User management: create, view, edit, delete users
- User ban/unban functionality
- Password reset capability
- Role change (promote/demote users)
- Last login tracking
- Subject management (add/delete custom subjects)
- Platform statistics:
  - Total users by role
  - Total courses generated
  - Total scenes generated
  - Storage usage
  - Recent activity feed

**Files Added:**
- `app/api/admin/users/route.ts` — User CRUD API
- `app/api/admin/stats/route.ts` — Platform statistics
- `components/dashboard/AdminDashboard.tsx` — Admin UI
- `components/admin/UserManagement.tsx` — User management table
- `components/admin/StatsDashboard.tsx` — Statistics display

### 9. Teacher Dashboard (NEW)

**OpenMAIC:** No student concept. No course assignment concept.

**OpenTalib:** Teacher workspace with three sections:

**Section 1: My Students**
- View all students assigned to this teacher
- Student data: name, grade, assigned courses, last quiz score
- Invite code to share with new students
- Regenerate invite code
- Expand student to see detailed progress

**Section 2: My Courses**
- List of courses generated by this teacher
- Generate new course button
- Assign course button (select students)
- Delete course

**Section 3: Assignments**
- Read-only view of all course assignments
- Shows course title, student name, date assigned

**Files Added:**
- `components/dashboard/TeacherDashboard.tsx` — Teacher UI
- `components/teacher/StudentList.tsx` — Student table
- `components/teacher/CourseAssignments.tsx` — Assignments UI
- `app/api/teacher/students/route.ts` — Get teacher's students
- `app/api/teacher/invite-code/route.ts` — Invite code management
- `app/api/teacher/courses/route.ts` — Get teacher's courses
- `app/api/teacher/stats/route.ts` — Teacher analytics

### 10. Student Dashboards (NEW)

**OpenMAIC:** Single user view. No student concept.

**OpenTalib:** Two distinct student interfaces:

**School Student Dashboard:**
- View assigned courses only (teacher-controlled)
- Grade filtering (sees grade-matched + ungraded courses)
- Quiz results table with scores
- Progress bars
- Profile editing

**Mature Student Dashboard:**
- Generate own courses (self-directed)
- View own courses grouped by subject
- Create own exams
- Subject filtering
- Custom subject creation
- Quiz results

**Files Added:**
- `components/dashboard/SchoolStudentDashboard.tsx` — School student UI
- `components/dashboard/MatureStudentDashboard.tsx` — Mature student UI

### 11. Profile & User Management (ENHANCED)

**OpenMAIC:** No user profiles. No display names.

**OpenTalib:** Full profile system:
- Display name editing
- Gender selection (affects TTS voice: male/female)
- Password change
- Grade selection (for school students)
- Teacher assignment (for school students)
- Last login timestamp
- Profile privacy controls planned

**Files Added:**
- `app/api/user/profile/route.ts` — Profile CRUD
- `components/profile/ProfileEditor.tsx` — Profile editing form
- Gender/voice mapping in TTS pipeline

### 12. Streaming & Real-Time Updates (ENHANCED)

**OpenMAIC:** Long-polling or WebSocket for generation updates.

**OpenTalib:** Server-Sent Events (SSE) for all generation:
- Course outline generation → `/api/generate/scene-outlines-stream`
- Scene content generation → `/api/generate/scene-content`
- Scene actions → `/api/generate/scene-actions`
- Agent profiles → `/api/generate/agent-profiles`
- Image generation → `/api/generate/image`
- TTS generation → `/api/generate/tts`

All endpoints stream progress with keepalive pings (every 5 seconds) to prevent Cloudflare 524 timeouts.

**Files Refactored:**
- `lib/hooks/use-scene-generator.ts` — Core generation orchestration
- `lib/utils/stream-fetch.ts` — SSE client utility
- All generation routes converted to streaming

---

## Feature Additions

### Quick Wins & UX Improvements

#### Auto-Generated Short Titles
- AI generates proper course titles from raw prompt
- Replaces "Create a course about..." with "Linear Equations"
- Stored in `classrooms.short_title` field

**Files Added:**
- `lib/server/classroom-utils.ts` — `generateShortTitle()` function

#### Course ID Badges
- Unique nanoid identifier shown inline with course title
- Click to copy functionality
- Helps students reference courses in conversations

#### Retry Images Button
- If image generation fails, regenerate without regenerating entire course
- Stores generation prompts on elements for retry
- Prevents frustration from temporary API failures

**Files Added:**
- `components/slides/RetryImageButton.tsx` — Retry UI
- Image prompt storage in stage metadata

#### Language Preference Fix
- User's explicit language selection takes priority over LLM inference
- Fixes incorrect language detection on some prompts

**Files Added:**
- `lib/generation/language-override.ts` — Language priority logic

#### Gender-Based TTS Voices
- Users select male/female voice during profile setup
- TTS pipeline respects selection
- Consistent AI teacher gender throughout course

#### Grade-Based Content
- Course generation considers student grade for appropriate difficulty
- Teachers can specify grade level for generated courses
- Grade badge shown on all course cards

### Integration Improvements

#### Ollama Support (from upstream cherry-pick)
- Full support for local LLMs
- Allows offline course generation
- ALLOW_LOCAL_NETWORKS security setting

**Files Added:**
- `lib/ai/providers.ts` — Ollama provider configuration
- `lib/server/ssrf-guard.ts` — SSRF protection for local networks

#### Custom TTS/ASR Providers (from upstream cherry-pick)
- Pluggable TTS provider system
- Support for: Google Cloud TTS, ElevenLabs, OpenAI TTS, custom providers
- Configured via `server-providers.yml`

#### ZIP Export/Import (from upstream cherry-pick)
- Export entire course as ZIP file (course.json + all media)
- Import previously exported courses
- Useful for backup and sharing

**Files Added:**
- `lib/export/use-export-classroom.ts` — Export orchestration
- `lib/export/classroom-zip-utils.ts` — ZIP file creation

---

## Database Schema Changes

### New Tables (from OpenMAIC → OpenTalib)

| Table | Purpose | Rows per Institution |
|-------|---------|----------------------|
| `user_profiles` | User metadata and roles | = users |
| `classrooms` | Courses metadata | Varies |
| `course_assignments` | Teacher → Student assignments | Varies |
| `subjects` | Subject categories | ~15-30 |
| `course_progress` | Student course completion | = users × courses |
| `quiz_results` | Quiz attempt results | = quiz attempts |
| `exams` | Exam definitions | Varies |
| `exam_results` | Exam attempt results | = exam attempts |

### Modified Tables

**auth.users** (from Supabase):
- Extended via `user_profiles` table (foreign key relationship)
- No changes to the core auth table

### Migration Scripts

**To upgrade from OpenMAIC to OpenTalib:**
```sql
-- Create new tables (see migrations/001_add_multi_user_schema.sql)
-- Create user_profiles for existing users
-- Set default role based on their access level
```

---

## API Changes

### New Endpoints (OpenTalib)

**Authentication:**
- `POST /api/auth/signup` — Create account with role selection
- `POST /api/auth/login` — Login with email/password
- `POST /api/auth/logout` — Logout and clear session

**User Management (Admin):**
- `GET/PATCH/DELETE /api/admin/users/[id]` — User CRUD
- `POST /api/admin/users/ban` — Ban user
- `POST /api/admin/users/unban` — Unban user
- `POST /api/admin/users/reset-password` — Reset password
- `GET /api/admin/stats` — Platform statistics

**Teacher:**
- `GET /api/teacher/students` — List my students
- `PATCH /api/teacher/students/[id]` — Edit student
- `POST /api/teacher/assign-course` — Assign course
- `DELETE /api/teacher/assign-course/[id]` — Remove assignment
- `GET /api/teacher/invite-code` — My invite code
- `POST /api/teacher/invite-code` — Regenerate invite code
- `GET /api/teacher/stats` — My analytics

**User (General):**
- `POST/PATCH/DELETE /api/user/classrooms` — Course CRUD
- `GET /api/user/assigned-classrooms` — My assigned courses
- `POST /api/user/course-progress` — Track progress
- `GET/PATCH /api/user/profile` — Profile management
- `GET /api/user/stats` — My statistics

**Subjects:**
- `GET/POST /api/subjects` — Subject list and creation
- `DELETE /api/subjects/[id]` — Delete subject

**Modified Endpoints from OpenMAIC:**
- All previously "global" endpoints now require authentication
- Course access filtered by ownership/assignment
- Media endpoints return 403 for unauthorized access

---

## Removed Features from OpenMAIC

Nothing has been removed. All of OpenMAIC's functionality is preserved:
- Course generation works the same
- Slide rendering is identical
- Quiz system still works
- TTS and image generation unchanged
- Whiteboard interaction preserved

The changes are **purely additive** — we wrap OpenMAIC functionality in a multi-user system.

---

## Security Enhancements

### New Security Features

1. **Session Management**
   - Secure cookies with httpOnly flag
   - Session validation on every protected route
   - Automatic logout on inactivity (planned)

2. **RBAC (Role-Based Access Control)**
   - `requireRole()` middleware on sensitive endpoints
   - Teachers can only access their own students
   - Students can only access assigned courses
   - Admins verified on every admin operation

3. **SSRF Protection**
   - `ssrf-guard.ts` validates all external URLs
   - Blocks requests to private IP ranges (unless ALLOW_LOCAL_NETWORKS=true)
   - Protects against DNS rebinding attacks
   - Required for Ollama support

4. **Data Privacy**
   - Students cannot see other students' progress
   - Teachers cannot see other teachers' students
   - Admin access logs planned

5. **CSRF Protection**
   - Next.js built-in CSRF protection
   - All POST/PATCH/DELETE requests validated

### Upstream Security Cherry-Picks

- SSRF DNS rebinding fix
- Anti-framing headers (CSP)
- Latest model presets

---

## Performance Changes

### What Improved

1. **Media Loading:** Server-side storage means faster, cached image loads
2. **Cross-Device:** No need to regenerate courses on different devices
3. **Database Queries:** PostgreSQL indexes on common filters (grade, subject)

### What's Slower

1. **First Generation:** Now waits for server-side media upload (slight delay)
2. **Database Queries:** Some queries slower than browser IndexedDB (but negligible at school scale)

### Optimization Done

- Image upload parallelized (up to 4 concurrent uploads)
- Database query caching on classrooms table
- Media deletion on course deletion

---

## Deployment Changes

### Infrastructure (OpenMAIC)

- Single Node.js process
- Browser storage only
- No database required
- Can run on tiny server

### Infrastructure (OpenTalib)

Requires multiple services:
1. **PostgreSQL** — Courses, users, progress
2. **Supabase GoTrue** — Authentication
3. **Next.js App** — Frontend + API routes
4. **PostgREST** (optional) — Direct DB access
5. **MinIO** (optional) — S3-compatible storage

**Good News:** Docker Compose eliminates setup complexity. Single command starts all services.

---

## Migration Guide (if upgrading from OpenMAIC)

### Data Migration
1. Export courses from OpenMAIC (JSON files)
2. Import into OpenTalib via import endpoint
3. Create user accounts
4. Assign courses to students

### Code Migration
OpenTalib is **not backward compatible** with OpenMAIC:
- Different authentication system
- Different database schema
- Different API endpoints
- Different environment variables

**Recommendation:** Treat OpenTalib as a new product, not an upgrade path. OpenMAIC users should create new OpenTalib instance.

---

## Testing Coverage

### Unit Tests (NEW)
- `lib/server/require-role.test.ts` — RBAC middleware
- `lib/server/grade-utils.test.ts` — Grade filtering
- `lib/generation/json-repair.test.ts` — JSON repair for Ollama

### Integration Tests (NEW)
- `__tests__/api/auth.test.ts` — Signup/login flow
- `__tests__/api/teacher.test.ts` — Teacher endpoints
- `__tests__/api/assignments.test.ts` — Course assignment flow

### Manual Testing (Required)
- [ ] Signup as each role
- [ ] Teacher invite code system
- [ ] Course assignment to multiple students
- [ ] Student sees only assigned courses
- [ ] Admin user management
- [ ] Subject management
- [ ] Ollama course generation
- [ ] Cross-device course access

---

## Documentation Changes

**OpenMAIC:**
- README with feature list
- Basic setup guide
- No role documentation
- No multi-user guide

**OpenTalib:**
- Comprehensive README with architecture
- [DEPLOYMENT.md](./docs/DEPLOYMENT.md) — Installation guide
- [ADMIN-MANUAL.md](./docs/ADMIN-MANUAL.md) — Admin features
- [TEACHER-MANUAL.md](./docs/TEACHER-MANUAL.md) — Teacher guide
- [STUDENT-MANUAL.md](./docs/STUDENT-MANUAL.md) — Student guide
- [API.md](./docs/API.md) — API reference
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) — Database & design
- [CHANGES.md](./CHANGES.md) — This file

---

## File Structure Comparison

### OpenMAIC (`/opt/OpenMAIC/`)
```
app/
  ├── page.tsx              ← Single user home
  ├── generate/page.tsx     ← Generation form
  ├── classroom/[id]/       ← Course playback
  └── api/
      ├── generate/         ← Generation endpoints
      └── classroom/        ← Course data

lib/
  ├── hooks/
  ├── utils/
  └── ai/
```

### OpenTalib (`/opt/OpenTalib/`)
```
app/
  ├── page.tsx              ← Role-based router
  ├── login/page.tsx        ← NEW: Login
  ├── signup/page.tsx       ← NEW: Signup
  ├── generate/page.tsx     ← Generation form (auth required)
  ├── classroom/[id]/       ← Course playback (auth required)
  ├── profile/page.tsx      ← NEW: Profile editing
  └── api/
      ├── auth/             ← NEW: Authentication
      ├── admin/            ← NEW: Admin endpoints
      ├── teacher/          ← NEW: Teacher endpoints
      ├── user/             ← NEW: General user endpoints
      ├── generate/         ← Generation (updated for streaming)
      ├── classroom/        ← Course data (updated)
      └── subjects/         ← NEW: Subject management

lib/
  ├── server/
  │   ├── require-role.ts   ← NEW: RBAC
  │   ├── supabase-admin.ts ← NEW: Admin client
  │   ├── classroom-storage.ts
  │   ├── ssrf-guard.ts     ← NEW: Security
  │   └── classroom-utils.ts
  ├── supabase/
  │   └── server.ts         ← NEW: Supabase setup
  ├── hooks/
  │   └── use-scene-generator.ts (updated)
  └── ...

components/
  ├── dashboard/
  │   ├── AdminDashboard.tsx      ← NEW
  │   ├── TeacherDashboard.tsx    ← NEW
  │   ├── SchoolStudentDashboard.tsx ← NEW
  │   └── MatureStudentDashboard.tsx ← NEW
  └── ...
```

---

## Commit History Highlights

Key commits that implement each phase:

- Phase 1-9: Multi-user architecture (150+ commits)
- Phase 10: UX improvements (20+ commits)
- Phase 11: Profile system (15+ commits)
- Phase 12: Admin features (25+ commits)
- Cross-cutting: Security, performance, documentation (50+ commits)

Total: **260+ commits from OpenMAIC baseline**

---

## Known Differences from Upstream

1. **Auth:** OpenTalib requires login; OpenMAIC uses access codes
2. **Database:** OpenTalib uses PostgreSQL; OpenMAIC is browser-only
3. **Users:** OpenTalib supports unlimited users; OpenMAIC is single-user
4. **Persistence:** OpenTalib survives browser refresh; OpenMAIC needs IndexedDB
5. **Deployment:** OpenTalib requires server infrastructure; OpenMAIC is lightweight

---

## Future Divergence

### Planned OpenTalib Features
- Phase 13: Supervisor role (manage multiple teachers)
- Phase 14: Public course library
- Phase 15: Kubernetes deployment guide
- Bilingual interface (English/Urdu)
- Automated exam result notifications
- Parent dashboard (view child progress)

### Not Planned
- Merge back to upstream (fundamentally different products)
- Maintain compatibility with OpenMAIC (distinct code paths)

---

## How to Contribute

If you find a bug or have a feature request:

1. Check if it's a **general AI classroom feature** → consider contributing to [OpenMAIC upstream](https://github.com/THU-MAIC/OpenMAIC)
2. Check if it's a **multi-user/school system feature** → contribute here to OpenTalib
3. Open an issue describing the problem/feature
4. Submit a pull request with your changes

---

## Credits

All the hard work on the core AI classroom generation system belongs to the OpenMAIC team at Tsinghua University. We're grateful to them for building such a solid foundation.

**OpenTalib additions:** Tajwali (taj@tajwali.uk)

---

**Last Updated:** May 2026  
**OpenTalib Version:** 2.0.0  
**Based on OpenMAIC:** March 2026 snapshot
