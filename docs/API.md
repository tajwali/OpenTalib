# API Documentation

This document describes the API endpoints for **OpenTalib**.

## Authentication

All requests (except login/signup) require a valid Supabase session. The session is managed via HTTP-only cookies in the browser.

For server-to-server communication or admin scripts, you can use the `SUPABASE_SERVICE_KEY` in the `Authorization` header:

```http
Authorization: Bearer <your-service-key>
```

## Role-Based Access (RBAC)

| Endpoint Prefix | Allowed Roles |
|-----------------|---------------|
| `/api/admin/*`  | `admin` |
| `/api/teacher/*`| `teacher`, `admin` |
| `/api/user/*`   | All authenticated users |
| `/api/generate/*`| `teacher`, `admin`, `mature_student` |

## Endpoints

### 1. Authentication

#### `POST /api/auth/login`
Authenticates a user and sets a session cookie.
- **Body:** `{ "email": "...", "password": "..." }`

#### `POST /api/auth/signup`
Creates a new user account.
- **Body:** `{ "email": "...", "password": "...", "inviteCode": "...", "role": "..." }`
- **Note:** `inviteCode` is required for `school_student` role.

### 2. Teacher API

#### `GET /api/teacher/students`
Lists all students linked to the teacher.

#### `POST /api/teacher/assign-course`
Assigns a course to one or more students.
- **Body:** `{ "classroom_id": "...", "student_ids": ["..."] }`

#### `DELETE /api/teacher/assign-course`
Removes a course assignment.
- **Body:** `{ "classroom_id": "...", "student_id": "..." }`

#### `GET /api/teacher/stats`
Returns aggregated statistics for the teacher's students and courses.

### 3. User API

#### `GET /api/user/classrooms`
Returns all courses owned by the user.

#### `POST /api/user/classrooms`
Saves or updates a course. Support `init: true` for placeholder creation.
- **Body:** `{ "id": "...", "title": "...", "scenes": [...], "init": boolean }`

#### `PATCH /api/user/classrooms/[id]`
Used for incremental scene saves during generation.
- **Body:** `{ "scenes": [...] }`

#### `GET /api/user/assigned-classrooms`
Returns courses assigned to the student by their teacher.

### 4. Admin API

#### `GET /api/admin/users`
Lists all users in the system (via GoTrue Admin API).

#### `PATCH /api/admin/users`
Update user profile or role.
- **Body:** `{ "user_id": "...", "new_role": "...", "display_name": "...", "disabled": boolean }`

#### `GET /api/admin/stats`
Returns system-wide platform statistics.

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication. |
| `FORBIDDEN` | 403 | User role does not have permission for this resource. |
| `MISSING_REQUIRED_FIELD` | 400 | The request body is missing a required parameter. |
| `INTERNAL_ERROR` | 500 | An unexpected error occurred on the server. |
| `AUTH_CONFIG_ERROR` | 500 | Server-side environment variables for Auth are missing. |
