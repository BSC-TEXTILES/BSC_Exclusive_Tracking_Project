import { NextRequest, NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import path from 'path'
import prisma from '@/lib/db/prisma'
import { requireAdmin } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const moduleId = searchParams.get('moduleId')
    const dateStr = searchParams.get('date')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')
    const page = parseInt(searchParams.get('page') || '1')

    const where: Record<string, unknown> = {}

    if (userId) where.uploadedById = userId
    if (search) {
      where.OR = [
        { originalName: { contains: search, mode: 'insensitive' } },
        { submission: { checkpoint: { title: { contains: search, mode: 'insensitive' } } } },
      ]
    }

    if (moduleId) {
      where.submission = {
        checkpoint: { moduleId },
      }
    }

    if (dateStr) {
      const date = new Date(dateStr)
      date.setHours(0, 0, 0, 0)
      where.submission = {
        ...(where.submission as Record<string, unknown> || {}),
        submissionDate: date,
      }
    }

    const [evidenceFiles, total, stats, users, modules] = await Promise.all([
      prisma.evidenceFile.findMany({
        where,
        include: {
          uploadedBy: {
            select: { id: true, fullName: true, employeeCode: true, email: true },
          },
          submission: {
            select: {
              id: true,
              submissionDate: true,
              status: true,
              checkpoint: {
                select: {
                  id: true,
                  title: true,
                  score: true,
                  module: { select: { id: true, name: true, slug: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.evidenceFile.count({ where }),
      prisma.evidenceFile.aggregate({
        _sum: { fileSize: true },
        _count: { id: true },
      }),
      prisma.user.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, fullName: true, employeeCode: true },
        orderBy: { fullName: 'asc' },
      }),
      prisma.module.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, slug: true },
        orderBy: { displayOrder: 'asc' },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        evidence: evidenceFiles.map(e => ({
          id: e.id,
          originalName: e.originalName,
          mimeType: e.mimeType,
          fileSize: e.fileSize,
          storagePath: e.storagePath,
          url: `/api/evidence/${e.id}`,
          createdAt: e.createdAt,
          user: e.uploadedBy,
          submission: {
            id: e.submission.id,
            status: e.submission.status,
            date: e.submission.submissionDate.toISOString().split('T')[0],
          },
          checkpoint: e.submission.checkpoint,
        })),
        total,
        page,
        limit,
        totalSizeBytes: stats._sum.fileSize || 0,
        totalCount: stats._count.id,
        users,
        modules,
      },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Admin evidence GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, message: 'Evidence ID required' }, { status: 400 })
    }

    const existing = await prisma.evidenceFile.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Evidence not found' }, { status: 404 })
    }

    // Try deleting physical file
    try {
      const filePath = path.resolve(existing.storagePath.replace(/^\//, ''))
      await unlink(filePath)
    } catch {
      // File may have been removed or moved
    }

    await prisma.evidenceFile.delete({ where: { id } })

    await createAuditLog({
      userId: admin.id,
      action: 'EVIDENCE_DELETED',
      entityType: 'evidence_file',
      entityId: id,
      oldValues: { originalName: existing.originalName, fileSize: existing.fileSize },
    })

    return NextResponse.json({ success: true, message: 'Evidence file deleted successfully' })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Admin evidence DELETE error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}
