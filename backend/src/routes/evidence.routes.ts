import { Router } from 'express'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { config } from '../config.js'
import { query } from '../db.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import { ah, fail, istToday, ok } from '../utils/http.js'
import { logAudit } from '../utils/audit.js'

const router = Router()
router.use(requireAuth)

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'text/csv': '.csv',
  'application/vnd.ms-excel': '.xls',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/webm': '.weba',
  'audio/x-m4a': '.m4a',
  'audio/aac': '.aac',
}

export const ALLOWED_EVIDENCE_TYPES = Object.keys(EXT_BY_MIME)

const useSupabaseStorage = config.fileStorageType === 'supabase'

let supabase: SupabaseClient | null = null
if (useSupabaseStorage) {
  if (!config.supabaseUrl || !config.supabaseServiceKey) {
    console.error(
      '[evidence] FILE_STORAGE_TYPE=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Falling back to local storage.'
    )
  } else {
    supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
}

fs.mkdirSync(config.uploadDir, { recursive: true })

const storage = useSupabaseStorage
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, config.uploadDir),
      filename: (_req, file, cb) => {
        const ext = EXT_BY_MIME[file.mimetype] || path.extname(file.originalname).toLowerCase() || '.bin'
        cb(null, `${randomUUID()}${ext}`)
      },
    })

const upload = multer({
  storage,
  limits: { fileSize: config.maxFileSizeMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_EVIDENCE_TYPES.includes(file.mimetype)) cb(null, true)
    else cb(new Error('UNSUPPORTED_TYPE'))
  },
})

// POST /api/evidence — upload evidence (images, PDF, CSV, audio)
router.post(
  '/',
  requirePermission('evidence:upload'),
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          return fail(res, 400, `File too large. Maximum size is ${config.maxFileSizeMb} MB`)
        }
        if ((err as Error).message === 'UNSUPPORTED_TYPE') {
          return fail(
            res,
            400,
            'Unsupported file type. Allowed: images (JPG, PNG, WEBP, GIF), PDF, CSV and audio (MP3, WAV, M4A, OGG, AAC)'
          )
        }
        return fail(res, 400, (err as Error).message || 'Upload failed')
      }
      next()
    })
  },
  ah(async (req, res) => {
    const user = req.user!
    const file = req.file
    if (!file) return fail(res, 400, 'No file provided')

    const submissionId = (req.body.submissionId as string) || null
    let effectiveSubmissionId = submissionId

    if (!effectiveSubmissionId) {
      // find today's submission for the checkpoint
      const checkpointId = req.body.checkpointId as string | undefined
      if (!checkpointId) {
        if (!useSupabaseStorage && file.path) fs.unlink(file.path, () => undefined)
        return fail(res, 400, 'checkpointId or submissionId is required')
      }
      const { rows } = await query<{ id: string }>(
        `SELECT id FROM checkpoint_submissions
         WHERE checkpoint_id = $1 AND user_id = $2 AND submission_date = $3
         LIMIT 1`,
        [checkpointId, user.id, istToday()]
      )
      if (rows.length === 0) {
        if (!useSupabaseStorage && file.path) fs.unlink(file.path, () => undefined)
        return fail(res, 404, 'No draft submission found. Save the form first, then upload evidence.')
      }
      effectiveSubmissionId = rows[0].id
    }

    // Persist the file
    let storedName = ''
    let storagePath = ''
    let publicUrl: string | null = null
    let urlPath = ''

    if (useSupabaseStorage && supabase) {
      const ext = EXT_BY_MIME[file.mimetype] || path.extname(file.originalname).toLowerCase() || '.bin'
      storedName = `${randomUUID()}${ext}`
      storagePath = `evidence/${effectiveSubmissionId}/${storedName}`
      const { error } = await supabase.storage
        .from(config.supabaseBucket)
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        })
      if (error) {
        return fail(res, 500, `Storage upload failed: ${error.message}`)
      }
      const { data: pub } = supabase.storage.from(config.supabaseBucket).getPublicUrl(storagePath)
      publicUrl = pub.publicUrl
      urlPath = publicUrl
    } else {
      storedName = file.filename
      storagePath = file.path
      urlPath = `/uploads/${file.filename}`
    }

    const stored = await query<{
      id: string
      original_name: string
      mime_type: string
      file_size: number
      created_at: string
    }>(
      `INSERT INTO evidence_files (submission_id, uploaded_by, original_name, stored_name, mime_type, file_size, storage_path, public_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, original_name, mime_type, file_size, created_at`,
      [
        effectiveSubmissionId,
        user.id,
        file.originalname,
        storedName,
        file.mimetype,
        file.size,
        storagePath,
        publicUrl,
      ]
    )
    await logAudit({
      userId: user.id,
      action: 'EVIDENCE_UPLOADED',
      entityType: 'evidence',
      entityId: stored.rows[0].id,
      newValues: { name: file.originalname, mime: file.mimetype, size: file.size },
      req,
    })

    ok(res, {
      id: stored.rows[0].id,
      originalName: stored.rows[0].original_name,
      mimeType: stored.rows[0].mime_type,
      fileSize: stored.rows[0].file_size,
      createdAt: stored.rows[0].created_at,
      url: urlPath,
    })
  })
)

