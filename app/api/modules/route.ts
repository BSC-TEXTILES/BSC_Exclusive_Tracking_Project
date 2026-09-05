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

    const modules = await prisma.module.findMany({
      where: { status: 'ACTIVE' },
      include: {
        checkpoints: {
          where: { status: 'ACTIVE' },
          select: { id: true },
        },
      },
      orderBy: { displayOrder: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: modules.map(m => ({
        id: m.id,
        name: m.name,
        slug: m.slug,
        description: m.description,
        checkpointCount: m.checkpoints.length,
      })),
    })
  } catch (error) {
    console.error('Modules list API error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
