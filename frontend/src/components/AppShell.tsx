import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderOpen,
  History,
  FileBarChart,
  CalendarDays,
  UserCircle,
  Bell,
  LogOut,
  ChevronDown,
  Menu,
  X,
  ShieldCheck,
  Users,
  Building2,
  ClipboardCheck,
  ListChecks,
  Paperclip,
  ScrollText,
  Settings,
  MapPin,
  Satellite,
  Activity,
  UserRound,
  Briefcase,
  Lock,
  CheckSquare,
  LayoutGrid,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  MessageSquare,
  Send,
} from 'lucide-react'
import { useAuth, can } from '../lib/auth'
import { useTracking } from '../lib/tracking'
import { get, patch, post, apiUrl } from '../lib/api'
import { timeAgo } from '../lib/format'
import ThemeToggle from './ThemeToggle'
import PWAInstallBanner from './PWAInstallBanner'
import { useSocket } from '../lib/useSocket'
import { playNotificationSound } from '../lib/notifySound'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  badge?: number
}

const USER_NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/modules', label: 'My Modules', icon: FolderOpen },
  { to: '/chat', label: 'Messages', icon: MessageSquare },
  { to: '/whatsapp', label: 'WhatsApp Hub', icon: Send },
  { to: '/history', label: 'My History', icon: History },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
]

const SUPERVISOR_NAV: NavItem[] = [
  { to: '/supervisor', label: 'Team Dashboard', icon: LayoutDashboard },
  { to: '/chat', label: 'Messages', icon: MessageSquare },
  { to: '/whatsapp', label: 'WhatsApp Hub', icon: Send },
  { to: '/supervisor/approvals', label: 'Approvals', icon: ClipboardCheck },
  { to: '/supervisor/employees', label: 'Employees', icon: Users },
  { to: '/supervisor/departments', label: 'Departments', icon: Building2 },
  { to: '/supervisor/projects', label: 'Projects', icon: Briefcase },
  { to: '/supervisor/reports', label: 'Team Reports', icon: FileBarChart },
  { to: '/supervisor/activity', label: 'Activity Log', icon: Activity },
]

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Admin Dashboard', icon: LayoutGrid },
  { to: '/chat', label: 'Messages', icon: MessageSquare },
  { to: '/admin/whatsapp', label: 'WhatsApp Hub', icon: Send },
  { to: '/admin/tracking', label: 'Live Tracking', icon: Satellite },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/roles', label: 'Roles & Permissions', icon: ShieldCheck },
  { to: '/admin/departments', label: 'Departments', icon: Building2 },
  { to: '/admin/modules', label: 'Modules', icon: FolderOpen },
  { to: '/admin/checkpoints', label: 'Checkpoints', icon: ListChecks },
  { to: '/admin/assignments', label: 'Assignments', icon: CheckSquare },
  { to: '/admin/submissions', label: 'Submissions', icon: ClipboardCheck },
  { to: '/admin/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/admin/evidence', label: 'Evidence', icon: Paperclip },
  { to: '/admin/reports', label: 'Reports', icon: FileBarChart },
  { to: '/admin/audit-logs', label: 'Audit Logs', icon: ScrollText },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

interface Notification {
  id: string
  title: string
  message: string
  type: string
  isRead: boolean
  linkUrl: string | null
  createdAt: string
}

const TYPE_COLORS: Record<string, string> = {
  info: 'bg-info text-white',
  success: 'bg-success text-white',
  warning: 'bg-warning text-white',
  danger: 'bg-danger text-white',
}

function LogoIcon({ size = 32, className = '' }: { size?: number; className?: string }) {
  return <img src="/bsc-logo.png" alt="BSC Exclusive" width={size} height={size} className={`rounded-lg object-contain ${className}`} />
}

