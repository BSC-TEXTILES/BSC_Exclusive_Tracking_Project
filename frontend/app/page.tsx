'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  Shield,
  Activity,
  Camera,
  Server,
  Clock,
  BarChart,
  ArrowRight,
  Menu,
  X,
  Layers,
  ChevronRight,
  Check,
} from 'lucide-react'
import BrandLogo from '@/components/ui/brand-logo'

interface PublicModule {
  id: string
  name: string
  description: string
  checkpointCount: number
}

const features = [
  {
    title: 'Daily Process Cadence',
    desc: 'Structured morning and evening checkpoint schedules with auto-lock and overdue alerts.',
    icon: Clock,
  },
  {
    title: 'Compliance Multi-State',
    desc: 'Record Fully Followed, Partially Followed, or Not Followed with mandatory justifications.',
    icon: CheckCircle2,
  },
  {
    title: 'Accuracy Verification',
    desc: 'Multi-layer validation for financial logs, transaction records, and inventory counts.',
    icon: Activity,
  },
  {
    title: 'Verifiable Evidence',
    desc: 'Upload supporting photos, spreadsheets, and signed documents stored in relational schemas.',
    icon: Camera,
  },
  {
    title: 'Corrective Action Workflow',
    desc: 'Enforce actionable remedial steps whenever compliance discrepancies are flagged.',
    icon: Shield,
  },
  {
    title: 'Admin Oversight',
    desc: 'Control center for users, roles, permissions, departments, and live audit trails.',
    icon: Layers,
  },
  {
    title: 'Immutable Audit Logs',
    desc: 'Every change, approval, and rejection is recorded in permanent PostgreSQL audit tables.',
    icon: Server,
  },
  {
    title: 'CSV & Analytics',
    desc: 'Generate real-time executive summaries, department breakdowns, and exportable audit reports.',
    icon: BarChart,
  },
]

const fallbackModules = [
  { name: 'CRM Module', count: 7, desc: 'Lead tracking, client communications, pipeline hygiene.' },
  { name: 'Warehouse & Purchase', count: 9, desc: 'Inbound manifests, inventory counts, dispatch proof.' },
  { name: 'Sales Operations', count: 9, desc: 'Order bookings, invoicing verification, collections.' },
  { name: 'Human Resources', count: 8, desc: 'Attendance audits, compliance filings, shift logs.' },
  { name: 'Accounts & Finance', count: 8, desc: 'Daily cash reconciliation, GST tracking, ledger audits.' },
  { name: 'Database & Infrastructure', count: 7, desc: 'Backup validation, replication health, security logs.' },
]

