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

// border + bg + text triplet, using the semantic operational ramps so the pills
// read correctly in light AND dark. ok=ready, info=in service/training,
// warn=charge/fuel/wash, danger=shop/maintenance, hazard=safety hold, neutral=salvage.
export const BUS_STATUS_COLOR: Record<BusStatus, string> = {
  ready:              'bg-ok-surface text-ok border-ok-border',
  in_service:         'bg-info-surface text-info border-info-border',
  charging:           'bg-warn-surface text-warn border-warn-border',
  fuel:               'bg-warn-surface text-warn border-warn-border',
  wash:               'bg-warn-surface text-warn border-warn-border',
  fuel_wash:          'bg-warn-surface text-warn border-warn-border',
  maintenance_pmi:    'bg-danger-surface text-danger border-danger-border',
  shopped_dvir:       'bg-danger-surface text-danger border-danger-border',
  maintenance_repair: 'bg-danger-surface text-danger border-danger-border',
  safety_hold:        'bg-hazard-surface text-hazard border-hazard-border',
  salvage:            'bg-neutral-surface text-neutral border-neutral-border',
  training:           'bg-info-surface text-info border-info-border',
}

// Operational groupings used by dashboards.
export const AVAILABLE_STATUSES: BusStatus[] = ['ready']
export const SHOP_STATUSES: BusStatus[]      = ['shopped_dvir', 'maintenance_repair', 'maintenance_pmi']
export const OOS_STATUSES: BusStatus[]       = ['shopped_dvir', 'maintenance_repair', 'maintenance_pmi', 'safety_hold', 'salvage']

export function busStatusLabel(status: string): string {
  return (BUS_STATUS_LABEL as Record<string, string>)[status] ?? status
}

export function busStatusColor(status: string): string {
  return (BUS_STATUS_COLOR as Record<string, string>)[status] ?? 'bg-neutral-surface text-neutral border-neutral-border'
}
