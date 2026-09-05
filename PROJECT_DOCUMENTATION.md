# BSC Exclusive — Process Tracker

## Full Project Documentation

> An enterprise-grade Process & Compliance Tracking system. This document explains
> the system end-to-end: what it is, the tech stack, how the pieces fit together,
> the data model, every important flow, security model, and how to operate it.

---

## 1. What This Project Is

**BSC Exclusive — Process Tracker** is an internal web application that lets a
company define **process modules** (e.g. CRM, Sales, HR, Accounts,
Warehouse & Purchase, Database), break each module into **checkpoints** (a
task that must be done on a schedule), **assign** those checkpoints to
specific users, and require the user to **submit** a compliance report
(with optional photo evidence) every day/week/month. Managers, supervisors,
auditors and admins can review submissions, approve or reject them, and
generate reports.

It is a single Next.js application that owns both the UI and the JSON API.
PostgreSQL is the only source of truth for business data — there is no
`localStorage`/`sessionStorage`/flat-file data store.

---

## 2. Tech Stack (every piece that actually runs)

### 2.1 Runtime & Language
| Layer | Choice | Why |
|---|---|---|
| Server runtime | **Node.js 18.17+** | Required by Next 16. |
| Language | **TypeScript 5** | Strict typing across UI and API. |
| Framework | **Next.js 16.3.4 (App Router)** | Server components, file-based routing, route handlers, image optimization. |
| UI library | **React 19.2.8** | Required by Next 16. |
| Styling | **Tailwind CSS 4** via `@tailwindcss/postcss` | Utility-first, design tokens defined in `app/globals.css` with `@theme inline`. |
| Icons | **lucide-react 1.41** | Tree-shakable SVG icon set. |
| Charts | **recharts 3.10** | Used in the dashboard, history, and reports pages. |

### 2.2 Data & Auth
| Concern | Choice | Where |
|---|---|---|
| Database | **PostgreSQL 14+** | Provided via `docker-compose.yml` (image `postgres:16-alpine`). |
| ORM | **Prisma 5.22** | `prisma/schema.prisma` is the canonical schema. |
| Password hashing | **bcryptjs 3.0** | `lib/auth/password.ts`. |
| Session token | **jose (HS256 JWT)** | `lib/auth/session.ts`. |
| Validation | **zod 4.5** | `lib/validations/schemas.ts`. |
| ID generation | **uuid 14** | Used in seed/data. |
| Date utilities | **date-fns 4.4** + **date-fns-tz 3.2** | All timestamps are normalized to `Asia/Kolkata`. |

### 2.3 Infrastructure
| Concern | Choice |
|---|---|
| Container orchestration | Docker Compose (`docker-compose.yml`). Two services: `postgres` and `backend`. |
| App container | `Dockerfile` — multi-stage build running `next start` in production. |
| File storage | **Local disk** at `./uploads` (mounted to `/app/uploads` in container). Configurable via `UPLOAD_DIR`. |
| Max upload size | 10 MB (configurable via `MAX_FILE_SIZE_MB`). Enforced both in `next.config.ts` (`serverActions.bodySizeLimit`) and at the API layer. |

### 2.4 Frontend conventions
- All custom interactive components begin with `'use client'`.
- Server components fetch data directly via Prisma.
- App-wide tokens (colors, fonts) live in `app/globals.css` under `@theme inline`
  and are consumed as Tailwind utilities like `bg-primary`, `text-text-muted`,
  `border-border`. Do **not** hard-code hex values in components.

---

## 3. Repository Layout

