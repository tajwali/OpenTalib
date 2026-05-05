# OpenTalib

<p align="center">
  <img src="assets/banner.png" alt="OpenTalib Banner" width="680"/>
</p>

<p align="center">
  <b>Immersive, multi-agent learning with persistent accounts and role-based access control.</b>
</p>

<p align="center">
  <a href="https://tutor.tajwali.uk"><img src="https://img.shields.io/badge/Demo-Live-brightgreen?style=flat-square" alt="Live Demo"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue.svg?style=flat-square" alt="License: AGPL-3.0"/></a>
</p>

---

## 📖 Overview

**OpenTalib** is a powerful, self-hosted Learning Management System (LMS) that leverages multi-agent AI to create immersive interactive classrooms. It transforms static topics or PDF documents into dynamic learning experiences featuring AI teachers, student agents, interactive slides, and real-time discussions.

This project is a significantly extended platform featuring a full **multi-user system** with persistent accounts, role-based dashboards (Admin, Teacher, Student), and cross-device access.

---

## ✨ Key Features

- **Multi-User Role System:** Specialized dashboards for Admin, Teacher, School Student, and Mature Student.
- **AI-Powered Generation:** Create full courses from simple prompts or PDF uploads.
- **Persistent Progress:** All courses, scenes, and quiz results are saved to a persistent Supabase database.
- **Interactive AI Classroom:** Multi-agent discussions with TTS (Text-to-Speech) and interactive whiteboard capabilities.
- **Teacher-Student Linking:** Invite code system for teachers to manage their students and assignments.
- **Timed Assessments:** Automated exam generation and result tracking.
- **Flexible Deployment:** Supports Manual Ubuntu setup, Docker Compose, and Proxmox LXC.

---

## 📚 Documentation

Detailed guides for setting up and using OpenTalib:

- **[Deployment Guide](docs/DEPLOYMENT.md)** — Installation, environment variables, and self-hosting instructions.
- **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)** — Solutions to common setup and operational issues.
- **[Administrator Manual](docs/ADMIN-MANUAL.md)** — First-time setup, managing users, and platform stats.
- **[Teacher Manual](docs/TEACHER-MANUAL.md)** — Managing students, generating courses, and assignments.
- **[Student Manual](docs/STUDENT-MANUAL.md)** — Navigating the AI classroom and tracking progress.
- **[API Documentation](docs/API.md)** — Endpoint reference and role-based access control.

---

## 🚀 Quick Start

1. **Clone the Repo:** `git clone https://github.com/tajwali/OpenTalib.git`
2. **Install Dependencies:** `pnpm install`
3. **Configure Environment:** Copy `.env.example` to `.env.local` and add your keys.
4. **Database Setup:** Apply migrations in `supabase/migrations/` to your PostgreSQL database.
5. **Build and Run:** `pnpm build && pnpm start`

For detailed instructions, see the **[Deployment Guide](docs/DEPLOYMENT.md)**.

---

## 🏗️ Architecture

OpenTalib is designed for production stability:
- **Frontend/Backend:** Next.js (App Router) in standalone mode.
- **Database/Auth:** Supabase (Self-hosted or Cloud).
- **AI Integration:** Google Gemini, OpenAI, Anthropic, and local LLMs via Ollama.
- **Media:** Persistent storage for generated images and audio files.

---

## 📄 License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).
