# OpenTalib Developer Documentation (Single Source of Truth)

This document serves as the comprehensive technical reference for the **OpenTalib** project. It is intended for developers (human and AI) to understand the architecture, patterns, infrastructure, and operational procedures of the stack.

---

## 1. Project Overview

**OpenTalib** is an open-source, multi-user Learning Management System (LMS) powered by multi-agent AI. It transforms static educational content or PDFs into immersive interactive classrooms featuring AI teachers, student agents, real-time discussions, and automated assessments.

- **Forked From:** [OpenMAIC](https://github.com/THU-MAIC/OpenMAIC) by Tsinghua University.
- **License:** **AGPL-3.0** (Must be preserved in all forks and deployments).
- **Core Enhancements (OpenTalib 2.0):**
  - **Full Multi-User System:** Persistent accounts with Supabase Auth.
  - **Role-Based Access Control (RBAC):** Admin, Teacher, School Student, Mature Student roles.
  - **Pedagogy Resolver:** Intelligent alignment with specific exam boards (FBISE, Cambridge, etc.) and grade levels.
  - **Spaced Repetition System:** Integrated SM-2 algorithm for automated concept reviews.
  - **Exam Preparation Engine:** AI-generated board-aligned mock exams with automated AI marking.
  - **AI Study Planner:** Data-driven personalized study schedules based on student mastery.
  - **Production Stability:** Optimized for single-host Proxmox LXC deployment with systemd.

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
                                  | (Ollama at .50:8080)  |
                                  +-----------------------+
```

### 2.2 Technology Stack
- **Frontend/Backend:** Next.js 16.1 (App Router), React 19.
- **State Management:** Zustand (Client), Supabase (Server/Persistent).
- **Database:** PostgreSQL 15 (Supabase).
- **Authentication:** Supabase GoTrue (JWT, Cookies).
- **Styling:** Tailwind CSS 4.
- **AI Integration:** Vercel AI SDK (Unified `callLLM` layer).
- **Media:** Persistent local storage for generated images and audio files.

---

## 3. Core Engine Components

### 3.1 Pedagogy Resolver
Located in `lib/server/pedagogy-resolver.ts`, this is a two-stage agentic resolver called before course generation.
1. **Stage 1 (Reasoning):** Uses a world-class curriculum designer prompt to analyze the topic, board, and grade level.
2. **Stage 2 (Extraction):** Extracts the reasoning into a strict `PedagogyProfile` JSON object.

The profile controls:
- **Teaching Methodology:** (e.g., "i-do-we-do-you-do", "socratic").
- **Language Mix:** (e.g., "english-urdu", "bilingual").
- **Exam Style:** Specific constraints for boards like FBISE or Cambridge.

### 3.2 Spaced Repetition (SM-2)
Implemented in `lib/spaced-repetition/sm2.ts`, this system manages the "Review Queue" for students.
- **Concept Keys:** Extracted from course content during generation.
- **Mastery Tracking:** `concept_mastery` table stores the `ease_factor`, `interval_days`, and `repetitions` for every user-concept pair.
- **Review Loop:** Quizzes taken in the classroom trigger updates to the SM-2 state. Low-mastery concepts are prioritized in the student's dashboard.

### 3.3 Exam Engine
Located in `app/api/exam/`, the engine handles:
- **Question Generation:** Uses course concepts to create board-aligned questions with detailed mark schemes.
- **Mock Exam UI:** A full-screen, timed interface for assessment.
- **AI Marking:** An examiner agent grades student answers against the mark scheme, providing point-by-point feedback.

### 3.4 Study Planner
Located in `app/api/planner/`, this component generates weekly study schedules.
- **Data Input:** Combines the student's upcoming exam date with their identified weak concepts from the SM-2 system.
- **Plan Generation:** Creates a day-by-day plan including "study", "review", and "mock-exam" sessions.

---

## 4. Database Schema

OpenTalib uses a persistent PostgreSQL schema. Key tables:

- `user_profiles`: Extends `auth.users` with `role`, `display_name`, `grade`, and `teacher_id`.
- `classrooms`: Primary table for course content, metadata, and scene JSON.
- `course_progress`: Tracks completion and last-accessed scene per user.
- `concept_mastery`: Spaced repetition state per concept.
- `exam_questions` / `exam_sessions` / `exam_results`: Mock exam system data.
- `student_exams` / `study_plans`: AI study planner data.

---

## 5. Deployment & Operations

### 5.1 Infrastructure
OpenTalib is typically deployed in a single Proxmox LXC container (Ubuntu 22.04).
- **IP:** `192.168.10.142`
- **Port:** `3000` (Main), `3001` (Internal Standalone).
- **Service:** `opentalib.service` (Systemd).

### 5.2 Standalone Build Pattern
Next.js standalone mode is used for production.
1. `pnpm build`
2. Sync config: `cp .env.local .next/standalone/.env.local`
3. Static files: `cp -r .next/static .next/standalone/.next/`
4. Public assets: `cp -r public .next/standalone/`

### 5.3 Critical Environment Variables
- `SUPABASE_AUTH_URL`: Must point directly to GoTrue (port 9999).
- `SUPABASE_SERVICE_KEY`: Admin key for bypass and background tasks.
- `MEDIA_STORAGE_PATH`: Path for persistent assets (e.g., `/opt/opentalib-data`).
- `OLLAMA_BASE_URL`: URL for local LLM inference.

---

## 6. Development Workflow (Multi-Agent)

This project is developed using a multi-agent system:
- **Orchestrator (Gemini):** Strategic planning, remote server operations (SSH/SCP), architecture decisions.
- **Worker (Goose):** Local file creation, repetitive batch tasks.

### Plan Files
All major features are executed via formal plan files (e.g., `plan-03-phases-F-G-H.md`). Never deviate from the plan without updating the orchestrator log.

---

## 7. Common Issues & Fixes

- **401 on Redirect:** Ensure `SUPABASE_AUTH_URL` is correct in the standalone directory.
- **Images Not Loading:** Check the symlink from `.next/standalone/public/data` to the persistent media path.
- **PostgREST Cache:** If the schema changes, notify PostgREST via `NOTIFY pgrst, 'reload schema';`.
- **SSE Streaming:** Generation routes require `text/event-stream`. Ensure Nginx/Cloudflare doesn't buffer responses.

---

*Last Updated: May 2026*
