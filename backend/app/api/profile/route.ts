import { NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/session'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const [
      totalSubmissions,
      approvedCount,
      rejectedCount,
      pendingCount,
      draftCount,
      thisWeekSubmissions,
      thisMonthSubmissions,
    ] = await Promise.all([
      prisma.checkpointSubmission.count({
        where: { userId: user.id },
      }),
      prisma.checkpointSubmission.count({
        where: { userId: user.id, status: 'APPROVED' },
      }),
      prisma.checkpointSubmission.count({
        where: { userId: user.id, status: 'REJECTED' },
      }),
      prisma.checkpointSubmission.count({
        where: { userId: user.id, status: 'PENDING' },
      }),
      prisma.checkpointSubmission.count({
        where: { userId: user.id, status: 'DRAFT' },
      }),
      prisma.checkpointSubmission.count({
        where: {
          userId: user.id,
          submissionDate: {
            gte: new Date(new Date().setDate(new Date().getDate() - 7)),
          },
        },
      }),
      prisma.checkpointSubmission.count({
        where: {
          userId: user.id,
          submissionDate: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          employeeCode: user.employeeCode,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          role: user.role.name,
          department: user.department?.name ?? null,
          status: user.status,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
        },
        stats: {
          totalSubmissions,
          approvedCount,
          rejectedCount,
          pendingCount,
          draftCount,
          thisWeekSubmissions,
          thisMonthSubmissions,
          approvalRate: totalSubmissions > 0 ? Math.round((approvedCount / totalSubmissions) * 100) : 0,
        },
      },
    })
  } catch (error) {
    console.error('Profile API error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
