'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Eye, EyeOff, Shield, Lock, User, CheckCircle2 } from 'lucide-react'
import BrandLogo from '@/components/ui/brand-logo'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (!data.success) {
        setError(data.message || 'Login failed')
        setLoading(false)
        return
      }

      router.push(data.data.redirectUrl || '/dashboard')
      router.refresh()
    } catch {
      setError('Unable to connect. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-header-bg relative overflow-hidden flex-col justify-between p-12 animate-fade-in">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-20 w-64 h-64 bg-primary rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-primary rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>

        <div className="relative z-10 max-w-md">
          <div className="w-14 h-14 bg-primary/20 border border-primary/30 flex items-center justify-center mb-8">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4 leading-tight">
            BSC Exclusive<br />Process Tracker
          </h1>
          <p className="text-white/60 text-sm leading-relaxed mb-8">
            Secure internal platform for managing business process compliance, checkpoints, and team assignments.
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-3 text-white/70">
              <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-sm">Real-time checkpoint tracking</span>
            </div>
            <div className="flex items-center gap-3 text-white/70">
              <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-sm">Role-based access control</span>
            </div>
            <div className="flex items-center gap-3 text-white/70">
              <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-sm">Full audit trail logging</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-white/30 text-xs">
          &copy; {new Date().getFullYear()} BSC Exclusive. All rights reserved.
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex flex-col">
        {/* Mobile back to home */}
        <div className="lg:hidden h-12 flex items-center px-4 border-b border-border bg-surface">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm animate-slide-up">
            {/* Mobile logo */}
            <div className="lg:hidden mb-8 flex justify-center">
              <BrandLogo size="md" variant="full" theme="light" />
            </div>

            <div className="mb-8">
              <div className="w-10 h-10 bg-primary flex items-center justify-center mb-4">
                <Lock className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-text mb-1">Welcome back</h2>
              <p className="text-sm text-text-secondary">Sign in to your account to continue</p>
            </div>

            {error && (
              <div className="mb-5 p-3 bg-danger-bg border border-danger-border text-danger text-sm flex items-center gap-2 animate-scale-in">
                <div className="w-1.5 h-1.5 bg-danger rounded-full flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="animate-fade-in stagger-1">
                <label htmlFor="username" className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-border text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-surface transition"
                    placeholder="Enter your username"
                  />
                </div>
              </div>

              <div className="animate-fade-in stagger-2">
                <label htmlFor="password" className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 border border-border text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-surface transition"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 animate-fade-in stagger-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 btn-press"
                >
                  {loading ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </div>
            </form>

            <p className="text-xs text-text-muted mt-6 text-center">
              Contact your administrator if you need an account.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
