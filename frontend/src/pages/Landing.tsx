import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ShieldCheck,
  FolderOpen,
  ListChecks,
  CheckCircle2,
  Satellite,
  FileText,
  Bell,
  ArrowRight,
  MapPin,
  Lock,
  Database,
  UserPlus,
  ScrollText,
  BarChart3,
  X,
} from 'lucide-react'
import { get } from '../lib/api'
import { useTheme } from '../lib/theme'
import ThemeToggle from '../components/ThemeToggle'
import Chatbot from '../components/Chatbot'
import { ScrollToTopButton } from '../components/ScrollToTopButton'

interface Stats {
  modules: number
  checkpoints: number
  users: number
  submissions: number
  departments: number
  approvalRate: number
}

function LogoMark({ size = 40 }: { size?: number }) {
  return <img src="/bsc-logo.png" alt="BSC" width={size} height={size} className="rounded-lg object-contain" />
}

const FEATURES = [
  { icon: ListChecks, title: 'Checkpoint Compliance', desc: 'Daily, weekly, monthly and one-time checkpoints with draft autosave.' },
  { icon: FileText, title: 'Evidence Uploads', desc: 'Attach images, PDFs, CSVs and audio to every report.' },
  { icon: Satellite, title: 'Live GPS Tracking', desc: 'Team locations updated every 30 minutes on a live map.' },
  { icon: CheckCircle2, title: 'Auto-Approval', desc: 'Unreviewed submissions auto-approve after 1 hour.' },
  { icon: Bell, title: 'Notifications', desc: 'Real-time alerts for assignments, approvals and rejections.' },
  { icon: ScrollText, title: 'Audit Trail', desc: 'Every action logged with before/after payloads and IP.' },
  { icon: BarChart3, title: 'Reports & Export', desc: 'Dashboards with charts and one-click CSV exports.' },
  { icon: Database, title: 'PostgreSQL', desc: 'Relational database on Supabase. Fast, indexed, ACID.' },
]

const STEPS = [
  { step: '01', icon: UserPlus, title: 'Admin creates accounts', desc: 'No public sign-up. Every member is invited by your admin team.' },
  { step: '02', icon: FolderOpen, title: 'Checkpoints assigned', desc: 'Admins assign tasks with due dates and frequency.' },
  { step: '03', icon: FileText, title: 'Submit with evidence', desc: 'Fill details and attach proof — autosaved as you type.' },
  { step: '04', icon: CheckCircle2, title: 'Review and approve', desc: 'Supervisors approve or reject. Auto-approves after 1 hour.' },
]

