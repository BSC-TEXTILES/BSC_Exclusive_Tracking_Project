import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { get, post } from './api'
import type { User } from './types'
import { AlertTriangle, Clock, ShieldAlert } from 'lucide-react'

const TIMEOUT_MS = 2 * 60 * 60 * 1000 // 2 hours
const WARNING_MS = 5 * 60 * 1000 // Show warning 5 minutes before logout (115 mins)
const STORAGE_KEY = 'bsc_last_activity'

interface AuthState {
  user: User | null
  loading: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  refresh: async () => undefined,
  logout: async () => undefined,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [warningSecondsLeft, setWarningSecondsLeft] = useState<number | null>(null)

  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const warningCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastWriteRef = useRef<number>(Date.now())

  const refresh = useCallback(async () => {
    try {
      const data = await get<{ user: User }>('/api/auth/me')
      setUser(data.user)
      // Initialize or refresh last activity timestamp
      localStorage.setItem(STORAGE_KEY, String(Date.now()))
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async (isExpired = false) => {
    try {
      await post('/api/auth/logout')
    } catch {
      // ignore network errors on logout
    }
    setUser(null)
    setWarningSecondsLeft(null)
    localStorage.removeItem(STORAGE_KEY)
    if (checkIntervalRef.current) clearInterval(checkIntervalRef.current)
    if (warningCountdownRef.current) clearInterval(warningCountdownRef.current)

    if (isExpired) {
      window.location.href = '/login?expired=1'
    }
  }, [])

  // Explicit user interaction resets activity
  const recordActivity = useCallback(() => {
    const now = Date.now()
    // Dismiss warning if active
    setWarningSecondsLeft(null)
    if (warningCountdownRef.current) {
      clearInterval(warningCountdownRef.current)
      warningCountdownRef.current = null
    }

    // Throttle writes to localStorage (at most once every 5 seconds)
    if (now - lastWriteRef.current > 5000) {
      lastWriteRef.current = now
      try {
        localStorage.setItem(STORAGE_KEY, String(now))
      } catch {
        // storage disabled or quota exceeded
      }
    }
  }, [])

  // Auto-logout on 2-hour inactivity
  useEffect(() => {
    if (!user) {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current)
      if (warningCountdownRef.current) clearInterval(warningCountdownRef.current)
      setWarningSecondsLeft(null)
      return
    }

    // Initialize activity if not set
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, String(Date.now()))
    }

    // Check timer periodically and on visibility change
    const checkInactivity = () => {
      const stored = localStorage.getItem(STORAGE_KEY)
      const lastActive = stored ? parseInt(stored, 10) : Date.now()
      const elapsed = Date.now() - lastActive

      if (elapsed >= TIMEOUT_MS) {
        // Auto-logout: 2 hours reached
        void logout(true)
        return
      }

      const timeUntilLogout = TIMEOUT_MS - elapsed
      if (timeUntilLogout <= WARNING_MS) {
        // Within the 5-minute warning window
        const secondsLeft = Math.max(0, Math.floor(timeUntilLogout / 1000))
        setWarningSecondsLeft(secondsLeft)
      } else {
        setWarningSecondsLeft(null)
      }
    }

    // Periodic check every 10 seconds
    checkIntervalRef.current = setInterval(checkInactivity, 10000)

    // Visibility change check (e.g. user opens laptop or switches back to tab after 2 hours)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkInactivity()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Cross-tab storage synchronization
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        checkInactivity()
      }
    }
    window.addEventListener('storage', handleStorageChange)

    // User input listeners
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    const handleUserActivity = () => {
      recordActivity()
    }

    events.forEach(evt => document.addEventListener(evt, handleUserActivity, { passive: true }))

    return () => {
      events.forEach(evt => document.removeEventListener(evt, handleUserActivity))
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('storage', handleStorageChange)
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current)
      if (warningCountdownRef.current) clearInterval(warningCountdownRef.current)
    }
  }, [user, logout, recordActivity])

  // Countdown timer when warning modal is displayed
  useEffect(() => {
    if (warningSecondsLeft !== null && warningSecondsLeft > 0) {
      const timer = setTimeout(() => {
        setWarningSecondsLeft(prev => (prev !== null && prev > 1 ? prev - 1 : 0))
      }, 1000)
      return () => clearTimeout(timer)
    } else if (warningSecondsLeft === 0) {
      void logout(true)
    }
  }, [warningSecondsLeft, logout])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout: () => logout(false) }}>
      {children}

      {/* 2-Hour Inactivity Warning Modal */}
      {warningSecondsLeft !== null && user && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-elevated border border-warning/40 shadow-2xl rounded-2xl max-w-md w-full p-6 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-warning/15 flex items-center justify-center text-warning animate-pulse">
              <Clock className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-bold text-text-primary">Session Timeout Warning</h3>

            <p className="text-sm text-text-secondary leading-relaxed">
              You have been inactive. For security purposes, your session will automatically sign out in{' '}
              <span className="font-extrabold text-warning font-mono text-base px-1.5 py-0.5 rounded bg-warning/10">
                {formatCountdown(warningSecondsLeft)}
              </span>{' '}
              unless you continue.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={recordActivity}
                className="btn btn-primary flex-1 py-2.5 font-bold shadow-lg shadow-brand-primary/25"
              >
                Stay Signed In
              </button>
              <button
                onClick={() => logout(false)}
                className="btn btn-outline py-2.5 text-text-muted hover:text-text-primary"
              >
                Sign Out Now
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

export function can(user: User | null, permission: string): boolean {
  if (!user) return false
  return user.roleName === 'ADMIN' || user.permissions.includes(permission)
}
