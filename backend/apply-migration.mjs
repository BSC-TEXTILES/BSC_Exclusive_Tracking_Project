// Apply migration 004 to the backend's configured database (Supabase pooler-safe:
// runs each statement individually to avoid multi-command prepared statements).
import 'dotenv/config'
import pg from 'pg'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

await client.connect()
try {
  const sql = fs.readFileSync(path.join(__dirname, '../database/migrations/004_customer_whatsapp_schema.sql'), 'utf8')
  const statements = sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  for (const s of statements) {
    await client.query(s)
  }
  console.log(`[migrate] Applied ${statements.length} statements to ${process.env.DATABASE_URL.split('@')[1]}`)

  const check = await client.query(
    `SELECT
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='modules' AND column_name='title')::int AS m_title,
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='checkpoints' AND column_name='code')::int AS cp_code,
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='users' AND column_name='account_type')::int AS u_account_type,
       (SELECT to_regclass('public.customers') IS NOT NULL) AS customers,
       (SELECT to_regclass('public.whatsapp_messages') IS NOT NULL) AS whatsapp_messages,
       (SELECT to_regclass('public.whatsapp_contacts') IS NOT NULL) AS whatsapp_contacts`
  )
  console.log('[migrate] Verify:', JSON.stringify(check.rows[0]))
} finally {
  await client.end()
}
