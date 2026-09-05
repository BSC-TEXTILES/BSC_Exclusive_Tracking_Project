import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const moduleId = searchParams.get('moduleId')

    const where: Record<string, unknown> = {}

    if (moduleId) {
      where.moduleId = moduleId
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    const checkpoints = await prisma.checkpoint.findMany({
      where,
      include: {
        module: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: { displayOrder: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: {
        checkpoints: checkpoints.map(cp => ({
          id: cp.id,
          title: cp.title,
          description: cp.description,
          score: cp.score,
          displayOrder: cp.displayOrder,
          isAccuracyRequired: cp.isAccuracyRequired,
          isCorrectiveActionRequired: cp.isCorrectiveActionRequired,
          isPhotoRequired: cp.isPhotoRequired,
          status: cp.status,
          moduleId: cp.moduleId,
          moduleName: cp.module.name,
          moduleSlug: cp.module.slug,
          createdById: cp.createdById,
          createdAt: cp.createdAt,
        })),
      },
    })
  } catch (error) {
    console.error('Admin checkpoints GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}
