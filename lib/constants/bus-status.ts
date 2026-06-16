import type { BusStatus } from '@/lib/supabase'

// Single source of truth for the bus-status vocabulary. The DB CHECK enum is
// the authority; this mirrors it. Replaces the divergent per-component maps
// (some of which used non-existent statuses like 'available'/'fueling' and
// silently fell through to gray, producing wrong counts).

export const BUS_STATUSES: BusStatus[] = [
  'ready', 'in_service', 'charging', 'fuel', 'wash', 'fuel_wash',
  'maintenance_pmi', 'shopped_dvir', 'maintenance_repair',
  'safety_hold', 'salvage', 'training',
]

export const BUS_STATUS_LABEL: Record<BusStatus, string> = {
  ready:              'Ready',
  in_service:         'In Service',
  charging:           'Charging',
  fuel:               'Fuel',
  wash:               'Wash',
  fuel_wash:          'Fuel + Wash',
  maintenance_pmi:    'Maintenance (PMI)',
  shopped_dvir:       'Shopped (DVIR)',
  maintenance_repair: 'Repair',
  safety_hold:        'Safety Hold',
  salvage:            'Salvage',
  training:           'Training',
}

// border + bg + text triplet. Semantic: green=ready, blue=in service,
// teal/amber/cyan=charge/fuel/wash, red=shop, purple=hazard hold, gray=salvage.
export const BUS_STATUS_COLOR: Record<BusStatus, string> = {
  ready:              'bg-green-900/30 text-green-400 border-green-800',
  in_service:         'bg-blue-900/30 text-blue-400 border-blue-800',
  charging:           'bg-teal-900/30 text-teal-400 border-teal-800',
  fuel:               'bg-amber-900/30 text-amber-400 border-amber-800',
  wash:               'bg-cyan-900/30 text-cyan-400 border-cyan-800',
  fuel_wash:          'bg-amber-900/30 text-amber-400 border-amber-800',
  maintenance_pmi:    'bg-red-900/30 text-red-400 border-red-800',
  shopped_dvir:       'bg-red-900/30 text-red-400 border-red-800',
  maintenance_repair: 'bg-red-900/30 text-red-400 border-red-800',
  safety_hold:        'bg-purple-900/30 text-purple-400 border-purple-800',
  salvage:            'bg-gray-800/40 text-gray-400 border-gray-700',
  training:           'bg-indigo-900/30 text-indigo-400 border-indigo-800',
}

// Operational groupings used by dashboards.
export const AVAILABLE_STATUSES: BusStatus[] = ['ready']
export const SHOP_STATUSES: BusStatus[]      = ['shopped_dvir', 'maintenance_repair', 'maintenance_pmi']
export const OOS_STATUSES: BusStatus[]       = ['shopped_dvir', 'maintenance_repair', 'maintenance_pmi', 'safety_hold', 'salvage']

export function busStatusLabel(status: string): string {
  return (BUS_STATUS_LABEL as Record<string, string>)[status] ?? status
}

export function busStatusColor(status: string): string {
  return (BUS_STATUS_COLOR as Record<string, string>)[status] ?? 'bg-gray-800/40 text-gray-400 border-gray-700'
}
