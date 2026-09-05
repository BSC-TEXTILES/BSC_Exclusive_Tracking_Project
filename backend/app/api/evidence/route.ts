import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import prisma from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/session'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '10') * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const checkpointId = formData.get('checkpointId') as string

    if (!file) {
      return NextResponse.json({ success: false, message: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, message: 'Invalid file type. Allowed: JPEG, PNG, WEBP' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, message: `File too large. Maximum size: ${process.env.MAX_FILE_SIZE_MB || 10}MB` },
        { status: 400 }
      )
    }

    // Find or create submission
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let submission = await prisma.checkpointSubmission.findFirst({
      where: {
        checkpointId,
        userId: user.id,
        submissionDate: today,
      },
    })

    if (!submission) {
      const assignment = await prisma.checkpointAssignment.findFirst({
        where: { checkpointId, userId: user.id, assignedDate: today },
      })

      submission = await prisma.checkpointSubmission.create({
        data: {
          checkpointId,
          userId: user.id,
          assignmentId: assignment?.id,
          submissionDate: today,
          status: 'DRAFT',
        },
      })
    }

    // Save file
    const ext = path.extname(file.name) || `.${file.type.split('/')[1]}`
    const storedName = `${uuidv4()}${ext}`
    const uploadDir = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || './uploads')
    const dateDir = path.join(/*turbopackIgnore: true*/ uploadDir, today.toISOString().split('T')[0])

    await mkdir(dateDir, { recursive: true })

    const filePath = path.join(/*turbopackIgnore: true*/ dateDir, storedName)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    const storagePath = `/uploads/${today.toISOString().split('T')[0]}/${storedName}`

    // Save metadata to database
    const evidence = await prisma.evidenceFile.create({
      data: {
        submissionId: submission.id,
        uploadedById: user.id,
        originalName: file.name,
        storedName,
        mimeType: file.type,
        fileSize: file.size,
        storagePath,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        id: evidence.id,
        originalName: evidence.originalName,
        fileSize: evidence.fileSize,
        storagePath: evidence.storagePath,
      },
    })
  } catch (error) {
    console.error('Evidence upload error:', error)
    return NextResponse.json({ success: false, message: 'Upload failed' }, { status: 500 })
  }
}
