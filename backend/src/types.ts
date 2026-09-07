export interface AuthUser {
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

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export interface EvidenceRow {
  id: string
  originalName: string
  storedName: string
  mimeType: string
  fileSize: number
  storagePath: string
  publicUrl: string | null
  createdAt: string
}
