'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Menu,
  LayoutDashboard,
  Layers,
  History,
  FileBarChart,
  User,
  Shield,
  LogOut,
  X,
  ChevronRight,
} from 'lucide-react'
import { useSidebar } from './sidebar-context'
import BrandLogo from '@/components/ui/brand-logo'

interface UserData {
  id: string
  fullName: string
  email: string
  role: string
  department?: string | null
  employeeCode?: string | null
}

export default function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { isExpanded, toggleSidebar, isMobileOpen, setIsMobileOpen } = useSidebar()
  const [user, setUser] = useState<UserData | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userRes = await fetch('/api/auth/me')
        const userData = await userRes.json()
        if (userData.success) setUser(userData.data)
      } catch {
        // silent
      }
    }
    fetchData()
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

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/modules', label: 'Modules', icon: Layers },
    { href: '/history', label: 'History', icon: History },
    { href: '/reports', label: 'Reports', icon: FileBarChart },
    { href: '/profile', label: 'Profile', icon: User },
  ]

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname?.startsWith(href)
  }

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed md:sticky top-0 left-0 z-30 h-screen bg-header-bg text-white border-r border-border transition-[width,transform] duration-200 flex flex-col select-none animate-slide-in-left ${
          isExpanded ? 'md:w-56' : 'md:w-[52px]'
        } ${
          isMobileOpen ? 'translate-x-0 w-56' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Brand bar */}
          <div className="h-12 flex items-center justify-between px-2.5 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-1.5 overflow-hidden">
              <button
                onClick={toggleSidebar}
                className="p-1 text-white/60 hover:text-white hover:bg-white/10 transition flex items-center justify-center flex-shrink-0"
                title={isExpanded ? 'Collapse' : 'Expand'}
                aria-label="Toggle menu"
              >
                <Menu className="w-4 h-4" />
              </button>
              {isExpanded && (
                <Link href="/dashboard" onClick={() => setIsMobileOpen(false)} className="flex items-center truncate">
                  <BrandLogo size="xs" variant="full" theme="dark" />
                </Link>
              )}
            </div>
            <button
              onClick={() => setIsMobileOpen(false)}
              className="md:hidden p-1 text-white/60 hover:text-white"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Profile card */}
          <div className="p-1.5 border-b border-border flex-shrink-0">
            <Link
              href="/profile"
              onClick={() => setIsMobileOpen(false)}
              className={`flex items-center gap-2 p-1.5 transition rounded ${
                pathname === '/profile' ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-white/70'
              } ${!isExpanded ? 'justify-center' : ''}`}
            >
              <div className="w-7 h-7 bg-primary text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                {userInitial}
              </div>
              {isExpanded && (
                <div className="flex-1 min-w-0 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">{user?.fullName || 'Loading...'}</p>
                    <p className="text-[10px] text-white/50 truncate">
                      {user?.role || 'USER'}{user?.department ? ` · ${user.department}` : ''}
                    </p>
                  </div>
                  <ChevronRight className="w-3 h-3 text-white/40 flex-shrink-0" />
                </div>
              )}
            </Link>
          </div>

          {/* Navigation */}
          <nav className="p-1.5 space-y-0.5 flex-shrink-0">
            {navItems.map(item => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center gap-2 px-2 py-1.5 text-xs transition rounded animate-fade-in hover-lift ${
                    active ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
                  } ${!isExpanded ? 'justify-center' : ''}`}
                  title={!isExpanded ? item.label : undefined}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {isExpanded && <span className="truncate">{item.label}</span>}
                </Link>
              )
            })}

            {user?.role === 'ADMIN' && (
              <div className="pt-1 mt-1 border-t border-border">
                <Link
                  href="/admin"
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center gap-2 px-2 py-1.5 text-xs transition rounded ${
                    pathname?.startsWith('/admin')
                      ? 'bg-primary text-white'
                      : 'text-blue-400 hover:bg-white/5 hover:text-blue-300'
                  } ${!isExpanded ? 'justify-center' : ''}`}
                >
                  <Shield className="w-4 h-4 flex-shrink-0" />
                  {isExpanded && <span className="truncate">Admin Panel</span>}
                </Link>
              </div>
            )}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />
        </div>

        <div className="p-1.5 border-t border-border flex-shrink-0">
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs text-white/60 hover:text-white hover:bg-white/5 transition rounded ${
              !isExpanded ? 'justify-center' : ''
            }`}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {isExpanded && <span className="truncate">{loggingOut ? 'Signing out...' : 'Sign Out'}</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
