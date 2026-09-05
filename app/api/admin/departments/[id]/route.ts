import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { requireAdmin } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'
import { z } from 'zod'

const updateDepartmentSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  code: z.string().min(2).max(20).toUpperCase().optional(),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params

    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        users: {
          select: { id: true, fullName: true, email: true, employeeCode: true, status: true },
        },
        modules: {
          select: { id: true, name: true, slug: true, status: true },
        },
      },
    })

    if (!department) {
      return NextResponse.json({ success: false, message: 'Department not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: { department } })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Department GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const body = await request.json()

    const parsed = updateDepartmentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Validation failed', errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const existing = await prisma.department.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Department not found' }, { status: 404 })
    }

    const data = parsed.data
    // Check duplicates if name or code is changing
    if (data.name && data.name !== existing.name) {
      const duplicateName = await prisma.department.findFirst({
        where: { name: data.name, id: { not: id } },
      })
      if (duplicateName) {
        return NextResponse.json({ success: false, message: 'Department name already exists' }, { status: 409 })
      }
    }

    if (data.code && data.code !== existing.code) {
      const duplicateCode = await prisma.department.findFirst({
        where: { code: data.code, id: { not: id } },
      })
      if (duplicateCode) {
        return NextResponse.json({ success: false, message: 'Department code already exists' }, { status: 409 })
      }
    }

    const updated = await prisma.department.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.code && { code: data.code }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status && { status: data.status }),
      },
    })

    await createAuditLog({
      userId: admin.id,
      action: 'DEPARTMENT_UPDATED',
      entityType: 'department',
      entityId: id,
      oldValues: { name: existing.name, code: existing.code, status: existing.status },
      newValues: { name: updated.name, code: updated.code, status: updated.status },
    })

    return NextResponse.json({
      success: true,
      message: 'Department updated successfully',
      data: { department: updated },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Department PATCH error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    const { id } = await params

    const existing = await prisma.department.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, modules: true } },
      },
    })

    if (!existing) {
      return NextResponse.json({ success: false, message: 'Department not found' }, { status: 404 })
    }

    if (existing._count.users > 0) {
      return NextResponse.json(
        { success: false, message: `Cannot delete department with ${existing._count.users} assigned user(s)` },
        { status: 400 }
      )
    }

    if (existing._count.modules > 0) {
      return NextResponse.json(
        { success: false, message: `Cannot delete department with ${existing._count.modules} associated module(s)` },
        { status: 400 }
      )
    }

    await prisma.department.delete({ where: { id } })

    await createAuditLog({
      userId: admin.id,
      action: 'DEPARTMENT_DELETED',
      entityType: 'department',
      entityId: id,
      oldValues: { name: existing.name, code: existing.code },
    })

    return NextResponse.json({ success: true, message: 'Department deleted successfully' })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Department DELETE error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}