```
D:\bssc\new_project
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root <html>/<body> + Inter font
│   ├── page.tsx                # Public landing page
│   ├── globals.css             # Tailwind v4 + design tokens
│   ├── login/                  # /login (public)
│   ├── (app)/                  # Authenticated route group
│   │   ├── layout.tsx          # AppShell (header + sidebar + main)
│   │   ├── dashboard/          # /dashboard
│   │   ├── modules/[moduleSlug]/  # /modules/{slug}
│   │   ├── checkpoints/[id]/   # /checkpoints/{id}
│   │   ├── history/            # /history
│   │   ├── reports/            # /reports
│   │   └── profile/            # /profile
│   ├── admin/                  # /admin and sub-pages (ADMIN only)
│   │   ├── page.tsx, layout.tsx
│   │   ├── users/, roles/, departments/
│   │   ├── modules/, checkpoints/
│   │   ├── assignments/, submissions/, evidence/
│   │   ├── reports/, audit-logs/, settings/
│   └── api/                    # Route handlers (REST-ish)
│       ├── auth/               # login, logout, me
│       ├── dashboard/, modules/, checkpoints/, evidence/
│       ├── submissions/, submissions/history/
│       ├── history/, reports/, notifications/
│       ├── public/modules/     # Public stats for landing page
│       ├── users/              # Admin user management
│       └── admin/...           # Mirrors /admin pages
├── components/
│   ├── layout/                 # app-header, app-sidebar, sidebar-context
│   └── ui/                     # brand-logo, live-date-time, calendar-widget
├── lib/
│   ├── auth/                   # password.ts, session.ts
│   ├── db/                     # prisma.ts (singleton)
│   ├── permissions/            # constants.ts (RBAC)
│   ├── audit/                  # index.ts (createAuditLog)
│   └── validations/            # zod schemas
├── prisma/
│   ├── schema.prisma           # 16 models, 6 enums
│   └── seed.ts                 # roles, permissions, depts, admin user, modules, checkpoints
├── uploads/                    # Local evidence file storage
├── public/                     # favicon, icon.png
├── docker-compose.yml
├── Dockerfile
├── next.config.ts
├── postcss.config.mjs
├── tailwind.config (via @theme)
├── tsconfig.json
├── eslint.config.mjs
├── .env.example
├── AGENTS.md                   # Custom-Next.js warning
└── CLAUDE.md
```

---

## 4. Data Model (Prisma schema, 16 models / 6 enums)

### 4.1 ER Overview (text diagram)

```
Role ──< RolePermission >── Permission
Role ──< User >── Department
User ──< Session
User ──< CheckpointAssignment >── Checkpoint >── Module >── Department
CheckpointAssignment ──< CheckpointSubmission ──< SubmissionAnswer
CheckpointSubmission ──< EvidenceFile
User ──< AuditLog
User ──< Notification
User ──< UserLocation >── Location
SystemSetting (key/value)
```

### 4.2 Enums
- **UserStatus** — `ACTIVE | INACTIVE | SUSPENDED`
- **CheckpointStatus** — `PENDING | DRAFT | SUBMITTED | APPROVED | REJECTED | NOT_APPLICABLE | OVERDUE`
- **ComplianceStatus** — `FULLY_FOLLOWED | PARTIALLY_FOLLOWED | NOT_FOLLOWED | NO_TRANSACTION | YET_TO_IMPLEMENT`
- **AccuracyStatus** — `FULLY_ACCURATE | PARTLY_ACCURATE | INACCURATE | NA`
- **AssignmentFrequency** — `DAILY | WEEKLY | MONTHLY | ONE_TIME`
- **EntityStatus** — `ACTIVE | INACTIVE` (used for departments, locations, modules, checkpoints, assignments)

### 4.3 Key models (fields worth knowing)
- **User** — `employeeCode` (unique), `fullName`, `email`, `username`, `passwordHash`, `roleId`, `departmentId?`, `status`, `profileImage?`, `mustChangePassword`, `lastLoginAt`, `createdBy`/`updatedBy` audit columns.
- **Session** — JWT-backed (`token` unique, indexed), `expiresAt`, `ipAddress`, `userAgent`.
- **Module** — belongs to `Department`, has `slug` (unique), `displayOrder`.
- **Checkpoint** — belongs to `Module`. Each checkpoint has `score` (default 5), `isAccuracyRequired`, `isCorrectiveActionRequired`, `isPhotoRequired`, `displayOrder`.
- **CheckpointAssignment** — `(userId, checkpointId, assignedDate)` is **unique** — one assignment per user/checkpoint/day. Has `frequency` and `dueDate`.
- **CheckpointSubmission** — the actual compliance report. Has `status` (draft/submitted/approved/rejected/…), `submittedAt`, `approvedAt`, `rejectedAt`, `reviewedById`, `reviewComment`.
- **SubmissionAnswer** — 1-to-1 with a submission. Stores `complianceStatus`, `accuracyStatus`, `comments`, `correctiveAction`.
- **EvidenceFile** — file metadata (`originalName`, `storedName`, `mimeType`, `fileSize`, `storagePath`, `publicUrl?`). Files live on disk under `UPLOAD_DIR`.
- **AuditLog** — `userId?`, `action` (string enum, see §7), `entityType`, `entityId`, `oldValues` (JSON), `newValues` (JSON), `ipAddress`, `userAgent`, `createdAt`.
- **Notification** — `userId`, `title`, `message`, `type`, `isRead`, `linkUrl?`.
- **SystemSetting** — generic `key/value` store, used for runtime configuration.

