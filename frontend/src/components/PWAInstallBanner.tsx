import { useState, useEffect } from 'react'
import { Download, X, Smartphone, Monitor } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Check if already dismissed
    if (localStorage.getItem('bsc_pwa_dismissed') === 'true') return

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if ((window.navigator as any).standalone === true) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowBanner(true)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowBanner(false)
      localStorage.setItem('bsc_pwa_installed', 'true')
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowBanner(false)
    setDismissed(true)
    localStorage.setItem('bsc_pwa_dismissed', 'true')
  }

  if (!showBanner || dismissed) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-[9999] animate-fade-in">
      <div className="bg-gradient-to-r from-sky-600 to-blue-700 rounded-2xl shadow-2xl shadow-sky-500/30 p-4 text-white">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
            <Download className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold">Install BSC Exclusive</h3>
            <p className="text-xs text-sky-100 mt-0.5 leading-relaxed">
              Install the app for faster access, offline support, and automatic GPS tracking.
            </p>
            <div className="flex items-center gap-2 mt-2 text-[10px] text-sky-200">
              <span className="flex items-center gap-1"><Smartphone className="w-3 h-3" /> Mobile</span>
              <span className="flex items-center gap-1"><Monitor className="w-3 h-3" /> Desktop</span>
            </div>
          </div>
          <button onClick={handleDismiss} className="text-white/60 hover:text-white p-1 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleInstall}
            className="flex-1 bg-white text-sky-700 text-xs font-bold py-2.5 rounded-xl hover:bg-sky-50 transition-colors flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Install Now
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  )
}
