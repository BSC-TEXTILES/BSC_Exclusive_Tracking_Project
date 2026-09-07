import cron from 'node-cron'
import { config } from '../config.js'
import { query } from '../db.js'
import { logAudit } from '../utils/audit.js'
import { notifyAdmins, notifyUser } from '../utils/notify.js'

// Auto-approval: submissions left in SUBMITTED state for more than
// auto_approve_hours (default 1 hour) are automatically approved.
// Runs once at startup and then every minute.
export async function runAutoApprovalOnce(): Promise<void> {
  try {
    const { rows: setting } = await query<{ value: string }>(
      `SELECT value FROM system_settings WHERE key = 'auto_approve_hours'`
    )
    const hours = setting[0] ? parseFloat(setting[0].value) : config.autoApproveHours
    if (!Number.isFinite(hours) || hours <= 0) return

    const { rows } = await query<{
      id: string
      user_id: string
      checkpoint_id: string
      full_name: string
      checkpoint_title: string
    }>(
        `UPDATE checkpoint_submissions s
         SET status = 'APPROVED',
             approved_at = NOW(),
             auto_approved = TRUE,
             review_comment = COALESCE(NULLIF(review_comment, ''),
               'Auto-approved: no reviewer action within ' || $1 || ' hour(s)'),
             updated_at = NOW()
         FROM checkpoints c, users u
         WHERE c.id = s.checkpoint_id
           AND u.id = s.user_id
           AND s.status = 'SUBMITTED'
           AND s.submitted_at IS NOT NULL
           AND s.submitted_at <= NOW() - make_interval(hours => CEIL($1)::int)
         RETURNING s.id, s.user_id, s.checkpoint_id, u.full_name, c.title AS checkpoint_title`,
        [hours]
      )
      if (rows.length === 0) return

      for (const row of rows) {
        await query(
          `UPDATE supervisor_approvals SET status = 'APPROVED', approval_date = NOW(),
           supervisor_comments = 'Auto-approved by system after timeout', updated_at = NOW()
           WHERE submission_id = $1 AND status = 'PENDING'`,
          [row.id]
        )
        await notifyUser(row.user_id, {
          title: 'Submission auto-approved',
          message: `"${row.checkpoint_title}" was automatically approved after ${hours} hour(s) without reviewer action.`,
          type: 'success',
          linkUrl: '/history',
        })
        await logAudit({
          userId: null,
          action: 'SUBMISSION_AUTO_APPROVED',
          entityType: 'submission',
          entityId: row.id,
          newValues: { userId: row.user_id, hours },
        })
      }
      await notifyAdmins({
        title: 'Submissions auto-approved',
        message: `${rows.length} submission(s) were auto-approved after the ${hours}-hour review window expired.`,
        type: 'info',
        linkUrl: '/admin/submissions',
      })
      console.log(`[auto-approve] Auto-approved ${rows.length} submission(s) (window: ${hours}h)`)
  } catch (err) {
    console.error('[auto-approve] job failed:', (err as Error).message)
  }
}

export function startAutoApprovalJob(): void {
  void runAutoApprovalOnce()
  cron.schedule('* * * * *', () => {
    void runAutoApprovalOnce()
  })
}
