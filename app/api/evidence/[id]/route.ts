import { NextRequest, NextResponse } from 'next/server'
import { unlink, readFile } from 'fs/promises'
import path from 'path'
import prisma from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/session'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const evidence = await prisma.evidenceFile.findUnique({
      where: { id },
    })

    if (!evidence) {
      return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 })
    }

    const filePath = path.resolve(evidence.storagePath.replace(/^\//, ''))
    const fileBuffer = await readFile(filePath)

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': evidence.mimeType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(evidence.originalName)}"`,
      },
    })
  } catch (error) {
    console.error('Serve evidence error:', error)
    return NextResponse.json({ success: false, message: 'File not found' }, { status: 404 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const evidence = await prisma.evidenceFile.findUnique({
      where: { id },
      include: { submission: true },
    })

    if (!evidence) {
      return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 })
    }

    // Only allow deleting own evidence and not from submitted checkpoints
    if (evidence.uploadedById !== user.id) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }

    if (evidence.submission.status === 'SUBMITTED' || evidence.submission.status === 'APPROVED') {
      return NextResponse.json(
        { success: false, message: 'Cannot delete evidence from submitted checkpoint' },
        { status: 400 }
      )
    }

    // Delete file from storage
    try {
      const filePath = path.resolve(evidence.storagePath.replace(/^\//, ''))
      await unlink(filePath)
    } catch {
      // File might not exist, continue
    }

    // Delete from database
    await prisma.evidenceFile.delete({ where: { id } })

    return NextResponse.json({ success: true, message: 'Evidence deleted' })
  } catch (error) {
    console.error('Delete evidence error:', error)
    return NextResponse.json({ success: false, message: 'Failed to delete' }, { status: 500 })
  }
}
