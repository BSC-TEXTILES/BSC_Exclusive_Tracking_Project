import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { getSupabaseServerClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth/session'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '10') * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseServerClient()
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

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]

    const { data: existingSubmissions } = await supabase
      .from('checkpoint_submissions')
      .select('id')
      .eq('checkpoint_id', checkpointId)
      .eq('user_id', user.id)
      .eq('submission_date', todayStr)
      .limit(1)

    let submissionId = existingSubmissions?.[0]?.id || null

    if (!submissionId) {
      const { data: assignments } = await supabase
        .from('checkpoint_assignments')
        .select('id')
        .eq('checkpoint_id', checkpointId)
        .eq('user_id', user.id)
        .eq('assigned_date', todayStr)
        .limit(1)

      const assignment = assignments?.[0] || null

      const { data: newSubmission } = await supabase
        .from('checkpoint_submissions')
        .insert({
          checkpoint_id: checkpointId,
          user_id: user.id,
          assignment_id: assignment?.id || null,
          submission_date: todayStr,
          status: 'DRAFT',
        })
        .select('id')
        .single()

      submissionId = newSubmission?.id || null
    }

    if (!submissionId) {
      return NextResponse.json({ success: false, message: 'Failed to create submission' }, { status: 500 })
    }

    const ext = path.extname(file.name) || `.${file.type.split('/')[1]}`
    const storedName = `${uuidv4()}${ext}`
    const uploadDir = path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || './uploads')
    const dateDir = path.join(/* turbopackIgnore: true */ uploadDir, todayStr)

    await mkdir(dateDir, { recursive: true })

    const filePath = path.join(/* turbopackIgnore: true */ dateDir, storedName)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    const storagePath = `/uploads/${todayStr}/${storedName}`

    const { data: evidence } = await supabase
      .from('evidence_files')
      .insert({
        submission_id: submissionId,
        uploaded_by: user.id,
        original_name: file.name,
        stored_name: storedName,
        mime_type: file.type,
        file_size: file.size,
        storage_path: storagePath,
      })
      .select()
      .single()

    return NextResponse.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        id: evidence?.id,
        originalName: evidence?.original_name,
        fileSize: evidence?.file_size,
        storagePath: evidence?.storage_path,
      },
    })
  } catch (error) {
    console.error('Evidence upload error:', error)
    return NextResponse.json({ success: false, message: 'Upload failed' }, { status: 500 })
  }
}
