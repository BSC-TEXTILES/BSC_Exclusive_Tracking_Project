# Backend — BSC Exclusive Tracking

Express + TypeScript REST API (port **4000**). SQL database only — PostgreSQL via the
`pg` driver (Supabase-compatible connection string).

## Run

```bash
npm install
npm run dev         # tsx watch mode
npm run build       # tsc → dist/
npm start           # tsx src/server.ts
```

Configuration lives in `.env` (copy from `.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | 4000 | API port |
| `DATABASE_URL` | localhost:5432/bsc_exclusive_tracking | PostgreSQL/Supabase connection string |
| `SESSION_SECRET` | dev value | JWT signing secret (change in production) |
| `CORS_ORIGIN` | http://localhost:5173 | Allowed frontend origin |
| `UPLOAD_DIR` | ./uploads | Evidence file storage |
| `MAX_FILE_SIZE_MB` | 25 | Upload size limit |
| `AUTO_APPROVE_HOURS` | 1 | Auto-approval window (also editable in Admin → Settings) |

## Structure

```
src/
├── server.ts            # entry: DB check, listen, start jobs
├── app.ts               # express app, middleware, route mounting, error handler
├── config.ts            # env config
├── db.ts                # pg pool
├── types.ts
├── middleware/
│   ├── auth.ts          # requireAuth, requirePermission, requireRole (JWT cookie)
│   └── (error handler in app.ts)
├── utils/
│   ├── http.ts          # async handler + ok/fail helpers
│   ├── session.ts       # JWT create/verify, cookie handling
│   ├── audit.ts         # audit log writer (never breaks main flow)
│   ├── notify.ts        # notification writer
│   └── review.ts        # shared approve/reject logic
├── jobs/
│   └── autoApproval.ts  # node-cron every minute + on startup
└── routes/
    ├── auth.routes.ts         # login / logout / me
    ├── public.routes.ts       # landing stats
    ├── dashboard.routes.ts    # user dashboard
    ├── modules.routes.ts      # modules + per-module progress
    ├── checkpoints.routes.ts  # checkpoint detail + today's submission
    ├── submissions.routes.ts  # draft autosave, submit, history
    ├── evidence.routes.ts     # multipart upload (images/PDF/CSV/audio), download, delete
    ├── calendar.routes.ts     # month view
    ├── reports.routes.ts      # analytics + CSV export
    ├── profile.routes.ts      # profile + password change
    ├── notifications.routes.ts
    ├── tracking.routes.ts     # POST /tracking, latest, history
    ├── admin.routes.ts        # full admin panel API
    └── supervisor.routes.ts   # supervisor panel API
```

## Key flows

- **Auth**: bcrypt password check → JWT (HS256, `jose`) stored in an HTTP-only
  cookie + a revocable `sessions` row.
- **Auto-approval**: every minute the job flips `SUBMITTED` submissions older than
  the configured window to `APPROVED` (flagged `auto_approved`), updates the
  supervisor approval queue, notifies the user and writes an audit entry.
- **Live tracking**: `POST /api/tracking` stores coordinates; `GET /api/tracking/latest`
  marks users online if they reported within 35 minutes.
- **Evidence**: multer disk storage with UUID filenames, strict MIME allow-list and
  size limit; files are served from `/uploads` with long cache headers.
