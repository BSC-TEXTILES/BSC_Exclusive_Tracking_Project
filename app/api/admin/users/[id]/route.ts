import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { requireAdmin } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'
import { hashPassword } from '@/lib/auth/password'

// GET single user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
        department: true,
        userLocations: { include: { location: true } },
      },
    })

    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        employeeCode: user.employeeCode,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        username: user.username,
        role: user.role.name,
        roleId: user.roleId,
        department: user.department?.name ?? null,
        departmentId: user.departmentId,
        status: user.status,
        mustChangePassword: user.mustChangePassword,
        locations: user.userLocations.map(ul => ({
          id: ul.location.id,
          name: ul.location.name,
        })),
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

// UPDATE user
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const body = await request.json()

    const existingUser = await prisma.user.findUnique({ where: { id }, include: { role: true } })
    if (!existingUser) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (body.fullName !== undefined) updateData.fullName = body.fullName
    if (body.email !== undefined) updateData.email = body.email
    if (body.phone !== undefined) updateData.phone = body.phone || null
    if (body.departmentId !== undefined) updateData.departmentId = body.departmentId || null
    if (body.roleId !== undefined) updateData.roleId = body.roleId
    if (body.status !== undefined) updateData.status = body.status
    if (body.username !== undefined && body.username !== existingUser.username) {
      const usernameTaken = await prisma.user.findFirst({
        where: { username: body.username, id: { not: id } },
      })
      if (usernameTaken) {
        return NextResponse.json({ success: false, message: 'Username already taken' }, { status: 409 })
      }
      updateData.username = body.username
    }
    if (body.employeeCode !== undefined && body.employeeCode !== existingUser.employeeCode) {
      const codeTaken = await prisma.user.findFirst({
        where: { employeeCode: body.employeeCode, id: { not: id } },
      })
      if (codeTaken) {
        return NextResponse.json({ success: false, message: 'Employee code already taken' }, { status: 409 })
      }
      updateData.employeeCode = body.employeeCode
    }
    if (body.password && body.password.trim()) {
      updateData.passwordHash = await hashPassword(body.password)
    }
    updateData.updatedBy = admin.id

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: { role: true, department: true },
    })

    await createAuditLog({
      userId: admin.id,
      action: 'USER_UPDATED',
      entityType: 'user',
      entityId: id,
      oldValues: { fullName: existingUser.fullName, email: existingUser.email, role: existingUser.role.name },
      newValues: { fullName: user.fullName, email: user.email, role: user.role.name },
    })

    return NextResponse.json({
      success: true,
      message: 'User updated successfully',
      data: { id: user.id, fullName: user.fullName },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ success: false, message: 'Failed to update user' }, { status: 500 })
  }
}
