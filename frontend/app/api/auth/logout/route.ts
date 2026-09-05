import { NextResponse } from 'next/server'
import { destroySession, getCurrentUser } from '@/lib/auth/session'
import { createAuditLog } from '@/lib/audit'

export async function POST() {
  try {
    const user = await getCurrentUser()

    if (user) {
      await createAuditLog({
        userId: user.id,
        action: 'LOGOUT',
        entityType: 'user',
        entityId: user.id,
      })
    }

    await destroySession()

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    })
  } catch (error) {
    console.error('Logout error:', error)
    await destroySession().catch(() => {})
    return NextResponse.json({
      success: true,
      message: 'Logged out',
    })
  }
}
