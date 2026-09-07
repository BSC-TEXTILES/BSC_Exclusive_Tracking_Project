import { useState, useEffect, useCallback, type ReactNode } from 'react'
import {
  MapPin,
  CheckCircle2,
  Shield,
  ScrollText,
  Cookie,
  X,
  AlertTriangle,
  Lock,
  Check,
  ExternalLink,
} from 'lucide-react'

const CONSENT_KEY = 'bsc_consent_accepted'
const COOKIES_KEY = 'bsc_cookies_accepted'
const LOCATION_KEY = 'bsc_location_granted'

function hasConsented(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'true'
  } catch {
    return false
  }
}

function hasCookiesAccepted(): boolean {
  try {
    return localStorage.getItem(COOKIES_KEY) === 'true'
  } catch {
    return false
  }
}

function hasLocationGranted(): boolean {
  try {
    return localStorage.getItem(LOCATION_KEY) === 'true'
  } catch {
    return false
  }
}

export default function ConsentGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [showConsent, setShowConsent] = useState(false)
  const [agreedTerms, setAgreedTerms] = useState(false)
  const [agreedPrivacy, setAgreedPrivacy] = useState(false)
  const [agreedCookies, setAgreedCookies] = useState(false)
  const [locationStatus, setLocationStatus] = useState<'pending' | 'granted' | 'denied' | 'unsupported'>('pending')
  const [showTermsFull, setShowTermsFull] = useState(false)
  const [showPrivacyFull, setShowPrivacyFull] = useState(false)
  const [showCookiesFull, setShowCookiesFull] = useState(false)

  useEffect(() => {
    if (hasConsented() && hasCookiesAccepted() && hasLocationGranted()) {
      setReady(true)
      return
    }
    setShowConsent(true)
  }, [])

  const requestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocationStatus('unsupported')
      return
    }
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocationStatus('granted')
        try { localStorage.setItem(LOCATION_KEY, 'true') } catch {}
      },
      () => {
        setLocationStatus('denied')
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }, [])

  const selectAll = () => {
    const next = !(agreedTerms && agreedPrivacy && agreedCookies)
    setAgreedTerms(next)
    setAgreedPrivacy(next)
    setAgreedCookies(next)
  }

  const handleAccept = useCallback(() => {
    try {
      localStorage.setItem(CONSENT_KEY, 'true')
      localStorage.setItem(COOKIES_KEY, 'true')
      if (locationStatus === 'granted') {
        localStorage.setItem(LOCATION_KEY, 'true')
      }
    } catch {}
    setShowConsent(false)
    setReady(true)
  }, [locationStatus])

  if (ready) return <>{children}</>
  if (!showConsent) return null

  const canProceed = agreedTerms && agreedPrivacy && agreedCookies && locationStatus === 'granted'

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto relative flex flex-col border border-slate-100">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-100 px-6 py-4 rounded-t-2xl z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/25">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Welcome to BSC Exclusive</h2>
              <p className="text-xs text-slate-500">Required compliance, policy & location gate</p>
            </div>
          </div>
          <button
            type="button"
            onClick={selectAll}
            className="text-[11px] font-bold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100/80 px-2.5 py-1 rounded-lg transition-colors"
          >
            {agreedTerms && agreedPrivacy && agreedCookies ? 'Unselect All' : 'Select All'}
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 flex-1">
          {/* Warning banner */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200/80 rounded-xl p-3.5">
            <AlertTriangle className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <p className="font-bold">Enterprise Security & Compliance Gate</p>
              <p className="text-amber-800 text-[11px] mt-0.5">
                You must accept Terms, Privacy Policy, Web Cookies, and grant GPS Location Access to proceed to BSC Exclusive.
              </p>
            </div>
          </div>

          {/* 1. Terms & Conditions */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <ScrollText className="w-4 h-4 text-sky-600" />
                <span className="text-xs font-bold text-slate-900">Terms & Conditions</span>
              </div>
              <button
                onClick={() => setShowTermsFull(true)}
                className="text-[11px] text-sky-600 font-bold hover:underline flex items-center gap-1"
              >
                View Full Terms <ExternalLink className="w-3 h-3" />
              </button>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                Accounts are administrator-managed. Submissions and checkpoint evidence are subject to audit verification, location validation, and 5-minute brute force rate limit protections.
              </p>
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                />
                <span className="text-xs text-slate-800 font-semibold group-hover:text-sky-600 transition-colors">
                  I have read and agree to the Terms & Conditions
                </span>
              </label>
            </div>
          </div>

          {/* 2. Privacy Policy */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-sky-600" />
                <span className="text-xs font-bold text-slate-900">Privacy Policy</span>
              </div>
              <button
                onClick={() => setShowPrivacyFull(true)}
                className="text-[11px] text-sky-600 font-bold hover:underline flex items-center gap-1"
              >
                View Full Privacy <ExternalLink className="w-3 h-3" />
              </button>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                All employee data, GPS location coordinates, and evidence files are encrypted in transit (TLS 1.3) and at rest (AES-256). Data is never sold or shared with external parties.
              </p>
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={agreedPrivacy}
                  onChange={(e) => setAgreedPrivacy(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                />
                <span className="text-xs text-slate-800 font-semibold group-hover:text-sky-600 transition-colors">
                  I have read and agree to the Privacy Policy
                </span>
              </label>
            </div>
          </div>

          {/* 3. Web Cookies & Data Storage */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Cookie className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold text-slate-900">Web Cookies & Security Tokens</span>
              </div>
              <button
                onClick={() => setShowCookiesFull(true)}
                className="text-[11px] text-sky-600 font-bold hover:underline flex items-center gap-1"
              >
                Cookie Policy <ExternalLink className="w-3 h-3" />
              </button>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-slate-600 leading-relaxed mb-2">
                We use strictly essential HTTP-only cookies (<code className="bg-slate-100 px-1 py-0.5 rounded text-[10px] text-slate-800 font-mono">bsc_session</code>), anti-CSRF tokens, rate limit counters, and offline storage to keep your session secure and prevent brute-force attacks.
              </p>
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={agreedCookies}
                  onChange={(e) => setAgreedCookies(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                />
                <span className="text-xs text-slate-800 font-semibold group-hover:text-sky-600 transition-colors">
                  I accept and consent to all essential web cookies
                </span>
              </label>
            </div>
          </div>

          {/* 4. Location Permission */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-900">Live GPS Location Access</span>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                BSC Exclusive captures live GPS coordinates every 30 minutes during active sessions to verify process checkpoints. Location is visible only to supervisors and administrators.
              </p>
              {locationStatus === 'granted' && (
                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Location access granted and verified
                </div>
              )}
              {locationStatus === 'denied' && (
                <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg text-xs font-bold mb-2">
                  <X className="w-4 h-4 text-red-600" /> Permission denied — please allow location in browser settings
                </div>
              )}
              {locationStatus === 'unsupported' && (
                <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg text-xs font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600" /> Geolocation is not supported by your browser
                </div>
              )}
              {locationStatus !== 'granted' && locationStatus !== 'unsupported' && (
                <button
                  type="button"
                  onClick={requestLocation}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold text-xs rounded-xl hover:from-emerald-600 hover:to-green-700 shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all"
                >
                  <MapPin className="w-4 h-4" /> Grant Location Access
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 rounded-b-2xl">
          <button
            type="button"
            onClick={handleAccept}
            disabled={!canProceed}
            className={`w-full py-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
              canProceed
                ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white hover:from-sky-600 hover:to-blue-700 shadow-lg shadow-sky-500/25'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {canProceed ? (
              <>
                <Check className="w-4 h-4" /> Continue to BSC Exclusive
              </>
            ) : (
              'Accept all terms, cookies & grant location to continue'
            )}
          </button>
        </div>
      </div>

      {/* Full Terms Modal */}
      {showTermsFull && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 relative border border-slate-100">
            <button onClick={() => setShowTermsFull(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-3">
              <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <ScrollText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Terms & Conditions</h2>
                <p className="text-xs text-slate-500">Enterprise Compliance & Platform Agreement</p>
              </div>
            </div>
            <div className="text-xs text-slate-600 leading-relaxed space-y-4">
              <p><strong>Last updated:</strong> September 2026 · Version 2.4</p>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">1. Acceptance & Organization Scope</h3>
                <p>By accessing BSC Exclusive Process Tracking, you agree to these Terms. All accounts are provisioned exclusively by authorized organization administrators. There is no public user registration.</p>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">2. Account Security & 5-Attempt Lockout</h3>
                <p>Users must safeguard credentials. For security, entering an incorrect password 5 times triggers an automated 5-minute system lockout to protect against unauthorized brute-force attempts.</p>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">3. Live GPS Location Reporting</h3>
                <p>You agree to periodic GPS location capture (every 30 minutes) during active work sessions. Coordinates are used solely for checkpoint validation and supervisor field compliance.</p>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">4. Accurate Submissions & Evidence Integrity</h3>
                <p>All attached photos, documents, and audit comments must represent genuine verification. Submitting falsified coordinates or tampered evidence constitutes a policy violation.</p>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">5. Automated Approval Timeline</h3>
                <p>Submissions left unreviewed by a supervisor or manager for 1 hour are auto-approved by the automated audit engine with a system-generated timestamp.</p>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">6. Comprehensive Audit Logs</h3>
                <p>Every login, session token refresh, submission, approval, and file upload is recorded with user ID, before/after states, IP address, and browser user-agent.</p>
              </div>
            </div>
            <button onClick={() => setShowTermsFull(false)} className="btn btn-primary mt-6 w-full text-xs font-bold">Close Terms</button>
          </div>
        </div>
      )}

      {/* Full Privacy Modal */}
      {showPrivacyFull && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 relative border border-slate-100">
            <button onClick={() => setShowPrivacyFull(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-3">
              <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Privacy Policy</h2>
                <p className="text-xs text-slate-500">How we protect, encrypt, and manage employee data</p>
              </div>
            </div>
            <div className="text-xs text-slate-600 leading-relaxed space-y-4">
              <p><strong>Last updated:</strong> September 2026 · ISO/IEC 27001 & GDPR Aligned</p>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">1. Information We Collect</h3>
                <p>We process: Employee Name, Employee Code, Work Email, Role, Department, GPS Latitude & Longitude, Device Battery Level, and Uploaded Evidence Files.</p>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">2. GPS Location Privacy</h3>
                <p>Location data is recorded solely while logged in and working. Coordinates are restricted to role-authorized supervisors and administrators. Location data is retained for 90 days and auto-archived.</p>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">3. Encryption & Storage</h3>
                <p>All network traffic is encrypted via TLS 1.3. Stored evidence files and database backups are encrypted with AES-256 in Supabase storage buckets.</p>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">4. No Third-Party Selling</h3>
                <p>BSC Exclusive never sells, monetizes, or shares employee data with marketing platforms or third-party data brokers.</p>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">5. Your Data Rights</h3>
                <p>You may request an export of your activity logs, profile details, and submission history through your organization administrator.</p>
              </div>
            </div>
            <button onClick={() => setShowPrivacyFull(false)} className="btn btn-primary mt-6 w-full text-xs font-bold">Close Privacy Policy</button>
          </div>
        </div>
      )}

      {/* Full Cookie Policy Modal */}
      {showCookiesFull && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 relative border border-slate-100">
            <button onClick={() => setShowCookiesFull(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Cookie className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Web Cookie & Storage Policy</h2>
                <p className="text-xs text-slate-500">Transparent disclosure of all cookies and storage tokens used</p>
              </div>
            </div>
            <div className="text-xs text-slate-600 leading-relaxed space-y-4">
              <p><strong>Last updated:</strong> September 2026</p>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">1. What Are Cookies?</h3>
                <p>Cookies are small data tokens stored in your browser to maintain your signed-in session securely, prevent session hijacking, and protect against automated attacks.</p>
              </div>
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/70 space-y-3">
                <div>
                  <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">A. Essential Authentication Cookie (<code className="font-mono text-sky-700">bsc_session</code>)</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">Encrypted JWT token stored in an HTTP-only, SameSite cookie. Valid for 7 days. Required for user verification.</p>
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">B. Security & Brute-Force Rate Limiting</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">Protects login endpoints against password cracking. Imposes a 5-minute lockout after 5 consecutive incorrect attempts.</p>
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">C. Draft Autosave & Local Preferences</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">LocalStorage items (<code className="font-mono text-slate-700">bsc_consent_accepted</code>, <code className="font-mono text-slate-700">bsc_cookies_accepted</code>) ensure you don't lose typed report answers if connectivity drops.</p>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1">2. How to Manage Cookies</h3>
                <p>Because BSC Exclusive is an internal enterprise platform, essential session cookies cannot be disabled without preventing you from signing in.</p>
              </div>
            </div>
            <button onClick={() => setShowCookiesFull(false)} className="btn btn-primary mt-6 w-full text-xs font-bold">Close Cookie Policy</button>
          </div>
        </div>
      )}
    </div>
  )
}
