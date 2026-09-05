import { NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { requireAdmin } from '@/lib/auth/session'

export async function GET() {
  try {
    await requireAdmin()

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [
      totalUsers,
      activeUsers,
      totalModules,
      activeModules,
      totalCheckpoints,
      activeCheckpoints,
      todaySubmissions,
      totalSubmissions,
      approvedSubmissions,
      rejectedSubmissions,
      pendingSubmissions,
      totalDepartments,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.module.count(),
      prisma.module.count({ where: { status: 'ACTIVE' } }),
      prisma.checkpoint.count(),
      prisma.checkpoint.count({ where: { status: 'ACTIVE' } }),
      prisma.checkpointSubmission.count({
        where: { submissionDate: { gte: today, lt: tomorrow } },
      }),
      prisma.checkpointSubmission.count(),
      prisma.checkpointSubmission.count({ where: { status: 'APPROVED' } }),
      prisma.checkpointSubmission.count({ where: { status: 'REJECTED' } }),
      prisma.checkpointSubmission.count({ where: { status: 'SUBMITTED' } }),
      prisma.department.count(),
    ])

    const completionRate = totalSubmissions > 0
      ? Math.round(((approvedSubmissions + rejectedSubmissions) / totalSubmissions) * 100)
      : 0

    const approvalRate = (approvedSubmissions + rejectedSubmissions) > 0
      ? Math.round((approvedSubmissions / (approvedSubmissions + rejectedSubmissions)) * 100)
      : 0

    const recentActivity = await prisma.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, fullName: true } },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          activeUsers,
          totalModules,
          activeModules,
          totalCheckpoints,
          activeCheckpoints,
          totalDepartments,
          todaySubmissions,
          totalSubmissions,
          approvedSubmissions,
          rejectedSubmissions,
          pendingSubmissions,
          completionRate,
          approvalRate,
        },
        recentActivity: recentActivity.map(log => ({
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
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Dashboard GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}
