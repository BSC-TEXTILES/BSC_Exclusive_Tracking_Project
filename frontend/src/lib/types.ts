export interface User {
  id: string
  employeeCode: string
  fullName: string
  email: string
  phone: string | null
  username: string
  roleId: string
  roleName: string
  departmentId: string | null
  departmentName: string | null
  profileImage: string | null
  permissions: string[]
}

export type StatusKey =
  | 'APPROVED'
  | 'SUBMITTED'
  | 'REJECTED'
  | 'DRAFT'
  | 'PENDING'
  | 'NOT_APPLICABLE'
  | 'OVERDUE'

export interface Evidence {
  id: string
  originalName: string
  storedName: string
  mimeType: string
  fileSize: number
  storagePath: string
  publicUrl: string | null
  createdAt: string
}

export interface SubmissionAnswer {
  complianceStatus: string | null
  accuracyStatus: string | null
  comments: string | null
  correctiveAction: string | null
}

export interface Submission {
  id: string
  status: StatusKey
  submittedAt: string | null
  approvedAt: string | null
  rejectedAt: string | null
  reviewComment: string | null
  autoApproved?: boolean
  reviewedByName?: string | null
  answer: SubmissionAnswer | null
  evidence: Evidence[]
}
