import { NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth/session'

export async function GET() {
  try {
    const user = await requireAuth()

    if (user.role.name !== 'SUPERVISOR' && user.role.name !== 'ADMIN' && user.role.name !== 'MANAGER') {
      return NextResponse.json(
        { success: false, message: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    const supervisorDeptId = user.departmentId

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [
      totalEmployees,
      activeEmployees,
      assignedDepartments,
      assignedModules,
      pendingApprovals,
      approvedCount,
      rejectedCount,
      todaySubmissions,
      totalSubmissions,
      recentActivity,
    ] = await Promise.all([
      prisma.user.count({
        where: supervisorDeptId ? { departmentId: supervisorDeptId } : {},
      }),
      prisma.user.count({
        where: {
          ...(supervisorDeptId ? { departmentId: supervisorDeptId } : {}),
          status: 'ACTIVE',
        },
      }),
      supervisorDeptId
        ? prisma.department.findMany({
            where: { id: supervisorDeptId },
            select: { id: true, name: true, code: true },
          })
        : [],
      supervisorDeptId
        ? prisma.module.findMany({
            where: { departmentId: supervisorDeptId, status: 'ACTIVE' },
            select: { id: true, name: true, slug: true, displayOrder: true },
            orderBy: { displayOrder: 'asc' },
          })
        : [],
      prisma.checkpointSubmission.count({
        where: {
          status: 'SUBMITTED',
          ...(supervisorDeptId
            ? { user: { departmentId: supervisorDeptId } }
            : {}),
        },
      }),
      prisma.checkpointSubmission.count({
        where: {
          status: 'APPROVED',
          ...(supervisorDeptId
            ? { user: { departmentId: supervisorDeptId } }
            : {}),
        },
      }),
      prisma.checkpointSubmission.count({
        where: {
          status: 'REJECTED',
          ...(supervisorDeptId
            ? { user: { departmentId: supervisorDeptId } }
            : {}),
        },
      }),
      prisma.checkpointSubmission.count({
        where: {
          submissionDate: { gte: today, lt: tomorrow },
          ...(supervisorDeptId
            ? { user: { departmentId: supervisorDeptId } }
            : {}),
        },
      }),
      prisma.checkpointSubmission.count({
        where: supervisorDeptId
          ? { user: { departmentId: supervisorDeptId } }
          : {},
      }),
      prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        where: supervisorDeptId
          ? { user: { departmentId: supervisorDeptId } }
          : {},
        include: {
          user: { select: { id: true, fullName: true } },
        },
      }),
    ])

    const completionRate =
      totalSubmissions > 0
        ? Math.round(
            ((approvedCount + rejectedCount) / totalSubmissions) * 100
          )
        : 0

    const approvalRate =
      approvedCount + rejectedCount > 0
        ? Math.round((approvedCount / (approvedCount + rejectedCount)) * 100)
        : 0

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalEmployees,
          activeEmployees,
          assignedDepartments: assignedDepartments.length,
          assignedModules: assignedModules.length,
          pendingApprovals,
          approvedCount,
          rejectedCount,
          todaySubmissions,
          totalSubmissions,
          completionRate,
          approvalRate,
        },
        departments: assignedDepartments,
        modules: assignedModules,
        recentActivity: recentActivity.map((log) => ({
          id: log.id,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          user: log.user?.fullName ?? 'System',
          createdAt: log.createdAt,
        })),
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
    console.error('Supervisor dashboard GET error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal error' },
      { status: 500 }
    )
  }
}
