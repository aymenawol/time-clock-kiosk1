// Single source of truth for driver radio codes (shown on driver tablet +
// dispatcher/board/coordinator/supervisor dashboards).

export interface RadioCode {
  code: string
  label: string
  /** Tailwind button classes for the driver tablet */
  buttonClass: string
}

export const RADIO_CODES: RadioCode[] = [
  { code: '10-8',  label: 'In Service',    buttonClass: 'bg-green-700 hover:bg-green-600 border-green-600' },
  { code: '10-39', label: 'On Break',      buttonClass: 'bg-yellow-700 hover:bg-yellow-600 border-yellow-600' },
  { code: '10-37', label: 'Fueling/Wash',  buttonClass: 'bg-blue-700 hover:bg-blue-600 border-blue-600' },
  { code: '10-7',  label: 'Out of Service', buttonClass: 'bg-red-700 hover:bg-red-600 border-red-600' },
]

// Includes codes that can appear on the board but aren't driver buttons.
export const RADIO_LABEL: Record<string, string> = {
  '10-8':  'In Service',
  '10-39': 'On Break',
  '10-37': 'Fueling/Wash',
  '10-7':  'OOS',
  '10-51': 'Assist Needed',
  '10-33': 'HAZARD',
}
