import {
  Home, MapPin, Store, MessageSquare, User,
  ClipboardCheck, AlertTriangle, Route,
  DollarSign, ClipboardList,
  BarChart3, Megaphone, FileText,
  Package, ShoppingCart, Settings, Receipt,
  Gift, HeadphonesIcon, Factory, CheckSquare, Gauge,
  type LucideIcon
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// OPS BOTTOM NAVIGATION — Role-specific configs for OpsLayout
// Paths MUST map to existing portal routes in AppRoutes.tsx
// ═══════════════════════════════════════════════════════════════════════════════

export interface OpsNavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

export type OpsRole =
  | 'driver'
  | 'biker'
  | 'ambassador'
  | 'influencer'
  | 'store'
  | 'store_owner'
  | 'wholesaler'
  | 'customer'
  | 'production';

export const opsNavigation: Record<OpsRole, OpsNavItem[]> = {
  driver: [
    { label: 'Home', path: '/portal/driver', icon: Home },
    { label: 'Route', path: '/portal/driver/route', icon: Route },
    { label: 'Stores', path: '/portal/driver/stores', icon: Store },
    { label: 'Msgs', path: '/portal/driver/messages', icon: MessageSquare },
    { label: 'Me', path: '/portal/driver/profile', icon: User },
  ],
  biker: [
    { label: 'Home', path: '/portal/biker', icon: Home },
    { label: 'Checks', path: '/portal/biker/checks', icon: ClipboardCheck },
    { label: 'Issues', path: '/portal/biker/issues', icon: AlertTriangle },
    { label: 'Route', path: '/portal/biker/route', icon: Route },
    { label: 'Me', path: '/portal/biker/profile', icon: User },
  ],
  ambassador: [
    { label: 'Home', path: '/ambassador/dashboard', icon: Home },
    { label: 'Stores', path: '/ambassador/stores', icon: Store },
    { label: 'Comms', path: '/ambassador/commissions', icon: DollarSign },
    { label: 'Tasks', path: '/ambassador/tasks', icon: ClipboardList },
    { label: 'Me', path: '/ambassador/profile', icon: User },
  ],
  influencer: [
    { label: 'Home', path: '/portal/influencer', icon: Home },
    { label: 'Campaigns', path: '/portal/influencer/campaigns', icon: Megaphone },
    { label: 'Content', path: '/portal/influencer/content', icon: FileText },
    { label: 'Analytics', path: '/portal/influencer/analytics', icon: BarChart3 },
    { label: 'Me', path: '/portal/influencer/profile', icon: User },
  ],
  store: [
    { label: 'Dashboard', path: '/portal/store', icon: Home },
    { label: 'Products', path: '/portal/store/products', icon: Package },
    { label: 'Orders', path: '/portal/store/orders', icon: ShoppingCart },
    { label: 'Invoices', path: '/portal/store/invoices', icon: Receipt },
    { label: 'Settings', path: '/portal/store/settings', icon: Settings },
  ],
  store_owner: [
    { label: 'Dashboard', path: '/portal/store', icon: Home },
    { label: 'Products', path: '/portal/store/products', icon: Package },
    { label: 'Orders', path: '/portal/store/orders', icon: ShoppingCart },
    { label: 'Invoices', path: '/portal/store/invoices', icon: Receipt },
    { label: 'Settings', path: '/portal/store/settings', icon: Settings },
  ],
  wholesaler: [
    { label: 'Dashboard', path: '/portal/wholesaler', icon: Home },
    { label: 'Products', path: '/portal/wholesaler/products', icon: Package },
    { label: 'Orders', path: '/portal/wholesaler/orders', icon: ShoppingCart },
    { label: 'Finance', path: '/portal/wholesaler/finance', icon: DollarSign },
    { label: 'Settings', path: '/portal/wholesaler/settings', icon: Settings },
  ],
  customer: [
    { label: 'Home', path: '/portal/customer', icon: Home },
    { label: 'Orders', path: '/portal/customer/orders', icon: ShoppingCart },
    { label: 'Rewards', path: '/portal/customer/rewards', icon: Gift },
    { label: 'Support', path: '/portal/customer/support', icon: HeadphonesIcon },
    { label: 'Me', path: '/portal/customer/profile', icon: User },
  ],
  production: [
    { label: 'Home', path: '/portal/production', icon: Home },
    { label: 'Batches', path: '/portal/production/batches', icon: Factory },
    { label: 'Progress', path: '/portal/production/progress', icon: Gauge },
    { label: 'Quality', path: '/portal/production/quality', icon: CheckSquare },
    { label: 'Me', path: '/portal/production/profile', icon: User },
  ],
};

/**
 * Get nav items for a given role. Falls back to empty array.
 */
export function getOpsNavItems(role: string): OpsNavItem[] {
  return opsNavigation[role as OpsRole] || [];
}
