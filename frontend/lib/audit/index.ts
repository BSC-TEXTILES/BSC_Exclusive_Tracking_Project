import { getSupabaseServerClient } from '@/lib/supabase/client'

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_ACTIVATED'
  | 'USER_DEACTIVATED'
  | 'PASSWORD_RESET'
  | 'PASSWORD_CHANGED'
  | 'DEPARTMENT_CREATED'
  | 'DEPARTMENT_UPDATED'
  | 'DEPARTMENT_DELETED'
  | 'MODULE_CREATED'
  | 'MODULE_UPDATED'
  | 'CHECKPOINT_CREATED'
  | 'CHECKPOINT_UPDATED'
  | 'CHECKPOINT_DELETED'
  | 'ASSIGNMENT_CREATED'
  | 'ASSIGNMENT_UPDATED'
  | 'ASSIGNMENT_DELETED'
  | 'EMPLOYEE_ASSIGNED'
  | 'EMPLOYEE_REMOVED'
  | 'DEPARTMENT_ASSIGNED'
  | 'MODULE_ASSIGNED'
  | 'CHECKPOINT_DRAFT_SAVED'
  | 'CHECKPOINT_SUBMITTED'
  | 'SUBMISSION_APPROVED'
  | 'SUBMISSION_REJECTED'
  | 'SUBMISSION_REVIEWED'
  | 'SUBMISSION_ESCALATED'
  | 'EVIDENCE_UPLOADED'
  | 'EVIDENCE_DELETED'
  | 'SETTINGS_UPDATED'

interface AuditLogParams {
  userId?: string | null
  action: AuditAction
  entityType: string
  entityId?: string | null
  oldValues?: Record<string, unknown> | null
  newValues?: Record<string, unknown> | null
  ipAddress?: string | null
  userAgent?: string | null
}

export async function createAuditLog(params: AuditLogParams) {
  try {
    const supabase = getSupabaseServerClient()
    await supabase.from('audit_logs').insert({
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      old_values: params.oldValues ?? null,
      new_values: params.newValues ?? null,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
    })
  } catch (error) {
    console.error('Failed to create audit log:', error)
  }
}
