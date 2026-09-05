import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { requireAdmin } from '@/lib/auth/session'
import { hashPassword } from '@/lib/auth/password'
import { createAuditLog } from '@/lib/audit'
import { createUserSchema } from '@/lib/validations/schemas'

// GET all users (admin only)
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const roleId = searchParams.get('roleId') || ''
    const departmentId = searchParams.get('departmentId') || ''

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeCode: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (status) where.status = status
    if (roleId) where.roleId = roleId
    if (departmentId) where.departmentId = departmentId

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          role: true,
          department: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        users: users.map(u => ({
          id: u.id,
          employeeCode: u.employeeCode,
          fullName: u.fullName,
          email: u.email,
          phone: u.phone,
          username: u.username,
          role: u.role.name,
          roleId: u.roleId,
          department: u.department?.name ?? null,
          departmentId: u.departmentId,
          status: u.status,
          lastLoginAt: u.lastLoginAt,
          createdAt: u.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Admin users GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

// CREATE user (admin only)
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = await request.json()

    const parsed = createUserSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Validation failed', errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Check for duplicate email/username/employeeCode
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          { username: data.username },
          { employeeCode: data.employeeCode },
        ],
      },
    })

    if (existing) {
      let field = 'Email'
      if (existing.username === data.username) field = 'Username'
      if (existing.employeeCode === data.employeeCode) field = 'Employee code'
      return NextResponse.json(
        { success: false, message: `${field} already exists` },
        { status: 409 }
      )
    }

    const hashedPassword = await hashPassword(data.password)

    const user = await prisma.user.create({
      data: {
        employeeCode: data.employeeCode,
        fullName: data.fullName,
        username: data.username,
        email: data.email,
        phone: data.phone || null,
        passwordHash: hashedPassword,
        roleId: data.roleId,
        departmentId: data.departmentId || null,
        status: data.status,
        mustChangePassword: data.mustChangePassword,
        createdBy: admin.id,
      },
      include: { role: true, department: true },
    })

    // Assign to location if provided
    if (data.locationId) {
      await prisma.userLocation.create({
        data: { userId: user.id, locationId: data.locationId },
      })
    }

    await createAuditLog({
      userId: admin.id,
      action: 'USER_CREATED',
      entityType: 'user',
      entityId: user.id,
      newValues: {
        employeeCode: user.employeeCode,
        fullName: user.fullName,
        email: user.email,
        role: user.role.name,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      data: {
        id: user.id,
        employeeCode: user.employeeCode,
        fullName: user.fullName,
        email: user.email,
        role: user.role.name,
      },
    }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
    console.error('Admin users POST error:', error)
    return NextResponse.json({ success: false, message: 'Failed to create user' }, { status: 500 })
  }
}
