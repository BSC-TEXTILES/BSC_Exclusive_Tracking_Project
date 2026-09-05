// Permission constants for RBAC
export const PERMISSIONS = {
  // User Management
  USERS_VIEW: 'users:view',
  USERS_CREATE: 'users:create',
  USERS_EDIT: 'users:edit',
  USERS_DELETE: 'users:delete',
  USERS_ACTIVATE: 'users:activate',
  USERS_DEACTIVATE: 'users:deactivate',
  USERS_RESET_PASSWORD: 'users:reset_password',

  // Department Management
  DEPARTMENTS_VIEW: 'departments:view',
  DEPARTMENTS_CREATE: 'departments:create',
  DEPARTMENTS_EDIT: 'departments:edit',
  DEPARTMENTS_DELETE: 'departments:delete',

  // Module Management
  MODULES_VIEW: 'modules:view',
  MODULES_CREATE: 'modules:create',
  MODULES_EDIT: 'modules:edit',
  MODULES_DELETE: 'modules:delete',

  // Checkpoint Management
  CHECKPOINTS_VIEW: 'checkpoints:view',
  CHECKPOINTS_CREATE: 'checkpoints:create',
  CHECKPOINTS_EDIT: 'checkpoints:edit',
  CHECKPOINTS_DELETE: 'checkpoints:delete',

  // Assignment Management
  ASSIGNMENTS_VIEW: 'assignments:view',
  ASSIGNMENTS_CREATE: 'assignments:create',
  ASSIGNMENTS_EDIT: 'assignments:edit',
  ASSIGNMENTS_DELETE: 'assignments:delete',

  // Submissions
  SUBMISSIONS_VIEW_OWN: 'submissions:view_own',
  SUBMISSIONS_VIEW_ALL: 'submissions:view_all',
  SUBMISSIONS_CREATE: 'submissions:create',
  SUBMISSIONS_EDIT_OWN: 'submissions:edit_own',
  SUBMISSIONS_REVIEW: 'submissions:review',
  SUBMISSIONS_APPROVE: 'submissions:approve',
  SUBMISSIONS_REJECT: 'submissions:reject',

  // Evidence
  EVIDENCE_UPLOAD: 'evidence:upload',
  EVIDENCE_VIEW_OWN: 'evidence:view_own',
  EVIDENCE_VIEW_ALL: 'evidence:view_all',
  EVIDENCE_DELETE: 'evidence:delete',

  // Reports
  REPORTS_VIEW_OWN: 'reports:view_own',
  REPORTS_VIEW_ALL: 'reports:view_all',
  REPORTS_EXPORT: 'reports:export',

  // Audit Logs
  AUDIT_LOGS_VIEW: 'audit_logs:view',

  // Settings
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_EDIT: 'settings:edit',

  // Admin Panel Access
  ADMIN_ACCESS: 'admin:access',
} as const

export type PermissionName = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

// Role-based default permissions
export const ROLE_PERMISSIONS: Record<string, PermissionName[]> = {
  ADMIN: Object.values(PERMISSIONS),

  MANAGER: [
    PERMISSIONS.SUBMISSIONS_VIEW_ALL,
    PERMISSIONS.SUBMISSIONS_REVIEW,
    PERMISSIONS.SUBMISSIONS_APPROVE,
    PERMISSIONS.SUBMISSIONS_REJECT,
    PERMISSIONS.EVIDENCE_VIEW_ALL,
    PERMISSIONS.REPORTS_VIEW_ALL,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.SUBMISSIONS_VIEW_OWN,
    PERMISSIONS.SUBMISSIONS_CREATE,
    PERMISSIONS.SUBMISSIONS_EDIT_OWN,
    PERMISSIONS.EVIDENCE_UPLOAD,
    PERMISSIONS.EVIDENCE_VIEW_OWN,
    PERMISSIONS.REPORTS_VIEW_OWN,
  ],

  SUPERVISOR: [
    PERMISSIONS.SUBMISSIONS_VIEW_ALL,
    PERMISSIONS.SUBMISSIONS_REVIEW,
    PERMISSIONS.EVIDENCE_VIEW_ALL,
    PERMISSIONS.REPORTS_VIEW_ALL,
    PERMISSIONS.SUBMISSIONS_VIEW_OWN,
    PERMISSIONS.SUBMISSIONS_CREATE,
    PERMISSIONS.SUBMISSIONS_EDIT_OWN,
    PERMISSIONS.EVIDENCE_UPLOAD,
    PERMISSIONS.EVIDENCE_VIEW_OWN,
    PERMISSIONS.REPORTS_VIEW_OWN,
  ],

  AUDITOR: [
    PERMISSIONS.SUBMISSIONS_VIEW_ALL,
    PERMISSIONS.EVIDENCE_VIEW_ALL,
    PERMISSIONS.REPORTS_VIEW_ALL,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.AUDIT_LOGS_VIEW,
  ],

  USER: [
    PERMISSIONS.SUBMISSIONS_VIEW_OWN,
    PERMISSIONS.SUBMISSIONS_CREATE,
    PERMISSIONS.SUBMISSIONS_EDIT_OWN,
    PERMISSIONS.EVIDENCE_UPLOAD,
    PERMISSIONS.EVIDENCE_VIEW_OWN,
    PERMISSIONS.REPORTS_VIEW_OWN,
  ],

  VIEWER: [
    PERMISSIONS.SUBMISSIONS_VIEW_OWN,
    PERMISSIONS.EVIDENCE_VIEW_OWN,
    PERMISSIONS.REPORTS_VIEW_OWN,
  ],
}

// Check if a role has a specific permission
export function hasPermission(roleName: string, permission: PermissionName): boolean {
  const permissions = ROLE_PERMISSIONS[roleName]
  if (!permissions) return false
  return permissions.includes(permission)
}

// Check if a role is an admin role
export function isAdmin(roleName: string): boolean {
  return roleName === 'ADMIN'
}

// Check if a role has admin panel access
export function hasAdminAccess(roleName: string): boolean {
  return hasPermission(roleName, PERMISSIONS.ADMIN_ACCESS)
}
