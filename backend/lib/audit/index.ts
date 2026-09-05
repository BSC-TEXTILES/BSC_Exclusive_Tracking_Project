import prisma from '@/lib/db/prisma'

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
  | 'CHECKPOINT_DRAFT_SAVED'
  | 'CHECKPOINT_SUBMITTED'
  | 'SUBMISSION_APPROVED'
  | 'SUBMISSION_REJECTED'
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
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        oldValues: params.oldValues as Record<string, string> ?? undefined,
        newValues: params.newValues as Record<string, string> ?? undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    })
  } catch (error) {
    // Don't let audit logging failures break the main operation
    console.error('Failed to create audit log:', error)
  }
}
