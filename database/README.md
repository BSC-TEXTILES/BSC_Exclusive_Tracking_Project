# Database — BSC Exclusive Tracking

PostgreSQL schema and seed data. **Supabase-compatible**: point `DATABASE_URL` at any
Supabase project's Direct connection string, or run these files in the Supabase SQL editor.

## Files

- `schema.sql` — complete schema (25 tables: users/roles/permissions, departments,
  modules, checkpoints, assignments, submissions, answers, evidence, audit logs,
  notifications, settings, supervisor tables, location tracking tables)
- `init.mjs` — creates the database, applies `schema.sql` and seeds demo data
  (idempotent — safe to re-run)
- `.env.example` — connection configuration

## Run

```bash
npm install
npm run init
```

Seeded demo accounts: `admin / Admin@123456`, `john.doe / User@123456`,
`sarah.lee / User@123456`, `jane.smith / Supervisor@123`, `mike.ross / Manager@123`.

Seed data includes 5 departments, 6 modules, 18 checkpoints, 14 days of assignments
and submissions in every status, supervisor setup for Jane Smith, registered office
locations, live location tracks and system settings.
