import {
  Home, MapPin, Store, MessageSquare, User, Inbox,
  ClipboardCheck, AlertTriangle, Route,
  DollarSign, ClipboardList,
  BarChart3, Megaphone, FileText,
  Package, ShoppingCart, Settings, Receipt,
  Gift, HeadphonesIcon, Factory, CheckSquare, Gauge, Camera,
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
    { label: 'Inbox', path: '/portal/inbox', icon: Inbox },
    { label: 'Stores', path: '/portal/driver/stores', icon: Store },
    { label: 'Me', path: '/portal/driver/profile', icon: User },
  ],
  biker: [
    { label: 'Home', path: '/portal/biker', icon: Home },
    { label: 'Checks', path: '/portal/biker/checks', icon: ClipboardCheck },
    { label: 'Inbox', path: '/portal/inbox', icon: Inbox },
    { label: 'Issues', path: '/portal/biker/issues', icon: AlertTriangle },
    { label: 'Me', path: '/portal/biker/profile', icon: User },
  ],
  ambassador: [
    { label: 'Home', path: '/ambassador/dashboard', icon: Home },
    { label: 'Stores', path: '/ambassador/stores', icon: Store },
    { label: 'Inbox', path: '/portal/inbox', icon: Inbox },
    // Label bug fix: this path is the commissions page, not a comms page
    { label: 'Earnings', path: '/ambassador/commissions', icon: DollarSign },
    // /ambassador/profile has no route — dashboard is the working profile home
    { label: 'Me', path: '/ambassador/dashboard', icon: User },
  ],
  influencer: [
    { label: 'Home', path: '/portal/influencer', icon: Home },
    { label: 'Campaigns', path: '/portal/influencer/campaigns', icon: Megaphone },
    { label: 'Inbox', path: '/portal/inbox', icon: Inbox },
    { label: 'Analytics', path: '/portal/influencer/analytics', icon: BarChart3 },
    { label: 'Me', path: '/portal/influencer/profile', icon: User },
  ],
  store: [
    { label: 'Dashboard', path: '/portal/store', icon: Home },
    { label: 'Products', path: '/portal/store/products', icon: Package },
    { label: 'Inbox', path: '/portal/inbox', icon: Inbox },
    { label: 'Orders', path: '/portal/store/orders', icon: ShoppingCart },
    { label: 'Settings', path: '/portal/store/settings', icon: Settings },
  ],
  store_owner: [
    { label: 'Dashboard', path: '/portal/store', icon: Home },
    { label: 'Products', path: '/portal/store/products', icon: Package },
    { label: 'Inbox', path: '/portal/inbox', icon: Inbox },
    { label: 'Orders', path: '/portal/store/orders', icon: ShoppingCart },
    { label: 'Settings', path: '/portal/store/settings', icon: Settings },
  ],
  wholesaler: [
    { label: 'Dashboard', path: '/portal/wholesaler', icon: Home },
    { label: 'Products', path: '/portal/wholesaler/products', icon: Package },
    { label: 'Quick Add', path: '/portal/wholesaler/catalog/onboard', icon: Camera },
    { label: 'Inbox', path: '/portal/inbox', icon: Inbox },
    { label: 'Orders', path: '/portal/wholesaler/orders', icon: ShoppingCart },
    { label: 'Settings', path: '/portal/wholesaler/settings', icon: Settings },
  ],
  customer: [
    { label: 'Home', path: '/portal/customer', icon: Home },
    { label: 'Orders', path: '/portal/customer/orders', icon: ShoppingCart },
    { label: 'Inbox', path: '/portal/inbox', icon: Inbox },
    { label: 'Rewards', path: '/portal/customer/rewards', icon: Gift },
    { label: 'Me', path: '/portal/customer/profile', icon: User },
  ],
  production: [
    { label: 'Home', path: '/portal/production', icon: Home },
    { label: 'Batches', path: '/portal/production/batches', icon: Factory },
    { label: 'Inbox', path: '/portal/inbox', icon: Inbox },
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