---

## 5. Application Flows

### 5.1 App shell
- `app/layout.tsx` is the **root** layout (HTML/body + Inter font + global CSS).
- `app/(app)/layout.tsx` is the **authenticated** shell. It wraps everything in
  a `SidebarProvider` and renders:
  - `AppSidebar` on the left (collapsible, mobile-aware via `sidebar-context.tsx`).
  - `AppHeader` on top — search bar, live clock, notification bell, logout
    button, profile dropdown, role badge. The header is **sticky** and uses
    the dark token palette (`bg-header-bg`).
- `app/admin/layout.tsx` adds an admin-only chrome around admin pages.

### 5.2 Authentication flow (password + JWT in HTTP-only cookie)

```
User submits login form (POST /api/auth/login)
    │
    ▼
Validate body with zod (loginSchema)
    │
    ▼
Find user by username OR email
    │
    ├── not found / inactive ──► 401 / 403
    │
    ▼
verifyPassword(plain, bcryptHash)         lib/auth/password.ts
    │
    ├── invalid ──► 401
    │
    ▼
createSession(userId, ip, ua)             lib/auth/session.ts
    │   ├─ Sign JWT (HS256, jose) with { userId }
    │   ├─ Persist Session row { token, expiresAt, ip, ua }
    │   └─ Set HTTP-only cookie "session_token"
    │
    ▼
Update User.lastLoginAt
    │
    ▼
createAuditLog({ action: 'LOGIN', entityType: 'user', ... })
    │
    ▼
Return { user, redirectUrl: '/admin' if role==='ADMIN' else '/dashboard' }
```

**Session verification** (`getSession`) on every request:

```
Read cookie "session_token"
    │
    ▼
jwtVerify(token, SESSION_SECRET)
    │   └── invalid signature / expired ──► return null
    │
    ▼
prisma.session.findUnique({ where:{token}, include:{ user, role, permissions, department } })
    │
    ├── missing or expiresAt < now() ──► delete row, return null
    │
    ▼
If user.status !== 'ACTIVE' ──► return null
    │
    ▼
Return { session, user }
```

`requireAuth()` and `requireAdmin()` are server-side guards; they throw and the
route handler returns 401/403.

**Logout** (`POST /api/auth/logout`):
1. `destroySession()` — delete the `Session` row matching the token and clear the cookie.
2. `createAuditLog({ action: 'LOGOUT', entityType: 'user', ... })`.

### 5.3 RBAC (role-based access control)

Defined in `lib/permissions/constants.ts`:

| Role | Default permission set |
|---|---|
| **ADMIN** | All permissions. |
| **MANAGER** | Review/approve/reject submissions, view all evidence, all reports, own submissions. |
| **SUPERVISOR** | Review submissions, view all evidence/reports, own submissions. |
| **AUDITOR** | View all submissions/evidence/reports, export reports, view audit logs. |
| **USER** | View own submissions, create/edit own submissions, upload own evidence, view own reports. |
| **VIEWER** | Read-only on own submissions, evidence, reports. |

Permissions are namespaced strings like `submissions:approve`, `users:create`.
API routes check the active user's permission set before mutating; admin pages
check `requireAdmin()`.

### 5.4 Checkpoint lifecycle (the core business flow)

```
Admin creates Module + Checkpoints                  lib/validations + /api/admin/checkpoints
        │
        ▼
Admin assigns Checkpoint to User on a date          /api/admin/assignments
        │  (creates CheckpointAssignment row)
        ▼
User opens /modules/{slug} or /checkpoints/{id}     (app)/(app)/...
        │  sees today's pending assignments
        ▼
User fills the form (compliance status, accuracy, comments, corrective action)
        │  client-side autosave on each field ──► debounced PUT/POST
        ▼
Draft saved to CheckpointSubmission (status = DRAFT) + SubmissionAnswer
        │
        ▼
User clicks "Submit"                                /api/submissions (status = SUBMITTED, submittedAt = now)
        │
        ▼
Manager/Admin reviews the submission               /admin/submissions
        │  can APPROVE  ──► status=APPROVED, approvedAt, reviewedBy
        │  can REJECT   ──► status=REJECTED, rejectedAt, reviewedBy, reviewComment
        ▼
Every state transition calls createAuditLog         lib/audit
        │
        ▼
Reports/Dashboard re-aggregate from SQL
```

### 5.5 Evidence upload flow