export default function AppShell() {
  const { user, logout } = useAuth()
  const tracking = useTracking()
  const { socket, connected } = useSocket()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [clock, setClock] = useState(new Date())
  const profileRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    setSidebarOpen(false)
    setProfileOpen(false)
    setBellOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const loadNotifications = async () => {
    try {
      const data = await get<{ items: Notification[]; unreadCount: number }>('/api/notifications')
      setNotifications(data.items)
      setUnread(data.unreadCount)
    } catch {
      // silent
    }
  }

  useEffect(() => {
    if (user) {
      void loadNotifications()
      const id = setInterval(() => void loadNotifications(), 60000)
      return () => clearInterval(id)
    }
  }, [user])

  // WebSocket real-time notifications
  useEffect(() => {
    if (!socket) return

    socket.on('notification:new', () => {
      playNotificationSound('notification')
      void loadNotifications()
    })

    socket.on('chat:unread', (data: { senderName: string; preview: string }) => {
      playNotificationSound('message')
    })

    socket.on('tracking:update', () => {
      // Real-time tracking update received
    })

    return () => {
      socket.off('notification:new')
      socket.off('chat:unread')
      socket.off('tracking:update')
    }
  }, [socket])

  if (!user) return null

  const isAdmin = user.roleName === 'ADMIN'
  const isSupervisor = ['SUPERVISOR', 'MANAGER'].includes(user.roleName)
  const nav = isAdmin ? ADMIN_NAV : isSupervisor ? [...SUPERVISOR_NAV, ...USER_NAV] : USER_NAV
  const home = isAdmin ? '/admin' : isSupervisor ? '/supervisor' : '/dashboard'

  const markAllRead = async () => {
    await post('/api/notifications/read-all')
    void loadNotifications()
  }
  const markRead = async (id: string) => {
    await patch(`/api/notifications/${id}/read`)
    void loadNotifications()
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const initials = user.fullName
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const sidebarWidth = collapsed ? 'w-[72px]' : 'w-64'

  const NavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `group flex items-center gap-3 rounded-xl text-[13px] font-medium transition-all duration-200 ${
      collapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5'
    } ${
      isActive
        ? 'bg-white/15 text-white shadow-lg shadow-black/10'
        : 'text-sky-100/70 hover:bg-white/10 hover:text-white'
    }`

  const profilePhotoUrl = user.profileImage
    ? (user.profileImage.startsWith('http') ? user.profileImage : apiUrl(user.profileImage))
    : null

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 ${sidebarWidth} bg-gradient-to-b from-[#0c4a6e] via-[#075985] to-[#1e3a5f] flex flex-col transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo header */}
        <div className={`flex items-center h-16 border-b border-white/10 shrink-0 transition-all duration-300 ${collapsed ? 'justify-center px-2' : 'gap-3 px-5'}`}>
          <div className="shrink-0">
            <LogoIcon size={collapsed ? 36 : 34} />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-white font-bold text-[15px] leading-tight tracking-tight">BSC Exclusive</p>
              <p className="text-sky-300/80 text-[9px] font-semibold tracking-[0.15em] uppercase">Process Tracking</p>
            </div>
          )}
        </div>

        {/* Collapse toggle - desktop only */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center justify-center h-8 mx-2 mt-2 rounded-lg bg-white/5 hover:bg-white/15 text-sky-300/60 hover:text-white transition-all duration-200 text-[11px] font-semibold gap-1 tip-bottom"
          data-tip={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronsRight className="w-3.5 h-3.5" /> : <ChevronsLeft className="w-3.5 h-3.5" />}
          {!collapsed && <span className="text-[10px]">Collapse</span>}
        </button>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1 scrollbar-thin">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/supervisor' || item.to === '/admin'}
              className={NavLinkClass}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="p-2.5 border-t border-white/10 space-y-1">
          <NavLink
            to="/profile"
            className={NavLinkClass}
            title={collapsed ? 'My Profile' : undefined}
          >
            <UserCircle className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && <span>My Profile</span>}
          </NavLink>
          <button
            onClick={handleLogout}
            className={`w-full group flex items-center gap-3 rounded-xl text-[13px] font-medium text-sky-100/70 hover:bg-red-500/20 hover:text-red-200 transition-all duration-200 ${collapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5'}`}
            title={collapsed ? 'Logout' : undefined}
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-surface border-b border-border dark:border-border flex items-center gap-3 px-4 sm:px-6 sticky top-0 z-20 shadow-sm">
          {/* Mobile hamburger */}
          <button
            className="lg:hidden w-9 h-9 rounded-lg hover:bg-primary-faint flex items-center justify-center text-text-secondary transition-colors"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Desktop collapse toggle (alternative in header) */}
          <button
            className="hidden lg:flex w-9 h-9 rounded-lg hover:bg-primary-faint items-center justify-center text-text-secondary transition-colors tip-bottom"
            onClick={() => setCollapsed(!collapsed)}
            data-tip={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Menu className="w-[18px] h-[18px]" />
          </button>

          {/* Date & Clock */}
          <div className="hidden sm:block border-l border-border-light pl-3">
            <p className="text-[11px] text-text-muted leading-tight">
              {clock.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
            <p className="text-sm font-bold text-text tabular-nums leading-tight">
              {clock.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </p>
          </div>

          {/* Breadcrumb / Page indicator */}
          <div className="hidden md:flex items-center gap-1.5 ml-2">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider bg-primary-faint px-2 py-0.5 rounded-md">
              {isAdmin ? 'Administration' : isSupervisor ? 'Supervision' : 'Employee'}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {/* Dark mode toggle */}
            <ThemeToggle />

            {/* Live GPS indicator */}
            <div
              className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-semibold ${
                connected
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-amber-50 border-amber-200 text-amber-700'
              } tip-bottom`}
              data-tip={
                connected
                  ? 'Real-time connection active — location updates are sent automatically every 30 minutes while you are signed in.'
                  : 'Connecting to the live tracking server...'
              }
            >
              <Satellite className="w-3.5 h-3.5 animate-pulse" />
              <span>GPS</span>
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            </div>

            {/* Notifications */}
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => { setBellOpen(!bellOpen); if (!bellOpen) void loadNotifications() }}
                className="relative w-9 h-9 rounded-lg hover:bg-primary-faint flex items-center justify-center text-text-secondary transition-colors"
              >
                <Bell className="w-[18px] h-[18px]" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-surface">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
              {bellOpen && (
                <div className="absolute right-0 mt-2 w-80 card shadow-2xl z-50 overflow-hidden animate-fade-in">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-slate-50 dark:bg-surface-alt">
                    <div className="flex items-center gap-2">
                      <Bell className="w-3.5 h-3.5 text-text-muted" />
                      <p className="text-xs font-bold text-text">Notifications</p>
                      {unread > 0 && (
                        <span className="px-1.5 py-[1px] rounded-full bg-danger text-white text-[9px] font-bold">{unread}</span>
                      )}
                    </div>
                    {unread > 0 && (
                      <button onClick={markAllRead} className="text-[11px] text-primary hover:text-primary-dark font-semibold">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-10 text-center">
                        <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                        <p className="text-xs text-text-muted">You're all caught up.</p>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => { void markRead(n.id); setBellOpen(false); if (n.linkUrl) navigate(n.linkUrl) }}
                          className="w-full text-left px-4 py-3 border-b border-border-light hover:bg-primary-faint transition-colors flex gap-2.5"
                        >
                          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.isRead ? 'bg-border' : TYPE_COLORS[n.type] || 'bg-info'}`} />
                          <span className="min-w-0">
                            <span className="block text-xs font-semibold text-text">{n.title}</span>
                            <span className="block text-[11px] text-text-secondary mt-0.5 line-clamp-2">{n.message}</span>
                            <span className="block text-[10px] text-text-muted mt-1">{timeAgo(n.createdAt)}</span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 px-1.5 py-1 rounded-xl hover:bg-primary-faint transition-colors border border-transparent hover:border-border-light"
              >
                {profilePhotoUrl ? (
                  <img src={profilePhotoUrl} alt={user.fullName} className="w-8 h-8 rounded-full object-cover shadow-sm" />
                ) : (
                  <span className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-blue-700 text-white text-xs font-bold flex items-center justify-center shadow-sm">
                    {initials}
                  </span>
                )}
                <span className="hidden sm:block text-left">
                  <span className="block text-xs font-bold text-text leading-tight">{user.fullName}</span>
                  <span className="block text-[10px] text-text-muted">{user.roleName}</span>
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-60 card shadow-2xl z-50 overflow-hidden animate-fade-in">
                  <div className="px-4 py-3.5 border-b border-border bg-gradient-to-r from-sky-50 to-blue-50 dark:from-surface-alt dark:to-surface">
                    <div className="flex items-center gap-3">
                      {profilePhotoUrl ? (
                        <img src={profilePhotoUrl} alt={user.fullName} className="w-10 h-10 rounded-full object-cover shadow-md" />
                      ) : (
                        <span className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-blue-700 text-white text-sm font-bold flex items-center justify-center shadow-md">
                          {initials}
                        </span>
                      )}
                      <div>
                        <p className="text-sm font-bold text-text">{user.fullName}</p>
                        <p className="text-[11px] text-text-muted">{user.email}</p>
                      </div>
                    </div>
                    <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full bg-white dark:bg-surface text-primary-deep text-[10px] font-bold border border-primary-light">
                      {user.roleName} {user.departmentName ? `· ${user.departmentName}` : ''}
                    </span>
                  </div>
                  <div className="py-1">
                    <button onClick={() => { setProfileOpen(false); navigate('/profile') }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-text-secondary hover:bg-primary-faint transition-colors">
                      <UserRound className="w-4 h-4" /> My Profile
                    </button>
                    {can(user, 'settings:view') && (
                      <button onClick={() => { setProfileOpen(false); navigate('/admin/settings') }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-text-secondary hover:bg-primary-faint transition-colors">
                        <Lock className="w-4 h-4" /> System Settings
                      </button>
                    )}
                  </div>
                  <div className="border-t border-border-light">
                    <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-danger hover:bg-red-50 dark:hover:bg-danger-bg transition-colors">
                      <LogOut className="w-4 h-4" /> Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content — scrolls internally; the page itself never scrolls */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 min-w-0">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="px-6 py-3 border-t border-border bg-white dark:bg-surface text-[11px] text-text-muted flex items-center justify-between flex-wrap gap-2">
          <span className="flex items-center gap-1.5">
            <LogoIcon size={14} />
            © {new Date().getFullYear()} BSC Exclusive — Process & Compliance Tracking
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3 text-emerald-500" /> Live tracking every 30 min · Auto-approval after 1 hour
          </span>
        </footer>
      </div>
      <PWAInstallBanner />
    </div>
  )
}
