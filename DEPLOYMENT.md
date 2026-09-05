# Deployment Guide

This guide covers deploying BSC Exclusive to **Vercel** (frontend), **Render** (backend), and **Supabase** (database).

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Supabase Setup](#supabase-setup)
4. [Vercel Deployment](#vercel-deployment)
5. [Render Deployment](#render-deployment)
6. [Environment Variables](#environment-variables)
7. [Database Migrations](#database-migrations)
8. [Post-Deploy Verification](#post-deploy-verification)
9. [Custom Domain](#custom-domain)

---

## Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│   Vercel     │────▶│   Render    │────▶│   Supabase      │
│   (Next.js)  │     │   (API)     │     │   (PostgreSQL)  │
│              │     │             │     │                 │
│  Frontend    │     │  Background │     │  Database       │
│  + API Routes│     │  Workers    │     │  Auth           │
│              │     │  Cron Jobs  │     │  Storage        │
└─────────────┘     └─────────────┘     └─────────────────┘
```

- **Vercel**: Hosts the Next.js app (frontend pages + API routes)
- **Render**: Optional — for background workers, cron jobs, or separate API
- **Supabase**: PostgreSQL database, optional auth, optional file storage

---

## Prerequisites

- GitHub account
- Vercel account (free tier works)
- Render account (free tier works)
- Supabase account (free tier works)
- Node.js 18.17+ (for local dev)
- Git installed

---

## Supabase Setup

### 1. Create Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose organization, set project name, database password
4. Select region closest to your users
5. Wait for project to be ready

### 2. Get Credentials

From the Supabase dashboard, go to **Settings → API**:

- **Project URL**: `https://xxxxx.supabase.co`
- **Anon Key**: `eyJhbG...`
- **Service Role Key**: `eyJhbG...` (keep secret!)

Go to **Settings → Database → Connection string**:

- **Connection string (URI)**: `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`

### 3. Run Migrations

**Option A: Via Supabase Dashboard**

1. Go to **SQL Editor**
2. Paste contents of `database/supabase/migrations/001_initial_schema.sql`
3. Run
4. Paste contents of `database/supabase/migrations/002_supervisor_system.sql`
5. Run
6. Paste contents of `database/supabase/seed.sql`
7. Run

**Option B: Via Supabase CLI**

```bash
cd database/supabase
supabase link --project-ref <your-project-ref>
supabase db push
```

---

## Vercel Deployment

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/bsc-exclusive-process-tracker.git
git push -u origin main
```

### 2. Import to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New → Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./`
   - **Build Command**: `npx prisma generate && next build`
   - **Output Directory**: `.next`

### 3. Set Environment Variables

Add these in Vercel's environment variables panel:

```env
DATABASE_URL=postgresql://postgres.xxx:password@aws-0-region.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
JWT_SECRET=your-secure-random-string-min-32-chars
NEXTAUTH_URL=https://your-app.vercel.app
NEXT_PUBLIC_APP_NAME=BSC Exclusive
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_APP_TIMEZONE=Asia/Kolkata
UPLOAD_DIR=/tmp/uploads
```

### 4. Deploy

Click "Deploy". Vercel will:
1. Install dependencies
2. Generate Prisma client
3. Build Next.js
4. Deploy to edge network

### 5. Custom Build Command (if needed)

If Prisma generation fails, add to `vercel.json`:

```json
{
  "buildCommand": "npx prisma generate && next build"
}
```

---

## Render Deployment

### 1. Create Web Service

1. Go to [render.com](https://render.com)
2. Click "New → Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `bsc-exclusive-api`
   - **Runtime**: Node
   - **Build Command**: `npm install && npx prisma generate`
   - **Start Command**: `node node_modules/.next/standalone/server.js`
   - **Plan**: Free

### 2. Set Environment Variables

Same as Vercel (see above).

### 3. Deploy

Render will build and deploy automatically.

### 4. Optional: Background Worker

For cron jobs or background processing:

1. Click "New → Background Worker"
2. Same repo, configure:
   - **Build Command**: `npm install && npx prisma generate`
   - **Start Command**: `npx tsx backend/workers/cron-worker.ts`

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (secret!) |
| `JWT_SECRET` | Yes | Min 32 chars, signs JWTs |
| `NEXTAUTH_URL` | Yes | App URL (e.g., `https://app.vercel.app`) |
| `NEXT_PUBLIC_APP_NAME` | No | Default: "BSC Exclusive" |
| `NEXT_PUBLIC_APP_URL` | No | Public app URL |
| `NEXT_PUBLIC_APP_TIMEZONE` | No | Default: "Asia/Kolkata" |
| `UPLOAD_DIR` | No | Default: "./uploads" or "/tmp/uploads" |
| `MAX_FILE_SIZE_MB` | No | Default: 10 |

---

## Database Migrations

### Applying New Migrations

1. Create migration SQL in `database/supabase/migrations/`
2. Push to GitHub
3. Apply via Supabase SQL Editor or CLI

### Using Prisma

```bash
# Generate client
npx prisma generate

# Push schema changes (dev)
npx prisma db push

# Create migration (production)
npx prisma migrate dev --name <migration-name>
npx prisma migrate deploy
```

---

## Post-Deploy Verification

### 1. Health Check

```bash
curl https://your-app.vercel.app/api/health
# Expected: {"status":"healthy","database":"connected",...}
```

### 2. Login

- Navigate to `https://your-app.vercel.app/login`
- Login with: `admin` / `Admin@123456`
- Verify redirect to `/admin`

### 3. Supervisor Access

- Login as a supervisor user
- Navigate to `/supervisor`
- Verify dashboard loads with stats

### 4. API Endpoints

```bash
# Test auth
curl https://your-app.vercel.app/api/auth/me

# Test supervisor dashboard (with auth cookie)
curl https://your-app.vercel.app/api/supervisor/dashboard
```

---

## Custom Domain

### Vercel

1. Go to Project Settings → Domains
2. Add your domain
3. Configure DNS as instructed
4. SSL is automatic

### Render

1. Go to Settings → Custom Domains
2. Add domain
3. Configure CNAME record
4. SSL is automatic

---

## Troubleshooting

### Build Fails on Vercel

- Check build logs for Prisma errors
- Ensure `prisma.schema` path is correct in `package.json`
- Try: `npx prisma generate` locally first

### Database Connection Issues

- Verify `DATABASE_URL` is correct
- Check Supabase project is active
- Ensure IP allowlist includes Vercel/Render IPs (or disable it)

### Environment Variables Not Loading

- Vercel: Redeploy after adding variables
- Render: Redeploy after adding variables
- Check variable names match exactly (case-sensitive)

### File Upload Issues on Vercel

- Vercel uses serverless functions — `/tmp` is the only writable directory
- Set `UPLOAD_DIR=/tmp/uploads`
- Files are ephemeral — use Supabase Storage for persistent files

---

## Production Checklist

- [ ] `JWT_SECRET` is strong and unique (≥32 chars)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is kept secret
- [ ] Database migrations applied
- [ ] Seed data loaded (or manual setup)
- [ ] `NEXTAUTH_URL` matches production domain
- [ ] SSL/HTTPS enabled
- [ ] Custom domain configured (optional)
- [ ] Monitoring/logging set up
- [ ] Backup strategy for database
