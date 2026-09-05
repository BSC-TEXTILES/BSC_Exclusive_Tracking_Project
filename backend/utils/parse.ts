import type { NextRequest } from 'next/server'

export async function safeJson(request: NextRequest): Promise<any | null> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export async function safeFormData(request: NextRequest): Promise<FormData | null> {
  try {
    return await request.formData()
  } catch {
    return null
  }
}
