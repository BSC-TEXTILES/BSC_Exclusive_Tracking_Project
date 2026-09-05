'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Building2,
  Layers,
  ClipboardCheck,
  CalendarCheck,
  FileCheck,
  FileImage,
  FileBarChart,
  ScrollText,
  Settings,
  Shield,
  ChevronLeft,
  Menu,
  X,
} from 'lucide-react'
import AppHeader from '@/components/layout/app-header'

const adminNavItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/roles', label: 'Roles', icon: Shield },
  { href: '/admin/departments', label: 'Departments', icon: Building2 },
  { href: '/admin/modules', label: 'Modules', icon: Layers },
  { href: '/admin/checkpoints', label: 'Checkpoints', icon: ClipboardCheck },
  { href: '/admin/assignments', label: 'Assignments', icon: CalendarCheck },
  { href: '/admin/submissions', label: 'Submissions', icon: FileCheck },
  { href: '/admin/evidence', label: 'Evidence', icon: FileImage },
  { href: '/admin/reports', label: 'Reports', icon: FileBarChart },
  { href: '/admin/audit-logs', label: 'Audit Logs', icon: ScrollText },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href
    return pathname?.startsWith(href)
  }

  const NavContent = () => (
    <>
      <div className="px-3 mb-2 space-y-2">
        <Link
          href="/dashboard"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-text hover:text-primary hover:bg-primary-light border border-border-light rounded-lg transition"
        >
          <ChevronLeft className="w-4 h-4 text-primary" />
          Tracking System
        </Link>

        <div className="flex items-center gap-1.5 text-primary font-semibold text-xs uppercase tracking-wider px-1 pt-0.5">
          <Shield className="w-3.5 h-3.5" />
          Admin Panel
        </div>
      </div>

      <nav className="flex-1 px-1.5 space-y-0.5">
        {adminNavItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium transition rounded ${
              isActive(item.href, item.exact)
                ? 'bg-primary-light text-primary'
                : 'text-text-secondary hover:bg-surface-alt hover:text-text'
            }`}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  )

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />

      {/* Mobile header bar with toggle */}
      <div className="lg:hidden flex items-center gap-2 px-4 py-2 bg-surface border-b border-border">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 hover:bg-surface-alt rounded transition"
          aria-label="Open admin menu"
        >
          <Menu className="w-5 h-5 text-text" />
        </button>
        <span className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" />
          Admin Panel
        </span>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-64 bg-surface border-r border-border py-2.5 flex flex-col transition-transform duration-200 lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-3 mb-2">
          <span className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            Admin Panel
          </span>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1 hover:bg-surface-alt rounded transition"
            aria-label="Close admin menu"
          >
            <X className="w-4 h-4 text-text-muted" />
          </button>
        </div>
        <NavContent />
      </aside>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-56 bg-surface border-r border-border py-2.5 flex-shrink-0">
          <NavContent />
        </aside>

        <main className="flex-1 bg-background overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
