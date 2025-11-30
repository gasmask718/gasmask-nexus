import {
  Crown, Building2, MessageSquare, Package, Truck, FileText, 
  Factory, Boxes, Users, Map, DollarSign, BarChart3, Settings,
  LayoutDashboard, Brain, Shield, Phone, Mail, Target, Award,
  Home, ShoppingCart, Wallet, UserCircle, ClipboardList, Briefcase,
  Globe, Zap, PieChart, Database, Cog, Bell, Calculator, Store,
  Bike, Car, Star, Heart, TrendingUp, Activity, Calendar, type LucideIcon
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// DYNASTY OS MEGA-ARCHITECTURE — FORTUNE 500 NAVIGATION BLUEPRINT
// Single source of truth for all navigation across the entire platform
// ═══════════════════════════════════════════════════════════════════════════════

// Role Types - includes legacy 'store_owner' for backward compatibility
export type OSRole = 
  | 'ceo' 
  | 'admin' 
  | 'va' 
  | 'driver' 
  | 'biker' 
  | 'store' 
  | 'store_owner'  // Legacy alias for 'store'
  | 'wholesaler' 
  | 'ambassador' 
  | 'production' 
  | 'customer'
  | 'accountant'
  | 'csr';

// Brand Configuration
export const DYNASTY_BRANDS = {
  gasmask: { id: 'gasmask', name: 'GasMask', color: '#FF0000', icon: '🔴' },
  hotmama: { id: 'hotmama', name: 'HotMama', color: '#B76E79', icon: '🟣' },
  scalati: { id: 'scalati', name: 'Hot Scalati', color: '#FF7A00', icon: '🟠' },
  grabba: { id: 'grabba', name: 'Grabba R Us', color: '#A020F0', icon: '🟪' },
} as const;

// Navigation Item Interface
export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  badge?: string;
  description?: string;
  roles: OSRole[];
  children?: NavItem[];
}

