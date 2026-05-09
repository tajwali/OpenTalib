# OpenTalib

<p align="center">
  <img src="assets/banner.png" alt="OpenTalib Banner" width="680"/>
</p>

<p align="center">
  <b>Immersive, multi-agent AI learning platform with board-alignment and personalized study planning.</b>
</p>

<p align="center">
  <a href="https://tutor.tajwali.uk"><img src="https://img.shields.io/badge/Demo-Live-brightgreen?style=flat-square" alt="Live Demo"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue.svg?style=flat-square" alt="License: AGPL-3.0"/></a>
</p>

---

## 📖 Overview

**OpenTalib** is a powerful, self-hosted Learning Management System (LMS) that leverages multi-agent AI to create immersive interactive classrooms. It transforms static topics or PDF documents into dynamic learning experiences featuring AI teachers, student agents, interactive slides, and real-time discussions.

The platform is designed for academic excellence, featuring deep alignment with international exam boards, automated mock exams, and an intelligent study planner that adapts to each student's mastery level.

---

## ✨ Key Features

- **Multi-User Role System:** Specialized dashboards for Admin, Teacher, School Student, and Mature Student.
- **AI-Powered Pedagogy:** Smart alignment with exam boards (FBISE, Cambridge, CBSE, AQA, etc.) and grade-appropriate instruction.
- **Spaced Repetition (SM-2):** Automated review queue tracking concept mastery for long-term retention.
- **Mock Exam Engine:** AI-generated board-aligned exams with automated marking and point-by-point feedback.
- **AI Study Planner:** Personalized weekly schedules based on exam dates and identified weak concepts.
- **Content Enrichment:** On-demand mind maps and printable revision flashcards generated from lesson content.
- **Interactive AI Classroom:** Multi-agent discussions with TTS (Text-to-Speech) and interactive whiteboard capabilities.
- **Teacher Analytics:** Concept heatmaps and progress tracking to identify students needing intervention.

---

## 📚 Documentation

- **[User Manual](docs/USER-MANUAL.md)** — Comprehensive guide for Students, Teachers, and Admins.
- **[Developer Documentation](docs/OPENTALIB-DEV.md)** — Architecture, patterns, and development workflow.
- **[Deployment Guide](docs/DEPLOYMENT.md)** — Installation, environment variables, and self-hosting instructions.
- **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)** — Solutions to common setup and operational issues.
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

OpenTalib is built for scale and stability:
- **Frontend/Backend:** Next.js 16.1 (App Router) in standalone mode.
- **Database/Auth:** Supabase (Self-hosted or Cloud).
- **AI Integration:** Unified LLM layer supporting Gemini, OpenAI, Anthropic, and local LLMs (Ollama).
- **Media:** Persistent local storage for generated images and audio files.

---

## 🤝 Upstream Credit

This project is a significantly extended fork of [OpenMAIC](https://github.com/THU-MAIC/OpenMAIC) by **Tsinghua University (THU-MAIC)**. We acknowledge and appreciate the foundational work done by the original team.

---

## 📄 License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).
