# Supabase Database Setup

## Quick Start

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Name: `process-tracker`
4. Database password: (choose a strong password)
5. Region: Choose closest to your users
6. Click "Create new project"

### 2. Get Your Credentials
After project creation, go to **Settings > API** and copy:
- `Project URL` (e.g., `https://xxxx.supabase.co`)
- `anon` `public` key
- `service_role` `secret` key (keep this safe!)

### 3. Run the Migration
Go to **SQL Editor** in Supabase Dashboard and run:

**Step 1:** Run the schema migration
- Open `migrations/001_initial_schema.sql`
- Copy the entire contents
- Paste into SQL Editor
- Click "Run"

**Step 2:** Run the seed data
- Open `seed.sql`
- Copy the entire contents
- Paste into SQL Editor
- Click "Run"

### 4. Update Environment Variables
Add to your `.env` file:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Keep existing DATABASE_URL for Prisma (uses Supabase PostgreSQL)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.your-project-id.supabase.co:5432/postgres
```

### 5. Generate Prisma Client
```bash
npx prisma generate
```

### 6. Verify Connection
```bash
npx prisma db push
```

## Schema Overview

The database contains 16 tables:

| Table | Purpose |
|-------|---------|
| `roles` | User roles (ADMIN, MANAGER, etc.) |
| `permissions` | Granular permission definitions |
| `role_permissions` | Role-permission mapping |
| `departments` | Organizational departments |
| `locations` | Office/branch locations |
| `users` | Employee accounts |
| `user_locations` | User-location assignments |
| `sessions` | Active login sessions |
| `modules` | Compliance modules |
| `checkpoints` | Individual checkpoints within modules |
| `checkpoint_assignments` | User-checkpoint-date assignments |
| `checkpoint_submissions` | Compliance submissions |
| `submission_answers` | Detailed answers for submissions |
| `evidence_files` | Uploaded evidence files |
| `audit_logs` | System audit trail |
| `notifications` | User notifications |
| `system_settings` | App configuration key-value store |

## Default Seed Data

After running `seed.sql`:

| Entity | Values |
|--------|--------|
| **Roles** | ADMIN, MANAGER, SUPERVISOR, AUDITOR, USER, VIEWER |
| **Departments** | Operations, Sales, HR, Accounts, IT, Warehouse |
| **Modules** | CRM, Warehouse, Sales, HR, Accounts, Database |
| **Admin User** | `admin` / `Admin@123456` |
| **Demo User** | `john.doe` / `User@123456` |

## RLS (Row Level Security)

All tables have RLS enabled. The application uses Prisma with `service_role` key for full access. If you need Supabase client-side access, create appropriate RLS policies.

## Backup

Supabase provides automatic daily backups. For manual backups:
```bash
pg_dump $DATABASE_URL > backup.sql
```
