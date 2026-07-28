import {
  Crown, Building2, MessageSquare, Package, Truck, FileText, 
  Factory, Users, Map, DollarSign, BarChart3, Settings,
  LayoutDashboard, Brain, Shield, Phone, Target, Award,
  Wallet, Calendar, CheckSquare, Clipboard, Store,
  Bike, Car, TrendingUp, Bell, Receipt, ClipboardList,
  UserCircle, Eye, ShoppingBag, MapPin, AlertCircle, type LucideIcon
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// PORTAL SIDEBAR CONSTITUTION — ROLE-BASED NAVIGATION (PRODUCTION-READY)
// Single source of truth for role-specific navigation
// ═══════════════════════════════════════════════════════════════════════════════

export type PortalRole = 
  | 'owner' 
  | 'admin' 
  | 'va' 
  | 'accountant'
  | 'biker' 
  | 'driver' 
  | 'ambassador' 
  | 'production'
  | 'csr';

export interface PortalNavItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  emoji?: string;
  badge?: string;
  description?: string;
}

export interface PortalSection {
  id: string;
  title: string;
  emoji: string;
  items: PortalNavItem[];
  titleClass?: string;
}

export interface PortalConfig {
  role: PortalRole;
  landingPage: string;
  portalRoot: string;
  name: string;
  description: string;
  sections: PortalSection[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// OWNER PORTAL — FULL EMPIRE ACCESS
// ═══════════════════════════════════════════════════════════════════════════════
export const OWNER_PORTAL: PortalConfig = {
  role: 'owner',
  landingPage: '/grabba/command-penthouse',
  portalRoot: '/',
  name: 'Empire Command',
  description: 'Full access to all systems',
  sections: [
    {
      id: 'penthouse',
      title: 'Command Penthouse',
      emoji: '👑',
      titleClass: 'bg-gradient-to-r from-amber-500/20 to-yellow-500/10 text-amber-300',
      items: [
        { id: 'penthouse-dashboard', label: 'Master Dashboard', path: '/grabba/command-penthouse', icon: Crown, emoji: '📊' },
        { id: 'home', label: 'Home Dashboard', path: '/', icon: LayoutDashboard, emoji: '🏠' },
        { id: 'intelligence', label: 'Global Intelligence', path: '/grabba/ai-insights', icon: Brain, emoji: '🧠' },
        { id: 'financial-command', label: 'Financial Command', path: '/grabba/advisor-penthouse', icon: DollarSign, emoji: '💰' },
        { id: 'executive-reports', label: 'Executive Reports', path: '/executive-reports', icon: BarChart3, emoji: '📑' },
        { id: 'settings', label: 'OS Settings', path: '/settings', icon: Settings, emoji: '⚙️' },
      ],
    },
    {
      id: 'security',
      title: 'Security & Governance',
      emoji: '🛡️',
      titleClass: 'bg-gradient-to-r from-emerald-500/20 to-green-500/10 text-emerald-300',
      items: [
        { id: 'security-console', label: 'Security Console', path: '/security/console', icon: Shield, emoji: '🛡️' },
        { id: 'people-access', label: 'People & Access', path: '/admin/field-assignments', icon: Users, emoji: '📧' },
        { id: 'audit-logs', label: 'Audit Logs', path: '/security/audit', icon: Eye, emoji: '📋' },
      ],
    },
    {
      id: 'floor-1',
      title: 'Floor 1: CRM & Stores',
      emoji: '🏢',
      items: [
        { id: 'crm-hub', label: 'CRM Hub', path: '/grabba/crm', icon: Building2, emoji: '📋' },
        { id: 'store-master', label: 'Store Master', path: '/stores', icon: Store, emoji: '🏪' },
        { id: 'brand-crm', label: 'Brand CRM', path: '/brand-crm', icon: TrendingUp, emoji: '🎯' },
        { id: 'store-performance', label: 'Store Performance', path: '/store-performance', icon: TrendingUp, emoji: '📈' },
      ],
    },
    {
      id: 'floor-2',
      title: 'Floor 2: Communication',
      emoji: '📞',
      items: [
        { id: 'comm-center', label: 'Command Center', path: '/communication', icon: MessageSquare, emoji: '🎛️' },
        { id: 'dialer', label: 'Dialer', path: '/communication/dialer', icon: Phone, emoji: '📱' },
        { id: 'campaigns', label: 'Campaigns', path: '/communication/campaigns', icon: Target, emoji: '🚀' },
      ],
    },
    {
      id: 'floor-3',
      title: 'Floor 3: Inventory',
      emoji: '📦',
      items: [
        { id: 'inventory', label: 'Grabba Inventory', path: '/grabba/inventory', icon: Package, emoji: '📦' },
        { id: 'production', label: 'Tube Counts', path: '/grabba/production', icon: Factory, emoji: '🧪' },
      ],
    },
    {
      id: 'floor-4',
      title: 'Floor 4: Delivery',
      emoji: '🚴',
      items: [
        { id: 'deliveries', label: 'Deliveries', path: '/grabba/deliveries', icon: Truck, emoji: '📬' },
        { id: 'assignments', label: 'Order Assignments', path: '/grabba/assignments', icon: ClipboardList, emoji: '📋' },
        { id: 'drivers', label: 'Driver Management', path: '/driver', icon: Car, emoji: '🚗' },
        { id: 'bikers', label: 'Biker Management', path: '/biker', icon: Bike, emoji: '🚴' },
        { id: 'routes', label: 'Route Plans', path: '/routes', icon: Map, emoji: '🗺️' },
      ],
    },
    {
      id: 'floor-5',
      title: 'Floor 5: Finance',
      emoji: '💰',
      items: [
        { id: 'finance-dashboard', label: 'Finance Dashboard', path: '/floor5', icon: DollarSign, emoji: '📊' },
        { id: 'invoices', label: 'Invoices', path: '/billing/invoices', icon: FileText, emoji: '🧾' },
        { id: 'legacy-invoice-repair', label: 'Legacy Invoice Repair (Read-Only)', path: '/admin/legacy-invoice-repair', icon: AlertCircle, emoji: '⚠️', description: 'One-time historical invoice tube attribution. Does not affect revenue, payments, or inventory.' },
        { id: 'unpaid', label: 'Unpaid Accounts', path: '/unpaid-accounts', icon: Bell, emoji: '⚠️' },
        { id: 'payroll', label: 'Payroll', path: '/payroll', icon: Wallet, emoji: '💵' },
      ],
    },
    {
      id: 'floor-8',
      title: 'Floor 8: Ambassadors',
      emoji: '🤝',
      items: [
        { id: 'ambassador-crm', label: 'Ambassador CRM', path: '/grabba/ambassadors', icon: Users, emoji: '👥' },
        { id: 'commissions', label: 'Commissions', path: '/ambassador-commissions', icon: DollarSign, emoji: '💰' },
        { id: 'leaderboard', label: 'Leaderboard', path: '/ambassador-leaderboard', icon: Award, emoji: '🏆' },
      ],
    },
    {
      id: 'floor-9',
      title: 'Floor 9: AI Operations',
      emoji: '🤖',
      items: [
        { id: 'ai-workforce', label: 'AI Workforce', path: '/ai/workforce', icon: Brain, emoji: '👾' },
        { id: 'ai-tasks', label: 'AI Tasks', path: '/grabba/floor9/tasks', icon: CheckSquare, emoji: '✅' },
        { id: 'ai-queue', label: 'Action Queue', path: '/grabba/floor9/action-queue', icon: ClipboardList, emoji: '📋' },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN PORTAL — OPERATIONAL CONTROL
// ═══════════════════════════════════════════════════════════════════════════════
export const ADMIN_PORTAL: PortalConfig = {
  role: 'admin',
  landingPage: '/',
  portalRoot: '/',
  name: 'Admin Control',
  description: 'Operational management access',
  sections: [
    {
      id: 'dashboard',
      title: 'Dashboard',
      emoji: '📊',
      items: [
        { id: 'home', label: 'Home Dashboard', path: '/', icon: LayoutDashboard, emoji: '🏠' },
        { id: 'command', label: 'Command Center', path: '/grabba/command-penthouse', icon: Crown, emoji: '📊' },
      ],
    },
    {
      id: 'floor-1',
      title: 'CRM & Stores',
      emoji: '🏢',
      items: [
        { id: 'crm-hub', label: 'CRM Hub', path: '/grabba/crm', icon: Building2, emoji: '📋' },
        { id: 'store-master', label: 'Store Master', path: '/stores', icon: Store, emoji: '🏪' },
        { id: 'brand-crm', label: 'Brand CRM', path: '/brand-crm', icon: TrendingUp, emoji: '🎯' },
        { id: 'contacts', label: 'Contacts', path: '/crm/contacts', icon: Users, emoji: '👥' },
      ],
    },
    {
      id: 'floor-2',
      title: 'Communication',
      emoji: '📞',
      items: [
        { id: 'comm-center', label: 'Command Center', path: '/communication', icon: MessageSquare, emoji: '🎛️' },
        { id: 'dialer', label: 'Dialer', path: '/communication/dialer', icon: Phone, emoji: '📱' },
        { id: 'campaigns', label: 'Campaigns', path: '/communication/campaigns', icon: Target, emoji: '🚀' },
      ],
    },
    {
      id: 'floor-3',
      title: 'Inventory',
      emoji: '📦',
      items: [
        { id: 'inventory', label: 'Grabba Inventory', path: '/grabba/inventory', icon: Package, emoji: '📦' },
        { id: 'products', label: 'Products', path: '/products', icon: Package, emoji: '🏷️' },
      ],
    },
    {
      id: 'floor-4',
      title: 'Delivery',
      emoji: '🚴',
      items: [
        { id: 'deliveries', label: 'Deliveries', path: '/grabba/deliveries', icon: Truck, emoji: '📬' },
        { id: 'assignments', label: 'Order Assignments', path: '/grabba/assignments', icon: ClipboardList, emoji: '📋' },
        { id: 'drivers', label: 'Driver Management', path: '/driver', icon: Car, emoji: '🚗' },
        { id: 'bikers', label: 'Biker Management', path: '/biker', icon: Bike, emoji: '🚴' },
        { id: 'routes', label: 'Route Plans', path: '/routes', icon: Map, emoji: '🗺️' },
      ],
    },
    {
      id: 'floor-5',
      title: 'Finance',
      emoji: '💰',
      items: [
        { id: 'invoices', label: 'Invoices', path: '/billing/invoices', icon: FileText, emoji: '🧾' },
        { id: 'legacy-invoice-repair', label: 'Legacy Invoice Repair (Read-Only)', path: '/admin/legacy-invoice-repair', icon: AlertCircle, emoji: '⚠️', description: 'One-time historical invoice tube attribution. Does not affect revenue, payments, or inventory.' },
        { id: 'unpaid', label: 'Unpaid Accounts', path: '/unpaid-accounts', icon: Bell, emoji: '⚠️' },
      ],
    },
    {
      id: 'floor-8',
      title: 'Ambassadors',
      emoji: '🤝',
      items: [
        { id: 'ambassador-crm', label: 'Ambassador CRM', path: '/grabba/ambassadors', icon: Users, emoji: '👥' },
        { id: 'commissions', label: 'Commissions', path: '/ambassador-commissions', icon: DollarSign, emoji: '💰' },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// VA PORTAL — VIRTUAL ASSISTANT ACCESS
// ═══════════════════════════════════════════════════════════════════════════════
export const VA_PORTAL: PortalConfig = {
  role: 'va',
  landingPage: '/',
  portalRoot: '/',
  name: 'VA Dashboard',
  description: 'CRM, notes, and follow-ups',
  sections: [
    {
      id: 'dashboard',
      title: 'Dashboard',
      emoji: '📊',
      items: [
        { id: 'home', label: 'Home Dashboard', path: '/', icon: LayoutDashboard, emoji: '🏠' },
        { id: 'tasks', label: 'My Tasks', path: '/tasks', icon: CheckSquare, emoji: '✅' },
      ],
    },
    {
      id: 'crm',
      title: 'CRM',
      emoji: '🏢',
      items: [
        { id: 'crm-hub', label: 'CRM Hub', path: '/grabba/crm', icon: Building2, emoji: '📋' },
        { id: 'store-master', label: 'Store Master', path: '/stores', icon: Store, emoji: '🏪' },
        { id: 'brand-crm', label: 'Brand CRM', path: '/brand-crm', icon: TrendingUp, emoji: '🎯' },
        { id: 'contacts', label: 'Contacts', path: '/crm/contacts', icon: Users, emoji: '👥' },
        { id: 'follow-ups', label: 'Follow-Ups', path: '/crm/follow-ups', icon: Bell, emoji: '🔔' },
      ],
    },
    {
      id: 'communication',
      title: 'Communication',
      emoji: '📞',
      items: [
        { id: 'dialer', label: 'Dialer', path: '/communication/dialer', icon: Phone, emoji: '📱' },
        { id: 'inbox', label: 'Inbox', path: '/communication/inbox', icon: MessageSquare, emoji: '📥' },
      ],
    },
    {
      id: 'finance-readonly',
      title: 'Finance (Read-Only)',
      emoji: '💰',
      items: [
        { id: 'invoices', label: 'View Invoices', path: '/billing/invoices', icon: FileText, emoji: '🧾' },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// ACCOUNTANT PORTAL — FINANCIAL ACCESS
// ═══════════════════════════════════════════════════════════════════════════════
export const ACCOUNTANT_PORTAL: PortalConfig = {
  role: 'accountant',
  landingPage: '/floor5',
  portalRoot: '/portal/accountant',
  name: 'Accountant Portal',
  description: 'Financial management and reporting',
  sections: [
    {
      id: 'finance',
      title: 'Finance',
      emoji: '💰',
      items: [
        { id: 'dashboard', label: 'Finance Dashboard', path: '/floor5', icon: DollarSign, emoji: '📊' },
        { id: 'invoices', label: 'Invoices', path: '/billing/invoices', icon: FileText, emoji: '🧾' },
        { id: 'billing', label: 'Billing Center', path: '/billing/center', icon: Receipt, emoji: '💳' },
        { id: 'unpaid', label: 'Unpaid Accounts', path: '/unpaid-accounts', icon: Bell, emoji: '⚠️' },
        { id: 'payroll', label: 'Payroll', path: '/payroll', icon: Wallet, emoji: '💵' },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// BIKER PORTAL — FIELD SALES ACCESS
// ═══════════════════════════════════════════════════════════════════════════════
export const BIKER_PORTAL: PortalConfig = {
  role: 'biker',
  landingPage: '/portal/biker',
  portalRoot: '/portal/biker',
  name: 'Biker Portal',
  description: 'Field visits and store notes',
  sections: [
    {
      id: 'daily-work',
      title: 'Daily Work',
      emoji: '🚴',
      items: [
        { id: 'dashboard', label: 'My Dashboard', path: '/portal/biker', icon: LayoutDashboard, emoji: '📊' },
        { id: 'my-stores', label: 'My Assigned Stores', path: '/portal/biker/stores', icon: Store, emoji: '🏪' },
        { id: 'daily-route', label: 'Daily Route', path: '/portal/biker/route', icon: Map, emoji: '🗺️' },
        { id: 'visit-log', label: 'Log Visit', path: '/portal/biker/visit-log', icon: ClipboardList, emoji: '📋' },
      ],
    },
    {
      id: 'activity',
      title: 'Activity',
      emoji: '📋',
      items: [
        { id: 'my-visits', label: 'My Visits', path: '/portal/biker/visits', icon: CheckSquare, emoji: '✅' },
        { id: 'schedule', label: 'Schedule', path: '/portal/biker/schedule', icon: Calendar, emoji: '📅' },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// DRIVER PORTAL — DELIVERY EXECUTION
// ═══════════════════════════════════════════════════════════════════════════════
export const DRIVER_PORTAL: PortalConfig = {
  role: 'driver',
  landingPage: '/portal/driver',
  portalRoot: '/portal/driver',
  name: 'Driver Portal',
  description: 'Delivery routes and status updates',
  sections: [
    {
      id: 'deliveries',
      title: 'Deliveries',
      emoji: '🚗',
      items: [
        { id: 'dashboard', label: 'My Dashboard', path: '/portal/driver', icon: LayoutDashboard, emoji: '📊' },
        { id: 'my-route', label: 'My Route', path: '/portal/driver/route', icon: Map, emoji: '🗺️' },
        { id: 'deliveries', label: 'Today\'s Deliveries', path: '/portal/driver/deliveries', icon: Truck, emoji: '📬' },
        { id: 'live-map', label: 'Live Map', path: '/portal/driver/map', icon: Map, emoji: '📍' },
      ],
    },
    {
      id: 'status',
      title: 'Status',
      emoji: '📋',
      items: [
        { id: 'completed', label: 'Completed', path: '/portal/driver/completed', icon: CheckSquare, emoji: '✅' },
        { id: 'history', label: 'History', path: '/portal/driver/history', icon: FileText, emoji: '📜' },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// AMBASSADOR PORTAL — STORE ACQUISITION
// ═══════════════════════════════════════════════════════════════════════════════
export const AMBASSADOR_PORTAL: PortalConfig = {
  role: 'ambassador',
  landingPage: '/ambassador/dashboard',
  portalRoot: '/ambassador',
  name: 'Ambassador Portal',
  description: 'Store sourcing, purchases, and commissions',
  sections: [
    {
      id: 'operations',
      title: 'Operations',
      emoji: '🏪',
      items: [
        { id: 'dashboard', label: 'Dashboard', path: '/ambassador/dashboard', icon: LayoutDashboard, emoji: '📊' },
        { id: 'stores', label: 'My Stores', path: '/ambassador/stores', icon: Store, emoji: '🏪' },
        { id: 'leads', label: 'Leads Pipeline', path: '/ambassador/leads', icon: Target, emoji: '🎯' },
        { id: 'purchases', label: 'My Purchases', path: '/ambassador/purchases', icon: ShoppingBag, emoji: '🛍️' },
        { id: 'routes', label: 'My Routes', path: '/ambassador/routes', icon: MapPin, emoji: '📍' },
      ],
    },
    {
      id: 'performance',
      title: 'Performance & Finance',
      emoji: '📈',
      items: [
        { id: 'commissions', label: 'My Commissions', path: '/ambassador/commissions', icon: DollarSign, emoji: '💰' },
        { id: 'orders', label: 'Store Orders', path: '/ambassador/orders', icon: Package, emoji: '📦' },
        { id: 'communications', label: 'Communications', path: '/ambassador/communications', icon: MessageSquare, emoji: '💬' },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTION PORTAL — WAREHOUSE ACCESS
// ═══════════════════════════════════════════════════════════════════════════════
export const PRODUCTION_PORTAL: PortalConfig = {
  role: 'production',
  landingPage: '/portal/production',
  portalRoot: '/portal/production',
  name: 'Production Portal',
  description: 'Warehouse and inventory management',
  sections: [
    {
      id: 'production',
      title: 'Production',
      emoji: '🏭',
      items: [
        { id: 'dashboard', label: 'Production Dashboard', path: '/portal/production', icon: Factory, emoji: '🏭' },
        { id: 'work-orders', label: 'Work Orders', path: '/portal/production/work-orders', icon: ClipboardList, emoji: '📋' },
        { id: 'inventory', label: 'Inventory', path: '/portal/production/inventory', icon: Package, emoji: '📦' },
        { id: 'tube-counts', label: 'Tube Counts', path: '/portal/production/tubes', icon: Package, emoji: '🧪' },
      ],
    },
    {
      id: 'fulfillment',
      title: 'Fulfillment',
      emoji: '📦',
      items: [
        { id: 'pending', label: 'Pending Orders', path: '/portal/production/pending', icon: Bell, emoji: '⏳' },
        { id: 'completed', label: 'Completed', path: '/portal/production/completed', icon: CheckSquare, emoji: '✅' },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// PORTAL REGISTRY — ROLE → CONFIG MAPPING
// ═══════════════════════════════════════════════════════════════════════════════
export const PORTAL_REGISTRY: Record<PortalRole, PortalConfig> = {
  owner: OWNER_PORTAL,
  admin: ADMIN_PORTAL,
  va: VA_PORTAL,
  accountant: ACCOUNTANT_PORTAL,
  biker: BIKER_PORTAL,
  driver: DRIVER_PORTAL,
  ambassador: AMBASSADOR_PORTAL,
  production: PRODUCTION_PORTAL,
  csr: VA_PORTAL, // CSR uses VA config with adjustments
};

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the portal configuration for a given role
 */
export function getPortalConfig(role: PortalRole): PortalConfig {
  return PORTAL_REGISTRY[role] || VA_PORTAL;
}

/**
 * Get the landing page for a given role
 */
export function getRoleLandingPage(role: PortalRole): string {
  return PORTAL_REGISTRY[role]?.landingPage || '/';
}

/**
 * Check if a role is elevated (owner/admin)
 */
export function isElevatedRole(role: PortalRole): boolean {
  return ['owner', 'admin'].includes(role);
}

/**
 * Check if a role has access to a specific path
 */
export function hasPathAccess(role: PortalRole, path: string): boolean {
  const config = getPortalConfig(role);
  
  // Elevated roles have full access
  if (isElevatedRole(role)) return true;
  
  // Check if path is in any of the role's sections
  for (const section of config.sections) {
    for (const item of section.items) {
      if (path === item.path || path.startsWith(item.path + '/')) {
        return true;
      }
    }
  }
  
  // Allow access to portal root
  if (path === config.portalRoot || path.startsWith(config.portalRoot + '/')) {
    return true;
  }
  
  return false;
}

/**
 * Get all allowed paths for a role
 */
export function getAllowedPaths(role: PortalRole): string[] {
  const config = getPortalConfig(role);
  const paths: string[] = [config.portalRoot, config.landingPage];
  
  for (const section of config.sections) {
    for (const item of section.items) {
      paths.push(item.path);
    }
  }
  
  return [...new Set(paths)];
}
