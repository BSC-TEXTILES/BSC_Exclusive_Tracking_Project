import React, { useEffect, useState, useCallback, useRef } from 'react'
import { ShieldAlert, Lock, AlertOctagon, Terminal } from 'lucide-react'

/**
 * Enterprise DevToolsGuard & Anti-Tamper Protection Suite
 * 
 * Features:
 * 1. Global right-click and context-menu prevention across all elements (capture phase).
 * 2. Blocks all inspection and DevTools shortcuts (F12, Ctrl+Shift+I/J/C/K/E, Ctrl+U, Ctrl+S).
 * 3. Real-time DevTools & Web Editor detection (dimension delta + getter timing probe).
 * 4. Active Security Lockdown screen with UI blur to protect sensitive data when DevTools is open.
 * 5. Console tampering protection with warning banners and periodic console clearing.
 */
export default function DevToolsGuard() {
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showSecurityToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    setToastMessage(msg)
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null)
    }, 2500)
  }, [])

  useEffect(() => {
    // ── 1. Output Enterprise Anti-Tampering Console Warning ────
    try {
      console.clear()
      const titleStyle = 'color: #ef4444; font-size: 28px; font-weight: bold; -webkit-text-stroke: 1px black;'
      const textStyle = 'color: #f59e0b; font-size: 14px; font-weight: 600;'
      const subStyle = 'color: #94a3b8; font-size: 12px;'
      console.log('%cSTOP!', titleStyle)
      console.log('%cThis is a secure enterprise compliance platform (BSC Exclusive).', textStyle)
      console.log('%cAny unauthorized inspection, reverse engineering, web editor injection, or script tampering is strictly monitored and logged with IP address and security audit trails.', subStyle)
    } catch {
      // ignore
    }

    // ── 2. Block Right-Click Context Menu ──────────────────────
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      showSecurityToast('Security Protected: Right-click is disabled on this platform.')
      return false
    }

    // Block right-click mouseup / mousedown
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 2 || e.which === 3) {
        e.preventDefault()
        e.stopPropagation()
        showSecurityToast('Security Protected: Right-click is disabled on this platform.')
      }
    }

    // ── 3. Block Developer Tools & Inspection Shortcuts ─────────
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()

      // F12
      if (key === 'f12') {
        e.preventDefault()
        e.stopPropagation()
        showSecurityToast('Security Protected: Developer Tools (F12) are restricted.')
        return false
      }

      // F2
      if (key === 'f2') {
        e.preventDefault()
        e.stopPropagation()
        return false
      }

      // Ctrl+Shift+I / J / C / K / E (Chrome, Firefox, Edge, Safari)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c', 'k', 'e'].includes(key)) {
        e.preventDefault()
        e.stopPropagation()
        showSecurityToast('Security Protected: Inspect & Console shortcuts are restricted.')
        return false
      }

      // Ctrl+U (View Page Source)
      if ((e.ctrlKey || e.metaKey) && key === 'u') {
        e.preventDefault()
        e.stopPropagation()
        showSecurityToast('Security Protected: Viewing page source is restricted.')
        return false
      }

      // Ctrl+S (Save Page Source)
      if ((e.ctrlKey || e.metaKey) && key === 's') {
        e.preventDefault()
        e.stopPropagation()
        return false
      }

      // Cmd+Option+I / J / C (Mac DevTools)
      if (e.metaKey && e.altKey && ['i', 'j', 'c'].includes(key)) {
        e.preventDefault()
        e.stopPropagation()
        showSecurityToast('Security Protected: Web Inspector is restricted.')
        return false
      }
    }

    // ── 4. Active DevTools / Web Editor Detection ──────────────
    const threshold = 160
    let detected = false

    const checkDevTools = () => {
      // Check 1: Window outer vs inner dimensions delta
      const widthDelta = window.outerWidth - window.innerWidth > threshold
      const heightDelta = window.outerHeight - window.innerHeight > threshold

      // Check 2: Console evaluation probe
      let getterTriggered = false
      const probe = new Image()
      Object.defineProperty(probe, 'id', {
        get: () => {
          getterTriggered = true
        },
      })
      // Trigger probe
      try {
        console.dir(probe)
      } catch {
        // ignore
      }

      const isOpen = widthDelta || heightDelta || getterTriggered

      if (isOpen && !detected) {
        detected = true
        setIsDevToolsOpen(true)
        try {
          console.clear()
        } catch {
          // ignore
        }
      } else if (!isOpen && detected) {
        detected = false
        setIsDevToolsOpen(false)
      }
    }

    // ── Attach Listeners (Capture Phase) ──────────────────────
    window.addEventListener('contextmenu', handleContextMenu, { capture: true })
    document.addEventListener('contextmenu', handleContextMenu, { capture: true })
    window.addEventListener('mousedown', handleMouseDown, { capture: true })
    window.addEventListener('keydown', handleKeyDown, { capture: true })

    // Check periodically for devtools state
    const interval = setInterval(checkDevTools, 800)

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu, { capture: true })
      document.removeEventListener('contextmenu', handleContextMenu, { capture: true })
      window.removeEventListener('mousedown', handleMouseDown, { capture: true })
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
      clearInterval(interval)
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    }
  }, [showSecurityToast])

  // Blur background when DevTools is open to protect sensitive compliance data
  useEffect(() => {
    const rootEl = document.getElementById('root')
    if (!rootEl) return
    if (isDevToolsOpen) {
      rootEl.style.filter = 'blur(14px)'
      rootEl.style.pointerEvents = 'none'
      rootEl.style.userSelect = 'none'
    } else {
      rootEl.style.filter = ''
      rootEl.style.pointerEvents = ''
      rootEl.style.userSelect = ''
    }
  }, [isDevToolsOpen])

  return (
    <>
      {/* Non-intrusive Security Warning Toast on attempted action */}
      {toastMessage && (
        <div
          role="alert"
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[999999] flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-900/95 text-amber-300 text-xs font-semibold shadow-2xl border border-amber-500/40 backdrop-blur-md animate-fade-in-fast pointer-events-none"
        >
          <Lock className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Full Security Lockdown Screen when DevTools / Web Editor is Open */}
      {isDevToolsOpen && (
        <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4 animate-fade-in">
          <div className="bg-slate-900 border border-red-500/40 rounded-3xl shadow-2xl p-6 sm:p-8 max-w-md w-full text-center text-white relative overflow-hidden">
            {/* Ambient Red Alert Glow */}
            <div className="absolute -top-16 -left-16 w-36 h-36 bg-red-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-5 shadow-inner">
                <ShieldAlert className="w-8 h-8 text-red-400 animate-pulse" />
              </div>

              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-300 text-[11px] font-bold uppercase tracking-wider mb-2">
                <AlertOctagon className="w-3.5 h-3.5" />
                Security Shield Active
              </div>

              <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-2">
                Developer Tools / Web Editor Detected
              </h3>

              <p className="text-xs sm:text-sm text-slate-300 mt-3 leading-relaxed">
                In compliance with BSC Exclusive zero-trust enterprise security protocols, code inspection, web editor modification, and developer tools are strictly restricted.
              </p>

              <div className="mt-5 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-left text-xs font-mono text-slate-400 space-y-1.5">
                <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Security Action Required:</span>
                </div>
                <p className="text-slate-300 text-[11px]">
                  Please <b>close Developer Tools / Web Inspector</b> to immediately restore access to your session.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                <span>BSC Exclusive Anti-Tamper v2.4</span>
                <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Protection Active
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
