import {
  AlertOctagon,
  BarChart3,
  Bell,
  BusFront,
  CalendarClock,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Clock,
  DollarSign,
  Fuel,
  Gauge,
  HeartPulse,
  Home,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Map,
  MessageSquare,
  Package,
  Settings,
  ShieldCheck,
  TrendingUp,
  User,
  Users,
  Wrench,
  Accessibility,
  FileSpreadsheet,
  Signature,
  type LucideIcon,
} from "lucide-react";
import type { Capability } from "@/lib/auth/permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  capability: Capability;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const OFFICE_NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, capability: "dashboard" }],
  },
  {
    label: "Operations",
    items: [
      { href: "/board", label: "Dispatch board", icon: Gauge, capability: "board" },
      { href: "/map", label: "Live map", icon: Map, capability: "map" },
      { href: "/sign-in-sheet", label: "Sign-in sheet", icon: Signature, capability: "signInSheet" },
      { href: "/assists", label: "Assist requests", icon: Accessibility, capability: "assists" },
      { href: "/compliance", label: "Breaks & compliance", icon: ClipboardCheck, capability: "compliance" },
      { href: "/emergency", label: "Emergency", icon: AlertOctagon, capability: "emergencyView" },
      { href: "/chat", label: "Chat", icon: MessageSquare, capability: "chat" },
    ],
  },
  {
    label: "Fleet",
    items: [
      { href: "/fleet", label: "Vehicles", icon: BusFront, capability: "fleet" },
      { href: "/fleet/readiness", label: "Readiness", icon: Gauge, capability: "readiness" },
      { href: "/fleet/inspections", label: "Inspections", icon: ListChecks, capability: "inspections" },
      { href: "/fleet/defects", label: "Defects", icon: Wrench, capability: "defects" },
      { href: "/fleet/fuel", label: "Fuel log", icon: Fuel, capability: "fuelLog" },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/people", label: "Employees", icon: Users, capability: "people" },
      { href: "/timesheets", label: "Timesheets", icon: Clock, capability: "timesheets" },
      { href: "/forms", label: "Requests", icon: Inbox, capability: "forms" },
      { href: "/safety", label: "Safety meetings", icon: ShieldCheck, capability: "safety" },
      { href: "/performance", label: "Performance", icon: TrendingUp, capability: "performance" },
      { href: "/fatigue", label: "Fatigue", icon: HeartPulse, capability: "fatigue" },
    ],
  },
  {
    label: "Scheduling",
    items: [
      { href: "/bids", label: "Shift bids", icon: CalendarRange, capability: "bids" },
      { href: "/overtime", label: "Overtime", icon: CalendarClock, capability: "overtime" },
    ],
  },
  {
    label: "Pay",
    items: [{ href: "/payroll", label: "Payroll", icon: DollarSign, capability: "payroll" }],
  },
  {
    label: "Records",
    items: [
      { href: "/counts", label: "Counting sheets", icon: FileSpreadsheet, capability: "counts" },
      { href: "/lost-found", label: "Lost & found", icon: Package, capability: "lostFound" },
      { href: "/reports", label: "Reports", icon: BarChart3, capability: "reports" },
      { href: "/notifications", label: "Notifications log", icon: Bell, capability: "notificationsLog" },
    ],
  },
  {
    label: "Admin",
    items: [{ href: "/settings", label: "Settings", icon: Settings, capability: "settings" }],
  },
];

export interface FieldTab {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const FIELD_TABS: FieldTab[] = [
  { href: "/m", label: "Home", icon: Home },
  { href: "/m/requests", label: "Requests", icon: ClipboardList },
  { href: "/m/chat", label: "Chat", icon: MessageSquare },
  { href: "/m/me", label: "Me", icon: User },
];
