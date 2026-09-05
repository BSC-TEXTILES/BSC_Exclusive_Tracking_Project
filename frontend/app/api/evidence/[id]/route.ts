import { NextRequest, NextResponse } from 'next/server'
import { unlink, readFile } from 'fs/promises'
import path from 'path'
import { getSupabaseServerClient } from '@/lib/supabase/client'
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
    const supabase = getSupabaseServerClient()

    const { data: evidence } = await supabase
      .from('evidence_files')
      .select('*')
      .eq('id', id)
      .single()

    if (!evidence) {
      return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 })
    }

    const filePath = path.resolve(evidence.storage_path.replace(/^\//, ''))
    const fileBuffer = await readFile(filePath)

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': evidence.mime_type,
        'Content-Disposition': `inline; filename="${encodeURIComponent(evidence.original_name)}"`,
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
    const supabase = getSupabaseServerClient()

    const { data: evidence } = await supabase
      .from('evidence_files')
      .select('*, submission:checkpoint_submissions(*)')
      .eq('id', id)
      .single()

    if (!evidence) {
      return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 })
    }

    if (evidence.uploaded_by !== user.id) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }

    const submission = Array.isArray(evidence.submission) ? evidence.submission[0] : evidence.submission
    if (submission?.status === 'SUBMITTED' || submission?.status === 'APPROVED') {
      return NextResponse.json(
        { success: false, message: 'Cannot delete evidence from submitted checkpoint' },
        { status: 400 }
      )
    }

    try {
      const filePath = path.resolve(evidence.storage_path.replace(/^\//, ''))
      await unlink(filePath)
    } catch {
      // File might not exist, continue
    }

    await supabase.from('evidence_files').delete().eq('id', id)

    return NextResponse.json({ success: true, message: 'Evidence deleted' })
  } catch (error) {
    console.error('Delete evidence error:', error)
    return NextResponse.json({ success: false, message: 'Failed to delete' }, { status: 500 })
  }
}
