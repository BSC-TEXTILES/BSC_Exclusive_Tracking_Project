# BSC Exclusive — Process Tracker

A complete, fully functional **enterprise Process & Compliance Tracker** web
application built with **Next.js 16 (App Router)**, **React 19**, **TypeScript**,
**Tailwind CSS 4**, **Prisma 5** and **PostgreSQL**.

> For the long-form explanation (data model, security, every flow, RBAC
> matrix, env vars, etc.) see **[`PROJECT_DOCUMENTATION.md`](./PROJECT_DOCUMENTATION.md)**.
> This README is the "front door" — quick start, the tech stack, and the
> flow diagrams you need to understand the system at a glance.

---

## Table of Contents
1. [What it does](#1-what-it-does)
2. [Tech stack](#2-tech-stack)
3. [Architecture at a glance](#3-architecture-at-a-glance)
4. [Flow diagrams](#4-flow-diagrams)
5. [System requirements](#5-system-requirements)
6. [Quick start](#6-quick-start)
7. [Default seed data](#7-default-seed-data)
8. [NPM scripts](#8-npm-scripts)
9. [Environment variables](#9-environment-variables)
10. [Features](#10-features)
11. [Production / Docker](#11-production--docker)
12. [Project layout](#12-project-layout)

---

## 1. What it does

BSC Exclusive lets a company:

- **Define modules** per department (CRM, Sales, HR, Accounts, Warehouse &
  Purchase, Database).
- **Break each module into checkpoints** — tasks that must be done on a
  schedule (daily/weekly/monthly/one-time).
- **Assign** checkpoints to specific users on specific dates.
- **Require compliance submissions** from users every period, with
  compliance status, accuracy status, comments, corrective action, and
  optional photo evidence.
- **Review** submissions — managers/supervisors/auditors can approve or
  reject, and admins can see everything.
- **Supervisor management** — assign employees, departments, and projects
  to supervisors; approval workflow with escalation support.
- **Audit** every state-changing action (login, create, update, delete,
  approve, reject, evidence upload, …) in a tamper-evident `AuditLog` table.
- **Report** on compliance and accuracy across the organization.

PostgreSQL is the **single source of truth** — no business data lives in
`localStorage`, `sessionStorage`, or flat files.

---

## 2. Tech stack

### Frontend
| | Choice | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.3.4 |
| UI library | React | 19.2.8 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS (via `@tailwindcss/postcss`) | 4.x |
| Icons | lucide-react | 1.41 |
| Charts | recharts | 3.10 |
| Date utils | date-fns + date-fns-tz | 4.4 / 3.2 |
| Fonts | Inter (next/font/google) | — |

### Backend (same Next.js app, route handlers under `app/api/`)
| | Choice | Version |
|---|---|---|
| Auth | JWT (HS256) via **jose** + **bcryptjs** | jose 6.2 / bcryptjs 3.0 |
| Validation | zod | 4.5 |
| ORM | Prisma | 5.22 |
| Database | PostgreSQL | 14+ (16-alpine in Docker) |
| File storage | Local disk (`./uploads`) | — |
| Audit log | Custom `lib/audit` writer | — |

### Infrastructure
| | Choice |
|---|---|
| Container orchestration | Docker Compose |
| App container | Multi-stage `Dockerfile` → `next start` |
| Web server | Next.js built-in (port 3000) |
| Cache headers | `next.config.ts` sets `public, max-age=31536000, immutable` on `/uploads/*` |
| Upload limit | 10 MB (configurable via `MAX_FILE_SIZE_MB`) |

> **Custom Next.js build.** The `AGENTS.md` block at the repo root warns that
> this is a non-mainstream Next.js variant with breaking changes from typical
> Next 16. Always read `node_modules/next/dist/docs/` before changing routing,
> server actions, or `params` handling.

---

## 3. Architecture at a glance

```
┌──────────────────────────────────────────────────────────────────────┐
│                           Browser (React 19)                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────┐  │
│  │  Public    │  │  Login     │  │  App       │  │  Admin         │  │  Supervisor  │  │
│  │  /         │  │  /login    │  │  (app)/*   │  │  /admin/*      │  │  /supervisor │  │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └──────┬─────────┘  └──────┬───────┘  │
└────────┼───────────────┼───────────────┼────────────────┼───────────────────┼───────────┘
         │  fetch        │  fetch        │  fetch          │  fetch            │  fetch
         ▼               ▼               ▼                ▼
┌──────────────────────────────────────────────────────────────────────┐
│              Next.js Server (Node 18.17+) — same process             │
│                                                                      │
│   ┌────────────────────┐         ┌────────────────────────────┐      │
│   │  Server Components │         │   Route Handlers (/api/…)  │      │
│   │  (app/**/page.tsx) │         │   auth, dashboard, modules,│      │
│   │                    │         │   checkpoints, evidence,   │      │
│   │                    │         │   submissions, history,    │      │
│   │                    │         │   reports, notifications,  │      │
│   │                    │         │   users, admin/…           │      │
│   └──────────┬─────────┘         └──────────┬─────────────────┘      │
│              │                              │                        │
│              └──────────────┬───────────────┘                        │
│                             │                                        │
│              ┌──────────────▼──────────────┐                         │
│              │  lib/  (server utilities)   │                         │
│              │  ├─ auth (password, session)│                        │
│              │  ├─ permissions (RBAC)      │                         │
│              │  ├─ audit (createAuditLog)  │                         │
│              │  ├─ validations (zod)       │                         │
│              │  └─ db (prisma singleton)   │                         │
│              └──────────────┬──────────────┘                         │
└─────────────────────────────┼────────────────────────────────────────┘
                              │  Prisma Client
                              ▼
                  ┌────────────────────────────┐
                  │   PostgreSQL (16-alpine)   │
                  │   (Docker / docker-compose)│
                  └────────────────────────────┘

                  ┌────────────────────────────┐
                  │  Local disk: ./uploads     │
                  │  (evidence files)          │
                  └────────────────────────────┘
```

---

## 4. Flow diagrams

### 4.1 Login & session

```
                 ┌──────────────┐
                 │  /login form │
                 └──────┬───────┘
                        │  POST /api/auth/login {username, password}
                        ▼
              ┌──────────────────────┐
              │ zod loginSchema      │
              └──────┬───────────────┘
                     ▼
              ┌──────────────────────┐    not found / inactive / bad pw
              │ prisma.user lookup   │ ───────────────────────────► 401/403
              │  by username or email│
              └──────┬───────────────┘
                     ▼
              ┌──────────────────────┐
              │ bcryptjs verify      │
              └──────┬───────────────┘
                     ▼
              ┌──────────────────────────────────────────────┐
              │ createSession(userId, ip, ua)                │
              │   1) Sign JWT (HS256, jose) with { userId }  │
              │   2) Persist Session row { token, expiresAt }│
              │   3) Set HttpOnly cookie "session_token"     │
              └──────┬───────────────────────────────────────┘
                     ▼
              ┌──────────────────────┐
              │ update lastLoginAt  │
              └──────┬───────────────┘
                     ▼
              ┌──────────────────────┐
              │ createAuditLog(LOGIN)│
              └──────┬───────────────┘
                     ▼
        { success, user, redirectUrl: /admin or /dashboard }
```

### 4.2 Authenticated request (every protected call)

```
        GET /api/<anything>  with cookie "session_token"
                        │
                        ▼
        ┌───────────────────────────────┐
        │  getSession()                 │
        │  1) read cookie               │
        │  2) jwtVerify(token, secret)  │── fail ──► 401
        │  3) prisma.session lookup     │── miss ──► 401
        │  4) expiresAt > now?          │── no  ──► delete row, 401
        │  5) user.status === 'ACTIVE'? │── no  ──► 401
        └────────────┬──────────────────┘
                     ▼
        ┌───────────────────────────────┐
        │  Permission check             │
        │  hasPermission(role, perm)    │── no ──► 403
        └────────────┬──────────────────┘
                     ▼
        ┌───────────────────────────────┐
        │  zod validate body / query    │── no ──► 400
        └────────────┬──────────────────┘
                     ▼
        ┌───────────────────────────────┐
        │  Prisma mutation/query        │
        └────────────┬──────────────────┘
                     ▼
        ┌───────────────────────────────┐
        │  createAuditLog(...)          │── never throws (catches)
        └────────────┬──────────────────┘
                     ▼
                 200 + JSON
```

### 4.3 Checkpoint submission lifecycle

```
  ADMIN
   │  creates Module + Checkpoints               /admin/modules, /admin/checkpoints
   │  creates CheckpointAssignment               /admin/assignments
   ▼
  USER
   │  opens /modules/{slug} or /checkpoints/{id}
   │  sees today's pending assignments
   │
   │  fills the form (compliance, accuracy, comments, corrective)
   │  client autosaves debounced draft
   │  ─► POST /api/submissions  status=DRAFT
   │  SubmissionAnswer row inserted/updated
   │
   │  clicks "Submit"
   │  ─► POST /api/submissions  status=SUBMITTED, submittedAt=now
   │  createAuditLog(CHECKPOINT_SUBMITTED)
   ▼
  MANAGER / SUPERVISOR / ADMIN
   │  opens /admin/submissions
   │  ─ APPROVE ─► status=APPROVED, approvedAt, reviewedBy
   │               createAuditLog(SUBMISSION_APPROVED)
   │  ─ REJECT  ─► status=REJECTED, rejectedAt, reviewedBy, reviewComment
   │               createAuditLog(SUBMISSION_REJECTED)
   ▼
  REPORTS / DASHBOARD
     re-aggregate from SQL (recharts) — no caches of business data
```

### 4.4 Evidence upload

```
  Client selects file
        │  multipart/form-data
        ▼
  POST /api/evidence
        │
        ├─ size check (≤ MAX_FILE_SIZE_MB)
        ├─ mime allow-list
        │
        ▼
  write to UPLOAD_DIR/<uuid-storedName>
        │
        ▼
  INSERT evidence_files row (originalName, storedName, mime, size, path)
        │
        ▼
  createAuditLog(EVIDENCE_UPLOADED)
        │
        ▼
  Return file metadata → client renders preview
        │
        ▼
  Public access via /uploads/<name>
        (Cache-Control: public, max-age=31536000, immutable)
```

### 4.5 Audit log coverage

```
   ┌──────────────────┬───────────────────────────┐
   │  Auth            │ LOGIN, LOGOUT             │
   ├──────────────────┼───────────────────────────┤
   │  Users           │ CREATED, UPDATED,         │
   │                  │ ACTIVATED, DEACTIVATED    │
   │  Passwords       │ RESET, CHANGED            │
   ├──────────────────┼───────────────────────────┤
   │  Departments     │ CREATED, UPDATED, DELETED │
   │  Modules         │ CREATED, UPDATED          │
   │  Checkpoints     │ CREATED, UPDATED, DELETED │
   │  Assignments     │ CREATED, UPDATED, DELETED │
   ├──────────────────┼───────────────────────────┤
   │  Submissions     │ DRAFT_SAVED, SUBMITTED,   │
   │                  │ APPROVED, REJECTED        │
   │  Evidence        │ UPLOADED, DELETED         │
   ├──────────────────┼───────────────────────────┤
   │  Settings        │ UPDATED                   │
   └──────────────────┴───────────────────────────┘

  Each log stores: userId, action, entityType, entityId,
                   oldValues (JSON), newValues (JSON),
                   ipAddress, userAgent, createdAt
  Failure to write is caught and logged — it never breaks the main op.
```

### 4.6 Front-end request flow (page render)

```
   Browser navigates to /dashboard
            │
            ▼
   Next.js matches app/(app)/dashboard/page.tsx
            │
            ▼
   (app)/layout.tsx renders <AppShell>:
       <SidebarProvider>
         <AppSidebar/>   <AppHeader/> + <main>{children}</main>
            │
            ▼
   page.tsx (Server Component by default)
     ├─ requireAuth() / requireAdmin()
     ├─ Prisma queries (e.g. today's assignments, recent submissions)
     └─ Renders HTML, streams to client
            │
            ▼
   Client hydrates; interactive bits (forms, charts, dropdowns)
   are wrapped in 'use client' components
```

---

## 5. System requirements

- **Node.js 18.17+** (Next 16 requirement)
- **PostgreSQL 14+**
- **npm** or **yarn**
- **Docker** (optional, recommended for local Postgres)
- Compatible with macOS, Linux, and Windows.

---

## 6. Quick start

```bash
# 1. Start Postgres (Docker)
docker-compose up -d

# 2. Install dependencies
npm install

# 3. Environment
cp .env.example .env
# Edit .env if needed; defaults match docker-compose

# 4. Schema + seed
npx prisma generate
npx prisma db push
npm run seed

# 5. Dev server
npm run dev
# → http://localhost:3000
```

---

## 7. Default seed data

After `npm run seed` you get:

| Role | Login | Password | Lands on |
|---|---|---|---|
| ADMIN | `admin` | `Admin@123456` | `/admin` |
| USER  | `john.doe` | `User@123456` | `/dashboard` |

Seeded roles: `ADMIN, MANAGER, SUPERVISOR, AUDITOR, USER, VIEWER`.
Seeded modules: `crm, warehouse-purchase, sales, hr, accounts, database`.
Supervisor permissions: `supervisor:access`, `supervisor:manage_team`, `supervisor:review_approvals`, `supervisor:view_reports`, `supervisor:manage_departments`, etc.

---

## 8. NPM scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start Next.js dev server (HMR). |
| `npm run build` | Production build. |
| `npm run start` | Run the built app. |
| `npm run lint` | ESLint. |
| `npm run seed` | Run `prisma/seed.ts` via tsx. |
| `npm run db:migrate` | `prisma migrate dev`. |
| `npm run db:push` | `prisma db push`. |
| `npm run db:seed` | Alias for `seed`. |
| `npm run db:studio` | Open Prisma Studio. |
| `npm run db:reset` | `prisma migrate reset` (destructive). |

---

## 9. Environment variables

See `.env.example` for the full list. Important ones:

```
DATABASE_URL              # PostgreSQL connection string
SESSION_SECRET            # ≥ 32 chars, signs session JWTs
NEXT_PUBLIC_APP_NAME      # "BSC Exclusive"
NEXT_PUBLIC_APP_TIMEZONE  # "Asia/Kolkata"
FILE_STORAGE_TYPE         # "local" (only one supported today)
UPLOAD_DIR                # default ./uploads
MAX_FILE_SIZE_MB          # default 10
INITIAL_ADMIN_EMAIL       # used by seed
INITIAL_ADMIN_USERNAME    # used by seed
INITIAL_ADMIN_PASSWORD    # used by seed
SMTP_*                    # optional email notifications
```

---

## 10. Features

- **Public landing page** at `/` with live module statistics.
- **Role-based access control** with 6 roles and 50+ permissions.
- **Supervisor panel** with team management, department/project assignment, approval workflow, reports, and activity tracking.
- **Daily process tracking** with debounced draft autosave.
- **Photo evidence** stored on local disk, metadata in SQL.
- **Approval workflow** (DRAFT → SUBMITTED → APPROVED/REJECTED).
- **Reports & charts** powered by recharts.
- **Notifications** persisted in SQL (bell UI is currently placeholder).
- **Complete audit trail** of all mutations.
- **Dockerized** backend + database for reproducible local dev.
- **Supabase** integration for managed PostgreSQL, auth, and storage.

---

## 11. Production / Docker

```bash
docker-compose up -d --build
```

Two services: `postgres` (port 5432) and `backend` (port 3000). Named
volumes `postgres_data` and `uploads_data` persist data across container
restarts. Override `SESSION_SECRET` and `INITIAL_ADMIN_PASSWORD` before
exposing the deployment.

---

## 12. Project layout

```
app/                     # Next.js App Router
  layout.tsx             # Root <html>/<body>
  page.tsx               # Public landing
  globals.css            # Tailwind v4 + design tokens
  login/                 # /login
  (app)/                 # Authenticated route group
    layout.tsx           # Sidebar + Header shell
    dashboard/, modules/, checkpoints/, history/, reports/, profile/
  admin/                 # /admin (ADMIN only)
  supervisor/            # /supervisor (SUPERVISOR role)
    page.tsx             # Supervisor dashboard
    employees/           # Team management
    departments/         # Department assignments
    projects/            # Project/module assignments
    approvals/           # Approval workflow
    reports/             # Team reports
    activity/            # Activity history
    profile/             # Supervisor profile
  api/                   # Route handlers (REST-ish)
    auth/, dashboard/, modules/, checkpoints/, evidence/,
    submissions/, history/, reports/, notifications/, public/,
    users/, admin/, supervisor/...
components/
  layout/                # app-header, app-sidebar, sidebar-context
  ui/                    # brand-logo, live-date-time, calendar-widget
lib/
  auth/                  # password.ts, session.ts
  db/                    # prisma.ts (singleton)
  permissions/           # constants.ts (RBAC)
  audit/                 # createAuditLog
  validations/           # zod schemas
frontend/                # Mirror of app/ + components/ + public/
backend/                 # Mirror of app/api/ + lib/
database/
  prisma/
    schema.prisma        # 22 models, 7 enums
    seed.ts              # roles, permissions, depts, admin, modules, checkpoints
  supabase/
    migrations/          # SQL migrations (001_initial, 002_supervisor)
    seed.sql             # SQL seed data
    config.toml          # Supabase local config
uploads/                 # Local evidence file storage
public/                  # favicon, icon.png
docker-compose.yml       # Postgres + Supabase Studio + App
Dockerfile               # Multi-stage build
vercel.json              # Vercel deployment config
render.yaml              # Render deployment config
next.config.ts
AGENTS.md                # Custom-Next.js warning
README.md                # ← you are here
DEPLOYMENT.md            # Deployment guide (Vercel/Render/Supabase)
PROJECT_DOCUMENTATION.md # ← the long-form docs
```
