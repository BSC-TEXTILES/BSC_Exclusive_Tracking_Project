import type { Request } from 'express'
import { query } from '../db.js'

export interface ParsedDeviceInfo {
  deviceType: 'Mobile' | 'Tablet' | 'Desktop'
  deviceModel: string
  os: string
  browser: string
  formatted: string
}

/**
 * Robust IP detection handling proxies, Cloudflare, load balancers, and IPv6 formatting.
 */
export function getClientIp(req: Request): string {
  const cfIp = req.headers['cf-connecting-ip']
  if (typeof cfIp === 'string' && cfIp.trim()) {
    return cleanIp(cfIp.trim())
  }

  const realIp = req.headers['x-real-ip']
  if (typeof realIp === 'string' && realIp.trim()) {
    return cleanIp(realIp.trim())
  }

  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string' && xff.trim()) {
    const first = xff.split(',')[0].trim()
    if (first) return cleanIp(first)
  }

  if (req.ip) {
    return cleanIp(req.ip)
  }

  const sockAddr = req.socket?.remoteAddress
  if (sockAddr) {
    return cleanIp(sockAddr)
  }

  return '127.0.0.1'
}

function cleanIp(ip: string): string {
  let cleaned = ip.trim()
  // Clean IPv4-mapped IPv6 addresses like ::ffff:192.168.1.1
  if (cleaned.startsWith('::ffff:')) {
    cleaned = cleaned.substring(7)
  }
  // Normalize loopback IPv6
  if (cleaned === '::1') {
    return '127.0.0.1'
  }
  return cleaned
}

/**
 * Intelligent parser for mobile phone devices vs system/desktop platforms from User-Agent and client hints.
 */
export function parseDevice(userAgentRaw?: string | null, clientHint?: { platform?: string; isMobile?: boolean }): ParsedDeviceInfo {
  const ua = (userAgentRaw || '').trim()

  let deviceType: 'Mobile' | 'Tablet' | 'Desktop' = 'Desktop'
  let os = 'Unknown OS'
  let browser = 'Unknown Browser'
  let deviceModel = 'System / PC'

  if (!ua) {
    if (clientHint?.isMobile) {
      return {
        deviceType: 'Mobile',
        deviceModel: 'Mobile Device',
        os: clientHint.platform || 'Mobile OS',
        browser: 'Mobile Browser',
        formatted: `Mobile (${clientHint.platform || 'Mobile Device'})`,
      }
    }
    return {
      deviceType: 'Desktop',
      deviceModel: 'Desktop System',
      os: clientHint?.platform || 'System',
      browser: 'Web Browser',
      formatted: 'System / PC (Web Browser)',
    }
  }

  const uaLower = ua.toLowerCase()

  // 1. Detect Device Type & OS
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) {
    deviceType = 'Tablet'
    deviceModel = 'Tablet Device'
  } else if (/iphone|ipod|mobile|android.*mobile|blackberry|iemobile|opera mini/i.test(ua)) {
    deviceType = 'Mobile'
  }

  // OS & Model specifics
  if (/iphone/i.test(ua)) {
    deviceType = 'Mobile'
    os = 'iOS'
    const match = ua.match(/OS (\d+[._]\d+)/i)
    if (match) os = `iOS ${match[1].replace('_', '.')}`
    deviceModel = 'Apple iPhone'
  } else if (/ipad/i.test(ua)) {
    deviceType = 'Tablet'
    os = 'iPadOS'
    const match = ua.match(/OS (\d+[._]\d+)/i)
    if (match) os = `iPadOS ${match[1].replace('_', '.')}`
    deviceModel = 'Apple iPad'
  } else if (/android/i.test(ua)) {
    const vMatch = ua.match(/Android (\d+(\.\d+)?)/i)
    os = vMatch ? `Android ${vMatch[1]}` : 'Android'

    // Extract device model if present in Android UA e.g. "SM-S928B", "Pixel 8", "Redmi Note 13"
    const modelMatch = ua.match(/;\s*([^;]+?)\s*Build\//i)
    if (modelMatch && modelMatch[1]) {
      deviceModel = modelMatch[1].trim()
    } else {
      deviceModel = deviceType === 'Tablet' ? 'Android Tablet' : 'Android Smartphone'
    }
  } else if (/windows nt 10\.0/i.test(ua)) {
    os = 'Windows 10/11'
    deviceModel = 'Windows System'
    deviceType = 'Desktop'
  } else if (/windows nt 6\.3/i.test(ua)) {
    os = 'Windows 8.1'
    deviceModel = 'Windows System'
    deviceType = 'Desktop'
  } else if (/windows nt 6\.1/i.test(ua)) {
    os = 'Windows 7'
    deviceModel = 'Windows System'
    deviceType = 'Desktop'
  } else if (/macintosh|mac os x/i.test(ua)) {
    os = 'macOS'
    const match = ua.match(/Mac OS X (\d+[._]\d+)/i)
    if (match) os = `macOS ${match[1].replace('_', '.')}`
    deviceModel = 'Apple Mac System'
    deviceType = 'Desktop'
  } else if (/linux/i.test(ua)) {
    os = 'Linux'
    deviceModel = 'Linux Workstation'
    deviceType = 'Desktop'
  }

  // 2. Detect Browser
  if (/edg\//i.test(ua)) {
    const m = ua.match(/Edg\/(\d+)/i)
    browser = m ? `Edge ${m[1]}` : 'Microsoft Edge'
  } else if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) {
    const m = ua.match(/Chrome\/(\d+)/i)
    browser = m ? `Chrome ${m[1]}` : 'Google Chrome'
  } else if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) {
    const m = ua.match(/Version\/(\d+)/i)
    browser = m ? `Safari ${m[1]}` : 'Safari'
  } else if (/firefox\//i.test(ua)) {
    const m = ua.match(/Firefox\/(\d+)/i)
    browser = m ? `Firefox ${m[1]}` : 'Mozilla Firefox'
  } else if (/opr\//i.test(ua)) {
    browser = 'Opera'
  }

  // Formatted summary
  const formatted = `${deviceModel} (${os} · ${browser})`

  return {
    deviceType,
    deviceModel,
    os,
    browser,
    formatted,
  }
}

/**
 * Ensures device tracking database columns are present.
 */
export async function ensureDeviceTrackingSchema(): Promise<void> {
  try {
    await query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_device VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_device_type VARCHAR(50);

      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_info VARCHAR(255);
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_type VARCHAR(50);

      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS device_info VARCHAR(255);
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS device_type VARCHAR(50);

      ALTER TABLE location_tracks ADD COLUMN IF NOT EXISTS ip_address VARCHAR(100);
      ALTER TABLE location_tracks ADD COLUMN IF NOT EXISTS device_info VARCHAR(255);
      ALTER TABLE location_tracks ADD COLUMN IF NOT EXISTS device_type VARCHAR(50);
    `)
  } catch (err) {
    console.error('[db] ensureDeviceTrackingSchema notice:', (err as Error).message)
  }
}
