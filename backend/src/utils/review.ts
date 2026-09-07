import type { Request } from 'express'
import { query } from '../db.js'
import { logAudit } from './audit.js'
import { notifyUser } from './notify.js'

export async function reviewSubmission(input: {
  submissionId: string
  reviewerId: string
  reviewerName: string
  action: 'APPROVE' | 'REJECT'
  comment?: string | null
  via: 'admin' | 'supervisor'
  req?: Request
}): Promise<{ found: boolean; alreadyReviewed?: boolean }> {
  const { rows } = await query<{ id: string; user_id: string; status: string; checkpoint_title: string }>(
    `SELECT s.id, s.user_id, s.status, c.title AS checkpoint_title
     FROM checkpoint_submissions s
     JOIN checkpoints c ON c.id = s.checkpoint_id
     WHERE s.id = $1`,
    [input.submissionId]
  )
  const sub = rows[0]
  if (!sub) return { found: false }
  if (sub.status === 'APPROVED' || sub.status === 'REJECTED') return { found: true, alreadyReviewed: true }

  if (input.action === 'APPROVE') {
    await query(
      `UPDATE checkpoint_submissions
       SET status = 'APPROVED', approved_at = NOW(), reviewed_by = $1,
           review_comment = $2, updated_at = NOW()
       WHERE id = $3`,
      [input.reviewerId, input.comment || null, sub.id]
    )
  } else {
    await query(
      `UPDATE checkpoint_submissions
       SET status = 'REJECTED', rejected_at = NOW(), reviewed_by = $1,
           review_comment = $2, updated_at = NOW()
       WHERE id = $3`,
      [input.reviewerId, input.comment || null, sub.id]
    )
  }

  const supStatus = input.action === 'APPROVE' ? 'APPROVED' : 'REJECTED'
  await query(
    `UPDATE supervisor_approvals
     SET status = $1,
         approval_date = CASE WHEN $1::varchar = 'APPROVED' THEN NOW() ELSE approval_date END,
         rejection_reason = CASE WHEN $1::varchar = 'REJECTED' THEN $2 ELSE rejection_reason END,
         supervisor_comments = $2, updated_at = NOW()
     WHERE submission_id = $3 AND status = 'PENDING'`,
    [supStatus, input.comment || null, sub.id]
  )

  await notifyUser(sub.user_id, {
    title: input.action === 'APPROVE' ? 'Submission approved' : 'Submission rejected',
    message:
      input.action === 'APPROVE'
        ? `"${sub.checkpoint_title}" was approved by ${input.reviewerName}.`
        : `"${sub.checkpoint_title}" was rejected by ${input.reviewerName}.${input.comment ? ` Reason: ${input.comment}` : ''}`,
    type: input.action === 'APPROVE' ? 'success' : 'danger',
    linkUrl: '/history',
  })
  await logAudit({
    userId: input.reviewerId,
    action: input.action === 'APPROVE' ? 'SUBMISSION_APPROVED' : 'SUBMISSION_REJECTED',
    entityType: 'submission',
    entityId: sub.id,
    newValues: { via: input.via, comment: input.comment || null },
    req: input.req,
  })
  return { found: true, alreadyReviewed: false }
}
