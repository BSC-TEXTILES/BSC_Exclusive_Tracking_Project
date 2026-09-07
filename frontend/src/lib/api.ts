export interface ApiError extends Error {
  status?: number
  code?: string
}

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

export const apiUrl = (path: string): string => `${API_BASE}${path}`

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000
const RETRYABLE_CODES = new Set([408, 429, 502, 503, 504])
const RETRYABLE_ERROR_CODES = new Set(['SERVER_OVERLOADED', 'QUEUE_TIMEOUT', 'SERVER_SHUTTING_DOWN'])

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchWithRetry<T = unknown>(
  path: string,
  options: RequestInit = {},
  attempt = 0
): Promise<T> {
  try {
    const res = await fetch(apiUrl(path), {
      credentials: 'include',
      headers:
        options.body && !(options.body instanceof FormData)
          ? { 'Content-Type': 'application/json', ...(options.headers || {}) }
          : options.headers,
      signal: AbortSignal.timeout(30_000),
      ...options,
    })

    const isJson = (res.headers.get('content-type') || '').includes('application/json')
    const body = isJson ? await res.json() : await res.text()

    if (!res.ok) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '0', 10)
      const errorCode = typeof body === 'object' && body?.code ? body.code : ''

      if (
        attempt < MAX_RETRIES &&
        (RETRYABLE_CODES.has(res.status) || RETRYABLE_ERROR_CODES.has(errorCode))
      ) {
        const delay = retryAfter > 0 ? retryAfter * 1000 : RETRY_DELAY_MS * Math.pow(2, attempt)
        console.warn(`[api] Retry ${attempt + 1}/${MAX_RETRIES} for ${path} (status: ${res.status}) in ${delay}ms`)
        await sleep(delay)
        return fetchWithRetry(path, options, attempt + 1)
      }

      const err: ApiError = new Error(
        (typeof body === 'object' && body && typeof body.message === 'string'
          ? body.message
          : `Request failed (${res.status})`) || `Request failed (${res.status})`
      )
      err.status = res.status
      if (typeof body === 'object' && body) err.code = body.code
      throw err
    }

    return (typeof body === 'object' && body && (body as { data?: unknown }).data !== undefined
      ? (body as { data: T }).data
      : (body as T)) as T
  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      if (attempt < MAX_RETRIES) {
        console.warn(`[api] Timeout retry ${attempt + 1}/${MAX_RETRIES} for ${path}`)
        await sleep(RETRY_DELAY_MS * Math.pow(2, attempt))
        return fetchWithRetry(path, options, attempt + 1)
      }
      const timeoutErr: ApiError = new Error('Request timed out. Please check your connection.')
      timeoutErr.code = 'TIMEOUT'
      throw timeoutErr
    }

    if (err.message === 'Failed to fetch' || err.message === 'NetworkError') {
      if (attempt < MAX_RETRIES) {
        console.warn(`[api] Network retry ${attempt + 1}/${MAX_RETRIES} for ${path}`)
        await sleep(RETRY_DELAY_MS * Math.pow(2, attempt))
        return fetchWithRetry(path, options, attempt + 1)
      }
      const netErr: ApiError = new Error('Network error. Please check your connection and try again.')
      netErr.code = 'NETWORK_ERROR'
      throw netErr
    }

    throw err
  }
}

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  return fetchWithRetry<T>(path, options)
}

export const get = <T = unknown>(path: string) => api<T>(path)
export const post = <T = unknown>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) })
export const put = <T = unknown>(path: string, body?: unknown) =>
  api<T>(path, { method: 'PUT', body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) })
export const patch = <T = unknown>(path: string, body?: unknown) =>
  api<T>(path, { method: 'PATCH', body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) })
export const del = <T = unknown>(path: string) => api<T>(path, { method: 'DELETE' })
