'use client'

import { useState, useEffect } from 'react'

interface LiveDateTimeProps {
  showSeconds?: boolean
  showDate?: boolean
  showTime?: boolean
  className?: string
  dateClassName?: string
  timeClassName?: string
  dateFormat?: 'short' | 'long' | 'compact'
  timeFormat?: '12h' | '24h'
  timezone?: string
}

export function LiveDateTime({
  showSeconds = true,
  showDate = true,
  showTime = true,
  className = '',
  dateClassName = '',
  timeClassName = '',
  dateFormat = 'compact',
  timeFormat = '12h',
  timezone = 'Asia/Kolkata',
}: LiveDateTimeProps) {
  const [now, setNow] = useState<Date>(new Date())

  useEffect(() => {
    const updateTime = () => setNow(new Date())
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
    }

    if (dateFormat === 'short') {
      options.day = '2-digit'
      options.month = 'short'
      options.year = 'numeric'
    } else if (dateFormat === 'long') {
      options.weekday = 'long'
      options.day = 'numeric'
      options.month = 'long'
      options.year = 'numeric'
    } else {
      options.day = '2-digit'
      options.month = 'short'
    }

    return date.toLocaleDateString('en-IN', options)
  }

  const formatTime = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      hour: timeFormat === '12h' ? 'numeric' : '2-digit',
      minute: '2-digit',
      hour12: timeFormat === '12h',
    }

    if (showSeconds) {
      options.second = '2-digit'
    }

    return date.toLocaleTimeString('en-IN', options)
  }

  const formattedDate = formatDate(now)
  const formattedTime = formatTime(now)

  if (!showDate && !showTime) return null

  return (
    <div className={`flex flex-col items-end ${className}`}>
      {showDate && (
        <div className={`text-sm font-medium text-text ${dateClassName}`}>
          {formattedDate}
        </div>
      )}
      {showTime && (
        <div className={`text-xs text-text-muted font-mono ${timeClassName}`}>
          {formattedTime}
        </div>
      )}
    </div>
  )
}

export function LiveDateOnly(props: Omit<LiveDateTimeProps, 'showTime'>) {
  return <LiveDateTime {...props} showTime={false} />
}

export function LiveTimeOnly(props: Omit<LiveDateTimeProps, 'showDate'>) {
  return <LiveDateTime {...props} showDate={false} />
}