export default function LandingPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [modules, setModules] = useState<PublicModule[]>([])

  useEffect(() => {
    fetch('/api/public/modules')
      .then(res => res.json())
      .then(json => {
        if (json.success) setModules(json.data)
      })
      .catch(() => {})
  }, [])

  const displayModules = modules.length > 0
    ? modules.map(m => ({ name: m.name, count: m.checkpointCount, desc: m.description || 'Enterprise operational workflow and daily compliance standard.' }))
    : fallbackModules

  return (
    <div className="min-h-screen bg-background text-text font-sans">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-header-bg">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between h-14">
            <Link href="/" className="flex items-center">
              <BrandLogo size="sm" variant="full" theme="dark" showSubtitle={false} />
            </Link>

            <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-white/60">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#modules" className="hover:text-white transition-colors">Modules</a>
              <a href="#workflow" className="hover:text-white transition-colors">How It Works</a>
              <a href="#contact" className="hover:text-white transition-colors">Contact</a>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 text-sm font-semibold transition-colors"
              >
                Login
                <ArrowRight className="w-4 h-4" />
              </Link>
            </nav>

            <button
              className="md:hidden p-2 text-white/60 hover:text-white"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden bg-header-bg border-t border-border px-6 py-4 space-y-3">
            <a href="#features" className="block text-white/60 hover:text-white text-sm py-1" onClick={() => setIsMobileMenuOpen(false)}>Features</a>
            <a href="#modules" className="block text-white/60 hover:text-white text-sm py-1" onClick={() => setIsMobileMenuOpen(false)}>Modules</a>
            <a href="#workflow" className="block text-white/60 hover:text-white text-sm py-1" onClick={() => setIsMobileMenuOpen(false)}>How It Works</a>
            <a href="#contact" className="block text-white/60 hover:text-white text-sm py-1" onClick={() => setIsMobileMenuOpen(false)}>Contact</a>
            <Link href="/login" className="block text-center bg-primary hover:bg-primary-hover text-white py-2 text-sm font-semibold mt-2" onClick={() => setIsMobileMenuOpen(false)}>Login</Link>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="bg-surface border-b border-border animate-fade-in">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-20">
          <div className="max-w-2xl">
            <span className="inline-block text-xs font-semibold uppercase tracking-wide text-primary bg-primary-light border border-primary/20 px-2 py-1 mb-4">
              Internal Tool
            </span>
            <h1 className="text-3xl sm:text-4xl font-bold text-text leading-tight mb-4 animate-slide-up stagger-1">
              Process Compliance &amp; Daily Audit Tracker
            </h1>
            <p className="text-base text-text-secondary leading-relaxed mb-6 animate-slide-up stagger-2">
              Execute standard operating procedures, record verifiable evidence, automate accuracy scoring, and maintain immutable audit histories across all departments.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-8 animate-slide-up stagger-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white px-5 py-2.5 text-sm font-semibold transition-colors"
              >
                Launch Process Tracker
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#workflow"
                className="inline-flex items-center justify-center gap-2 bg-surface hover:bg-surface-alt text-text border border-border px-5 py-2.5 text-sm font-semibold transition-colors"
              >
                See How It Works
                <ChevronRight className="w-4 h-4 text-text-muted" />
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-text-muted border-t border-border pt-6">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-success" />
                <span>PostgreSQL Core</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-success" />
                <span>Role-Based Access</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-success" />
                <span>Encrypted Sessions</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-success" />
                <span>ISO 9001 Ready</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="bg-surface border-b border-border animate-fade-in">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="mb-10">
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">Enterprise Features</span>
            <h2 className="text-2xl font-bold text-text mt-2">Built for Operational Compliance</h2>
            <p className="text-sm text-text-secondary mt-2 max-w-xl">
              Standardize checkpoint execution across distributed departments with real-time oversight.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((f, i) => (
              <div key={i} className="flex items-start gap-4 p-5 bg-background border border-border hover-lift">
                <div className="w-10 h-10 bg-primary-light text-primary border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <f.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text mb-1">{f.title}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MODULES */}
      <section id="modules" className="bg-background border-b border-border animate-fade-in">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">Operational Modules</span>
              <h2 className="text-2xl font-bold text-text mt-2">Configured System Modules</h2>
            </div>
            <Link href="/login" className="text-sm font-semibold text-primary hover:text-primary-hover inline-flex items-center gap-1">
              View in Process Tracker
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="bg-surface border border-border overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Module</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted hidden sm:table-cell">Description</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted text-right">Checkpoints</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted text-right hidden md:table-cell">Status</th>
                </tr>
              </thead>
              <tbody>
                {displayModules.map((m, i) => (
                  <tr key={i} className="border-b border-border-light last:border-0 hover:bg-background transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary-light text-primary border border-primary/20 flex items-center justify-center flex-shrink-0">
                          <Layers className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-semibold text-text">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-text-secondary hidden sm:table-cell">{m.desc}</td>
                    <td className="px-5 py-4 text-sm font-medium text-text text-right">{m.count}</td>
                    <td className="px-5 py-4 text-right hidden md:table-cell">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success bg-success/10 border border-success/20 px-2 py-0.5">
                        <span className="w-1.5 h-1.5 bg-success rounded-full" />
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="workflow" className="bg-surface border-b border-border animate-fade-in">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="mb-10">
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">Audit Lifecycle</span>
            <h2 className="text-2xl font-bold text-text mt-2">How It Works</h2>
            <p className="text-sm text-text-secondary mt-2 max-w-xl">
              Three steps to operational compliance across your organization.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { num: 1, title: 'Assign & Configure', desc: 'Admin sets up department checkpoints, assigns roles, and configures user permissions for each module.' },
              { num: 2, title: 'Execute & Verify', desc: 'Staff completes daily checkpoints, uploads timestamped evidence, and records compliance status for each item.' },
              { num: 3, title: 'Review & Remediate', desc: 'Managers review submissions, approve completions, and trigger corrective action workflows when discrepancies arise.' },
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="w-10 h-10 bg-primary text-white flex items-center justify-center flex-shrink-0 text-sm font-bold">
                  {step.num}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-text mb-1">{step.title}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contact" className="bg-header-bg animate-fade-in">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Get Started Today</h2>
          <p className="text-sm text-white/60 max-w-lg mx-auto mb-6 leading-relaxed">
            Gain full visibility, guarantee compliance standards, and protect your enterprise with the IVT Process Tracker.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-6 py-3 text-sm font-semibold transition-colors"
          >
            Access Portal
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-header-bg border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <BrandLogo size="xs" variant="full" theme="dark" showSubtitle={false} />
            <nav className="flex flex-wrap justify-center gap-6 text-sm text-white/60">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#modules" className="hover:text-white transition-colors">Modules</a>
              <a href="#workflow" className="hover:text-white transition-colors">How It Works</a>
              <a href="#contact" className="hover:text-white transition-colors">Contact</a>
              <Link href="/login" className="hover:text-white transition-colors">Login</Link>
            </nav>
          </div>
          <div className="mt-6 pt-6 border-t border-border text-center text-xs text-white/60">
            &copy; {new Date().getFullYear()} IVT Process Tracker. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
