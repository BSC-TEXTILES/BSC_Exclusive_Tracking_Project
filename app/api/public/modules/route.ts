import { NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'

// GET all active modules for the public landing page
// This deliberately excludes sensitive configuration data
export async function GET() {
  try {
    const modules = await prisma.module.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        description: true,
        // In a real app we might want a `isPublic` flag, 
        // but for the prompt we show active modules
      },
      orderBy: {
        displayOrder: 'asc',
      },
    })

    // Get checkpoint counts for each module safely
    const modulesWithCounts = await Promise.all(
      modules.map(async (mod) => {
        const count = await prisma.checkpoint.count({
          where: { moduleId: mod.id, status: 'ACTIVE' }
        })
        return {
          ...mod,
          checkpointCount: count
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: modulesWithCounts,
    })
  } catch (error) {
    console.error('Public modules GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}
