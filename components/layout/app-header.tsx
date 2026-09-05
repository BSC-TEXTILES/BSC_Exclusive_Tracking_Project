'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import {
  User,
  LogOut,
  Shield,
  ArrowLeft,
  Clock,
  Menu,
  Search,
  Bell,
} from 'lucide-react'
import BrandLogo from '@/components/ui/brand-logo'
import { useSidebar } from '@/components/layout/sidebar-context'

interface UserData {
  id: string
  fullName: string
  email: string
  role: string
  department: string | null
  profileImage: string | null
}

const MODULE_NAMES: Record<string, string> = {
  'crm': 'CRM',
  'warehouse-purchase': 'Warehouse & Purchase',
  'sales': 'Sales',
  'hr': 'HR',
  'accounts': 'Accounts',
  'database': 'Database',
}

function LiveClock() {
  const [time, setTime] = useState('')

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
      }))
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center gap-1.5 text-xs text-text-muted font-mono tabular-nums">
      <Clock className="w-3.5 h-3.5" />
      <span>{time}</span>
    </div>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatHeaderDate(date: Date = new Date()) {
  const day = String(date.getDate()).padStart(2, '0')
  const month = date.toLocaleString('en-US', { month: 'short' })
  const year = date.getFullYear()
  return `${day} ${month} ${year}`
}

export default function AppHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<UserData | null>(null)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success) setUser(data.data)
      })
      .catch(() => {})
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch {
      setLoggingOut(false)
    }
  }

  const userInitial = useMemo(() => {
    if (!user?.fullName) return 'U'
    const parts = user.fullName.trim().split(/\s+/)
    if (parts.length > 1) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    }
    return parts[0][0].toUpperCase()
  }, [user])

  const displayName = useMemo(() => {
    if (!user?.fullName) return 'User'
    return user.fullName
  }, [user])

  const isModulePage = pathname?.startsWith('/modules/')
  const moduleSlug = isModulePage ? pathname.split('/')[2] : ''
  const moduleTitle = moduleSlug
    ? (MODULE_NAMES[moduleSlug] || moduleSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '))
    : ''

  const todayDateStr = formatHeaderDate()

  let sidebarCtx: ReturnType<typeof useSidebar> | null = null
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    sidebarCtx = useSidebar()
  } catch {
    // Rendered outside SidebarProvider
  }

  return (
    <header className="bg-header-bg text-white sticky top-0 z-40 border-b border-primary/20 animate-fade-in">
      <div className="flex items-center justify-between h-12 px-4">
        <div className="flex items-center gap-2">
          {sidebarCtx && (
            <button
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                  sidebarCtx!.toggleMobile()
                } else {
                  sidebarCtx!.toggleSidebar()
                }
              }}
              className="p-1 -ml-1 text-white/60 hover:text-white hover:bg-primary/10 rounded transition flex items-center justify-center"
              aria-label="Toggle navigation menu"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}
          <Link href="/dashboard" className="flex items-center">
            <BrandLogo size="xs" variant="full" theme="dark" />
          </Link>
          {pathname?.startsWith('/admin') && (
            <Link
              href="/dashboard"
              className="ml-2 flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-primary bg-primary-light hover:bg-primary/20 border border-primary/30 rounded-md transition"
              title="Return to Tracking System"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Tracking System</span>
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3">
          <LiveClock />

          <div className="relative hidden sm:block">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/60 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search…"
              aria-label="Search"
              className="w-44 lg:w-56 bg-header-bg border border-primary/20 focus:border-primary focus:outline-none text-xs text-white placeholder:text-white/40 pl-7 pr-2 py-1 transition"
            />
          </div>

          {user?.role === 'ADMIN' && (
            pathname?.startsWith('/admin') ? (
              <span className="text-xs bg-primary/20 text-primary px-2.5 py-1 border border-primary/40 flex items-center gap-1 font-semibold rounded">
                <Shield className="w-3 h-3" />
                <span>Admin</span>
              </span>
            ) : (
              <Link
                href="/admin"
                className="text-xs bg-primary/10 hover:bg-primary/20 text-primary px-2 py-1 border border-primary/25 flex items-center gap-1 transition rounded"
              >
                <Shield className="w-3 h-3" />
                <span>Admin</span>
              </Link>
            )
          )}

          <div className="relative">
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className="relative p-1.5 text-white/60 hover:text-white hover:bg-primary/10 rounded transition flex items-center justify-center"
              aria-label="Notifications"
              aria-expanded={notifOpen}
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-danger rounded-full animate-pulse-dot" />
            </button>

            {notifOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                <div className="absolute right-0 mt-1 w-72 bg-surface border border-border py-1 z-50 text-text text-sm shadow-md animate-scale-in dropdown-enter">
                  <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                    <p className="font-medium text-text">Notifications</p>
                    <span className="text-[10px] uppercase font-bold tracking-wider bg-primary-light text-primary px-1.5 py-0.5">
                      0 new
                    </span>
                  </div>
                  <div className="px-3 py-6 text-center text-text-muted text-xs">
                    You&apos;re all caught up.
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white hover:bg-primary/10 px-2 py-1.5 rounded transition disabled:opacity-50"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{loggingOut ? 'Signing out…' : 'Logout'}</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className="w-8 h-8 bg-primary text-white font-bold text-xs flex items-center justify-center hover:bg-primary-hover transition"
              aria-label="User menu"
              aria-expanded={profileMenuOpen}
            >
              {userInitial}
            </button>

            {profileMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setProfileMenuOpen(false)} />
                <div className="absolute right-0 mt-1 w-56 bg-surface border border-border py-1 z-50 text-text text-sm shadow-md animate-scale-in dropdown-enter">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="font-medium text-text">{user?.fullName}</p>
                    <p className="text-text-secondary text-xs mt-0.5">{user?.email}</p>
                    <span className="inline-block mt-1 text-[10px] uppercase font-bold tracking-wider bg-primary-light text-primary px-1.5 py-0.5">
                      {user?.role}
                    </span>
                  </div>

                  <Link
                    href="/dashboard"
                    className="block px-3 py-1.5 text-text-secondary hover:bg-primary-light transition"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>

                  {user?.role === 'ADMIN' && (
                    <Link
                      href="/admin"
                      className="block px-3 py-1.5 text-primary hover:bg-primary-light transition"
                      onClick={() => setProfileMenuOpen(false)}
                    >
                      Admin Panel
                    </Link>
                  )}

                  <Link
                    href="/profile"
                    className="flex items-center gap-2 px-3 py-1.5 text-text-secondary hover:bg-primary-light transition"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    <User className="w-3.5 h-3.5" />
                    Profile
                  </Link>

                  <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="flex items-center gap-2 px-3 py-1.5 text-danger hover:bg-danger/10 transition w-full text-left border-t border-border mt-0.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    {loggingOut ? 'Signing out...' : 'Sign Out'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-primary/20 px-4 py-2.5">
        {isModulePage ? (
          <div className="flex items-center justify-between">
            <div>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white transition mb-0.5"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Modules</span>
              </Link>
              <h1 className="text-base font-semibold text-white">{moduleTitle}</h1>
            </div>
            <span className="text-xs text-white/60">{todayDateStr}</span>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-sm font-semibold text-white">
                {getGreeting()}, {displayName}
              </h1>
              <p className="text-xs text-white/60 mt-0.5">Updating for: {todayDateStr}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
