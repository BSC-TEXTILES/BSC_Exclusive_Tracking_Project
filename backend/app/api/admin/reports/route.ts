import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { requireAdmin } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''
    const moduleId = searchParams.get('moduleId') || ''
    const departmentId = searchParams.get('departmentId') || ''
    const userId = searchParams.get('userId') || ''

    const where: Record<string, unknown> = {}

    if (moduleId) where.checkpoint = { moduleId }
    if (userId) where.userId = userId

    if (dateFrom || dateTo) {
      where.submissionDate = {}
      if (dateFrom) (where.submissionDate as Record<string, unknown>).gte = new Date(dateFrom)
      if (dateTo) (where.submissionDate as Record<string, unknown>).lte = new Date(dateTo)
    }

    const moduleFilter: Record<string, unknown> = {}
    if (moduleId) moduleFilter.id = moduleId
    if (departmentId) moduleFilter.departmentId = departmentId

    const [submissions, moduleStats, userStats] = await Promise.all([
      prisma.checkpointSubmission.findMany({
        where,
        include: {
          checkpoint: { include: { module: { include: { department: true } } } },
          user: { select: { id: true, fullName: true, employeeCode: true, departmentId: true } },
          answer: true,
        },
        orderBy: { submissionDate: 'desc' },
      }),
      prisma.module.findMany({
        where: moduleFilter,
        include: {
          department: true,
          checkpoints: {
            include: {
              submissions: {
                select: { status: true },
              },
            },
          },
        },
      }),
      prisma.user.findMany({
        where: departmentId ? { departmentId } : {},
        include: {
          role: true,
          department: true,
          checkpointSubmissions: {
            select: { status: true },
          },
        },
      }),
    ])

    const summary = {
      totalSubmissions: submissions.length,
      approved: submissions.filter(s => s.status === 'APPROVED').length,
      rejected: submissions.filter(s => s.status === 'REJECTED').length,
      pending: submissions.filter(s => s.status === 'SUBMITTED').length,
      draft: submissions.filter(s => s.status === 'DRAFT').length,
    }

    const byModule = moduleStats.map(m => {
      const allSubmissions = m.checkpoints.flatMap(cp => cp.submissions)
      return {
        moduleId: m.id,
        moduleName: m.name,
        department: m.department.name,
        totalCheckpoints: m.checkpoints.length,
        totalSubmissions: allSubmissions.length,
        approved: allSubmissions.filter(s => s.status === 'APPROVED').length,
        rejected: allSubmissions.filter(s => s.status === 'REJECTED').length,
        pending: allSubmissions.filter(s => s.status === 'SUBMITTED').length,
      }
    })

    const byUser = userStats.map(u => ({
      userId: u.id,
      fullName: u.fullName,
      employeeCode: u.employeeCode,
      role: u.role.name,
      department: u.department?.name ?? null,
      totalSubmissions: u.checkpointSubmissions.length,
      approved: u.checkpointSubmissions.filter(s => s.status === 'APPROVED').length,
      rejected: u.checkpointSubmissions.filter(s => s.status === 'REJECTED').length,
      pending: u.checkpointSubmissions.filter(s => s.status === 'SUBMITTED').length,
    }))

    return NextResponse.json({
      success: true,
      data: { summary, byModule, byUser },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Reports GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { type, dateFrom, dateTo, moduleId, departmentId, userId } = body as {
      type: string
      dateFrom?: string
      dateTo?: string
      moduleId?: string
      departmentId?: string
      userId?: string
    }

    if (!type || !['submissions', 'modules', 'users'].includes(type)) {
      return NextResponse.json(
        { success: false, message: 'Invalid report type' },
        { status: 400 }
      )
    }

    let csvContent = ''
    let filename = ''

    if (type === 'submissions') {
      const where: Record<string, unknown> = {}
      if (moduleId) where.checkpoint = { moduleId }
      if (userId) where.userId = userId
      if (dateFrom || dateTo) {
        where.submissionDate = {}
        if (dateFrom) (where.submissionDate as Record<string, unknown>).gte = new Date(dateFrom)
        if (dateTo) (where.submissionDate as Record<string, unknown>).lte = new Date(dateTo)
      }

      const submissions = await prisma.checkpointSubmission.findMany({
        where,
        include: {
          checkpoint: { include: { module: true } },
          user: { select: { fullName: true, employeeCode: true } },
          answer: true,
        },
        orderBy: { submissionDate: 'desc' },
      })

      csvContent = 'Date,User,Employee Code,Module,Checkpoint,Status,Compliance,Accuracy,Comments\n'
      for (const s of submissions) {
        csvContent += [
          s.submissionDate.toISOString().split('T')[0],
          s.user.fullName,
          s.user.employeeCode,
          s.checkpoint.module.name,
          s.checkpoint.title,
          s.status,
          s.answer?.complianceStatus || '',
          s.answer?.accuracyStatus || '',
          `"${(s.answer?.comments || '').replace(/"/g, '""')}"`,
        ].join(',') + '\n'
      }
      filename = `submissions-report-${new Date().toISOString().split('T')[0]}.csv`
    } else if (type === 'modules') {
      const where: Record<string, unknown> = {}
      if (departmentId) where.departmentId = departmentId

      const modules = await prisma.module.findMany({
        where,
        include: {
          department: true,
          checkpoints: {
            include: {
              submissions: { select: { status: true } },
            },
          },
        },
      })

      csvContent = 'Module,Department,Checkpoints,Total Submissions,Approved,Rejected,Pending\n'
      for (const m of modules) {
        const allSubs = m.checkpoints.flatMap(cp => cp.submissions)
        csvContent += [
          m.name,
          m.department.name,
          m.checkpoints.length,
          allSubs.length,
          allSubs.filter(s => s.status === 'APPROVED').length,
          allSubs.filter(s => s.status === 'REJECTED').length,
          allSubs.filter(s => s.status === 'SUBMITTED').length,
        ].join(',') + '\n'
      }
      filename = `modules-report-${new Date().toISOString().split('T')[0]}.csv`
    } else {
      const where: Record<string, unknown> = {}
      if (departmentId) where.departmentId = departmentId

      const users = await prisma.user.findMany({
        where,
        include: {
          role: true,
          department: true,
          checkpointSubmissions: { select: { status: true } },
        },
      })

      csvContent = 'Name,Employee Code,Email,Role,Department,Total Submissions,Approved,Rejected\n'
      for (const u of users) {
        csvContent += [
          u.fullName,
          u.employeeCode,
          u.email,
          u.role.name,
          u.department?.name || '',
          u.checkpointSubmissions.length,
          u.checkpointSubmissions.filter(s => s.status === 'APPROVED').length,
          u.checkpointSubmissions.filter(s => s.status === 'REJECTED').length,
        ].join(',') + '\n'
      }
      filename = `users-report-${new Date().toISOString().split('T')[0]}.csv`
    }

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Reports POST error:', error)
    return NextResponse.json({ success: false, message: 'Failed to generate report' }, { status: 500 })
  }
}
