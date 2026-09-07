import type { NextFunction, Request, RequestHandler, Response } from 'express'

export type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>

export const ah =
  (fn: AsyncHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }

export const ok = (res: Response, data: unknown, extra?: Record<string, unknown>) =>
  res.json({ success: true, data, ...(extra || {}) })

export const fail = (res: Response, status: number, message: string, code?: string) =>
  res.status(status).json({ success: false, message, code })

export function istToday(): string {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000)
  return d.toISOString().slice(0, 10)
}

export function isValidDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime())
}
