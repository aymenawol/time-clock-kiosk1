// Harry Reid International Airport (LAS) terminal coordinates
// Used for ETA calculations and congestion detection

export interface Terminal {
  id: string
  code: string
  name: string
  lat: number
  lng: number
  radiusMeters: number
}

export const TERMINALS: Terminal[] = [
  { id: 't1',  code: 'T1',  name: 'Terminal 1',          lat: 36.0840, lng: -115.1537, radiusMeters: 200 },
  { id: 't3w', code: 'T3W', name: 'Terminal 3 West',     lat: 36.0797, lng: -115.1480, radiusMeters: 200 },
  { id: 't3e', code: 'T3E', name: 'Terminal 3 East',     lat: 36.0797, lng: -115.1450, radiusMeters: 200 },
  { id: 'rac', code: 'RAC', name: 'Rental Car Center',   lat: 36.0880, lng: -115.1480, radiusMeters: 200 },
]

/** Map center for the GPS live map */
export const MAP_CENTER = { lat: 36.0840, lng: -115.1537 }
export const MAP_DEFAULT_ZOOM = 14