```
User picks a file on the checkpoint form
    │
    ▼
Client POSTs multipart/form-data to /api/evidence
    │  server validates: size ≤ MAX_FILE_SIZE_MB, mime allow-list
    │
    ▼
Server writes the file to UPLOAD_DIR/<storedName>    (uuid-based)
    │
    ▼
Server inserts EvidenceFile row (originalName, storedName, mimeType,
    fileSize, storagePath, optional publicUrl)
    │
    ▼
Audit log: action = EVIDENCE_UPLOADED
    │
    ▼
Client renders the file via /uploads/... (immutable cache, see next.config.ts)
```

### 5.6 Notifications
- Server writes to `Notification` table on relevant events.
- `GET /api/notifications` returns the current user's notifications.
- The header bell toggles a dropdown panel (count badge in the red dot — UI only).
- Marking-as-read happens via the same endpoint (`PATCH`).

### 5.7 Audit logging
- Centralized in `lib/audit/index.ts`. Failures are caught and logged so audit
  write errors **never break the main operation**.
- `AuditAction` is a string union of 27 actions (LOGIN, LOGOUT, USER_*,
  PASSWORD_*, DEPARTMENT_*, MODULE_*, CHECKPOINT_*, ASSIGNMENT_*,
  CHECKPOINT_DRAFT_SAVED, CHECKPOINT_SUBMITTED, SUBMISSION_APPROVED,
  SUBMISSION_REJECTED, EVIDENCE_*, SETTINGS_UPDATED).
- Viewed at `/admin/audit-logs` (permission `audit_logs:view`).

---

## 6. Routing Map

### 6.1 Public
- `/` — landing page (live module stats from `GET /api/public/modules`).
- `/login` — credential form (POSTs to `/api/auth/login`).

### 6.2 Authenticated (`(app)` group)
| Path | Purpose |
|---|---|
| `/dashboard` | KPIs, today's tasks, recent activity. |
| `/modules/[moduleSlug]` | Checkpoint list for a module. |
| `/checkpoints/[id]` | Fill/submit a single checkpoint. |
| `/history` | Past submissions, filters, charts. |
| `/reports` | Compliance/accuracy reports, export. |
| `/profile` | Update name/email/phone/photo/password. |

### 6.3 Admin (`/admin`)
- `/admin` (overview)
- `/admin/users`, `/admin/users/[id]`
- `/admin/roles`, `/admin/departments`
- `/admin/modules`, `/admin/checkpoints`
- `/admin/assignments`, `/admin/submissions`, `/admin/evidence`
- `/admin/reports`, `/admin/audit-logs`, `/admin/settings`

### 6.4 API (`app/api`)
- `auth/{login,logout,me}`
- `dashboard/route.ts`
- `modules/[slug]/route.ts`
- `checkpoints/[id]/route.ts`
- `submissions/...`, `submissions/history/...`
- `evidence/route.ts`, `evidence/[id]/route.ts`
- `history/route.ts`
- `reports/route.ts`
- `notifications/route.ts`
- `public/modules/route.ts`
- `users/`, `admin/...` (mirror of admin pages for programmatic use)

---

## 7. Security Model

- **Password storage:** bcrypt hash, never the plaintext.
- **Session:** JWT (HS256) signed with `SESSION_SECRET` (≥ 32 chars). Token is
  stored both in a `Session` DB row (so it can be revoked) and in an
  `HttpOnly`, `SameSite=Lax` cookie. `Secure` flag is on in production.
- **Auth enforcement:** `requireAuth()` / `requireAdmin()` on every
  protected API route. UI pages call these guards too via the API.
- **RBAC:** `hasPermission(role, permission)` in `lib/permissions/constants.ts`.
- **Input validation:** all API inputs go through zod schemas in
  `lib/validations/schemas.ts` before touching the database.
- **File uploads:** size limit (10 MB by default), mime validation, names
  re-randomized on disk, served with long immutable cache headers.
- **Audit trail:** every state-changing operation is logged with the actor,
  entity, before/after JSON, IP, and user agent.
- **Headers:** `next.config.ts` sets `Cache-Control: public, max-age=31536000,
  immutable` on `/uploads/*` to offload browser cache (safe because names
  are content-addressed/unique).

---

## 8. Environment Variables

Defined in `.env.example`:

