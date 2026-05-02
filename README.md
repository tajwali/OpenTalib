# OpenTalib

> **Open Multi-User AI Classroom Platform for Schools**
>
> An AI-powered school management system with course generation, student assignments, progress tracking, and exam management.

![License](https://img.shields.io/badge/license-AGPL--3.0-blue)
![Status](https://img.shields.io/badge/status-production--ready-green)
![Node](https://img.shields.io/badge/node-20.x-brightgreen)

---

## 🙏 Acknowledgment

**OpenTalib is built upon [OpenMAIC](https://github.com/THU-MAIC/OpenMAIC) by the MAIC team at Tsinghua University.**

OpenMAIC is a brilliant single-user AI classroom generation platform. We have transformed it into a comprehensive multi-user school management platform while maintaining the AGPL-3.0 license and crediting the original team.

**If you find OpenTalib useful, please also consider the original OpenMAIC project.**

---

## What is OpenTalib?

OpenTalib is a modern, open-source platform for schools to:

- **Teachers** manage students, generate AI courses, assign content, and track progress
- **Students** take assigned courses, complete quizzes, and view their achievements
- **Administrators** oversee the entire platform, manage users, and view institution-wide analytics

### Key Features

✅ **Multi-User System with 4 Roles:**
- Admin — platform management, user oversight, statistics
- Teacher — student management, course generation, assignments, analytics
- School Student — access assigned courses, take quizzes and exams
- Mature Student — self-directed learning, generate own courses

✅ **AI-Powered Content Generation:**
- Automatic course generation from prompts using Google Gemini or other LLMs
- AI-generated quizzes and exams with explanations
- Text-to-speech narration with gender-based voice selection
- AI-generated diagrams and illustrations

✅ **Course Management:**
- Teachers assign specific courses to specific students
- Grade-aware content (Grades 1-12)
- Subject classification and filtering
- Cross-device media serving (images and audio stored server-side)

✅ **Progress Tracking:**
- Student quiz results and scores
- Course completion tracking
- Teacher analytics and student performance insights
- Exam result management

✅ **Self-Hosting:**
- Full control over your data
- Works behind Cloudflare tunnels
- Supports local LLMs (Ollama)
- Docker Compose and manual installation options

---

## Quick Start

### Prerequisites

- Node.js 20.x
- pnpm 10.x
- PostgreSQL 15 (or use Supabase)
- API keys: Google Gemini (free tier available)

### Option A: Docker Compose (Recommended)

```bash
git clone https://github.com/tajwali/OpenTalib.git
cd OpenTalib
docker compose up -d
```

Visit `http://localhost:3000` and sign up.

**See [Docker Setup Guide](./docs/DOCKER.md) for detailed instructions.**

### Option B: Manual Installation

```bash
# Clone and install
git clone https://github.com/tajwali/OpenTalib.git
cd OpenTalib
pnpm install

# Configure environment
cp .env.example .env.local
nano .env.local  # Fill in your API keys

# Build and run
pnpm build
pnpm start
```

**See [Deployment Guide](./docs/DEPLOYMENT.md) for detailed instructions.**

---

## Documentation

- **[Deployment Guide](./docs/DEPLOYMENT.md)** — Installation on Ubuntu/Debian, Docker, and Proxmox
- **[Admin Manual](./docs/ADMIN-MANUAL.md)** — User management, subject management, platform configuration
- **[Teacher Manual](./docs/TEACHER-MANUAL.md)** — Student management, course generation, assignments, analytics
- **[Student Manual](./docs/STUDENT-MANUAL.md)** — Taking courses, completing quizzes, viewing progress
- **[API Reference](./docs/API.md)** — REST API endpoints for developers
- **[Architecture Guide](./docs/ARCHITECTURE.md)** — Database schema, authentication, file structure

---

## Technology Stack

- **Frontend:** Next.js 16 (App Router, Turbopack)
- **Backend:** Node.js with Next.js API routes
- **Database:** PostgreSQL via Supabase
- **Authentication:** Supabase GoTrue
- **AI Models:**
  - LLMs: Google Gemini, OpenAI, OpenRouter, Ollama (local)
  - Image: Gemini Image API, DALL-E
  - TTS: Google Cloud TTS, ElevenLabs, OpenAI
- **Storage:** Local filesystem with symlink persistence
- **Deployment:** Systemd services, Docker Compose, Cloudflare Tunnels

---

## What's Different from OpenMAIC?

OpenMAIC is a single-user tool for generating personal AI courses. OpenTalib extends it into a **multi-user school management platform**:

| Feature | OpenMAIC | OpenTalib |
|---------|----------|-----------|
| Users | Single | Multiple with roles |
| Authentication | Access codes | Full auth system |
| Course Assignments | N/A | Teacher assigns to students |
| Progress Tracking | N/A | Quiz results, completion tracking |
| Admin Panel | N/A | Full dashboard |
| Grade System | N/A | Grades 1-12 |
| Media Storage | Browser only | Server-side + cross-device |
| Database | Browser IndexedDB | PostgreSQL + Supabase |

**Major additions:**
- Full authentication system with 4 user roles
- Teacher dashboard with student and course management
- Admin dashboard with platform statistics
- Course assignments and student tracking
- Grade-aware content generation
- Cross-device media serving
- Exam system with result tracking
- Invite code system for teacher enrollment

See [CHANGES.md](./CHANGES.md) for a detailed changelog of all modifications from OpenMAIC.

---

## Getting Started (Users)

### Create an Account

1. Go to your OpenTalib instance
2. Click "Sign Up"
3. Choose your role:
   - **Independent Learner** — generate courses for yourself
   - **School Student** — join a teacher's class (need invite code)
4. Complete your profile

### First Course (Teachers)

1. Go to **My Courses** dashboard
2. Click **+ Generate New Course**
3. Describe your lesson:
   - Example: "Grade 7 Mathematics — Chapter 3 on Linear Equations with practice problems"
4. Choose options: language, images, narration
5. Click **Enter Classroom**
6. Wait 2-5 minutes for generation
7. Review and assign to students

### Assigning to Students

1. Find the course in **My Courses**
2. Click **Assign**
3. Select students
4. Click **Assign Course**
5. Students see it in their dashboard immediately

### Taking a Course (Students)

1. Find the course in **Assigned Courses**
2. Click to open
3. Navigate scenes with arrow buttons
4. Answer quizzes when they appear
5. Submit to see results

---

## Development

### Prerequisites
- Node.js 20.x
- pnpm 10.x
- Docker (for running services)

### Setup Development Environment

```bash
git clone https://github.com/tajwali/OpenTalib.git
cd OpenTalib
pnpm install
cp .env.example .env.local

# Configure .env.local with API keys
# Start services
docker compose -f docker-compose.dev.yml up -d

# Run development server
pnpm dev
```

Visit `http://localhost:3000`

### Branch Structure

- **main** — stable production release
- **develop** — active development
- Feature branches — `feature/description`

### Making Changes

```bash
git checkout -b feature/my-feature
# Make changes
pnpm lint
pnpm build
git add -A
git commit -m "feat: description of change"
git push origin feature/my-feature
```

Create a Pull Request on GitHub.

---

## Deployment

### Production Checklist

- [ ] Set strong database password
- [ ] Configure JWT secret (32+ chars)
- [ ] Set up HTTPS/SSL (Cloudflare or Let's Encrypt)
- [ ] Configure API keys for all providers
- [ ] Set up regular backups
- [ ] Review security settings
- [ ] Test user registration and login
- [ ] Test course generation
- [ ] Test assignments workflow

See [Deployment Guide](./docs/DEPLOYMENT.md) for full instructions.

---

## Configuration

### Environment Variables

Required:
```env
# Google Gemini
GOOGLE_API_KEY=your-key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://your-server:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
SUPABASE_SERVICE_KEY=your-key
SUPABASE_JWT_SECRET=your-secret-32-chars-minimum

# Optional: Local LLM (Ollama)
ALLOW_LOCAL_NETWORKS=true
OLLAMA_BASE_URL=http://your-ip:11434/v1
DEFAULT_MODEL=ollama:llama2
```

See [.env.example](./.env.example) for all available options.

---

## Support

### For Users
- **Deployment Issues:** See [Troubleshooting](./docs/DEPLOYMENT.md#troubleshooting)
- **Account Problems:** Contact your administrator
- **Feature Requests:** Open a GitHub issue

### For Developers
- **Architecture Questions:** See [ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **API Reference:** See [API.md](./docs/API.md)
- **Code Issues:** Open a GitHub issue with reproduction steps

### Community

- **GitHub Issues:** Bug reports and feature requests
- **GitHub Discussions:** Questions and ideas
- **Email:** taj@tajwali.uk

---

## License

OpenTalib is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

This means:
- ✅ You can use it freely
- ✅ You can modify it
- ✅ You can host it for others
- ⚠️ You must share your modifications
- ⚠️ If you offer it as a service, you must provide source code to users

See [LICENSE](./LICENSE) for details.

---

## Credits

**OpenTalib** is built on [OpenMAIC](https://github.com/THU-MAIC/OpenMAIC) by:
- Tsinghua University MAIC team
- Lead maintainer and original architect

OpenMAIC is an incredible piece of work. We have extended it significantly but the foundation is entirely theirs.

**Contributors to OpenTalib:**
- Tajwali — Multi-user system, authentication, teacher/admin dashboards

---

## Roadmap

### Phase 13 — Supervisor Role
- New role between admin and teacher
- Manage multiple teachers and view cross-teacher analytics

### Phase 14 — Mature Student Features
- Public course library
- Fork and remix courses from other students

### Phase 15 — Production Release
- Docker Compose installer with one-click setup
- Kubernetes deployment guide
- Bilingual interface (English/Urdu)

---

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes and test thoroughly
4. Commit with clear messages (`git commit -m 'feat: add amazing feature'`)
5. Push to your branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

Please ensure:
- Code follows the existing style
- All tests pass (`pnpm test`)
- Documentation is updated
- AGPL-3.0 license header is in new files

---

## Security

- Report security issues to **taj@tajwali.uk** (do not open public issues)
- Review our security practices in [docs/SECURITY.md](./docs/SECURITY.md)
- Keep dependencies updated: `pnpm audit`

---

## FAQ

**Q: Can I run this on a small server?**
A: Yes, OpenTalib runs on minimal hardware (2GB RAM, 2 CPU).

**Q: How much does it cost?**
A: OpenTalib itself is free. You pay only for API keys you use (Google Gemini has a free tier).

**Q: Can I use it with a local LLM?**
A: Yes, fully supports Ollama. See [Local LLM Setup](./docs/OLLAMA.md).

**Q: Is my data private?**
A: Yes, self-hosted means your data stays on your server. No external analytics or tracking.

**Q: How many users can it handle?**
A: Tested with 50+ concurrent users. Scales to 1000+ with proper infrastructure.

---

## Related Projects

- **[OpenMAIC](https://github.com/THU-MAIC/OpenMAIC)** — Original single-user platform
- **[Supabase](https://supabase.com)** — Open-source Firebase alternative
- **[Next.js](https://nextjs.org)** — React framework we're built on

---

**Made with ❤️ for education. Licensed under AGPL-3.0.**

Questions? [Open an issue](https://github.com/tajwali/OpenTalib/issues) or reach out.