// GET /api/evidence/:id — download evidence
router.get(
  '/:id',
  ah(async (req, res) => {
    const user = req.user!
    const { rows } = await query<{
      id: string
      submission_id: string
      uploaded_by: string
      original_name: string
      stored_name: string
      mime_type: string
      storage_path: string
      public_url: string | null
    }>(
      `SELECT id, submission_id, uploaded_by, original_name, stored_name, mime_type, storage_path, public_url
       FROM evidence_files WHERE id = $1`,
      [req.params.id]
    )
    const ev = rows[0]
    if (!ev) return fail(res, 404, 'Evidence not found')
    const canView =
      user.roleName === 'ADMIN' ||
      user.permissions.includes('evidence:view_all') ||
      ev.uploaded_by === user.id
    if (!canView) return fail(res, 403, 'Forbidden', 'FORBIDDEN')

    // Supabase-stored file: redirect to its public URL
    if (ev.public_url) return res.redirect(ev.public_url)

    const filePath = path.resolve(ev.storage_path)
    if (!filePath.startsWith(path.resolve(config.uploadDir)) || !fs.existsSync(filePath)) {
      return fail(res, 404, 'File missing on disk')
    }
    res.setHeader('Content-Type', ev.mime_type)
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(ev.original_name)}"`)
    return fs.createReadStream(filePath).pipe(res)
  })
)

// DELETE /api/evidence/:id
router.delete(
  '/:id',
  ah(async (req, res) => {
    const user = req.user!
    const { rows } = await query<{
      id: string
      uploaded_by: string
      storage_path: string
      public_url: string | null
      status: string
    }>(
      `SELECT e.id, e.uploaded_by, e.storage_path, e.public_url, s.status
       FROM evidence_files e
       JOIN checkpoint_submissions s ON s.id = e.submission_id
       WHERE e.id = $1`,
      [req.params.id]
    )
    const ev = rows[0]
    if (!ev) return fail(res, 404, 'Evidence not found')
    const isAdmin = user.roleName === 'ADMIN'
    if (!isAdmin && ev.uploaded_by !== user.id) return fail(res, 403, 'Forbidden', 'FORBIDDEN')
    if (!isAdmin && ev.status === 'SUBMITTED') {
      return fail(res, 409, 'Cannot delete evidence from a submitted checkpoint')
    }

    if (ev.public_url && supabase) {
      const rel = ev.storage_path.startsWith('evidence/') ? ev.storage_path : `evidence/${ev.storage_path}`
      const { error } = await supabase.storage.from(config.supabaseBucket).remove([rel])
      if (error) console.error('[evidence] storage delete failed:', error.message)
    } else {
      const filePath = path.resolve(ev.storage_path)
      if (filePath.startsWith(path.resolve(config.uploadDir))) {
        fs.unlink(filePath, () => undefined)
      }
    }

    await query('DELETE FROM evidence_files WHERE id = $1', [ev.id])
    await logAudit({
      userId: user.id,
      action: 'EVIDENCE_DELETED',
      entityType: 'evidence',
      entityId: ev.id,
      req,
    })
    ok(res, { deleted: true })
  })
)

export default router
