import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || 'Asia/Kolkata'

export function getLocalDateString(date: Date = new Date()): string {
  return formatInTimeZone(date, APP_TIMEZONE, 'yyyy-MM-dd')
}

export function getLocalDayBounds(date: Date = new Date()): { dayStart: string; dayEnd: string } {
  const [y, m, d] = getLocalDateString(date).split('-').map(Number)
  const dayStart = fromZonedTime(new Date(y, m - 1, d, 0, 0, 0), APP_TIMEZONE)
  const dayEnd = fromZonedTime(new Date(y, m - 1, d, 23, 59, 59, 999), APP_TIMEZONE)
  return { dayStart: dayStart.toISOString(), dayEnd: dayEnd.toISOString() }
}
