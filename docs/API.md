# API Documentation (v2.0)

This document lists the core API endpoints for **OpenTalib**. All endpoints require authentication via Supabase session cookies unless otherwise noted.

---

## 1. Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | `POST` | Authenticates a user. |
| `/api/auth/signup` | `POST` | Creates a new user (Invite Code required for students). |
| `/api/auth/logout` | `POST` | Clears the session cookie. |

---

## 2. Course Generation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/generate/resolve-pedagogy` | `POST` | Analyzes topic/board/grade to create a pedagogy profile. |
| `/api/generate/scene-outlines-stream` | `POST` | Streams the course structure (outline) from the LLM. |
| `/api/generate/scene-content` | `POST` | Generates the full interactive content for a specific scene. |
| `/api/user/classrooms` | `POST` | Saves/Updates a course in the database. |
| `/api/user/classrooms/[id]` | `PATCH` | Used for incremental scene saves. |

---

## 3. Teacher Tools

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/teacher/students` | `GET` | Returns list of students linked to the teacher. |
| `/api/teacher/assign-course` | `POST` | Grants a student access to a specific course. |
| `/api/teacher/stats` | `GET` | Aggregate performance data for the class. |
| `/api/teacher/heatmap` | `GET` | Concept-level mastery data for the entire class. |

---

## 4. Assessment (Exam Engine)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/exam/generate-questions` | `POST` | Creates board-aligned questions from course content. |
| `/api/exam/sessions` | `POST` | Starts a new timed mock exam session. |
| `/api/exam/sessions/[id]/submit` | `POST` | Submits student answers for AI marking. |

---

## 5. Learning & Progress

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/planner` | `POST` | Generates a weekly study plan for an upcoming exam. |
| `/api/spaced-repetition/review` | `POST` | Fetches concepts due for review (SM-2). |
| `/api/user/course-progress` | `POST/PATCH`| Tracks scene views and course completions. |
| `/api/quiz-grade` | `POST` | Grades a classroom quiz and updates concept mastery. |

---

## 6. Content Enrichment

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/content/mindmap` | `POST` | Returns mind map JSON for a given scene text. |
| `/api/content/revision-cards` | `POST` | Returns printable HTML flashcards for course concepts. |

---

## Role-Based Access Control (RBAC)

- **Admin (`admin`):** Access to all `/api/admin/*` and management tools.
- **Teacher (`teacher`):** Access to student management, course generation, and assignments.
- **Mature Student (`mature_student`):** Access to course generation and learning tools.
- **School Student (`school_student`):** Access to assigned courses and learning tools only.
