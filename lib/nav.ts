import {
  BookOpen,
  Cog,
  FileChartColumn,
  FlaskConical,
  Gauge,
  History,
  SlidersHorizontal,
  Mail,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  icon: LucideIcon;
  label: string;
  sub: string;
  href: string;
  enabled: boolean;
  /** Permission key required to see this link — omitted means visible to
   * every authenticated role (the underlying page is read-accessible to all;
   * any write actions on it are separately gated in the page/component itself).
   * Only set on pages that fully redirect a user away when they lack it. */
  perm?: string;
}

export interface NavSection {
  id: string;
  title: string;
  /** Can be folded away in the sidebar (open/closed is remembered per browser). */
  collapsible?: boolean;
  /** Initial state when the browser has no remembered choice yet. */
  defaultCollapsed?: boolean;
  /** Sits at the bottom of the sidebar, apart from the everyday menu. */
  pinBottom?: boolean;
  icon?: LucideIcon;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "main",
    title: "เมนูหลัก (Main modules)",
    items: [
      { icon: Gauge, label: "ภาพรวมความเสี่ยง", sub: "Dashboard", href: "/dashboard", enabled: true },
      { icon: Cog, label: "ฐานข้อมูลเครื่องจักร", sub: "Asset database", href: "/assets", enabled: true, perm: "assets:read" },
      { icon: FlaskConical, label: "ป้อนข้อมูล", sub: "Data input", href: "/data-entry", enabled: true, perm: "dataentry:read" },
      { icon: BookOpen, label: "คลังมาตรฐาน", sub: "Standards", href: "/standards", enabled: true, perm: "standards:read" },
      { icon: SlidersHorizontal, label: "ตั้งค่าแจ้งเตือน", sub: "Alarm config", href: "/config/alarms", enabled: true, perm: "alarms:read" },
      { icon: FileChartColumn, label: "รายงานผู้บริหาร", sub: "Reports", href: "/reports", enabled: true, perm: "reports:view" },
    ],
  },
  {
    id: "admin",
    title: "ผู้ดูแลระบบ (Admin)",
    icon: ShieldCheck,
    pinBottom: true,
    collapsible: true,
    defaultCollapsed: true,
    items: [
      { icon: Users, label: "จัดการผู้ใช้", sub: "Users", href: "/admin/users", enabled: true, perm: "users:manage" },
      { icon: ShieldCheck, label: "Role และสิทธิ์", sub: "Roles & permissions", href: "/admin/roles", enabled: true, perm: "users:manage" },
      { icon: Mail, label: "ตั้งค่าแจ้งเตือนอีเมล", sub: "Notifications", href: "/admin/notifications", enabled: true, perm: "notifications:manage" },
      { icon: History, label: "Audit Trail", sub: "Audit log", href: "/admin/audit", enabled: true, perm: "audit:read" },
    ],
  },
];

// Find the nav item whose href best matches a pathname (longest-prefix match,
// so nested routes like /assets/[id] resolve to the "/assets" nav entry).
export function findNavItem(pathname: string): NavItem | null {
  const all = NAV_SECTIONS.flatMap((s) => s.items);
  let best: NavItem | null = null;
  for (const item of all) {
    if (pathname === item.href || pathname.startsWith(item.href + "/")) {
      if (!best || item.href.length > best.href.length) best = item;
    }
  }
  return best;
}