```
DATABASE_URL              # PostgreSQL connection string
NEXT_PUBLIC_APP_NAME      # "BSC Exclusive"
NEXT_PUBLIC_APP_TIMEZONE  # "Asia/Kolkata"
SESSION_SECRET            # ≥ 32 chars, used to sign JWTs
FILE_STORAGE_TYPE         # "local" (only one supported today)
UPLOAD_DIR                # default ./uploads
MAX_FILE_SIZE_MB          # default 10
INITIAL_ADMIN_EMAIL       # used by seed.ts
INITIAL_ADMIN_USERNAME    # used by seed.ts
INITIAL_ADMIN_PASSWORD    # used by seed.ts
SMTP_*                    # optional, for future email notifications
```

`docker-compose.yml` provides a working `DATABASE_URL` and a default
`SESSION_SECRET` for local dev (change it in production).

---

## 9. NPM Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start Next.js dev server (HMR). |
| `npm run build` | Production build. |
| `npm run start` | Run the built app. |
| `npm run lint` | ESLint (`eslint-config-next`). |
| `npm run seed` | Run `prisma/seed.ts` with tsx. |
| `npm run db:migrate` | `prisma migrate dev`. |
| `npm run db:push` | `prisma db push` (no migration files). |
| `npm run db:seed` | Alias for `seed`. |
| `npm run db:studio` | Open Prisma Studio. |
| `npm run db:reset` | `prisma migrate reset` (destructive). |

---

## 10. Default Seeded Data

`prisma/seed.ts` populates:

- **Roles:** `ADMIN`, `MANAGER`, `SUPERVISOR`, `AUDITOR`, `USER`, `VIEWER`
  with the permission sets defined in `lib/permissions/constants.ts`.
- **Permissions:** every key in the `PERMISSIONS` map.
- **Departments:** e.g. Operations, Sales, HR, Accounts, IT.
- **Locations:** a couple of branches.
- **Modules:** `crm`, `warehouse-purchase`, `sales`, `hr`, `accounts`,
  `database` (slugs match the names used in the header lookup table).
- **Checkpoints:** at least one per module with sensible defaults.
- **Admin user:** from `INITIAL_ADMIN_*` env vars (default
  `admin@bscexclusive.com` / `admin` / `Admin@123456`).
- **Demo user:** `john.doe` / `User@123456`.

---

## 11. UI Conventions

- **Design tokens only.** Never hardcode hex codes — use `bg-primary`,
  `text-text-muted`, `border-border`, `bg-surface`, etc. Tokens are declared
  in `app/globals.css` under `@theme inline`.
- **Status colors:** success/warning/danger/info each have a `*-bg` and
  `*-border` companion token.
- **Header layout:** top bar = logo + nav toggle on the left, search,
  clock, notification bell, logout, profile avatar on the right.
- **Sidebar:** collapsible on desktop, drawer on mobile, state lives in
  `sidebar-context.tsx`.
- **Auth-required pages** live under `app/(app)`. They share one shell.
- **Admin pages** live under `app/admin` with their own layout.

---

## 12. Local Development — Quick Start

```bash
# 1. Start Postgres
docker-compose up -d

# 2. Install
npm install

# 3. Env
cp .env.example .env

# 4. Schema + seed
npx prisma generate
npx prisma db push
npm run seed

# 5. Dev server
npm run dev
# → http://localhost:3000
```

Default logins (after seed):
- `admin` / `Admin@123456` (lands on `/admin`)
- `john.doe` / `User@123456` (lands on `/dashboard`)

---

## 13. Production / Docker

```bash
docker-compose up -d --build
```

`docker-compose.yml` brings up `postgres` (16-alpine) and `backend` (the Next
app) on port `3000`. `uploads_data` and `postgres_data` are named volumes so
data survives container restarts. Override `SESSION_SECRET` and
`INITIAL_ADMIN_PASSWORD` before exposing the deployment.

---

## 14. Known Constraints / Things to Watch

- The `AGENTS.md` note says this Next.js build has **breaking changes from
  mainstream Next 16**. Always read `node_modules/next/dist/docs/` before
  touching routing, server actions, or `params` handling.
- `lucide-react` is pinned to **1.41**, which is older than the current
  ecosystem version. Don't bump without testing.
- `recharts` 3.x is the chart library; dashboard/history/reports all use it.
- The header's notification dropdown is currently **UI-only** — the red dot
  is hardcoded, and the panel shows "0 new" / "You're all caught up." until
  the notifications API is wired into it.
- The header's search bar is also **UI-only** — it stores input in state but
  doesn't perform any routing or filtering.
- A direct "Logout" button was added to the top bar in addition to the
  existing profile-menu "Sign Out" item; both call the same
  `handleLogout()`.
