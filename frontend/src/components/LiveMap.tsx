import { useState, useCallback } from 'react'
import { APIProvider, Map, AdvancedMarker, InfoWindow, MapControl, ControlPosition } from '@vis.gl/react-google-maps'
import { Layers, Satellite, Mountain, Map as MapIcon, Navigation, ExternalLink, User } from 'lucide-react'
import { apiUrl } from '../lib/api'

export interface MapMarker {
  id: string
  name: string
  latitude: number
  longitude: number
  online?: boolean
  role?: string
  kind?: 'user' | 'office'
  address?: string | null
  profileImage?: string | null
  employeeCode?: string
  departmentName?: string | null
  batteryLevel?: number | null
  accuracy?: number | null
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

type MapLayer = 'roadmap' | 'satellite' | 'terrain' | 'hybrid'

function MapLayerControl({ activeLayer, onLayerChange }: { activeLayer: MapLayer; onLayerChange: (l: MapLayer) => void }) {
  const [isOpen, setIsOpen] = useState(false)

  const layers: { key: MapLayer; label: string; icon: typeof Layers }[] = [
    { key: 'roadmap', label: 'Street View', icon: MapIcon },
    { key: 'satellite', label: 'Satellite', icon: Satellite },
    { key: 'terrain', label: 'Terrain', icon: Mountain },
    { key: 'hybrid', label: 'Hybrid', icon: Layers },
  ]

  return (
    <MapControl position={ControlPosition.TOP_RIGHT}>
      <div className="relative m-3">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-600"
          title="Map Layers"
        >
          <Layers className="w-5 h-5 text-gray-700 dark:text-gray-200" />
        </button>
        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 shadow-xl rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden z-50">
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
              <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Map Layers</p>
            </div>
            {layers.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => { onLayerChange(key); setIsOpen(false) }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors ${
                  activeLayer === key
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {activeLayer === key && <span className="ml-auto text-blue-500 text-xs">&#10003;</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </MapControl>
  )
}

function UserMarker({ marker, onClick }: { marker: MapMarker; onClick: () => void }) {
  const hasPhoto = marker.profileImage && marker.profileImage.length > 0
  const photoUrl = hasPhoto
    ? (marker.profileImage!.startsWith('http') ? marker.profileImage! : apiUrl(marker.profileImage!))
    : null

  return (
    <AdvancedMarker
      position={{ lat: marker.latitude, lng: marker.longitude }}
      onClick={onClick}
    >
      <div className="relative cursor-pointer group" style={{ transform: 'translate(-50%, -100%)' }}>
        {hasPhoto && photoUrl ? (
          <div className={`w-10 h-10 rounded-full border-3 shadow-lg overflow-hidden ${
            marker.online ? 'border-green-500' : 'border-gray-400'
          }`}>
            <img src={photoUrl} alt={marker.name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50% 50% 50% 0',
              transform: 'rotate(-45deg)',
              background: marker.online ? '#16a34a' : '#64748b',
              border: '3px solid white',
              boxShadow: marker.online
                ? '0 2px 8px rgba(22,163,74,0.5)'
                : '0 2px 6px rgba(100,116,139,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <User className="w-3.5 h-3.5 text-white" style={{ transform: 'rotate(45deg)' }} />
          </div>
        )}
        {marker.online && (
          <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white shadow-sm animate-pulse" />
        )}
      </div>
    </AdvancedMarker>
  )
}

function OfficeMarker({ marker, onClick }: { marker: MapMarker; onClick: () => void }) {
  return (
    <AdvancedMarker
      position={{ lat: marker.latitude, lng: marker.longitude }}
      onClick={onClick}
    >
      <div style={{ transform: 'translate(-50%, -50%)' }} className="cursor-pointer">
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 6,
            background: '#0369a1',
            border: '2.5px solid white',
            boxShadow: '0 2px 8px rgba(3,105,161,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 800,
            fontSize: 14,
          }}
        >
          ★
        </div>
      </div>
    </AdvancedMarker>
  )
}

export default function LiveMap({
  markers,
  center,
  zoom = 11,
  onMarkerClick,
  showDistanceFrom,
}: {
  markers: MapMarker[]
  center: [number, number]
  zoom?: number
  onMarkerClick?: (m: MapMarker) => void
  showDistanceFrom?: { latitude: number; longitude: number } | null
}) {
  const [activeLayer, setActiveLayer] = useState<MapLayer>('roadmap')
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null)
  const [selectedUserPos, setSelectedUserPos] = useState<{ lat: number; lng: number } | null>(null)

  const handleMarkerClick = useCallback((marker: MapMarker) => {
    setSelectedMarker(marker)
    setSelectedUserPos({ lat: marker.latitude, lng: marker.longitude })
    onMarkerClick?.(marker)
  }, [onMarkerClick])

  const openInGoogleMaps = useCallback((marker: MapMarker) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${marker.latitude},${marker.longitude}&travelmode=driving`
    window.open(url, '_blank')
  }, [])

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="w-full h-full min-h-[420px] rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center gap-4 p-6">
        <Satellite className="w-12 h-12 text-gray-400" />
        <div className="text-center">
          <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Google Maps API Key Required</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Set <code className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-[11px]">VITE_GOOGLE_MAPS_API_KEY</code> in your .env file
          </p>
        </div>
        {/* Fallback: simple centered list */}
        <div className="w-full max-w-md space-y-2 mt-4">
          {markers.slice(0, 5).map((m) => (
            <button
              key={m.id}
              onClick={() => handleMarkerClick(m)}
              className="w-full flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
            >
              {m.profileImage ? (
                <img src={m.profileImage.startsWith('http') ? m.profileImage : apiUrl(m.profileImage)} alt={m.name} className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${m.online ? 'bg-green-500' : 'bg-gray-400'}`}>
                  {m.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">{m.name}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{m.latitude.toFixed(5)}, {m.longitude.toFixed(5)}</p>
              </div>
              {m.online && <span className="w-2 h-2 bg-green-500 rounded-full shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <div className="w-full h-full min-h-[420px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 relative">
        <Map
          defaultCenter={{ lat: center[0], lng: center[1] }}
          defaultZoom={zoom}
          mapId="bsc-live-tracking"
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapTypeControl={false}
          streetViewControl={true}
          fullscreenControl={true}
          zoomControl={true}
          style={{ width: '100%', height: '100%' }}
        >
          <MapLayerControl activeLayer={activeLayer} onLayerChange={setActiveLayer} />

          {markers.map((m) =>
            m.kind === 'office' ? (
              <OfficeMarker key={m.id} marker={m} onClick={() => handleMarkerClick(m)} />
            ) : (
              <UserMarker key={m.id} marker={m} onClick={() => handleMarkerClick(m)} />
            )
          )}

          {selectedMarker && (
            <InfoWindow
              position={{ lat: selectedMarker.latitude, lng: selectedMarker.longitude }}
              onCloseClick={() => { setSelectedMarker(null); setSelectedUserPos(null) }}
            >
              <div className="min-w-[220px] p-1" style={{ fontFamily: 'Inter, sans-serif' }}>
                <div className="flex items-start gap-3">
                  {selectedMarker.profileImage ? (
                    <img
                      src={selectedMarker.profileImage.startsWith('http') ? selectedMarker.profileImage : apiUrl(selectedMarker.profileImage)}
                      alt={selectedMarker.name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-md"
                    />
                  ) : (
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold ${
                      selectedMarker.online ? 'bg-green-500' : selectedMarker.kind === 'office' ? 'bg-sky-700' : 'bg-gray-400'
                    }`}>
                      {selectedMarker.kind === 'office' ? '★' : selectedMarker.name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{selectedMarker.name}</p>
                    {selectedMarker.employeeCode && (
                      <p className="text-[11px] text-gray-500">{selectedMarker.employeeCode}</p>
                    )}
                    {selectedMarker.role && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                        {selectedMarker.role}
                      </span>
                    )}
                    {selectedMarker.departmentName && (
                      <p className="text-[10px] text-gray-500 mt-1">{selectedMarker.departmentName}</p>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 text-[11px]">
                  <p className="text-gray-500 font-mono">
                    {selectedMarker.latitude.toFixed(6)}, {selectedMarker.longitude.toFixed(6)}
                  </p>
                  {selectedMarker.online ? (
                    <p className="text-green-600 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> Online — GPS live
                    </p>
                  ) : (
                    <p className="text-gray-400">Offline</p>
                  )}
                  {selectedMarker.batteryLevel !== null && selectedMarker.batteryLevel !== undefined && (
                    <p className="text-gray-500">Battery: {Math.round(selectedMarker.batteryLevel)}%</p>
                  )}
                  {selectedMarker.accuracy !== null && selectedMarker.accuracy !== undefined && (
                    <p className="text-gray-500">Accuracy: ±{Math.round(selectedMarker.accuracy)} m</p>
                  )}
                  {selectedMarker.address && (
                    <p className="text-gray-600 text-[10px]">{selectedMarker.address}</p>
                  )}
                  {showDistanceFrom && selectedMarker.kind !== 'office' && (
                    <p className="text-sky-600 font-bold">
                      Distance: {formatDistance(
                        haversineDistance(
                          showDistanceFrom.latitude,
                          showDistanceFrom.longitude,
                          selectedMarker.latitude,
                          selectedMarker.longitude
                        )
                      )}
                    </p>
                  )}
                </div>

                {selectedMarker.kind !== 'office' && (
                  <button
                    onClick={() => openInGoogleMaps(selectedMarker)}
                    className="mt-3 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded-lg transition-colors"
                  >
                    <Navigation className="w-3.5 h-3.5" /> Navigate in Google Maps
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            </InfoWindow>
          )}
        </Map>
      </div>
    </APIProvider>
  )
}