export default function Landing() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [policyModal, setPolicyModal] = useState<'terms' | 'privacy' | 'cookies' | null>(null)
  const { theme } = useTheme()

  useEffect(() => {
    get<Stats>('/api/public/stats')
      .then(setStats)
      .catch(() => undefined)
  }, [])

  return (
    <div className="min-h-screen bg-white dark:bg-[#0b1120] flex flex-col transition-colors duration-200">

      {/* ── Header ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-[#0b1120]/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LogoMark size={30} />
            <span className="font-bold text-sm text-gray-900 dark:text-gray-100">BSC Exclusive</span>
          </div>

          <nav className="hidden md:flex items-center gap-5 text-xs font-medium text-gray-500 dark:text-gray-400">
            <a href="#features" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Features</a>
            <a href="#how" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">How it works</a>
            <a href="#tracking" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">GPS Tracking</a>
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/login" className="text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 transition-colors">
              Sign in
            </Link>
            <Link to="/login" className="text-xs font-semibold text-white bg-gray-900 dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 px-4 py-1.5 rounded-lg transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-5 py-20 sm:py-28">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 tracking-widest uppercase mb-4">Enterprise Compliance Platform</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white leading-tight max-w-2xl">
            Track every process.<br />
            <span className="text-gray-400 dark:text-gray-500">Verify every location.</span>
          </h1>
          <p className="mt-5 text-base text-gray-500 dark:text-gray-400 max-w-xl leading-relaxed">
            Compliance tracking with live GPS, evidence uploads, supervisor reviews and complete audit trails — on one dashboard.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <Link to="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-gray-900 dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 px-5 py-2.5 rounded-lg transition-colors">
              Sign In <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#how" className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 px-5 py-2.5 rounded-lg transition-colors">
              See how it works
            </a>
          </div>
          <div className="mt-10 flex items-center gap-5 text-xs text-gray-400 dark:text-gray-500">
            <button onClick={() => setPolicyModal('terms')} className="hover:text-gray-600 dark:hover:text-gray-300 underline underline-offset-2">Terms</button>
            <button onClick={() => setPolicyModal('privacy')} className="hover:text-gray-600 dark:hover:text-gray-300 underline underline-offset-2">Privacy</button>
            <button onClick={() => setPolicyModal('cookies')} className="hover:text-gray-600 dark:hover:text-gray-300 underline underline-offset-2">Cookies</button>
          </div>
        </div>
      </section>

      {/* ── Stats ───────────────────────────────────────────── */}
      <section className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-[#0f1729]">
        <div className="max-w-5xl mx-auto px-5 grid grid-cols-3 sm:grid-cols-6 divide-x divide-gray-200 dark:divide-gray-800">
          {[
            { label: 'Modules', value: stats?.modules ?? '—' },
            { label: 'Checkpoints', value: stats?.checkpoints ?? '—' },
            { label: 'Members', value: stats?.users ?? '—' },
            { label: 'Departments', value: stats?.departments ?? '—' },
            { label: 'Submissions', value: stats?.submissions ?? '—' },
            { label: 'Approval Rate', value: stats ? `${stats.approvalRate}%` : '—' },
          ].map((s) => (
            <div key={s.label} className="py-5 text-center">
              <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{s.value}</p>
              <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 mt-0.5 uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────── */}
      <section id="features" className="border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-5 py-20">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 tracking-widest uppercase mb-2">Features</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Everything your team needs</h2>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                  <f.icon className="w-4.5 h-4.5 text-gray-600 dark:text-gray-400" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{f.title}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────── */}
      <section id="how" className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-[#0f1729]">
        <div className="max-w-5xl mx-auto px-5 py-20">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 tracking-widest uppercase mb-2">Workflow</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">How it works</h2>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map((s) => (
              <div key={s.step} className="relative p-5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                <span className="text-2xl font-bold text-gray-100 dark:text-gray-800 absolute top-4 right-4">{s.step}</span>
                <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                  <s.icon className="w-4.5 h-4.5 text-gray-600 dark:text-gray-400" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{s.title}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GPS Tracking ────────────────────────────────────── */}
      <section id="tracking" className="border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-5 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 tracking-widest uppercase mb-2">GPS Tracking</p>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Your team's location, updated every 30 minutes</h2>
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Every team member's browser reports GPS coordinates on a 30-minute cycle. The dashboard shows a live map with online/offline status, coordinates, accuracy and battery.
              </p>
              <ul className="mt-6 space-y-2.5">
                {[
                  'Automatic updates — no manual check-ins',
                  'Battery level reporting on every ping',
                  'Office locations pinned on the same map',
                  'Full history with accuracy bounds',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Live Coordinates</h3>
              </div>
              <div className="space-y-2.5">
                {[
                  { name: 'John Doe', loc: '19.11360, 72.86970 · Andheri East', online: true, battery: '82%' },
                  { name: 'Sarah Lee', loc: '19.21830, 72.97810 · Thane', online: true, battery: '91%' },
                  { name: 'Jane Smith', loc: '19.03300, 73.02970 · Dombivli', online: false, battery: '76%' },
                ].map((u) => (
                  <div key={u.name} className="flex items-center justify-between px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white">{u.name}</p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{u.loc}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-[10px] font-semibold ${u.online ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
                        {u.online ? 'ONLINE' : 'OFFLINE'}
                      </span>
                      <span className="block text-[10px] text-gray-400 dark:text-gray-500">{u.battery}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="bg-gray-900 dark:bg-black text-gray-400">
        <div className="max-w-5xl mx-auto px-5 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <LogoMark size={24} />
                <span className="text-white font-bold text-sm">BSC Exclusive</span>
              </div>
              <p className="text-xs leading-relaxed">Enterprise compliance tracking with live GPS and audit trails.</p>
              <div className="mt-3 text-[11px] text-emerald-400 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                All Systems Operational
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-white uppercase tracking-wider mb-3">Platform</p>
              <ul className="space-y-2 text-xs">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#how" className="hover:text-white transition-colors">How it Works</a></li>
                <li><a href="#tracking" className="hover:text-white transition-colors">GPS Tracking</a></li>
                <li><Link to="/login" className="hover:text-white transition-colors">Sign In</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-white uppercase tracking-wider mb-3">Security</p>
              <ul className="space-y-2 text-xs">
                <li className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3 text-sky-400" /> 5-Attempt Lockout</li>
                <li className="flex items-center gap-1.5"><Lock className="w-3 h-3 text-sky-400" /> API Rate Limiting</li>
                <li className="flex items-center gap-1.5"><Satellite className="w-3 h-3 text-sky-400" /> 30-Min GPS</li>
                <li className="flex items-center gap-1.5"><ScrollText className="w-3 h-3 text-sky-400" /> Audit Logs</li>
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-white uppercase tracking-wider mb-3">Legal</p>
              <ul className="space-y-2 text-xs">
                <li><button onClick={() => setPolicyModal('terms')} className="hover:text-white transition-colors">Terms & Conditions</button></li>
                <li><button onClick={() => setPolicyModal('privacy')} className="hover:text-white transition-colors">Privacy Policy</button></li>
                <li><button onClick={() => setPolicyModal('cookies')} className="hover:text-white transition-colors">Cookie Policy</button></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-5 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
            <p>&copy; {new Date().getFullYear()} BSC Exclusive. All rights reserved.</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setPolicyModal('terms')} className="hover:text-gray-300 transition-colors">Terms</button>
              <span>&middot;</span>
              <button onClick={() => setPolicyModal('privacy')} className="hover:text-gray-300 transition-colors">Privacy</button>
              <span>&middot;</span>
              <button onClick={() => setPolicyModal('cookies')} className="hover:text-gray-300 transition-colors">Cookies</button>
            </div>
          </div>
        </div>
      </footer>

      {/* ── AI Chatbot & Floating Scroll-To-Top ──────────────── */}
      <Chatbot />
      <ScrollToTopButton />

      {/* ── Policy Modal ────────────────────────────────────── */}
      {policyModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 relative border border-gray-200 dark:border-gray-800">
            <button onClick={() => setPolicyModal(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-5 border-b border-gray-100 dark:border-gray-800 pb-3 pr-6">
              {(['terms', 'privacy', 'cookies'] as const).map((tab) => (
                <button key={tab} onClick={() => setPolicyModal(tab)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${policyModal === tab ? 'bg-gray-900 dark:bg-white dark:text-gray-900 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                  {tab === 'terms' ? 'Terms' : tab === 'privacy' ? 'Privacy' : 'Cookies'}
                </button>
              ))}
            </div>

            {policyModal === 'terms' && (
              <div className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed space-y-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Terms & Conditions</h2>
                <p className="text-gray-400">Effective: September 2026</p>
                <div className="space-y-3">
                  <div><h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">1. Enterprise Access</h3><p>BSC Exclusive is an internal platform. Accounts are created by administrators only.</p></div>
                  <div><h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">2. Password Security</h3><p>5 consecutive incorrect entries lock the account for 5 minutes.</p></div>
                  <div><h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">3. Rate Limiting</h3><p>All endpoints enforce rate limiting. Exceeding thresholds returns HTTP 429.</p></div>
                  <div><h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">4. GPS Tracking</h3><p>Users consent to 30-minute GPS collection for compliance verification.</p></div>
                  <div><h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">5. Auto-Approval</h3><p>Submissions unreviewed for 1 hour are auto-approved by the system.</p></div>
                  <div><h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">6. Audit Trail</h3><p>Every action is recorded in an immutable audit log.</p></div>
                </div>
              </div>
            )}

            {policyModal === 'privacy' && (
              <div className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed space-y-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Privacy Policy</h2>
                <p className="text-gray-400">Effective: September 2026</p>
                <div className="space-y-3">
                  <div><h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">1. Data Collected</h3><p>Name, employee code, email, department, GPS coordinates, battery status, uploaded files.</p></div>
                  <div><h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">2. Location Data</h3><p>GPS collected during active sessions only. Encrypted. Accessible to supervisors and admins. Purged after 90 days.</p></div>
                  <div><h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">3. Encryption</h3><p>TLS 1.3 in transit. AES-256 for files. Supabase Storage buckets.</p></div>
                  <div><h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">4. No Tracking</h3><p>This platform uses NO Google Analytics, NO Facebook Pixel, NO third-party trackers, NO cookies for advertising. All data stays within the platform. No browsing behavior is tracked or sold.</p></div>
                  <div><h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">5. No Data Selling</h3><p>We do not sell or share employee data with third parties. Period.</p></div>
                  <div><h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">6. Data Access</h3><p>Employees can request an export of their data from their administrator.</p></div>
                  <div><h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">7. Admin Visibility</h3><p>Administrators can see which users are active in the system. This is for security purposes only — no data leaves the platform.</p></div>
                </div>
              </div>
            )}

            {policyModal === 'cookies' && (
              <div className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed space-y-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Cookie Policy</h2>
                <p className="text-gray-400">Effective: September 2026</p>
                <div className="space-y-3">
                  <div><h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">1. Session Cookie</h3><p><code className="font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">bsc_session</code> — HTTP-only JWT cookie. SameSite=None in production.</p></div>
                  <div><h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">2. Rate Limit Tokens</h3><p>Security cookies track login attempts for the 5-attempt lockout.</p></div>
                  <div><h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">3. Local Storage</h3><p>Consent tokens and draft saves stored in localStorage.</p></div>
                  <div><h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">4. No Tracking Cookies</h3><p>We use NO Google Analytics, NO Facebook Pixel, NO advertising cookies, NO third-party trackers. Your browsing data is never tracked or sold.</p></div>
                  <div><h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">5. Requirement</h3><p>These are essential for security and operation. Acceptance is mandatory.</p></div>
                </div>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-end">
              <button onClick={() => setPolicyModal(null)} className="text-xs font-semibold text-white bg-gray-900 dark:bg-white dark:text-gray-900 px-5 py-2 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
