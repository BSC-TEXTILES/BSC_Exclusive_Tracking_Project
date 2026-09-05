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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const moduleSlug = searchParams.get('module') || ''
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''

    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {
      userId: user.id,
    }

    if (status) {
      where.status = status
    }

    if (dateFrom || dateTo) {
      where.submissionDate = {}
      if (dateFrom) {
        (where.submissionDate as Record<string, Date>).gte = new Date(dateFrom)
      }
      if (dateTo) {
        (where.submissionDate as Record<string, Date>).lte = new Date(dateTo)
      }
    }

    if (moduleSlug || search) {
      where.checkpoint = {}
      if (moduleSlug) {
        (where.checkpoint as Record<string, unknown>).module = { slug: moduleSlug }
      }
      if (search) {
        (where.checkpoint as Record<string, unknown>).title = { contains: search, mode: 'insensitive' }
      }
    }

    const [submissions, total] = await Promise.all([
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
        skip,
        take: limit,
      }),
      prisma.checkpointSubmission.count({ where }),
    ])

    const data = submissions.map(sub => ({
      id: sub.id,
      date: sub.submissionDate,
      module: sub.checkpoint.module.name,
      moduleSlug: sub.checkpoint.module.slug,
      checkpoint: sub.checkpoint.title,
      compliance: sub.answer?.complianceStatus || null,
      accuracy: sub.answer?.accuracyStatus || null,
      correctiveAction: sub.answer?.correctiveAction || null,
      score: sub.checkpoint.score,
      status: sub.status,
      evidenceCount: sub.evidence.length,
      submittedAt: sub.submittedAt,
    }))

    return NextResponse.json({
      success: true,
      data: {
        submissions: data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('History API error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
