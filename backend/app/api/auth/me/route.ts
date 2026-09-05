import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        employeeCode: user.employeeCode,
        fullName: user.fullName,
        email: user.email,
        username: user.username,
        phone: user.phone,
        role: user.role.name,
        roleName: user.role.name,
        department: user.department?.name ?? null,
        departmentId: user.departmentId,
        status: user.status,
        profileImage: user.profileImage,
        mustChangePassword: user.mustChangePassword,
        lastLoginAt: user.lastLoginAt,
      },
    })
  } catch (error) {
    console.error('Get current user error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
