import { z } from 'zod'

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})
export type LoginInput = z.infer<typeof loginSchema>

export const createUserSchema = z.object({
  employeeCode: z.string().min(1).max(50),
  fullName: z.string().min(2).max(100),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  phone: z.string().max(20).optional().or(z.literal('')),
  departmentId: z.string().optional().or(z.literal('')),
  roleId: z.string().min(1),
  locationId: z.string().optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).default('ACTIVE'),
  password: z.string().min(8),
  mustChangePassword: z.boolean().default(true),
})
export type CreateUserInput = z.infer<typeof createUserSchema>

export const updateUserSchema = createUserSchema.partial().omit({ password: true })
export type UpdateUserInput = z.infer<typeof updateUserSchema>

export const departmentSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(20).regex(/^[A-Z0-9_]+$/),
  description: z.string().max(500).optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
})
export type DepartmentInput = z.infer<typeof departmentSchema>

export const moduleSchema = z.object({
  departmentId: z.string().min(1),
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional().or(z.literal('')),
  displayOrder: z.number().int().min(0).default(0),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
})
export type ModuleInput = z.infer<typeof moduleSchema>

export const checkpointSchema = z.object({
  moduleId: z.string().min(1),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional().or(z.literal('')),
  score: z.number().int().min(0).max(100).default(5),
  isAccuracyRequired: z.boolean().default(false),
  isCorrectiveActionRequired: z.boolean().default(false),
  isPhotoRequired: z.boolean().default(false),
  displayOrder: z.number().int().min(0).default(0),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
})
export type CheckpointInput = z.infer<typeof checkpointSchema>

export const complianceStatusEnum = z.enum([
  'FULLY_FOLLOWED', 'PARTIALLY_FOLLOWED', 'NOT_FOLLOWED', 'NO_TRANSACTION', 'YET_TO_IMPLEMENT',
])

export const accuracyStatusEnum = z.enum([
  'FULLY_ACCURATE', 'PARTLY_ACCURATE', 'INACCURATE', 'NA',
])

export const submissionAnswerSchema = z.object({
  complianceStatus: complianceStatusEnum.optional().nullable(),
  accuracyStatus: accuracyStatusEnum.optional().nullable(),
  comments: z.string().max(2000).optional().or(z.literal('')),
  correctiveAction: z.string().max(5000).optional().or(z.literal('')),
})
export type SubmissionAnswerInput = z.infer<typeof submissionAnswerSchema>

export const submitCheckpointSchema = z.object({
  complianceStatus: complianceStatusEnum,
  accuracyStatus: accuracyStatusEnum.optional().nullable(),
  comments: z.string().max(2000).optional().or(z.literal('')),
  correctiveAction: z.string().max(5000).optional().or(z.literal('')),
}).refine(
  (data) => {
    if (data.complianceStatus === 'NOT_FOLLOWED' || data.complianceStatus === 'PARTIALLY_FOLLOWED' || data.complianceStatus === 'YET_TO_IMPLEMENT') {
      return data.correctiveAction && data.correctiveAction.trim().length > 0
    }
    return true
  },
  { message: 'Corrective action is required for this compliance status', path: ['correctiveAction'] }
)

export const assignmentSchema = z.object({
  checkpointId: z.string().min(1),
  userId: z.string().min(1),
  assignedDate: z.string().min(1),
  dueDate: z.string().optional().or(z.literal('')),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'ONE_TIME']).default('DAILY'),
})
export type AssignmentInput = z.infer<typeof assignmentSchema>
