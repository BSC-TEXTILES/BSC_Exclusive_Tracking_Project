import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { post } from './api'
import { useAuth } from './auth'
import { getSocket } from './useSocket'

// High-frequency live tracking intervals
const DB_SYNC_THROTTLE_MS = 10 * 1000 // Save to database every 10 seconds
const ACTIVE_KEEPALIVE_MS = 15 * 1000 // Active GPS ping fallback every 15 seconds

interface TrackingState {
  supported: boolean
  permissionDenied: boolean
  permissionStatus: string
  lastSync: Date | null
  error: string | null
  syncing: boolean
  syncNow: () => Promise<void>
  watching: boolean
  currentPosition: { latitude: number; longitude: number; accuracy: number } | null
  pingCount: number
  liveStatus: 'active' | 'syncing' | 'denied' | 'idle'
}

const TrackingContext = createContext<TrackingState>({
  supported: false,
  permissionDenied: false,
  permissionStatus: 'unknown',
  lastSync: null,
  error: null,
  syncing: false,
  syncNow: async () => undefined,
  watching: false,
  currentPosition: null,
  pingCount: 0,
  liveStatus: 'idle',
})

export function TrackingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown')
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [watching, setWatching] = useState(false)
  const [currentPosition, setCurrentPosition] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null)
  const [pingCount, setPingCount] = useState<number>(0)
  const [liveStatus, setLiveStatus] = useState<'active' | 'syncing' | 'denied' | 'idle'>('idle')

  const inFlight = useRef(false)
  const mounted = useRef(true)
  const watchIdRef = useRef<number | null>(null)
  const lastPostTime = useRef<number>(0)
  const lastCoords = useRef<{ lat: number; lng: number } | null>(null)

  // Send position to server & websocket
  const postLocation = useCallback(async (coords: GeolocationCoordinates, forceDb = false) => {
    let batteryLevel: number | null = null
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      try {
        const battery: any = await (navigator as any).getBattery()
        if (battery && typeof battery.level === 'number') {
          batteryLevel = Math.round(battery.level * 100)
        }
      } catch {
        // battery not available
      }
    }

    const payload = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: Math.round(coords.accuracy),
      batteryLevel,
      address: null,
    }

    // 1. Broadcast via WebSocket immediately for real-time live map updates
    const socket = getSocket()
    if (socket && socket.connected) {
      socket.emit('tracking:update', payload)
    }

    // 2. Persist to DB at controlled interval (or if forced)
    const now = Date.now()
    const moved = !lastCoords.current ||
      Math.abs(lastCoords.current.lat - coords.latitude) > 0.0001 ||
      Math.abs(lastCoords.current.lng - coords.longitude) > 0.0001

    if (forceDb || moved || (now - lastPostTime.current >= DB_SYNC_THROTTLE_MS)) {
      lastPostTime.current = now
      lastCoords.current = { lat: coords.latitude, lng: coords.longitude }
      try {
        await post('/api/tracking', payload)
      } catch (err) {
        console.warn('[tracking] post error:', err)
      }
    }

    if (mounted.current) {
      setLastSync(new Date())
      setError(null)
      setPermissionDenied(false)
      setPermissionStatus('granted')
      setLiveStatus('active')
      setPingCount(prev => prev + 1)
      setCurrentPosition({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
      })
    }
  }, [])

  // Single GPS sync ping
  const syncNow = useCallback(async () => {
    if (inFlight.current) return
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported by your browser')
      setLiveStatus('idle')
      return
    }

    inFlight.current = true
    setSyncing(true)
    setError(null)

    try {
      if ('permissions' in navigator) {
        try {
          const status = await navigator.permissions.query({ name: 'geolocation' })
          setPermissionStatus(status.state)
          if (status.state === 'denied') {
            setPermissionDenied(true)
            setLiveStatus('denied')
            setError('Location permission denied. Please allow location in your browser.')
            return
          }
        } catch {
          // permissions API optional
        }
      }

      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        })
      )

      await postLocation(pos.coords, true)
    } catch (e) {
      if (!mounted.current) return
      const err = e as GeolocationPositionError
      if (err?.code === 1) {
        setPermissionDenied(true)
        setPermissionStatus('denied')
        setLiveStatus('denied')
        setError('Location access denied. Please allow location in your browser.')
      } else if (err?.code === 2) {
        setError('Location unavailable. Check your device GPS.')
      } else if (err?.code === 3) {
        setError('Location request timed out. Retrying in background...')
      } else {
        setError('Could not get your location.')
      }
    } finally {
      if (mounted.current) setSyncing(false)
      inFlight.current = false
    }
  }, [postLocation])

  // Continuous watchPosition tracking until tab closes
  const startWatching = useCallback(() => {
    if (!('geolocation' in navigator)) return
    if (watchIdRef.current !== null) return

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        if (!mounted.current) return
        void postLocation(pos.coords)
      },
      (err) => {
        if (!mounted.current) return
        if (err.code === 1) {
          setPermissionDenied(true)
          setPermissionStatus('denied')
          setLiveStatus('denied')
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000,
      }
    )
    watchIdRef.current = id
    setWatching(true)
    setLiveStatus('active')
  }, [postLocation])

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
      setWatching(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      stopWatching()
    }
  }, [stopWatching])

  // Continuous tracking effect — runs for ANY logged-in user continuously until tab closed
  useEffect(() => {
    if (!user) {
      setLiveStatus('idle')
      stopWatching()
      return
    }

    // 1. Initial sync
    void syncNow()

    // 2. Start continuous watchPosition
    startWatching()

    // 3. Fallback active keep-alive interval (runs every 15s continuously until tab closed)
    const intervalId = setInterval(() => {
      void syncNow()
    }, ACTIVE_KEEPALIVE_MS)

    // 4. Handle visibility changes: when user switches back to this tab, fetch immediately
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void syncNow()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibility)
      stopWatching()
    }
  }, [user, syncNow, startWatching, stopWatching])

  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator

  return (
    <TrackingContext.Provider
      value={{
        supported,
        permissionDenied,
        permissionStatus,
        lastSync,
        error,
        syncing,
        syncNow,
        watching,
        currentPosition,
        pingCount,
        liveStatus,
      }}
    >
      {children}
    </TrackingContext.Provider>
  )
}

export function useTracking() {
  return useContext(TrackingContext)
}

export const TRACKING_INTERVAL_MINUTES = 0.25 // live continuous
