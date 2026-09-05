import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || 'all' // 'today', 'week', 'month', 'all'
    const moduleId = searchParams.get('moduleId') || ''

    const where: Record<string, unknown> = {
      userId: user.id,
    }

    if (moduleId) {
      where.checkpoint = { moduleId }
    }

    const now = new Date()
    if (range === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      where.submissionDate = { gte: startOfDay }
    } else if (range === 'week') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      where.submissionDate = { gte: sevenDaysAgo }
    } else if (range === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      where.submissionDate = { gte: startOfMonth }
    }

    const [submissions, allModules] = await Promise.all([
      prisma.checkpointSubmission.findMany({
        where,
        include: {
          checkpoint: {
            include: {
              module: true,
            },
          },
          answer: true,
          evidence: true,
        },
        orderBy: { submissionDate: 'desc' },
      }),
      prisma.module.findMany({
        where: { status: 'ACTIVE' },
        include: {
          checkpoints: {
            where: { status: 'ACTIVE' },
            select: { id: true, title: true },
          },
        },
        orderBy: { displayOrder: 'asc' },
      }),
    ])

    const totalSubmissions = submissions.length
    const approved = submissions.filter(s => s.status === 'APPROVED').length
    const rejected = submissions.filter(s => s.status === 'REJECTED').length
    const pending = submissions.filter(s => s.status === 'SUBMITTED' || s.status === 'PENDING').length
    const drafts = submissions.filter(s => s.status === 'DRAFT').length

    // Accurate and compliant count
    const compliantCount = submissions.filter(s => 
      s.answer?.complianceStatus === 'FULLY_FOLLOWED' || s.answer?.complianceStatus === 'PARTIALLY_FOLLOWED'
    ).length
    const accurateCount = submissions.filter(s => 
      s.answer?.accuracyStatus === 'FULLY_ACCURATE' || s.answer?.accuracyStatus === 'PARTLY_ACCURATE'
    ).length

    const complianceRate = totalSubmissions > 0 ? Math.round((compliantCount / totalSubmissions) * 100) : 100
    const accuracyRate = totalSubmissions > 0 ? Math.round((accurateCount / totalSubmissions) * 100) : 100

    // Module-by-module breakdown
    const moduleBreakdown = allModules.map(m => {
      const moduleSubs = submissions.filter(s => s.checkpoint.moduleId === m.id)
      const modCompliant = moduleSubs.filter(s => 
        s.answer?.complianceStatus === 'FULLY_FOLLOWED' || s.answer?.complianceStatus === 'PARTIALLY_FOLLOWED'
      ).length
      return {
        id: m.id,
        name: m.name,
        slug: m.slug,
        totalCheckpoints: m.checkpoints.length,
        submissionsCount: moduleSubs.length,
        approvedCount: moduleSubs.filter(s => s.status === 'APPROVED').length,
        pendingCount: moduleSubs.filter(s => s.status === 'SUBMITTED' || s.status === 'PENDING').length,
        complianceRate: moduleSubs.length > 0 ? Math.round((modCompliant / moduleSubs.length) * 100) : 0,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          fullName: user.fullName,
          employeeCode: user.employeeCode,
          email: user.email,
          role: user.role.name,
          department: user.department?.name ?? 'Operations',
        },
        summary: {
          totalSubmissions,
          approved,
          rejected,
          pending,
          drafts,
          complianceRate,
          accuracyRate,
        },
        moduleBreakdown,
        recentSubmissions: submissions.slice(0, 15).map(s => ({
          id: s.id,
          checkpointTitle: s.checkpoint.title,
          moduleName: s.checkpoint.module.name,
          status: s.status,
          complianceStatus: s.answer?.complianceStatus || 'N/A',
          accuracyStatus: s.answer?.accuracyStatus || 'N/A',
          submissionDate: s.submissionDate,
          evidenceCount: s.evidence.length,
        })),
      },
    })
  } catch (error) {
    console.error('Reports API error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const range = body.range || 'all'

    const where: Record<string, unknown> = {
      userId: user.id,
    }

    const now = new Date()
    if (range === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      where.submissionDate = { gte: startOfDay }
    } else if (range === 'week') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      where.submissionDate = { gte: sevenDaysAgo }
    } else if (range === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      where.submissionDate = { gte: startOfMonth }
    }

    const submissions = await prisma.checkpointSubmission.findMany({
      where,
      include: {
        checkpoint: { include: { module: true } },
        answer: true,
      },
      orderBy: { submissionDate: 'desc' },
    })

    let csv = 'Date,Module,Checkpoint,Status,Compliance,Accuracy,Comments\n'
    for (const s of submissions) {
      csv += [
        s.submissionDate.toISOString().split('T')[0],
        `"${s.checkpoint.module.name.replace(/"/g, '""')}"`,
        `"${s.checkpoint.title.replace(/"/g, '""')}"`,
        s.status,
        s.answer?.complianceStatus || 'N/A',
        s.answer?.accuracyStatus || 'N/A',
        `"${(s.answer?.comments || '').replace(/"/g, '""')}"`,
      ].join(',') + '\n'
    }

    const filename = `bsc-exclusive-report-${new Date().toISOString().split('T')[0]}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Reports Export error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to generate report' },
      { status: 500 }
    )
  }
}
