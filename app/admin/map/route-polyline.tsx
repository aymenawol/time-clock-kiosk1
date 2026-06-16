'use client'

import { useEffect } from 'react'
import { useMap } from '@vis.gl/react-google-maps'

/**
 * N9 — draws a bus's recent GPS trail as a polyline on the map. @vis.gl exposes
 * no Polyline component, so we manage a google.maps.Polyline imperatively via
 * the shared map instance and tear it down on unmount / path change.
 */
export default function RoutePolyline({
  path,
  color = '#3b82f6',
}: {
  path: { lat: number; lng: number }[]
  color?: string
}) {
  const map = useMap()

  useEffect(() => {
    if (!map || path.length < 2) return
    // google is available once <Map> has loaded the API. Typed locally so the
    // build does not depend on the ambient `google` namespace being resolvable
    // (it ships only as a transitive type dep of @vis.gl/react-google-maps).
    const g = (window as unknown as { google?: GoogleMapsApi }).google
    if (!g?.maps) return

    const line = new g.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: color,
      strokeOpacity: 0.8,
      strokeWeight: 4,
      map,
    })
    return () => line.setMap(null)
  }, [map, path, color])

  return null
}

/** Minimal shape of the google.maps.Polyline surface this component uses. */
interface GoogleMapsApi {
  maps: {
    Polyline: new (opts: {
      path: { lat: number; lng: number }[]
      geodesic?: boolean
      strokeColor?: string
      strokeOpacity?: number
      strokeWeight?: number
      map?: unknown
    }) => { setMap: (map: unknown) => void }
  }
}