// Floor Interface
export interface OSFloor {
  id: string;
  name: string;
  icon: LucideIcon;
  emoji: string;
  description: string;
  roles: OSRole[];
  items: NavItem[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 👑 PENTHOUSE — CEO / FOUNDER COMMAND CENTER
// ═══════════════════════════════════════════════════════════════════════════════
export const PENTHOUSE: OSFloor = {
  id: 'penthouse',
  name: 'Command Penthouse',
  icon: Crown,
  emoji: '👑',
  description: 'Master control center for the entire Dynasty empire',
  roles: ['ceo', 'admin'],
  items: [
    { id: 'master-dashboard', label: 'Master Dashboard', path: '/', icon: LayoutDashboard, roles: ['ceo', 'admin', 'va'] },
    { id: 'command-penthouse', label: 'Command Penthouse', path: '/grabba/command-penthouse', icon: Crown, roles: ['ceo', 'admin'] },
    { id: 'global-intelligence', label: 'Global Intelligence', path: '/grabba/ai-insights', icon: Brain, roles: ['ceo', 'admin'] },
    { id: 'financial-command', label: 'Financial Command', path: '/grabba/advisor-penthouse', icon: DollarSign, roles: ['ceo', 'admin'] },
    { id: 'executive-reports', label: 'Executive Reports', path: '/executive-reports', icon: PieChart, roles: ['ceo', 'admin'] },
    { id: 'ceo-ai-assistant', label: 'CEO AI Assistant', path: '/ai/ceo-control', icon: Zap, roles: ['ceo', 'admin'] },
    { id: 'os-settings', label: 'OS Settings', path: '/settings', icon: Settings, roles: ['ceo', 'admin'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🏢 FLOOR 1 — CRM
// ═══════════════════════════════════════════════════════════════════════════════
export const FLOOR_1_CRM: OSFloor = {
  id: 'floor-1-crm',
  name: 'Floor 1: CRM',
  icon: Building2,
  emoji: '🏢',
  description: 'Customer relationships, stores, contacts, and sales pipeline',
  roles: ['ceo', 'admin', 'va', 'ambassador'],
  items: [
    { id: 'crm-hub', label: 'CRM Hub', path: '/grabba/crm', icon: Building2, roles: ['ceo', 'admin', 'va'] },
    { id: 'stores', label: 'Stores', path: '/stores', icon: Store, roles: ['ceo', 'admin', 'va', 'driver'] },
    { id: 'crm-contacts', label: 'Contacts', path: '/crm/contacts', icon: Users, roles: ['ceo', 'admin', 'va'] },
    { id: 'crm-customers', label: 'Customers', path: '/crm/customers', icon: UserCircle, roles: ['ceo', 'admin', 'va'] },
    { id: 'companies', label: 'Companies', path: '/companies', icon: Briefcase, roles: ['ceo', 'admin', 'va'] },
    { id: 'sales-prospects', label: 'Sales Prospects', path: '/sales/prospects', icon: Target, roles: ['ceo', 'admin', 'va'] },
    { id: 'sales-report', label: 'Sales Report', path: '/sales/report', icon: BarChart3, roles: ['ceo', 'admin', 'va'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📞 FLOOR 2 — OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════
export const FLOOR_2_OPERATIONS: OSFloor = {
  id: 'floor-2-operations',
  name: 'Floor 2: Operations',
  icon: MessageSquare,
  emoji: '📞',
  description: 'Communications, automations, and operational workflows',
  roles: ['ceo', 'admin', 'va'],
  items: [
    { id: 'communication-hub', label: 'Communication Hub', path: '/grabba/communication', icon: MessageSquare, roles: ['ceo', 'admin', 'va'] },
    { id: 'text-center', label: 'Text Center', path: '/grabba/text-center', icon: Phone, roles: ['ceo', 'admin', 'va'] },
    { id: 'email-center', label: 'Email Center', path: '/grabba/email-center', icon: Mail, roles: ['ceo', 'admin', 'va'] },
    { id: 'call-center', label: 'Call Center', path: '/grabba/call-center', icon: Phone, roles: ['ceo', 'admin', 'va'] },
    { id: 'automation', label: 'Automation', path: '/grabba/autopilot', icon: Zap, roles: ['ceo', 'admin'] },
    { id: 'daily-briefing', label: 'Daily Briefing', path: '/grabba/daily-briefing', icon: Calendar, roles: ['ceo', 'admin', 'va'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 FLOOR 3 — INVENTORY
// ═══════════════════════════════════════════════════════════════════════════════
export const FLOOR_3_INVENTORY: OSFloor = {
  id: 'floor-3-inventory',
  name: 'Floor 3: Inventory',
  icon: Package,
  emoji: '📦',
  description: 'Manufacturing, inventory tracking, and stock management',
  roles: ['ceo', 'admin', 'va', 'production'],
  items: [
    { id: 'production', label: 'Production', path: '/grabba/production', icon: Factory, roles: ['ceo', 'admin', 'va', 'production'] },
    { id: 'inventory', label: 'Inventory', path: '/grabba/inventory', icon: Package, roles: ['ceo', 'admin', 'va', 'production'] },
    { id: 'products', label: 'Products', path: '/products', icon: Boxes, roles: ['ceo', 'admin', 'va'] },
    { id: 'warehouse', label: 'Warehouse Brain', path: '/os/warehouse', icon: Factory, roles: ['ceo', 'admin'] },
    { id: 'procurement', label: 'Procurement', path: '/os/procurement', icon: Database, roles: ['ceo', 'admin'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🚴 FLOOR 4 — DELIVERY / ROUTING
// ═══════════════════════════════════════════════════════════════════════════════
export const FLOOR_4_DELIVERY: OSFloor = {
  id: 'floor-4-delivery',
  name: 'Floor 4: Delivery / Routing',
  icon: Truck,
  emoji: '🚴',
  description: 'Delivery operations, routes, drivers, and bikers',
  roles: ['ceo', 'admin', 'va', 'driver', 'biker'],
  items: [
    { id: 'deliveries', label: 'Deliveries', path: '/grabba/deliveries', icon: Truck, roles: ['ceo', 'admin', 'va'] },
    { id: 'routes', label: 'Routes', path: '/routes', icon: Map, roles: ['ceo', 'admin', 'va', 'driver'] },
    { id: 'route-optimizer', label: 'Route Optimizer', path: '/route-optimizer', icon: Target, roles: ['ceo', 'admin', 'va'] },
    { id: 'live-map', label: 'Live Map', path: '/operations/live-map', icon: Globe, roles: ['ceo', 'admin', 'va'] },
    { id: 'driver-management', label: 'Driver Management', path: '/driver', icon: Car, roles: ['ceo', 'admin', 'va'] },
    { id: 'biker-payouts', label: 'Biker Payouts', path: '/biker-payouts', icon: Bike, roles: ['ceo', 'admin', 'va'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🏬 FLOOR 5 — MARKETPLACE
// ═══════════════════════════════════════════════════════════════════════════════
export const FLOOR_5_MARKETPLACE: OSFloor = {
  id: 'floor-5-marketplace',
  name: 'Floor 5: Marketplace',
  icon: ShoppingCart,
  emoji: '🏬',
  description: 'Wholesale operations, marketplace, and fulfillment',
  roles: ['ceo', 'admin', 'va', 'wholesaler'],
  items: [
    { id: 'wholesale-platform', label: 'Wholesale Platform', path: '/grabba/wholesale-platform', icon: Boxes, roles: ['ceo', 'admin', 'va'] },
    { id: 'marketplace', label: 'Marketplace', path: '/wholesale/marketplace', icon: ShoppingCart, roles: ['ceo', 'admin', 'va', 'wholesaler'] },
    { id: 'fulfillment', label: 'Fulfillment', path: '/wholesale/fulfillment', icon: Package, roles: ['ceo', 'admin', 'va'] },
    { id: 'marketplace-shop', label: 'Shop Front', path: '/shop', icon: ShoppingCart, roles: ['ceo', 'admin', 'va'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🤝 FLOOR 6 — AMBASSADORS
// ═══════════════════════════════════════════════════════════════════════════════
export const FLOOR_6_AMBASSADORS: OSFloor = {
  id: 'floor-6-ambassadors',
  name: 'Floor 6: Ambassadors',
  icon: Users,
  emoji: '🤝',
  description: 'Ambassador network, commissions, and referrals',
  roles: ['ceo', 'admin', 'va', 'ambassador'],
  items: [
    { id: 'ambassadors', label: 'Ambassadors', path: '/grabba/ambassadors', icon: Users, roles: ['ceo', 'admin', 'va'] },
    { id: 'ambassador-regions', label: 'Ambassador Regions', path: '/ambassador-regions', icon: Map, roles: ['ceo', 'admin', 'va'] },
    { id: 'ambassador-payouts', label: 'Ambassador Payouts', path: '/ambassador-payouts', icon: Wallet, roles: ['ceo', 'admin', 'va'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 💰 FLOOR 7 — ACCOUNTING
// ═══════════════════════════════════════════════════════════════════════════════
export const FLOOR_7_ACCOUNTING: OSFloor = {
  id: 'floor-7-accounting',
  name: 'Floor 7: Accounting',
  icon: DollarSign,
  emoji: '💰',
  description: 'Billing, invoices, payouts, and financial analytics',
  roles: ['ceo', 'admin', 'va', 'accountant'],
  items: [
    { id: 'finance-hub', label: 'Finance Hub', path: '/grabba/finance', icon: DollarSign, roles: ['ceo', 'admin', 'va', 'accountant'] },
    { id: 'billing', label: 'Billing Center', path: '/billing-center', icon: FileText, roles: ['ceo', 'admin', 'va', 'accountant'] },
    { id: 'invoices', label: 'Invoices', path: '/billing/invoices', icon: FileText, roles: ['ceo', 'admin', 'va', 'accountant'] },
    { id: 'unpaid-accounts', label: 'Unpaid Accounts', path: '/unpaid-accounts', icon: Bell, roles: ['ceo', 'admin', 'va'] },
    { id: 'payroll', label: 'Payroll', path: '/payroll', icon: Calculator, roles: ['ceo', 'admin', 'accountant'] },
    { id: 'economic-analytics', label: 'Economic Analytics', path: '/economic-analytics', icon: TrendingUp, roles: ['ceo', 'admin'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🤖 FLOOR 8 — INTELLIGENCE / AI
// ═══════════════════════════════════════════════════════════════════════════════
export const FLOOR_8_INTELLIGENCE: OSFloor = {
  id: 'floor-8-intelligence',
  name: 'Floor 8: Intelligence / AI',
  icon: Brain,
  emoji: '🤖',
  description: 'AI workers, automations, playbooks, analytics, and intelligence',
  roles: ['ceo', 'admin', 'va'],
  items: [
    { id: 'ai-workforce', label: 'AI Workforce', path: '/ai/workforce', icon: Brain, roles: ['ceo', 'admin', 'va'] },
    { id: 'ai-operations', label: 'AI Operations', path: '/grabba/ai', icon: Activity, roles: ['ceo', 'admin'] },
    { id: 'ai-playbooks', label: 'AI Playbooks', path: '/grabba/ai-playbooks', icon: ClipboardList, roles: ['ceo', 'admin'] },
    { id: 'ai-routines', label: 'AI Routines', path: '/grabba/ai-routines', icon: Cog, roles: ['ceo', 'admin'] },
    { id: 'risk-radar', label: 'Risk Radar', path: '/grabba/risk-radar', icon: Shield, roles: ['ceo', 'admin'] },
    { id: 'analytics', label: 'Analytics', path: '/analytics', icon: BarChart3, roles: ['ceo', 'admin', 'va'] },
    { id: 'store-performance', label: 'Store Performance', path: '/store-performance', icon: TrendingUp, roles: ['ceo', 'admin', 'va'] },
    { id: 'expansion', label: 'Expansion', path: '/expansion', icon: Globe, roles: ['ceo', 'admin'] },
    { id: 'territories', label: 'Territories', path: '/territories', icon: Map, roles: ['ceo', 'admin', 'va'] },
    { id: 'leaderboard', label: 'Leaderboard', path: '/leaderboard', icon: Award, roles: ['ceo', 'admin', 'va'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 HR & WORKFORCE
// ═══════════════════════════════════════════════════════════════════════════════
export const FLOOR_HR: OSFloor = {
  id: 'floor-hr',
  name: 'HR & Workforce',
  icon: Briefcase,
  emoji: '📋',
  description: 'Employees, hiring, onboarding, and HR management',
  roles: ['ceo', 'admin'],
  items: [
    { id: 'hr', label: 'HR Dashboard', path: '/hr', icon: Briefcase, roles: ['ceo', 'admin'] },
    { id: 'employees', label: 'Employees', path: '/hr/employees', icon: Users, roles: ['ceo', 'admin'] },
    { id: 'applicants', label: 'Applicants', path: '/hr/applicants', icon: UserCircle, roles: ['ceo', 'admin'] },
    { id: 'interviews', label: 'Interviews', path: '/hr/interviews', icon: Calendar, roles: ['ceo', 'admin'] },
    { id: 'hr-payroll', label: 'HR Payroll', path: '/hr/payroll', icon: DollarSign, roles: ['ceo', 'admin'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN OS FLOORS (Ordered Array)
// ═══════════════════════════════════════════════════════════════════════════════
export const OS_FLOORS: OSFloor[] = [
  PENTHOUSE,
  FLOOR_1_CRM,
  FLOOR_2_OPERATIONS,
  FLOOR_3_INVENTORY,
  FLOOR_4_DELIVERY,
  FLOOR_5_MARKETPLACE,
  FLOOR_6_AMBASSADORS,
  FLOOR_7_ACCOUNTING,
  FLOOR_8_INTELLIGENCE,
  FLOOR_HR,
];

// ═══════════════════════════════════════════════════════════════════════════════
// ADDITIONAL SECTIONS (Admin Tools)
// ═══════════════════════════════════════════════════════════════════════════════
export const SECTION_MARKETPLACE_ADMIN: OSFloor = {
  id: 'section-marketplace-admin',
  name: 'Marketplace Admin',
  icon: ShoppingCart,
  emoji: '🛒',
  description: 'B2C marketplace, customers, orders, and fulfillment',
  roles: ['ceo', 'admin', 'va'],
  items: [
    { id: 'marketplace-admin', label: 'Marketplace Admin', path: '/portal/marketplace-admin', icon: Cog, roles: ['ceo', 'admin'] },
    { id: 'national-wholesale', label: 'National Wholesale', path: '/portal/national-wholesale', icon: Globe, roles: ['ceo', 'admin'] },
  ],
};

export const SECTION_ACCOUNTING: OSFloor = {
  id: 'section-accounting',
  name: 'Accounting OS',
  icon: Calculator,
  emoji: '💳',
  description: 'Financial dashboards, personal finance, and accounting tools',
  roles: ['ceo', 'admin', 'accountant'],
  items: [
    { id: 'financial-dashboard', label: 'Financial Dashboard', path: '/grabba/financial-dashboard', icon: DollarSign, roles: ['ceo', 'admin', 'accountant'] },
    { id: 'personal-finance', label: 'Personal Finance', path: '/grabba/personal-finance', icon: Wallet, roles: ['ceo', 'admin'] },
    { id: 'payroll-manager', label: 'Payroll Manager', path: '/grabba/payroll-manager', icon: Calculator, roles: ['ceo', 'admin', 'accountant'] },
    { id: 'advisor-penthouse-2', label: 'Financial Advisor', path: '/grabba/advisor-penthouse', icon: Brain, roles: ['ceo', 'admin'] },
  ],
};

export const SECTION_GLOBAL: OSFloor = {
  id: 'section-global',
  name: 'Global Tools',
  icon: Globe,
  emoji: '🌍',
  description: 'Holdings, assets, and global administration',
  roles: ['ceo', 'admin'],
  items: [
    { id: 'holdings-overview', label: 'Holdings Overview', path: '/holdings', icon: Building2, roles: ['ceo', 'admin'] },
    { id: 'holdings-assets', label: 'Holdings Assets', path: '/holdings/assets', icon: Boxes, roles: ['ceo', 'admin'] },
    { id: 'brand-dashboard', label: 'Brand Dashboard', path: '/brand-dashboard', icon: Star, roles: ['ceo', 'admin'] },
  ],
};

export const SECTION_REAL_ESTATE: OSFloor = {
  id: 'section-real-estate',
  name: 'Real Estate OS',
  icon: Home,
  emoji: '🏠',
  description: 'Real estate leads, pipeline, and investments',
  roles: ['ceo', 'admin'],
  items: [
    { id: 're-dashboard', label: 'RE Dashboard', path: '/real-estate', icon: Home, roles: ['ceo', 'admin'] },
    { id: 're-leads', label: 'RE Leads', path: '/real-estate/leads', icon: Target, roles: ['ceo', 'admin'] },
    { id: 're-pipeline', label: 'RE Pipeline', path: '/real-estate/pipeline', icon: TrendingUp, roles: ['ceo', 'admin'] },
    { id: 're-investors', label: 'Investors', path: '/real-estate/investors', icon: Users, roles: ['ceo', 'admin'] },
  ],
};

export const SECTION_POD: OSFloor = {
  id: 'section-pod',
  name: 'Print on Demand',
  icon: Boxes,
  emoji: '🎨',
  description: 'POD designs, mockups, and scaling',
  roles: ['ceo', 'admin'],
  items: [
    { id: 'pod-overview', label: 'POD Overview', path: '/pod', icon: Boxes, roles: ['ceo', 'admin'] },
    { id: 'pod-designs', label: 'Designs', path: '/pod/designs', icon: Star, roles: ['ceo', 'admin'] },
    { id: 'pod-mockups', label: 'Mockups', path: '/pod/mockups', icon: Package, roles: ['ceo', 'admin'] },
    { id: 'pod-analytics', label: 'POD Analytics', path: '/pod/analytics', icon: BarChart3, roles: ['ceo', 'admin'] },
  ],
};

export const ADDITIONAL_SECTIONS: OSFloor[] = [
  SECTION_MARKETPLACE_ADMIN,
  SECTION_ACCOUNTING,
  SECTION_GLOBAL,
  SECTION_REAL_ESTATE,
  SECTION_POD,
];

// ═══════════════════════════════════════════════════════════════════════════════
// PORTAL DEFINITIONS — Role-specific entry points
// ═══════════════════════════════════════════════════════════════════════════════
export interface PortalConfig {
  id: string;
  role: OSRole;
  label: string;
  path: string;
  icon: LucideIcon;
  color: string;
  description: string;
}

export const PORTALS: PortalConfig[] = [
  { id: 'driver-portal', role: 'driver', label: 'Driver Portal', path: '/portal/driver', icon: Car, color: 'hsl(210, 100%, 50%)', description: 'Routes, deliveries, earnings' },
  { id: 'biker-portal', role: 'biker', label: 'Biker Portal', path: '/portal/biker', icon: Bike, color: 'hsl(180, 100%, 40%)', description: 'Pickups, dropoffs, checks' },
  { id: 'ambassador-portal', role: 'ambassador', label: 'Ambassador Portal', path: '/portal/ambassador', icon: Star, color: 'hsl(150, 100%, 40%)', description: 'Referrals, commissions, stores' },
  { id: 'store-portal', role: 'store', label: 'Store Buyer Portal', path: '/portal/store', icon: Store, color: 'hsl(270, 100%, 50%)', description: 'Orders, products, invoices' },
  { id: 'wholesaler-portal', role: 'wholesaler', label: 'Wholesaler Seller Portal', path: '/portal/wholesaler', icon: Boxes, color: 'hsl(30, 100%, 50%)', description: 'Products, orders, payouts' },
  { id: 'customer-portal', role: 'customer', label: 'Customer Account Portal', path: '/portal/customer', icon: Heart, color: 'hsl(340, 100%, 50%)', description: 'Orders, rewards, support' },
  { id: 'production-portal', role: 'production', label: 'Production Portal', path: '/portal/production', icon: Factory, color: 'hsl(45, 100%, 50%)', description: 'Daily counts, inventory, tools' },
  { id: 'va-portal', role: 'va', label: 'VA Portal', path: '/portal/va', icon: UserCircle, color: 'hsl(200, 100%, 50%)', description: 'CRM, tasks, communications' },
  { id: 'national-wholesale-portal', role: 'wholesaler', label: 'National Wholesale Portal', path: '/portal/national-wholesale', icon: Globe, color: 'hsl(220, 100%, 50%)', description: 'Nationwide distribution' },
  { id: 'marketplace-admin-portal', role: 'admin', label: 'Marketplace Admin Portal', path: '/portal/marketplace-admin', icon: Cog, color: 'hsl(0, 0%, 50%)', description: 'Marketplace management' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// COMBINED NAVIGATION ARRAY
// ═══════════════════════════════════════════════════════════════════════════════
export const ALL_FLOORS: OSFloor[] = [
  ...OS_FLOORS,
  ...ADDITIONAL_SECTIONS,
];

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// Get navigation items for a specific role
export function getNavForRole(role: OSRole): OSFloor[] {
  return OS_FLOORS
    .filter(floor => floor.roles.includes(role))
    .map(floor => ({
      ...floor,
      items: floor.items.filter(item => item.roles.includes(role)),
    }))
    .filter(floor => floor.items.length > 0);
}

// Get portal config for a role
export function getPortalForRole(role: OSRole): PortalConfig | undefined {
  return PORTALS.find(p => p.role === role);
}

// Get redirect path for a role
export function getRoleRedirectPath(role: OSRole): string {
  // Normalize store_owner to store
  const normalizedRole = role === 'store_owner' ? 'store' : role;
  const portal = getPortalForRole(normalizedRole);
  return portal?.path || '/portal/home';
}

// Check if a role can access a path
export function canAccessPath(role: OSRole, path: string): boolean {
  for (const floor of ALL_FLOORS) {
    for (const item of floor.items) {
      if (item.path === path && item.roles.includes(role)) {
        return true;
      }
    }
  }
  return false;
}

// Get all paths a role can access
export function getAllPathsForRole(role: OSRole): string[] {
  const paths: string[] = [];
  for (const floor of ALL_FLOORS) {
    for (const item of floor.items) {
      if (item.roles.includes(role)) {
        paths.push(item.path);
      }
    }
  }
  return paths;
}

// Get floor by path
export function getFloorByPath(path: string): OSFloor | undefined {
  return ALL_FLOORS.find(floor => 
    floor.items.some(item => item.path === path || path.startsWith(item.path + '/'))
  );
}

// Check if user is admin/ceo
export function isAdminRole(role: OSRole): boolean {
  return role === 'admin' || role === 'ceo' || role === 'va';
}

// Check if user is a field role
export function isFieldRole(role: OSRole): boolean {
  return role === 'driver' || role === 'biker';
}

// Check if user is a portal role (external user)
export function isPortalRole(role: OSRole): boolean {
  return ['store', 'wholesaler', 'ambassador', 'customer', 'production'].includes(role);
}
