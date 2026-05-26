'use client'

import { useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
} from '@vis.gl/react-google-maps'
import {
  calcETA,
  getTerminalCongestion,
  isPositionStale,
  minutesSinceLastPosition,
  type PositionSample,
} from '@/lib/gps-utils'
import { TERMINALS, MAP_CENTER, MAP_DEFAULT_ZOOM } from '@/lib/terminals'

interface BusPosition {
  id: string
  bus_id: string
  driver_id: string | null
  shift_id: string | null
  latitude: number
  longitude: number
  speed: number | null
  heading: number | null
  recorded_at: string
}

interface ActiveBus {
  bus_id: string
  bus_number: string
  bus_type: string
  driver_name: string
  shift_id: string
  position: BusPosition | null
}

interface Props {
  initialBuses: ActiveBus[]
  apiKey: string | null
}

const CONGESTION_COLOR = { green: '#22c55e', yellow: '#facc15', red: '#ef4444' }

export default function MapClient({ initialBuses, apiKey }: Props) {
  const [buses, setBuses] = useState<ActiveBus[]>(initialBuses)
  const [selected, setSelected] = useState<ActiveBus | null>(null)
  const positionHistoryRef = useRef<Record<string, BusPosition[]>>({})

  // Seed history from initial data
  useEffect(() => {
    initialBuses.forEach(b => {
      if (b.position) positionHistoryRef.current[b.bus_id] = [b.position]
    })
  }, [initialBuses])

  // Realtime subscription to bus_positions
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const channel = supabase
      .channel('map-positions')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bus_positions' },
        (payload) => {
          const pos = payload.new as BusPosition
          // Update position history (keep last 5 samples for ETA rolling avg)
          const hist = positionHistoryRef.current[pos.bus_id] ?? []
          positionHistoryRef.current[pos.bus_id] = [pos, ...hist].slice(0, 5)

          setBuses(prev => prev.map(b =>
            b.bus_id === pos.bus_id ? { ...b, position: pos } : b
          ))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  if (!apiKey) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-950 text-center p-8">
        <div>
          <p className="text-yellow-400 font-semibold text-lg mb-2">Google Maps API key not configured</p>
          <p className="text-gray-400 text-sm">
            Add <code className="bg-gray-800 px-1 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to your{' '}
            <code className="bg-gray-800 px-1 rounded">.env.local</code> file to enable the live map.
          </p>
        </div>
      </div>
    )
  }

  const congestion = TERMINALS.map(t => {
    const latestPositions = buses
      .filter(b => b.position)
      .map(b => ({ bus_id: b.bus_id, lat: b.position!.latitude, lng: b.position!.longitude, recorded_at: b.position!.recorded_at }))
    return { terminal: t, level: getTerminalCongestion(latestPositions, t) }
  })

  const activeBuses = buses.filter(b => b.position)
  const staleBuses = buses.filter(b => b.position && isPositionStale(b.position.recorded_at))

  return (
    <div className="flex flex-col h-full">
      {/* Terminal congestion row */}
      <div className="flex gap-3 px-4 py-2 bg-gray-900 border-b border-gray-800 flex-wrap">
        {congestion.map(({ terminal, level }) => (
          <div key={terminal.id} className="flex items-center gap-1.5 text-sm">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: CONGESTION_COLOR[level] }}
            />
            <span className="text-gray-300">{terminal.name}</span>
            <span className="text-gray-500 capitalize text-xs">{level}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-4 text-xs text-gray-500">
          <span>{activeBuses.length} buses online</span>
          {staleBuses.length > 0 && (
            <span className="text-red-400">{staleBuses.length} GPS lost</span>
          )}
        </div>
      </div>

      {/* Map + side panel */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1">
          <APIProvider apiKey={apiKey}>
            <Map
              mapId="dispatch-map"
              defaultCenter={MAP_CENTER}
              defaultZoom={MAP_DEFAULT_ZOOM}
              style={{ width: '100%', height: '100%' }}
              colorScheme="DARK"
            >
              {/* Terminal markers */}
              {TERMINALS.map(t => (
                <AdvancedMarker key={t.id} position={{ lat: t.lat, lng: t.lng }}>
                  <div className="bg-blue-900 border border-blue-500 text-blue-200 text-xs font-bold px-2 py-0.5 rounded shadow-lg">
                    {t.code}
                  </div>
                </AdvancedMarker>
              ))}

              {/* Bus markers */}
              {buses.map(bus => {
                if (!bus.position) return null
                const stale = isPositionStale(bus.position.recorded_at)
                return (
                  <AdvancedMarker
                    key={bus.bus_id}
                    position={{ lat: bus.position.latitude, lng: bus.position.longitude }}
                    onClick={() => setSelected(bus)}
                  >
                    <div className={`flex flex-col items-center cursor-pointer`}>
                      <div className={`text-xs font-bold px-2 py-0.5 rounded shadow-lg border ${
                        stale
                          ? 'bg-red-900 border-red-600 text-red-200'
                          : 'bg-gray-900 border-gray-600 text-white'
                      }`}>
                        #{bus.bus_number}
                        {stale && <span className="ml-1 text-red-400">⚠</span>}
                      </div>
                      <Pin
                        background={stale ? '#7f1d1d' : '#1e3a5f'}
                        glyphColor={stale ? '#fca5a5' : '#93c5fd'}
                        borderColor={stale ? '#ef4444' : '#3b82f6'}
                      />
                    </div>
                  </AdvancedMarker>
                )
              })}

              {/* InfoWindow for selected bus */}
              {selected && selected.position && (
                <InfoWindow
                  position={{ lat: selected.position.latitude, lng: selected.position.longitude }}
                  onCloseClick={() => setSelected(null)}
                >
                  <div className="text-gray-900 text-sm min-w-48">
                    <p className="font-bold text-base">Bus #{selected.bus_number}</p>
                    <p className="text-gray-600">{selected.driver_name}</p>
                    <hr className="my-1" />
                    <p>Speed: {selected.position.speed != null ? `${selected.position.speed.toFixed(0)} km/h` : 'N/A'}</p>
                    <p>Heading: {selected.position.heading != null ? `${selected.position.heading.toFixed(0)}°` : 'N/A'}</p>
                    <hr className="my-1" />
                    <p className="font-semibold text-xs uppercase tracking-wide text-gray-500 mt-1">ETA to terminals</p>
                    {TERMINALS.map(t => {
                      const history = positionHistoryRef.current[selected.bus_id] ?? []
                      const samples: PositionSample[] = history.map(p => ({
                        lat: p.latitude, lng: p.longitude, recorded_at: p.recorded_at, speed: p.speed,
                      }))
                      const eta = calcETA(samples, t)
                      return (
                        <p key={t.id} className="text-xs">{t.name}: {eta != null ? `~${eta} min` : '—'}</p>
                      )
                    })}
                    <p className="text-xs text-gray-500 mt-1">
                      {isPositionStale(selected.position.recorded_at)
                        ? `GPS lost ${minutesSinceLastPosition(selected.position.recorded_at)} min ago`
                        : `Updated ${minutesSinceLastPosition(selected.position.recorded_at)} min ago`}
                    </p>
                  </div>
                </InfoWindow>
              )}
            </Map>
          </APIProvider>
        </div>

        {/* Bus list sidebar */}
        <div className="w-64 bg-gray-900 border-l border-gray-800 overflow-y-auto p-3 space-y-2">
          <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-3">Active Buses</p>
          {buses.length === 0 && (
            <p className="text-gray-600 text-sm">No active shifts with GPS data.</p>
          )}
          {buses.map(bus => {
            const stale = bus.position ? isPositionStale(bus.position.recorded_at) : false
            return (
              <button
                key={bus.bus_id}
                onClick={() => setSelected(bus)}
                className={`w-full text-left rounded-lg p-2.5 border transition-colors ${
                  selected?.bus_id === bus.bus_id
                    ? 'border-blue-600 bg-blue-950/30'
                    : 'border-gray-800 bg-gray-900 hover:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">#{bus.bus_number}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    bus.bus_type === 'EV' ? 'bg-teal-900 text-teal-300' : 'bg-gray-800 text-gray-400'
                  }`}>{bus.bus_type}</span>
                </div>
                <p className="text-gray-400 text-xs truncate">{bus.driver_name}</p>
                {bus.position ? (
                  <p className={`text-xs mt-0.5 ${stale ? 'text-red-400' : 'text-green-400'}`}>
                    {stale ? `GPS lost ${minutesSinceLastPosition(bus.position.recorded_at)}m ago` : 'Live'}
                  </p>
                ) : (
                  <p className="text-xs text-gray-600 mt-0.5">No GPS data</p>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
