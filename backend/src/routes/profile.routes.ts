import { Router } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { query } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { ah, fail, ok } from '../utils/http.js'
import { logAudit } from '../utils/audit.js'
import { destroySession } from '../utils/session.js'
import { config } from '../config.js'

const router = Router()
router.use(requireAuth)

// ── Profile Photo Upload ──────────────────────────────────────
const PROFILE_PHOTO_MIMES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

const useSupabase = config.fileStorageType === 'supabase'
let supabaseClient: SupabaseClient | null = null
if (useSupabase && config.supabaseUrl && config.supabaseServiceKey) {
  supabaseClient = createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

const profilePhotoStorage = useSupabase
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (_req, _file, cb) => {
        const dir = path.join(config.uploadDir, 'profiles')
        fs.mkdirSync(dir, { recursive: true })
        cb(null, dir)
      },
      filename: (_req, file, cb) => {
        const ext = PROFILE_PHOTO_MIMES[file.mimetype] || '.jpg'
        cb(null, `${randomUUID()}${ext}`)
      },
    })

const profileUpload = multer({
  storage: profilePhotoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    if (Object.keys(PROFILE_PHOTO_MIMES).includes(file.mimetype)) cb(null, true)
    else cb(new Error('Only JPG, PNG, and WEBP images are allowed'))
  },
})

const updateSchema = z.object({
  fullName: z.string().min(2).max(150).optional(),
  email: z.string().email().max(150).optional(),
  phone: z.string().max(30).nullable().optional(),
})

// POST /api/profile/photo — upload profile photo
router.post(
  '/photo',
  (req, res, next) => {
    profileUpload.single('photo')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          return fail(res, 400, 'Photo too large. Maximum size is 5 MB')
        }
        return fail(res, 400, (err as Error).message || 'Upload failed')
      }
      next()
    })
  },
  ah(async (req, res) => {
    const user = req.user!
    const file = req.file
    if (!file) return fail(res, 400, 'No photo provided')

    // Delete old profile photo if exists
    const { rows: existing } = await query<{ profile_image: string | null }>(
      'SELECT profile_image FROM users WHERE id = $1',
      [user.id]
    )
    const oldImage = existing[0]?.profile_image

    let publicUrl: string | null = null
    let storagePath = ''

    if (useSupabase && supabaseClient) {
      const ext = PROFILE_PHOTO_MIMES[file.mimetype] || '.jpg'
      const storedName = `${randomUUID()}${ext}`
      storagePath = `profiles/${user.id}/${storedName}`
      const { error } = await supabaseClient.storage
        .from(config.supabaseBucket)
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        })
      if (error) return fail(res, 500, `Storage upload failed: ${error.message}`)
      const { data: pub } = supabaseClient.storage.from(config.supabaseBucket).getPublicUrl(storagePath)
      publicUrl = pub.publicUrl
    } else {
      storagePath = file.path
      publicUrl = `/uploads/profiles/${file.filename}`
    }

    await query(
      'UPDATE users SET profile_image = $1, updated_at = NOW() WHERE id = $2',
      [publicUrl, user.id]
    )

    // Cleanup old local file
    if (oldImage && !oldImage.startsWith('http') && oldImage.startsWith('/uploads/')) {
      const oldPath = path.join(config.uploadDir, oldImage.replace('/uploads/', ''))
      fs.unlink(oldPath, () => undefined)
    }

    await logAudit({ userId: user.id, action: 'PROFILE_PHOTO_UPDATED', entityType: 'user', entityId: user.id, req })
    ok(res, { profileImage: publicUrl })
  })
)

// DELETE /api/profile/photo — remove profile photo
router.delete(
  '/photo',
  ah(async (req, res) => {
    const user = req.user!
    const { rows } = await query<{ profile_image: string | null }>(
      'SELECT profile_image FROM users WHERE id = $1',
      [user.id]
    )
    const oldImage = rows[0]?.profile_image
    if (!oldImage) return fail(res, 404, 'No profile photo to remove')

    // Delete file
    if (oldImage.startsWith('/uploads/')) {
      const oldPath = path.join(config.uploadDir, oldImage.replace('/uploads/', ''))
      fs.unlink(oldPath, () => undefined)
    }

    await query('UPDATE users SET profile_image = NULL, updated_at = NOW() WHERE id = $1', [user.id])
    await logAudit({ userId: user.id, action: 'PROFILE_PHOTO_REMOVED', entityType: 'user', entityId: user.id, req })
    ok(res, { removed: true })
  })
)

// GET /api/profile
router.get(
  '/',
  ah(async (req, res) => {
    const user = req.user!
    const { rows } = await query<{
      id: string
      employee_code: string
      full_name: string
      email: string
      phone: string | null
      username: string
      profile_image: string | null
      must_change_password: boolean
      last_login_at: string | null
      role_name: string
      department_name: string | null
      created_at: string
    }>(
      `SELECT u.id, u.employee_code, u.full_name, u.email, u.phone, u.username,
              u.profile_image, u.must_change_password, u.last_login_at, u.created_at,
              r.name AS role_name, d.name AS department_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE u.id = $1`,
      [user.id]
    )
    ok(res, { profile: rows[0] })
  })
)

// PUT /api/profile
router.put(
  '/',
  ah(async (req, res) => {
    const user = req.user!
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) return fail(res, 400, 'Invalid profile data')
    const d = parsed.data
    await query(
      `UPDATE users SET full_name = COALESCE($1, full_name), email = COALESCE($2, email),
       phone = $3, updated_at = NOW() WHERE id = $4`,
      [d.fullName || null, d.email || null, d.phone === undefined ? null : d.phone, user.id]
    )
    await logAudit({ userId: user.id, action: 'PROFILE_UPDATED', entityType: 'user', entityId: user.id, req })
    ok(res, { updated: true })
  })
)

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').regex(/^(?=.*[A-Za-z])(?=.*\d)/, 'Password must contain both letters and numbers'),
})

// PUT /api/profile/password
router.put(
  '/password',
  ah(async (req, res) => {
    const user = req.user!
    const parsed = passwordSchema.safeParse(req.body)
    if (!parsed.success) return fail(res, 400, parsed.error.issues[0]?.message || 'Invalid password')

    const { rows } = await query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1',
      [user.id]
    )
    const valid = await bcrypt.compare(parsed.data.currentPassword, rows[0].password_hash)
    if (!valid) return fail(res, 400, 'Current password is incorrect')

    await query(
      `UPDATE users SET password_hash = $1, must_change_password = FALSE, updated_at = NOW() WHERE id = $2`,
      [await bcrypt.hash(parsed.data.newPassword, 10), user.id]
    )
    // Revoke other sessions
    const token = (req.cookies as Record<string, string>)[config.cookieName]
    await query('DELETE FROM sessions WHERE user_id = $1 AND token <> $2', [user.id, token])
    await logAudit({ userId: user.id, action: 'PASSWORD_CHANGED', entityType: 'user', entityId: user.id, req })
    ok(res, { updated: true })
  })
)

export default router
