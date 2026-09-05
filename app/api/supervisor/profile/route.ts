import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'

export async function GET() {
  try {
    const user = await requireAuth()

    if (user.role.name !== 'SUPERVISOR' && user.role.name !== 'ADMIN' && user.role.name !== 'MANAGER') {
      return NextResponse.json(
        { success: false, message: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    const [
      totalEmployees,
      activeEmployees,
      pendingApprovals,
      approvedCount,
      rejectedCount,
      totalSubmissions,
    ] = await Promise.all([
      prisma.user.count({
        where: user.departmentId ? { departmentId: user.departmentId } : {},
      }),
      prisma.user.count({
        where: {
          ...(user.departmentId ? { departmentId: user.departmentId } : {}),
          status: 'ACTIVE',
        },
      }),
      prisma.checkpointSubmission.count({
        where: {
          status: 'SUBMITTED',
          ...(user.departmentId
            ? { user: { departmentId: user.departmentId } }
            : {}),
        },
      }),
      prisma.checkpointSubmission.count({
        where: {
          status: 'APPROVED',
          reviewedById: user.id,
        },
      }),
      prisma.checkpointSubmission.count({
        where: {
          status: 'REJECTED',
          reviewedById: user.id,
        },
      }),
      prisma.checkpointSubmission.count({
        where: user.departmentId
          ? { user: { departmentId: user.departmentId } }
          : {},
      }),
    ])

    const names = user.fullName.trim().split(/\s+/)
    const initials =
      names.length > 1
        ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
        : (names[0]?.substring(0, 2) || 'U').toUpperCase()

    return NextResponse.json({
      success: true,
      data: {
        profile: {
          id: user.id,
          employeeCode: user.employeeCode,
          fullName: user.fullName,
          firstName: names[0] || user.fullName,
          initials,
          email: user.email,
          phone: user.phone,
          role: user.role.name,
          department: user.department?.name ?? null,
          departmentId: user.departmentId,
          status: user.status,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
        },
        stats: {
          totalEmployees,
          activeEmployees,
          pendingApprovals,
          approvedCount,
          rejectedCount,
          totalSubmissions,
          approvalRate:
            approvedCount + rejectedCount > 0
              ? Math.round(
                  (approvedCount / (approvedCount + rejectedCount)) * 100
                )
              : 0,
        },
      },
    })
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')
    ) {
      return NextResponse.json(
        { success: false, message: 'Forbidden' },
        { status: 403 }
      )
    }
    console.error('Supervisor profile GET error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth()

    if (user.role.name !== 'SUPERVISOR' && user.role.name !== 'ADMIN' && user.role.name !== 'MANAGER') {
      return NextResponse.json(
        { success: false, message: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { fullName, phone } = body as { fullName?: string; phone?: string }

    const updateData: Record<string, unknown> = {}
    if (fullName) updateData.fullName = fullName
    if (phone !== undefined) updateData.phone = phone || null

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, message: 'No fields to update' },
        { status: 400 }
      )
    }

    const oldValues: Record<string, unknown> = {}
    if (fullName) oldValues.fullName = user.fullName
    if (phone !== undefined) oldValues.phone = user.phone

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      include: { role: true, department: true },
    })

    await createAuditLog({
      userId: user.id,
      action: 'USER_UPDATED',
      entityType: 'user',
      entityId: user.id,
      oldValues,
      newValues: updateData,
    })

    const names = updatedUser.fullName.trim().split(/\s+/)
    const initials =
      names.length > 1
        ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
        : (names[0]?.substring(0, 2) || 'U').toUpperCase()

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: updatedUser.id,
        employeeCode: updatedUser.employeeCode,
        fullName: updatedUser.fullName,
        firstName: names[0] || updatedUser.fullName,
        initials,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role.name,
        department: updatedUser.department?.name ?? null,
      },
    })
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')
    ) {
      return NextResponse.json(
        { success: false, message: 'Forbidden' },
        { status: 403 }
      )
    }
    console.error('Supervisor profile PUT error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to update profile' },
      { status: 500 }
    )
  }
}
