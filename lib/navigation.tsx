import type { LucideIcon } from 'lucide-react'
import {
  Users,
  CalendarClock,
  Clock3,
  Inbox,
  ShieldCheck,
  Bus,
  Gauge,
  Map,
  ClipboardCheck,
  Hash,
  ClipboardList,
  PackageSearch,
  Plane,
  Wallet,
  BarChart3,
  Activity,
  BatteryWarning,
  MessageSquare,
  Bell,
  Siren,
  SlidersHorizontal,
  MonitorPlay,
  LayoutDashboard,
  Wrench,
  Fuel,
  Accessibility,
  ListChecks,
  FileText,
  CalendarRange,
  TrendingUp,
  Scale,
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  /** Opens a separate full-screen context (e.g. the wall board) */
  external?: boolean
  /** Extra search terms for the command palette */
  keywords?: string
  /** Short description shown in the command palette */
  description?: string
  /** Render with an alert accent (emergency / hazard) */
  alert?: boolean
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

// ─── Admin / Management — the full 21-section console ────────────────────────
// Ordered by daily relevance: people & approvals first, fleet ops next,
// time & pay, then comms and rarely-touched system config.
export const ADMIN_NAV: NavGroup[] = [
  {
    label: 'People & Scheduling',
    items: [
      { label: 'Employees', href: '/admin/employees', icon: Users, keywords: 'roster directory staff hire seniority', description: 'Directory, roles & leave balances' },
      { label: 'Forms', href: '/admin/forms', icon: Inbox, keywords: 'time off pto leave incident fmla resignation approvals', description: 'Review & approve submissions' },
      { label: 'Shift Bids', href: '/admin/bids', icon: CalendarClock, keywords: 'bidding cycle seniority award slots', description: 'Bid cycles & seniority awards' },
      { label: 'Overtime', href: '/admin/overtime', icon: Clock3, keywords: 'ot extra hours off-day banner', description: 'OT shifts, awards & banner' },
      { label: 'Safety Meetings', href: '/admin/safety-meetings', icon: ShieldCheck, keywords: 'meeting attendance training', description: 'Schedule & track attendance' },
    ],
  },
  {
    label: 'Fleet & Operations',
    items: [
      { label: 'Fleet', href: '/admin/buses', icon: Bus, keywords: 'buses vehicles ev diesel tablets', description: 'Bus & tablet management' },
      { label: 'Fleet Status', href: '/admin/fleet-readiness', icon: Gauge, keywords: 'readiness availability oos charging fuel queue', description: 'Readiness & availability' },
      { label: 'Live Map', href: '/admin/map', icon: Map, keywords: 'gps tracking location route', description: 'Real-time GPS positions' },
      { label: 'Inspections', href: '/admin/inspections', icon: ClipboardCheck, keywords: 'pre-trip post-trip dvir defects damage', description: 'Pre/post-trip review' },
      { label: 'Counting Sheets', href: '/admin/counting-sheets', icon: Hash, keywords: 'passenger counts trips terminals', description: 'Passenger count review' },
      { label: 'Sign-In Sheets', href: '/admin/sign-in-sheets', icon: ClipboardList, keywords: 'roster attendance daily', description: 'Daily roster by date' },
      { label: 'Lost & Found', href: '/admin/lost-found', icon: PackageSearch, keywords: 'items returned claimed', description: 'Lost item lifecycle' },
      { label: 'Airlines', href: '/admin/airlines', icon: Plane, keywords: 'directory terminal wheelchair contact', description: 'LAS airline directory' },
    ],
  },
  {
    label: 'Time & Pay',
    items: [
      { label: 'Payroll', href: '/admin/payroll', icon: Wallet, keywords: 'pay periods hours regular overtime export', description: 'Pay periods & hours' },
      { label: 'Reports', href: '/admin/reports', icon: BarChart3, keywords: 'hours overtime forms safety bids export csv', description: 'Exportable operational reports' },
      { label: 'Performance', href: '/admin/performance', icon: Activity, keywords: 'metrics driver attendance snapshots', description: '90-day driver metrics' },
      { label: 'Fatigue', href: '/admin/fatigue', icon: BatteryWarning, keywords: 'alerts hours consecutive days safety', description: 'Fatigue alerts' },
    ],
  },
  {
    label: 'Communications',
    items: [
      { label: 'Chat', href: '/chat', icon: MessageSquare, keywords: 'messages rooms confirm', description: 'Internal messaging' },
      { label: 'Notifications', href: '/admin/notifications', icon: Bell, keywords: 'audit log email in-app', description: 'Notification audit log' },
      { label: 'Emergency', href: '/admin/emergency', icon: Siren, alert: true, keywords: 'broadcast alert fleet weather', description: 'Fleet-wide broadcast' },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Rules & Config', href: '/admin/settings', icon: SlidersHorizontal, keywords: 'settings break overtime rules', description: 'Break & overtime rules' },
    ],
  },
  {
    label: 'Displays',
    items: [
      { label: 'Dispatch Board', href: '/board', icon: MonitorPlay, external: true, keywords: 'wall display kanban', description: 'Wall-mounted board' },
    ],
  },
]

// ─── Dispatcher console ──────────────────────────────────────────────────────
export const DISPATCHER_NAV: NavGroup[] = [
  {
    label: 'Operations',
    items: [
      { label: 'Dashboard', href: '/dispatcher', icon: LayoutDashboard, keywords: 'active drivers breaks alerts', description: 'Active drivers & break alerts' },
      { label: 'Sign-In Sheet', href: '/dispatcher/sign-in', icon: ClipboardList, keywords: 'sign in driver bus tablet signature', description: 'Sign a driver in' },
      { label: 'Overtime', href: '/dispatcher/overtime', icon: Clock3, keywords: 'ot shifts off-day banner', description: 'OT shifts & off-day requests' },
    ],
  },
  {
    label: 'Displays',
    items: [
      { label: 'Dispatch Board', href: '/board', icon: MonitorPlay, external: true, keywords: 'wall display kanban', description: 'Wall-mounted board' },
      { label: 'Chat', href: '/chat', icon: MessageSquare, keywords: 'messages rooms', description: 'Internal messaging' },
    ],
  },
]

// ─── Coordinator / Supervisor (read-mostly monitoring) ───────────────────────
const COORDINATOR_BASE: NavGroup[] = [
  {
    label: 'Monitor',
    items: [
      { label: 'Overview', href: '/coordinator', icon: LayoutDashboard, keywords: 'active drivers breaks compliance verdicts', description: 'Roster, breaks & compliance' },
    ],
  },
]

const SUPERVISOR_EXTRA: NavGroup = {
  label: 'Displays',
  items: [
    { label: 'Dispatch Board', href: '/board', icon: MonitorPlay, external: true, description: 'Wall-mounted board' },
    { label: 'Chat', href: '/chat', icon: MessageSquare, description: 'Internal messaging' },
  ],
}

// ─── Technician ──────────────────────────────────────────────────────────────
export const TECHNICIAN_NAV: NavGroup[] = [
  {
    label: 'Maintenance',
    items: [
      { label: 'Open Defects', href: '/technician', icon: Wrench, keywords: 'repairs dvir resolve bus shop', description: 'Defect repair queue' },
    ],
  },
]

// ─── Payroll role (subset of admin) ──────────────────────────────────────────
export const PAYROLL_NAV: NavGroup[] = [
  {
    label: 'Time & Pay',
    items: [
      { label: 'Payroll', href: '/admin/payroll', icon: Wallet, description: 'Pay periods & hours' },
      { label: 'Reports', href: '/admin/reports', icon: BarChart3, description: 'Exportable reports' },
    ],
  },
]

/** Resolve the office sidebar groups for a given role. */
export function getOfficeNav(role: string): NavGroup[] {
  switch (role) {
    case 'admin':
    case 'management':
      return ADMIN_NAV
    case 'dispatcher':
      return DISPATCHER_NAV
    case 'supervisor':
      return [...COORDINATOR_BASE, SUPERVISOR_EXTRA]
    case 'coordinator':
      return COORDINATOR_BASE
    case 'technician':
      return TECHNICIAN_NAV
    case 'payroll':
      return PAYROLL_NAV
    default:
      return COORDINATOR_BASE
  }
}

// ─── Driver field app ─────────────────────────────────────────────────────────
// "My Shift" items surface as big dashboard tiles AND in the drawer; "More"
// items live only in the drawer.
export const DRIVER_PRIMARY: NavItem[] = [
  { label: 'Counting Sheet', href: '/driver/counting-sheet', icon: Hash, description: 'Log passenger counts' },
  { label: 'Pre-Trip', href: '/driver/inspection/pre_trip', icon: ClipboardCheck, description: 'Pre-trip inspection' },
  { label: 'Post-Trip', href: '/driver/inspection/post_trip', icon: ListChecks, description: 'Post-trip inspection' },
  { label: '10-51 Wheelchair', href: '/driver/10-51', icon: Accessibility, alert: true, description: 'Request wheelchair assist' },
  { label: 'End of Shift', href: '/driver/end-of-shift', icon: BatteryWarning, alert: true, description: 'Close out your shift' },
]

export const DRIVER_MORE: NavItem[] = [
  { label: 'Forms', href: '/driver/forms', icon: FileText, description: 'Time-off, incident & more' },
  { label: 'Lost & Found', href: '/driver/lost-found', icon: PackageSearch, description: 'Report a found item' },
  { label: 'Shift Bids', href: '/driver/bids', icon: CalendarRange, description: 'Bid on shifts' },
  { label: 'Overtime', href: '/driver/overtime', icon: Clock3, description: 'Off-day & OT requests' },
  { label: 'Safety Meetings', href: '/driver/safety-meetings', icon: ShieldCheck, description: 'Upcoming & past meetings' },
  { label: 'Performance', href: '/driver/performance', icon: TrendingUp, description: 'Your 90-day metrics' },
  { label: 'My Balances', href: '/balances', icon: Scale, description: 'PTO, vacation & seniority' },
]

export const DRIVER_NAV: NavGroup[] = [
  { label: 'My Dashboard', items: [{ label: 'Dashboard', href: '/driver', icon: LayoutDashboard, description: 'Shift, radio & breaks' }] },
  { label: 'My Shift', items: DRIVER_PRIMARY },
  { label: 'More', items: DRIVER_MORE },
]

// ─── Fueler / Washer field app ────────────────────────────────────────────────
export const FUELER_NAV: NavGroup[] = [
  { label: 'Station', items: [{ label: 'Service Queue', href: '/fueler', icon: Fuel, description: 'Fuel & wash queue' }] },
  {
    label: 'More',
    items: [
      { label: 'Forms', href: '/driver/forms', icon: FileText, description: 'Submit a form' },
      { label: 'Safety Meetings', href: '/driver/safety-meetings', icon: ShieldCheck, description: 'Meetings & attendance' },
      { label: 'Lost & Found', href: '/driver/lost-found', icon: PackageSearch, description: 'Report a found item' },
    ],
  },
]

/** Human label for a role, used in shell headers. */
export const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin Console',
  management: 'Management',
  dispatcher: 'Dispatch',
  coordinator: 'Coordinator',
  supervisor: 'Supervisor',
  technician: 'Maintenance',
  fueler_washer: 'Fuel & Wash',
  payroll: 'Payroll',
  driver: 'Driver',
}
