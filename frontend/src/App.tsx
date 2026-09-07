import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './lib/auth'
import AppShell from './components/AppShell'
import { Spinner } from './components/States'
import ErrorBoundary from './components/ErrorBoundary'

function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 3,
  interval = 400
): React.LazyExoticComponent<T> {
  return lazy(() =>
    new Promise<{ default: T }>((resolve, reject) => {
      const attempt = (remaining: number) => {
        factory()
          .then(resolve)
          .catch((error: any) => {
            const msg = String(error?.message || error || '')
            const isDynamicImportError =
              msg.includes('dynamically imported module') ||
              msg.includes('Failed to fetch') ||
              msg.includes('Loading chunk') ||
              msg.includes('Importing a module script failed')

            if (remaining > 0) {
              setTimeout(() => attempt(remaining - 1), interval)
              return
            }

            if (isDynamicImportError && typeof window !== 'undefined') {
              const storageKey = 'retry_chunk_reload_' + window.location.pathname
              const lastReload = sessionStorage.getItem(storageKey)
              const now = Date.now()
              if (!lastReload || now - parseInt(lastReload, 10) > 8000) {
                sessionStorage.setItem(storageKey, String(now))
                window.location.reload()
                return
              }
            }

            reject(error)
          })
      }
      attempt(retries)
    })
  )
}

const Landing = lazyWithRetry(() => import('./pages/Landing'))
const Login = lazyWithRetry(() => import('./pages/Login'))
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'))
const Modules = lazyWithRetry(() => import('./pages/Modules'))
const ModuleDetail = lazyWithRetry(() => import('./pages/ModuleDetail'))
const CheckpointDetail = lazyWithRetry(() => import('./pages/CheckpointDetail'))
const History = lazyWithRetry(() => import('./pages/History'))
const Reports = lazyWithRetry(() => import('./pages/Reports'))
const CalendarPage = lazyWithRetry(() => import('./pages/CalendarPage'))
const Profile = lazyWithRetry(() => import('./pages/Profile'))
const AdminDashboard = lazyWithRetry(() => import('./pages/admin/AdminDashboard'))
const AdminUsers = lazyWithRetry(() => import('./pages/admin/AdminUsers'))
const AdminRoles = lazyWithRetry(() => import('./pages/admin/AdminRoles'))
const AdminDepartments = lazyWithRetry(() => import('./pages/admin/AdminDepartments'))
const AdminModules = lazyWithRetry(() => import('./pages/admin/AdminModules'))
const AdminCheckpoints = lazyWithRetry(() => import('./pages/admin/AdminCheckpoints'))
const AdminAssignments = lazyWithRetry(() => import('./pages/admin/AdminAssignments'))
const AdminSubmissions = lazyWithRetry(() => import('./pages/admin/AdminSubmissions'))
const AdminCalendar = lazyWithRetry(() => import('./pages/admin/AdminCalendar'))
const AdminEvidence = lazyWithRetry(() => import('./pages/admin/AdminEvidence'))
const AdminTracking = lazyWithRetry(() => import('./pages/admin/AdminTracking'))
const AdminReports = lazyWithRetry(() => import('./pages/admin/AdminReports'))
const AdminAuditLogs = lazyWithRetry(() => import('./pages/admin/AdminAuditLogs'))
const AdminSettings = lazyWithRetry(() => import('./pages/admin/AdminSettings'))
const SupervisorDashboard = lazyWithRetry(() => import('./pages/supervisor/SupervisorDashboard'))
const SupervisorApprovals = lazyWithRetry(() => import('./pages/supervisor/SupervisorApprovals'))
const SupervisorDepartments = lazyWithRetry(() => import('./pages/supervisor/SupervisorDepartments'))
const SupervisorEmployees = lazyWithRetry(() => import('./pages/supervisor/SupervisorEmployees'))
const SupervisorProjects = lazyWithRetry(() => import('./pages/supervisor/SupervisorProjects'))
const SupervisorActivity = lazyWithRetry(() => import('./pages/supervisor/SupervisorActivity'))
const SupervisorProfile = lazyWithRetry(() => import('./pages/supervisor/SupervisorProfile'))
const SupervisorReports = lazyWithRetry(() => import('./pages/supervisor/SupervisorReports'))
const Chat = lazyWithRetry(() => import('./pages/Chat'))
const WhatsAppSection = lazyWithRetry(() => import('./pages/WhatsAppSection'))

function PageLoader() {
  return (
    <div className="min-h-[300px] flex items-center justify-center">
      <Spinner text="Loading page..." />
    </div>
  )
}

function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (online) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[99999] bg-amber-500 text-white text-center py-2 px-4 text-xs font-semibold shadow-lg">
      You are currently offline. Some features may be unavailable.
    </div>
  )
}

const Lazy = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
)

function Protected({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner text="Checking session..." />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (roles && !roles.includes(user.roleName)) {
    return <Navigate to={user.roleName === 'ADMIN' ? '/admin' : user.roleName === 'SUPERVISOR' || user.roleName === 'MANAGER' ? '/supervisor' : '/dashboard'} replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <ErrorBoundary>
      <OfflineBanner />
      <Lazy>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />

        <Route
          element={
            <Protected>
              <AppShell />
            </Protected>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/modules" element={<Modules />} />
          <Route path="/modules/:slug" element={<ModuleDetail />} />
          <Route path="/checkpoints/:id" element={<CheckpointDetail />} />
          <Route path="/history" element={<History />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/chat/:conversationId" element={<Chat />} />
          <Route path="/whatsapp" element={<WhatsAppSection />} />

          <Route
            path="/admin"
            element={
              <Protected roles={['ADMIN']}>
                <Outlet />
              </Protected>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="tracking" element={<AdminTracking />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="roles" element={<AdminRoles />} />
            <Route path="departments" element={<AdminDepartments />} />
            <Route path="modules" element={<AdminModules />} />
            <Route path="checkpoints" element={<AdminCheckpoints />} />
            <Route path="assignments" element={<AdminAssignments />} />
            <Route path="submissions" element={<AdminSubmissions />} />
            <Route path="calendar" element={<AdminCalendar />} />
            <Route path="evidence" element={<AdminEvidence />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="audit-logs" element={<AdminAuditLogs />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="whatsapp" element={<WhatsAppSection />} />
          </Route>

          <Route
            path="/supervisor"
            element={
              <Protected roles={['SUPERVISOR', 'MANAGER', 'ADMIN']}>
                <Outlet />
              </Protected>
            }
          >
            <Route index element={<SupervisorDashboard />} />
            <Route path="approvals" element={<SupervisorApprovals />} />
            <Route path="departments" element={<SupervisorDepartments />} />
            <Route path="employees" element={<SupervisorEmployees />} />
            <Route path="projects" element={<SupervisorProjects />} />
            <Route path="activity" element={<SupervisorActivity />} />
            <Route path="profile" element={<SupervisorProfile />} />
            <Route path="reports" element={<SupervisorReports />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Lazy>
    </ErrorBoundary>
  )
}
