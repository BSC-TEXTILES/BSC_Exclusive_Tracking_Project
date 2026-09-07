import { Router } from 'express'
import { query } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { ah, fail, istToday, ok } from '../utils/http.js'

const router = Router()
router.use(requireAuth)

// GET /api/checkpoints/:id — checkpoint detail + today's assignment/submission
router.get(
  '/:id',
  ah(async (req, res) => {
    const user = req.user!
    const today = istToday()
    const { rows: cp } = await query<{
      id: string
      title: string
      description: string | null
      score: number
      is_accuracy_required: boolean
      is_corrective_action_required: boolean
      is_photo_required: boolean
      module_name: string
      module_slug: string
      department_name: string
    }>(
      `SELECT c.id, c.title, c.description, c.score, c.is_accuracy_required,
              c.is_corrective_action_required, c.is_photo_required,
              m.name AS module_name, m.slug AS module_slug, d.name AS department_name
       FROM checkpoints c
       JOIN modules m ON m.id = c.module_id
       JOIN departments d ON d.id = m.department_id
       WHERE c.id = $1 AND c.status = 'ACTIVE'`,
      [req.params.id]
    )
    if (cp.length === 0) return fail(res, 404, 'Checkpoint not found')

    const { rows: assignment } = await query<{
      id: string
      assigned_date: string
      due_date: string | null
      frequency: string
    }>(
      `SELECT id, assigned_date::text, due_date::text, frequency
       FROM checkpoint_assignments
       WHERE checkpoint_id = $1 AND user_id = $2 AND assigned_date = $3 AND status = 'ACTIVE'
       LIMIT 1`,
      [req.params.id, user.id, today]
    )

    let submission: Record<string, unknown> | null = null
    const { rows: subs } = await query<{
      id: string
      status: string
      submitted_at: string | null
      approved_at: string | null
      rejected_at: string | null
      review_comment: string | null
      auto_approved: boolean
      reviewed_by_name: string | null
      compliance_status: string | null
      accuracy_status: string | null
      comments: string | null
      corrective_action: string | null
    }>(
      `SELECT s.id, s.status, s.submitted_at, s.approved_at, s.rejected_at, s.review_comment,
              s.auto_approved, rb.full_name AS reviewed_by_name,
              a.compliance_status, a.accuracy_status, a.comments, a.corrective_action
       FROM checkpoint_submissions s
       LEFT JOIN submission_answers a ON a.submission_id = s.id
       LEFT JOIN users rb ON rb.id = s.reviewed_by
       WHERE s.checkpoint_id = $1 AND s.user_id = $2 AND s.submission_date = $3
       LIMIT 1`,
      [req.params.id, user.id, today]
    )
    if (subs.length > 0) {
      const s = subs[0]
      const { rows: evidence } = await query(
        `SELECT id, original_name, stored_name, mime_type, file_size, storage_path, public_url, created_at
         FROM evidence_files WHERE submission_id = $1 ORDER BY created_at`,
        [s.id]
      )
      submission = {
        id: s.id,
        status: s.status,
        submittedAt: s.submitted_at,
        approvedAt: s.approved_at,
        rejectedAt: s.rejected_at,
        reviewComment: s.review_comment,
        autoApproved: s.auto_approved,
        reviewedByName: s.reviewed_by_name,
        answer:
          s.compliance_status || s.accuracy_status || s.comments || s.corrective_action
            ? {
                complianceStatus: s.compliance_status,
                accuracyStatus: s.accuracy_status,
                comments: s.comments,
                correctiveAction: s.corrective_action,
              }
            : null,
        evidence: evidence.map((e) => ({
          id: e.id,
          originalName: e.original_name,
          storedName: e.stored_name,
          mimeType: e.mime_type,
          fileSize: e.file_size,
          storagePath: e.storage_path,
          publicUrl: e.public_url,
          createdAt: e.created_at,
        })),
      }
    }

    ok(res, {
      checkpoint: {
        id: cp[0].id,
        title: cp[0].title,
        description: cp[0].description,
        score: cp[0].score,
        isAccuracyRequired: cp[0].is_accuracy_required,
        isCorrectiveActionRequired: cp[0].is_corrective_action_required,
        isPhotoRequired: cp[0].is_photo_required,
        moduleName: cp[0].module_name,
        moduleSlug: cp[0].module_slug,
        departmentName: cp[0].department_name,
      },
      assignment: assignment.length > 0 ? assignment[0] : null,
      submission,
    })
  })
)

export default router
