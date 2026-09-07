import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { AuthProvider } from './lib/auth'
import { TrackingProvider } from './lib/tracking'
import { ThemeProvider } from './lib/theme'
import DevToolsGuard from './components/DevToolsGuard'
import ConsentGate from './components/ConsentGate'

function SessionTimeoutBanner() {
  return (
    <div id="session-timeout-banner" className="session-timeout-banner" style={{ display: 'none' }}>
      Your session will expire in 5 minutes due to inactivity. Move your mouse or press a key to stay logged in.
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConsentGate>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ThemeProvider>
          <AuthProvider>
            <TrackingProvider>
              <DevToolsGuard />
              <SessionTimeoutBanner />
              <App />
            </TrackingProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ConsentGate>
  </StrictMode>
)
