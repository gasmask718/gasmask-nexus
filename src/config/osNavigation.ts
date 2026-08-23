import {
  Crown, Building2, MessageSquare, Package, Truck, FileText, 
  Factory, Boxes, Users, Map, DollarSign, BarChart3, Settings,
  LayoutDashboard, Brain, Shield, ShieldCheck, Phone, Mail, Target, Award,
  Home, ShoppingCart, Wallet, UserCircle, ClipboardList, Briefcase,
  Globe, Zap, PieChart, Database, Cog, Bell, Calculator, Store,
  Bike, Car, Star, Heart, TrendingUp, Activity, Calendar, 
  CheckSquare, Clipboard, Rocket, Gift, CreditCard, Receipt,
  Banknote, LineChart, Bot, Cpu, Eye, Megaphone, UserPlus,
  type LucideIcon
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// DYNASTY OS MEGA-ARCHITECTURE — FORTUNE 500 NAVIGATION BLUEPRINT
// Single source of truth for all navigation across the entire platform
// ═══════════════════════════════════════════════════════════════════════════════

// Role Types
export type OSRole = 
  | 'ceo' 
  | 'admin' 
  | 'va' 
  | 'driver' 
  | 'biker' 
  | 'store' 
  | 'store_owner'
  | 'wholesaler' 
  | 'ambassador' 
  | 'production' 
  | 'customer'
  | 'user'
  | 'accountant'
  | 'csr'
  | 'pending';

// Brand Configuration
export const DYNASTY_BRANDS = {
  gasmask: { id: 'gasmask', name: 'GasMask', color: '#FF0000', icon: '🔴' },
  hotmama: { id: 'hotmama', name: 'HotMama', color: '#B76E79', icon: '🟣' },
  scalati: { id: 'scalati', name: 'Hotscolatti', color: '#FF7A00', icon: '🟠' },
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
// 👑 PENTHOUSE — COMMAND CENTER (Intelligence + Ownership)
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
    { id: 'mission-control', label: 'Mission Control', path: '/penthouse/missions', icon: Target, badge: 'NEW', description: 'Founder Execution OS — Cross-business task intelligence', roles: ['ceo', 'admin'] },
    { id: 'accounting-os', label: 'Accounting OS', path: '/penthouse/accounting', icon: Calculator, badge: 'CPA', description: 'CPA-grade financial intelligence — business & personal', roles: ['ceo', 'admin', 'accountant'] },
    { id: 'audit-engine', label: 'Audit Engine', path: '/penthouse/audit-engine', icon: ShieldCheck, description: 'Invoice verification, reconciliation & strict ledger validation', roles: ['ceo', 'admin'] },
    { id: 'global-intelligence', label: 'Global Intelligence', path: '/grabba/ai-insights', icon: Brain, roles: ['ceo', 'admin'] },
    { id: 'financial-command', label: 'Financial Command', path: '/grabba/advisor-penthouse', icon: DollarSign, roles: ['ceo', 'admin'] },
    { id: 'executive-reports', label: 'Executive Reports', path: '/executive-reports', icon: PieChart, roles: ['ceo', 'admin'] },
    { id: 'ceo-ai-assistant', label: 'CEO AI Assistant', path: '/ai/ceo-control', icon: Zap, roles: ['ceo', 'admin'] },
    { id: 'os-settings', label: 'OS Settings', path: '/settings', icon: Settings, roles: ['ceo', 'admin'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🏢 FLOOR 1 — CRM & STORE MASTER
// ═══════════════════════════════════════════════════════════════════════════════
export const FLOOR_1_CRM: OSFloor = {
  id: 'floor-1-crm',
  name: 'Floor 1: CRM & Store Master',
  icon: Building2,
  emoji: '🏢',
  description: 'Customer relationships, stores, contacts, and sales pipeline',
  roles: ['ceo', 'admin', 'va', 'ambassador'],
  items: [
    { id: 'crm-hub', label: 'CRM Hub', path: '/grabba/crm', icon: Building2, roles: ['ceo', 'admin', 'va'] },
    { id: 'store-master', label: 'Store Master', path: '/stores', icon: Store, roles: ['ceo', 'admin', 'va', 'driver'] },
    { id: 'brand-crm', label: 'Brand CRM', path: '/brand-crm', icon: Target, roles: ['ceo', 'admin', 'va'] },
    { id: 'crm-contacts', label: 'Contacts', path: '/crm/contacts', icon: Users, roles: ['ceo', 'admin', 'va'] },
    { id: 'crm-customers', label: 'Customers', path: '/crm/customers', icon: UserCircle, roles: ['ceo', 'admin', 'va'] },
    { id: 'companies', label: 'Companies', path: '/companies', icon: Briefcase, roles: ['ceo', 'admin', 'va'] },
    { id: 'sales-prospects', label: 'Sales Prospects', path: '/sales/prospects', icon: Target, roles: ['ceo', 'admin', 'va'] },
    { id: 'sales-report', label: 'Sales Report', path: '/sales/report', icon: BarChart3, roles: ['ceo', 'admin', 'va'] },
    { id: 'store-performance', label: 'Store Performance', path: '/store-performance', icon: TrendingUp, roles: ['ceo', 'admin', 'va'] },
    { id: 'opportunities', label: 'All Opportunities', path: '/opportunities', icon: Target, roles: ['ceo', 'admin', 'va', 'csr'] },
    { id: 'report-account-activity', label: 'Account Activity Report', path: '/reports/account-activity', icon: Activity, roles: ['ceo', 'admin', 'va'] },
    { id: 'report-samples-by-store', label: 'Samples by Store', path: '/reports/samples-by-store', icon: Gift, roles: ['ceo', 'admin', 'va'] },
    { id: 'report-samples-by-brand', label: 'Samples by Brand', path: '/reports/samples-by-brand', icon: PieChart, roles: ['ceo', 'admin', 'va'] },
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
  description: 'Communications, call center, tasks, and workforce management',
  roles: ['ceo', 'admin', 'va'],
  items: [
    { id: 'communication-hub', label: 'Communication Hub', path: '/grabba/communication', icon: MessageSquare, roles: ['ceo', 'admin', 'va'] },
    { id: 'text-center', label: 'Text Center', path: '/grabba/communication', icon: Phone, roles: ['ceo', 'admin', 'va'] },
    { id: 'email-center', label: 'Email Center', path: '/grabba/communication', icon: Mail, roles: ['ceo', 'admin', 'va'] },
    { id: 'call-center', label: 'Call Center', path: '/grabba/communication', icon: Phone, roles: ['ceo', 'admin', 'va'] },
    { id: 'task-center', label: 'Task Center', path: '/tasks', icon: CheckSquare, roles: ['ceo', 'admin', 'va'] },
    { id: 'automation', label: 'Automation', path: '/grabba/autopilot', icon: Zap, roles: ['ceo', 'admin'] },
    { id: 'daily-briefing', label: 'Daily Briefing', path: '/grabba/daily-briefing', icon: Calendar, roles: ['ceo', 'admin', 'va'] },
    { id: 'workforce-tasks', label: 'Workforce Tasks', path: '/workforce/tasks', icon: Clipboard, roles: ['ceo', 'admin', 'va'] },
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
  description: 'Grabba inventory, tube counts, stock overview',
  roles: ['ceo', 'admin', 'va', 'production'],
  items: [
    { id: 'grabba-inventory', label: 'Grabba Inventory', path: '/grabba/inventory', icon: Package, roles: ['ceo', 'admin', 'va', 'production'] },
    { id: 'tube-counts', label: 'Tube Counts', path: '/grabba/production', icon: Factory, roles: ['ceo', 'admin', 'va', 'production'] },
    { id: 'stock-overview', label: 'Stock Overview', path: '/inventory/stock', icon: Boxes, roles: ['ceo', 'admin', 'va'] },
    { id: 'products', label: 'Products', path: '/products', icon: Boxes, roles: ['ceo', 'admin', 'va'] },
    { id: 'product-conversions', label: 'Product Conversions', path: '/os/product-conversions', icon: Settings, roles: ['ceo', 'admin'] },
    { id: 'warehouse-brain', label: 'Warehouse Brain', path: '/os/warehouse', icon: Factory, roles: ['ceo', 'admin'] },
    { id: 'procurement', label: 'Procurement', path: '/os/procurement', icon: Database, roles: ['ceo', 'admin'] },
    { id: 'low-stock-alerts', label: 'Low Stock Alerts', path: '/inventory/alerts', icon: Bell, badge: 'Live', roles: ['ceo', 'admin', 'va'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🚴 FLOOR 4 — DELIVERY & ROUTING
// ═══════════════════════════════════════════════════════════════════════════════
export const FLOOR_4_DELIVERY: OSFloor = {
  id: 'floor-4-delivery',
  name: 'Floor 4: Delivery & Routing',
  icon: Truck,
  emoji: '🚴',
  description: 'Drivers, bikers, route plans, and delivery operations',
  roles: ['ceo', 'admin', 'va', 'driver', 'biker'],
  items: [
    { id: 'deliveries', label: 'Deliveries', path: '/grabba/deliveries', icon: Truck, roles: ['ceo', 'admin', 'va'] },
    { id: 'assignments', label: 'Order Assignments', path: '/grabba/assignments', icon: ClipboardList, roles: ['ceo', 'admin', 'va'] },
    { id: 'driver-management', label: 'Driver Management', path: '/driver', icon: Car, roles: ['ceo', 'admin', 'va'] },
    { id: 'biker-management', label: 'Biker Management', path: '/biker', icon: Bike, roles: ['ceo', 'admin', 'va'] },
    { id: 'routes', label: 'Route Plans', path: '/routes', icon: Map, roles: ['ceo', 'admin', 'va', 'driver'] },
    { id: 'route-optimizer', label: 'Route Optimizer', path: '/route-optimizer', icon: Target, roles: ['ceo', 'admin', 'va'] },
    { id: 'live-map', label: 'Live Map', path: '/operations/live-map', icon: Globe, roles: ['ceo', 'admin', 'va'] },
    { id: 'biker-payouts', label: 'Biker Payouts', path: '/delivery/payouts', icon: Wallet, roles: ['ceo', 'admin', 'va'] },
    { id: 'driver-payouts', label: 'Driver Payouts', path: '/delivery/payouts', icon: Wallet, roles: ['ceo', 'admin', 'va'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 💰 FLOOR 5 — FINANCE & ORDERS (Operational Execution Only)
// ═══════════════════════════════════════════════════════════════════════════════
export const FLOOR_5_FINANCE: OSFloor = {
  id: 'floor-5-finance',
  name: 'Floor 5: Finance & Orders',
  icon: DollarSign,
  emoji: '💰',
  description: 'Operational finance — invoices, billing, payroll, unpaid accounts',
  roles: ['ceo', 'admin', 'va', 'accountant'],
  items: [
    { id: 'floor5-dashboard', label: 'Finance Dashboard', path: '/floor5', icon: DollarSign, roles: ['ceo', 'admin', 'va', 'accountant'] },
    { id: 'invoices', label: 'Invoices', path: '/billing/invoices', icon: FileText, roles: ['ceo', 'admin', 'va', 'accountant'] },
    { id: 'billing-center', label: 'Billing Center', path: '/billing-center', icon: CreditCard, roles: ['ceo', 'admin', 'va', 'accountant'] },
    { id: 'unpaid-accounts', label: 'Unpaid Accounts', path: '/unpaid-accounts', icon: Bell, badge: 'Alert', roles: ['ceo', 'admin', 'va'] },
    { id: 'payroll', label: 'Payroll', path: '/payroll', icon: Banknote, roles: ['ceo', 'admin', 'accountant'] },
    { id: 'payroll-manager', label: 'Payroll Manager', path: '/grabba/payroll-manager', icon: Calculator, roles: ['ceo', 'admin', 'accountant'] },
    { id: 'business-ledger', label: 'Business Ledger', path: '/grabba/finance', icon: Receipt, roles: ['ceo', 'admin', 'va', 'accountant'] },
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
  description: 'Ambassador CRM, commissions, signup center',
  roles: ['ceo', 'admin', 'va', 'ambassador'],
  items: [
    { id: 'ambassador-crm', label: 'Ambassador CRM', path: '/grabba/ambassadors', icon: Users, roles: ['ceo', 'admin', 'va'] },
    { id: 'ambassador-commissions', label: 'Commissions', path: '/ambassador-commissions', icon: DollarSign, roles: ['ceo', 'admin', 'va'] },
    { id: 'ambassador-signup', label: 'Signup Center', path: '/ambassador-signup', icon: UserPlus, roles: ['ceo', 'admin', 'va'] },
    { id: 'ambassador-regions', label: 'Ambassador Regions', path: '/ambassador-regions', icon: Map, roles: ['ceo', 'admin', 'va'] },
    { id: 'ambassador-payouts', label: 'Ambassador Payouts', path: '/ambassador-payouts', icon: Wallet, roles: ['ceo', 'admin', 'va'] },
    { id: 'ambassador-leaderboard', label: 'Leaderboard', path: '/ambassador-leaderboard', icon: Award, roles: ['ceo', 'admin', 'va'] },
    { id: 'referral-tracking', label: 'Referral Tracking', path: '/referral-tracking', icon: Target, roles: ['ceo', 'admin', 'va'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🛒 FLOOR 7 — WHOLESALE PLATFORM (Wholesale Only — PERIOD)
// ═══════════════════════════════════════════════════════════════════════════════
export const FLOOR_7_WHOLESALE: OSFloor = {
  id: 'floor-7-wholesale',
  name: 'Floor 7: Wholesale Platform',
  icon: ShoppingCart,
  emoji: '🛒',
  description: 'Wholesale marketplace, directory, and fulfillment',
  roles: ['ceo', 'admin', 'va', 'wholesaler'],
  items: [
    { id: 'wholesale-platform', label: 'Wholesale Platform', path: '/grabba/wholesale-platform', icon: Boxes, roles: ['ceo', 'admin', 'va'] },
    { id: 'wholesale-directory', label: 'Wholesale Directory', path: '/wholesale', icon: Store, roles: ['ceo', 'admin', 'va'] },
    { id: 'wholesale-marketplace', label: 'Wholesale Marketplace', path: '/wholesale-marketplace', icon: Globe, roles: ['ceo', 'admin', 'va'] },
    { id: 'national-wholesale', label: 'National Wholesale', path: '/portal/national-wholesale', icon: Globe, roles: ['ceo', 'admin'] },
    { id: 'marketplace-admin', label: 'Marketplace Admin', path: '/portal/marketplace-admin', icon: Cog, roles: ['ceo', 'admin'] },
    { id: 'wholesale-fulfillment', label: 'Fulfillment', path: '/wholesale/fulfillment', icon: Package, roles: ['ceo', 'admin', 'va'] },
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
  description: 'AI copilot, AI workforce, insights',
  roles: ['ceo', 'admin', 'va'],
  items: [
    { id: 'ai-copilot', label: 'AI Copilot', path: '/grabba/ai', icon: Bot, roles: ['ceo', 'admin', 'va'] },
    { id: 'ai-workforce', label: 'AI Workforce', path: '/ai/workforce', icon: Cpu, roles: ['ceo', 'admin', 'va'] },
    // Floor 9 canonical links (legacy AI routes redirect here)
    { id: 'floor9-results', label: 'AI Results', path: '/grabba/floor9/results', icon: Eye, roles: ['ceo', 'admin'] },
    { id: 'floor9-playbooks', label: 'AI Playbooks', path: '/grabba/floor9/playbooks', icon: ClipboardList, roles: ['ceo', 'admin'] },
    { id: 'floor9-instinct', label: 'Instinct Log', path: '/grabba/floor9/instinct-log', icon: Cog, roles: ['ceo', 'admin'] },
    { id: 'risk-radar', label: 'Risk Radar', path: '/grabba/risk-radar', icon: Shield, roles: ['ceo', 'admin'] },
    { id: 'analytics', label: 'Analytics', path: '/analytics', icon: BarChart3, roles: ['ceo', 'admin', 'va'] },
    { id: 'expansion', label: 'Expansion', path: '/expansion', icon: Rocket, roles: ['ceo', 'admin'] },
    { id: 'territories', label: 'Territories', path: '/territories', icon: Map, roles: ['ceo', 'admin', 'va'] },
    { id: 'leaderboard', label: 'Leaderboard', path: '/leaderboard', icon: Award, roles: ['ceo', 'admin', 'va'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 HR & WORKFORCE FLOOR
// ═══════════════════════════════════════════════════════════════════════════════
export const FLOOR_HR: OSFloor = {
  id: 'floor-hr',
  name: 'HR & Workforce',
  icon: Briefcase,
  emoji: '📋',
  description: 'Employees, hiring, onboarding, and HR management',
  roles: ['ceo', 'admin'],
  items: [
    { id: 'hr-dashboard', label: 'HR Dashboard', path: '/hr', icon: Briefcase, roles: ['ceo', 'admin'] },
    { id: 'employees', label: 'Employees', path: '/hr/employees', icon: Users, roles: ['ceo', 'admin'] },
    { id: 'applicants', label: 'Applicants', path: '/hr/applicants', icon: UserCircle, roles: ['ceo', 'admin'] },
    { id: 'interviews', label: 'Interviews', path: '/hr/interviews', icon: Calendar, roles: ['ceo', 'admin'] },
    { id: 'hr-payroll', label: 'HR Payroll', path: '/hr/payroll', icon: DollarSign, roles: ['ceo', 'admin'] },
    { id: 'onboarding', label: 'Onboarding', path: '/hr/onboarding', icon: Rocket, roles: ['ceo', 'admin'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN OS FLOORS ARRAY
// ═══════════════════════════════════════════════════════════════════════════════
export const OS_FLOORS: OSFloor[] = [
  PENTHOUSE,
  FLOOR_1_CRM,
  FLOOR_2_OPERATIONS,
  FLOOR_3_INVENTORY,
  FLOOR_4_DELIVERY,
  FLOOR_5_FINANCE,
  FLOOR_6_AMBASSADORS,
  FLOOR_7_WHOLESALE,
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
  description: 'Marketplace management and administration',
  roles: ['ceo', 'admin'],
  items: [
    { id: 'mp-admin-dashboard', label: 'Admin Dashboard', path: '/portal/marketplace-admin', icon: Cog, roles: ['ceo', 'admin'] },
    { id: 'mp-national-wholesale', label: 'National Wholesale', path: '/portal/national-wholesale', icon: Globe, roles: ['ceo', 'admin'] },
    { id: 'mp-order-management', label: 'Order Management', path: '/marketplace/orders', icon: ClipboardList, roles: ['ceo', 'admin'] },
    { id: 'mp-promotions', label: 'Promotions', path: '/marketplace/promotions', icon: Gift, roles: ['ceo', 'admin'] },
  ],
};

// SECTION_ACCOUNTING removed — Accounting OS lives ONLY in Penthouse (/penthouse/accounting)
// This section was a duplicate and violated the Master Architect directive.

export const SECTION_GLOBAL: OSFloor = {
  id: 'section-global',
  name: 'Global Tools',
  icon: Globe,
  emoji: '🌍',
  description: 'Holdings, assets, and global administration',
  roles: ['ceo', 'admin'],
  items: [
    { id: 'global-holdings', label: 'Holdings Overview', path: '/holdings', icon: Building2, roles: ['ceo', 'admin'] },
    { id: 'global-assets', label: 'Holdings Assets', path: '/holdings/assets', icon: Boxes, roles: ['ceo', 'admin'] },
    { id: 'global-brand-dashboard', label: 'Brand Dashboard', path: '/brand-dashboard', icon: Star, roles: ['ceo', 'admin'] },
    { id: 'global-translations', label: 'Translations', path: '/translations', icon: Globe, roles: ['ceo', 'admin'] },
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
    { id: 're-properties', label: 'Properties', path: '/real-estate/properties', icon: Building2, roles: ['ceo', 'admin'] },
  ],
};

export const SECTION_POD: OSFloor = {
  id: 'section-pod',
  name: 'Print on Demand',
  icon: Megaphone,
  emoji: '🎨',
  description: 'POD designs, mockups, and scaling',
  roles: ['ceo', 'admin'],
  items: [
    { id: 'pod-overview', label: 'POD Overview', path: '/pod', icon: Boxes, roles: ['ceo', 'admin'] },
    { id: 'pod-designs', label: 'Designs', path: '/pod/designs', icon: Star, roles: ['ceo', 'admin'] },
    { id: 'pod-mockups', label: 'Mockups', path: '/pod/mockups', icon: Package, roles: ['ceo', 'admin'] },
    { id: 'pod-analytics', label: 'POD Analytics', path: '/pod/analytics', icon: BarChart3, roles: ['ceo', 'admin'] },
    { id: 'pod-orders', label: 'POD Orders', path: '/pod/orders', icon: ClipboardList, roles: ['ceo', 'admin'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📞 CALL CENTER OS
// ═══════════════════════════════════════════════════════════════════════════════
export const SECTION_CALL_CENTER: OSFloor = {
  id: 'section-call-center',
  name: 'Call Center OS',
  icon: Phone,
  emoji: '📞',
  description: 'Call center operations, dialers, and AI agents',
  roles: ['ceo', 'admin', 'va', 'csr'],
  items: [
    { id: 'cc-dashboard', label: 'Dashboard', path: '/callcenter', icon: LayoutDashboard, roles: ['ceo', 'admin', 'va', 'csr'] },
    { id: 'cc-dialer', label: 'Dialer', path: '/call-center/dialer', icon: Phone, roles: ['ceo', 'admin', 'va', 'csr'] },
    { id: 'cc-logs', label: 'Call Logs', path: '/call-center/logs', icon: FileText, roles: ['ceo', 'admin', 'va', 'csr'] },
    { id: 'cc-ai-agents', label: 'AI Agents', path: '/call-center/ai-agents', icon: Bot, roles: ['ceo', 'admin'] },
    { id: 'cc-analytics', label: 'Analytics', path: '/call-center/analytics', icon: BarChart3, roles: ['ceo', 'admin', 'va'] },
    { id: 'cc-live', label: 'Live Monitoring', path: '/call-center/monitoring', icon: Activity, roles: ['ceo', 'admin'] },
    { id: 'cc-numbers', label: 'Phone Numbers', path: '/call-center/numbers', icon: Phone, roles: ['ceo', 'admin'] },
    { id: 'cc-messages', label: 'Messages', path: '/call-center/messages', icon: MessageSquare, roles: ['ceo', 'admin', 'va', 'csr'] },
    { id: 'cc-emails', label: 'Emails', path: '/call-center/emails', icon: Mail, roles: ['ceo', 'admin', 'va', 'csr'] },
    { id: 'cc-settings', label: 'Settings', path: '/call-center/settings', icon: Settings, roles: ['ceo', 'admin'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 💬 COMMUNICATION HUB
// ═══════════════════════════════════════════════════════════════════════════════
export const SECTION_COMMUNICATION: OSFloor = {
  id: 'section-communication',
  name: 'Communication Hub',
  icon: MessageSquare,
  emoji: '💬',
  description: 'Multi-channel communication center',
  roles: ['ceo', 'admin', 'va'],
  items: [
    { id: 'comm-overview', label: 'Overview', path: '/communication', icon: LayoutDashboard, roles: ['ceo', 'admin', 'va'] },
    { id: 'comm-sms', label: 'SMS Center', path: '/communication/sms', icon: MessageSquare, roles: ['ceo', 'admin', 'va'] },
    { id: 'comm-email', label: 'Email Center', path: '/communication/email', icon: Mail, roles: ['ceo', 'admin', 'va'] },
    { id: 'comm-calls', label: 'Calls', path: '/communication/calls', icon: Phone, roles: ['ceo', 'admin', 'va'] },
    { id: 'comm-campaigns', label: 'Campaigns', path: '/communication/campaigns', icon: Megaphone, roles: ['ceo', 'admin', 'va'] },
    { id: 'comm-ai-agents', label: 'AI Agents', path: '/communication/ai-agents', icon: Bot, roles: ['ceo', 'admin'] },
    { id: 'comm-logs', label: 'Logs', path: '/communication/logs', icon: FileText, roles: ['ceo', 'admin', 'va'] },
    { id: 'comm-analytics', label: 'Analytics', path: '/communication/analytics', icon: BarChart3, roles: ['ceo', 'admin', 'va'] },
    { id: 'comm-settings', label: 'Settings', path: '/communication/settings', icon: Settings, roles: ['ceo', 'admin'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔥 GRABBA OS (Extended)
// ═══════════════════════════════════════════════════════════════════════════════
export const SECTION_GRABBA_OS: OSFloor = {
  id: 'section-grabba-os',
  name: 'Grabba OS',
  icon: Zap,
  emoji: '🔥',
  description: 'Grabba brand management and operations',
  roles: ['ceo', 'admin', 'va'],
  items: [
    { id: 'grabba-penthouse', label: 'Command Penthouse', path: '/grabba/command-penthouse', icon: Crown, roles: ['ceo', 'admin'] },
    { id: 'grabba-cluster', label: 'Cluster Dashboard', path: '/grabba/cluster-dashboard', icon: LayoutDashboard, roles: ['ceo', 'admin', 'va'] },
    // Floor 9 - AI Operations (canonical route: /grabba/floor9)
    { id: 'grabba-floor9', label: 'Floor 9 — AI Ops', path: '/grabba/floor9', icon: Brain, roles: ['ceo', 'admin'] },
    { id: 'grabba-floor9-playbooks', label: 'AI Playbooks', path: '/grabba/floor9/playbooks', icon: ClipboardList, roles: ['ceo', 'admin'] },
    { id: 'grabba-floor9-queue', label: 'Action Queue', path: '/grabba/floor9/action-queue', icon: Bell, roles: ['ceo', 'admin'] },
    { id: 'grabba-floor9-instinct', label: 'Instinct Log', path: '/grabba/floor9/instinct-log', icon: Eye, roles: ['ceo', 'admin'] },
    { id: 'grabba-floor9-results', label: 'AI Results', path: '/grabba/floor9/results', icon: BarChart3, roles: ['ceo', 'admin'] },
    { id: 'grabba-autopilot', label: 'Autopilot Console', path: '/grabba/autopilot', icon: Zap, roles: ['ceo', 'admin'] },
    { id: 'grabba-upload', label: 'Unified Upload', path: '/grabba/unified-upload', icon: Database, roles: ['ceo', 'admin', 'va'] },
    { id: 'grabba-delivery', label: 'Multi-Brand Delivery', path: '/grabba/multi-brand-delivery', icon: Truck, roles: ['ceo', 'admin', 'va'] },
    { id: 'grabba-command', label: 'Command Console', path: '/grabba/command-console', icon: Cpu, roles: ['ceo', 'admin'] },
    { id: 'grabba-drilldown', label: 'Drilldown', path: '/grabba/drilldown', icon: Target, roles: ['ceo', 'admin'] },
    { id: 'grabba-briefing', label: 'Daily Briefing', path: '/grabba/daily-briefing', icon: Calendar, roles: ['ceo', 'admin', 'va'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 WAREHOUSE & PROCUREMENT
// ═══════════════════════════════════════════════════════════════════════════════
export const SECTION_WAREHOUSE: OSFloor = {
  id: 'section-warehouse',
  name: 'Warehouse & Procurement',
  icon: Factory,
  emoji: '🏭',
  description: 'Warehouse operations and procurement management',
  roles: ['ceo', 'admin', 'va'],
  items: [
    { id: 'warehouse-dash', label: 'Warehouse Dashboard', path: '/os/warehouse', icon: Factory, roles: ['ceo', 'admin', 'va'] },
    { id: 'procurement-dash', label: 'Procurement Dashboard', path: '/os/procurement', icon: Database, roles: ['ceo', 'admin', 'va'] },
    { id: 'procurement-suppliers', label: 'Suppliers', path: '/os/procurement/suppliers', icon: Users, roles: ['ceo', 'admin', 'va'] },
    { id: 'procurement-orders', label: 'Purchase Orders', path: '/os/procurement/purchase-orders', icon: ClipboardList, roles: ['ceo', 'admin', 'va'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🛍️ LEGACY CRM SYSTEMS
// ═══════════════════════════════════════════════════════════════════════════════
export const SECTION_LEGACY_CRM: OSFloor = {
  id: 'section-legacy-crm',
  name: 'CRM Legacy Systems',
  icon: Building2,
  emoji: '🗂️',
  description: 'Legacy CRM pages and tools',
  roles: ['ceo', 'admin', 'va'],
  items: [
    { id: 'legacy-crm-main', label: 'CRM Main', path: '/crm', icon: Building2, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-crm-follow', label: 'Follow-Ups', path: '/crm/follow-ups', icon: Bell, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-crm-data', label: 'CRM Data', path: '/crm/data', icon: Database, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-crm-export', label: 'Data Export', path: '/crm/data/export', icon: FileText, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-crm-import', label: 'Data Import', path: '/crm/data/import', icon: Database, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-crm-backup', label: 'Backup Settings', path: '/crm/backup-settings', icon: Settings, roles: ['ceo', 'admin'] },
    { id: 'legacy-text', label: 'Text Center', path: '/text-center', icon: MessageSquare, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-email', label: 'Email Center', path: '/email-center', icon: Mail, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-call', label: 'Call Center', path: '/call-center', icon: Phone, roles: ['ceo', 'admin', 'va'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 💼 FUNDING & LOANS
// ═══════════════════════════════════════════════════════════════════════════════
export const SECTION_FUNDING: OSFloor = {
  id: 'section-funding',
  name: 'Funding & Loans',
  icon: Banknote,
  emoji: '💼',
  description: 'Funding requests and loan management',
  roles: ['ceo', 'admin'],
  items: [
    { id: 'funding-requests', label: 'Funding Requests', path: '/funding/requests', icon: Banknote, roles: ['ceo', 'admin'] },
    { id: 'loan-products', label: 'Loan Products', path: '/loans/products', icon: CreditCard, roles: ['ceo', 'admin'] },
    { id: 'lender-directory', label: 'Lender Directory', path: '/loans/lenders', icon: Users, roles: ['ceo', 'admin'] },
    { id: 'loan-calculators', label: 'Loan Calculators', path: '/loans/calculators', icon: Calculator, roles: ['ceo', 'admin'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🤖 AI TOOLS COLLECTION
// ═══════════════════════════════════════════════════════════════════════════════
export const SECTION_AI_TOOLS: OSFloor = {
  id: 'section-ai-tools',
  name: 'AI Tools',
  icon: Bot,
  emoji: '🤖',
  description: 'AI-powered tools and automation',
  roles: ['ceo', 'admin', 'va'],
  items: [
    { id: 'ai-ceo-room', label: 'CEO Control Room', path: '/ai/ceo-control', icon: Crown, roles: ['ceo', 'admin'] },
    { id: 'ai-workforce', label: 'AI Workforce', path: '/ai/workforce', icon: Users, roles: ['ceo', 'admin', 'va'] },
    { id: 'ai-command', label: 'AI Command Console', path: '/grabba/ai-command', icon: Cpu, roles: ['ceo', 'admin'] },
    { id: 'floor9-playbooks-link', label: 'AI Playbooks', path: '/grabba/floor9/playbooks', icon: ClipboardList, roles: ['ceo', 'admin'] },
    { id: 'floor9-hub-link', label: 'Floor 9 — AI Ops', path: '/grabba/floor9', icon: Cog, roles: ['ceo', 'admin'] },
    { id: 'ai-risk', label: 'Risk Radar', path: '/grabba/risk-radar', icon: Shield, roles: ['ceo', 'admin'] },
    { id: 'ai-followup', label: 'Follow-Up Settings', path: '/grabba/follow-up-settings', icon: Settings, roles: ['ceo', 'admin'] },
    { id: 'ai-dynasty', label: 'Dynasty Automations', path: '/automations/dynasty', icon: Zap, roles: ['ceo', 'admin'] },
    { id: 'ai-meta', label: 'Meta AI', path: '/ai/meta', icon: Brain, roles: ['ceo', 'admin'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 VA PERFORMANCE CENTER
// ═══════════════════════════════════════════════════════════════════════════════
export const SECTION_VA_CENTER: OSFloor = {
  id: 'section-va-center',
  name: 'VA Performance Center',
  icon: UserCircle,
  emoji: '📊',
  description: 'Virtual assistant performance and management',
  roles: ['ceo', 'admin', 'va'],
  items: [
    { id: 'va-performance', label: 'VA Performance', path: '/va/performance', icon: BarChart3, roles: ['ceo', 'admin', 'va'] },
    { id: 'va-ranking', label: 'VA Ranking', path: '/va/ranking', icon: Award, roles: ['ceo', 'admin', 'va'] },
    { id: 'va-tasks', label: 'VA Task Center', path: '/va/tasks', icon: CheckSquare, roles: ['ceo', 'admin', 'va'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🏢 HOLDINGS & ASSETS
// ═══════════════════════════════════════════════════════════════════════════════
export const SECTION_HOLDINGS: OSFloor = {
  id: 'section-holdings',
  name: 'Holdings & Assets',
  icon: Building2,
  emoji: '🏢',
  description: 'Holdings management and asset tracking',
  roles: ['ceo', 'admin'],
  items: [
    { id: 'holdings-overview', label: 'Holdings Overview', path: '/holdings', icon: Building2, roles: ['ceo', 'admin'] },
    { id: 'holdings-assets', label: 'Assets', path: '/holdings/assets', icon: Boxes, roles: ['ceo', 'admin'] },
    { id: 'holdings-airbnb', label: 'Airbnb Properties', path: '/holdings/airbnb', icon: Home, roles: ['ceo', 'admin'] },
    { id: 'holdings-tenants', label: 'Tenants', path: '/holdings/tenants', icon: Users, roles: ['ceo', 'admin'] },
    { id: 'holdings-loans', label: 'Loans', path: '/holdings/loans', icon: Banknote, roles: ['ceo', 'admin'] },
    { id: 'holdings-expenses', label: 'Expenses', path: '/holdings/expenses', icon: Receipt, roles: ['ceo', 'admin'] },
    { id: 'holdings-strategy', label: 'Strategy', path: '/holdings/strategy', icon: Target, roles: ['ceo', 'admin'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📁 LEGACY SYSTEMS (Auto-Recovered)
// ═══════════════════════════════════════════════════════════════════════════════
export const SECTION_LEGACY_SYSTEMS: OSFloor = {
  id: 'section-legacy-systems',
  name: 'Legacy Systems (Recovered)',
  icon: Database,
  emoji: '📁',
  description: 'Auto-recovered legacy pages and systems',
  roles: ['ceo', 'admin', 'va'],
  items: [
    // Old Communications
    { id: 'legacy-comms-main', label: 'Communications Main', path: '/communications', icon: MessageSquare, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-comms-ai', label: 'Communications AI', path: '/communications-ai', icon: Bot, roles: ['ceo', 'admin'] },
    { id: 'legacy-comms-auto', label: 'Communication Automation', path: '/communication-automation', icon: Zap, roles: ['ceo', 'admin'] },
    { id: 'legacy-comms-insights', label: 'Communication Insights', path: '/communication-insights', icon: Eye, roles: ['ceo', 'admin'] },
    { id: 'legacy-comms-overview', label: 'Comms Center Overview', path: '/communications-center', icon: LayoutDashboard, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-comms-logs', label: 'Comms Center Logs', path: '/communications-center/logs', icon: FileText, roles: ['ceo', 'admin', 'va'] },
    // Old Wholesale / Billing
    { id: 'legacy-wholesale', label: 'Wholesale Hub', path: '/wholesale', icon: Boxes, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-wholesale-mp', label: 'Wholesale Marketplace', path: '/wholesale-marketplace', icon: ShoppingCart, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-wholesale-fulfillment', label: 'Wholesale Fulfillment', path: '/wholesale/fulfillment', icon: Package, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-billing', label: 'Billing Dashboard', path: '/billing', icon: CreditCard, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-billing-center', label: 'Billing Center', path: '/billing-center', icon: Receipt, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-billing-invoices', label: 'Billing Invoices', path: '/billing/invoices', icon: FileText, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-unpaid', label: 'Unpaid Accounts', path: '/unpaid-accounts', icon: Bell, roles: ['ceo', 'admin', 'va'] },
    // Old Drivers/Bikers
    { id: 'legacy-driver', label: 'Driver Management', path: '/driver', icon: Car, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-driver-debt', label: 'Driver Debt Collection', path: '/driver-debt-collection', icon: DollarSign, roles: ['ceo', 'admin'] },
    { id: 'legacy-biker-payouts', label: 'Biker Payouts', path: '/delivery/payouts', icon: Wallet, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-delivery-capacity', label: 'Delivery Capacity', path: '/delivery-capacity', icon: Truck, roles: ['ceo', 'admin', 'va'] },
    // Old Analytics / Reports
    { id: 'legacy-analytics', label: 'Analytics', path: '/analytics', icon: BarChart3, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-economic', label: 'Economic Analytics', path: '/economic-analytics', icon: LineChart, roles: ['ceo', 'admin'] },
    { id: 'legacy-exec-reports', label: 'Executive Reports', path: '/executive-reports', icon: PieChart, roles: ['ceo', 'admin'] },
    { id: 'legacy-revenue-brain', label: 'Revenue Brain', path: '/revenue-brain', icon: Brain, roles: ['ceo', 'admin'] },
    // Old Marketing / Ambassadors  
    { id: 'legacy-ambassadors', label: 'Ambassadors', path: '/ambassadors', icon: Users, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-ambassador-pay', label: 'Ambassador Payouts', path: '/ambassador-payouts', icon: Wallet, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-ambassador-regions', label: 'Ambassador Regions', path: '/ambassador-regions', icon: Map, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-influencers', label: 'Influencers', path: '/influencers', icon: Star, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-influencer-campaigns', label: 'Influencer Campaigns', path: '/influencer-campaigns', icon: Megaphone, roles: ['ceo', 'admin', 'va'] },
    // Old Misc Tools
    { id: 'legacy-batch-import', label: 'Batch Import', path: '/batch-import', icon: Database, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-automation', label: 'Automation Settings', path: '/automation-settings', icon: Cog, roles: ['ceo', 'admin'] },
    { id: 'legacy-training', label: 'Training', path: '/training', icon: Rocket, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-missions', label: 'Missions', path: '/missions', icon: Target, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-missions-hq', label: 'Missions HQ', path: '/missions-hq', icon: Crown, roles: ['ceo', 'admin'] },
    { id: 'legacy-opportunity', label: 'Opportunity Radar', path: '/opportunity-radar', icon: Eye, roles: ['ceo', 'admin'] },
    { id: 'legacy-rewards', label: 'Rewards', path: '/rewards', icon: Gift, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-subscriptions', label: 'Subscriptions', path: '/subscriptions', icon: CreditCard, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-templates', label: 'Templates', path: '/templates', icon: FileText, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-reminders', label: 'Reminders', path: '/reminders', icon: Bell, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-team', label: 'Team', path: '/team', icon: Users, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-worker-home', label: 'Worker Home', path: '/worker-home', icon: Home, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-my-route', label: 'My Route', path: '/my-route', icon: Map, roles: ['driver', 'biker', 'va'] },
    { id: 'legacy-my-hr', label: 'My HR', path: '/my-hr', icon: UserCircle, roles: ['ceo', 'admin', 'va'] },
    { id: 'legacy-wallet', label: 'Wallet', path: '/wallet', icon: Wallet, roles: ['ceo', 'admin', 'va'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🏠 REAL ESTATE EXTENDED
// ═══════════════════════════════════════════════════════════════════════════════
export const SECTION_REAL_ESTATE_EXTENDED: OSFloor = {
  id: 'section-real-estate-ext',
  name: 'Real Estate Extended',
  icon: Home,
  emoji: '🏡',
  description: 'Extended real estate tools and deal management',
  roles: ['ceo', 'admin'],
  items: [
    { id: 're-closings', label: 'Closings', path: '/real-estate/closings', icon: CheckSquare, roles: ['ceo', 'admin'] },
    { id: 're-expansion', label: 'RE Expansion', path: '/real-estate/expansion', icon: TrendingUp, roles: ['ceo', 'admin'] },
    { id: 're-subscriptions', label: 'RE Subscriptions', path: '/real-estate/subscriptions', icon: CreditCard, roles: ['ceo', 'admin'] },
    { id: 're-partners', label: 'RE Partners', path: '/real-estate/partners', icon: Users, roles: ['ceo', 'admin'] },
    { id: 're-pl', label: 'RE P&L', path: '/real-estate/pl', icon: DollarSign, roles: ['ceo', 'admin'] },
    { id: 're-deal-sheets', label: 'Deal Sheets Generator', path: '/real-estate/deal-sheets', icon: FileText, roles: ['ceo', 'admin'] },
    { id: 're-investor-blast', label: 'Investor Blast', path: '/real-estate/investor-blast', icon: Megaphone, roles: ['ceo', 'admin'] },
    { id: 're-offer-analyzer', label: 'Offer Analyzer', path: '/real-estate/offer-analyzer', icon: Calculator, roles: ['ceo', 'admin'] },
    { id: 're-fee-optimizer', label: 'Assignment Fee Optimizer', path: '/real-estate/fee-optimizer', icon: Target, roles: ['ceo', 'admin'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 EXPANSION & TERRITORY TOOLS
// ═══════════════════════════════════════════════════════════════════════════════
export const SECTION_EXPANSION: OSFloor = {
  id: 'section-expansion',
  name: 'Expansion & Territories',
  icon: Globe,
  emoji: '🌎',
  description: 'Market expansion and territory management',
  roles: ['ceo', 'admin'],
  items: [
    { id: 'exp-main', label: 'Expansion', path: '/expansion', icon: Rocket, roles: ['ceo', 'admin'] },
    { id: 'exp-regions', label: 'Expansion Regions', path: '/expansion/regions', icon: Map, roles: ['ceo', 'admin'] },
    { id: 'exp-heatmap', label: 'Expansion Heatmap', path: '/expansion/heatmap', icon: Activity, roles: ['ceo', 'admin'] },
    { id: 'exp-territories', label: 'Territories', path: '/territories', icon: Globe, roles: ['ceo', 'admin', 'va'] },
    { id: 'exp-live-map', label: 'Live Map', path: '/operations/live-map', icon: Map, roles: ['ceo', 'admin', 'va'] },
    { id: 'exp-leaderboard', label: 'Leaderboard', path: '/leaderboard', icon: Award, roles: ['ceo', 'admin', 'va'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🛣️ ROUTE OPERATIONS CENTER
// ═══════════════════════════════════════════════════════════════════════════════
export const SECTION_ROUTE_OPS: OSFloor = {
  id: 'section-route-ops',
  name: 'Route Operations',
  icon: Map,
  emoji: '🛣️',
  description: 'Route planning, optimization and operations',
  roles: ['ceo', 'admin', 'va', 'driver'],
  items: [
    { id: 'routes-main', label: 'Routes', path: '/routes', icon: Map, roles: ['ceo', 'admin', 'va', 'driver'] },
    { id: 'route-optimizer', label: 'Route Optimizer', path: '/route-optimizer', icon: Target, roles: ['ceo', 'admin', 'va'] },
    { id: 'route-ops-center', label: 'Route Ops Center', path: '/route-ops-center', icon: LayoutDashboard, roles: ['ceo', 'admin', 'va'] },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔐 SECURITY & GOVERNANCE
// ═══════════════════════════════════════════════════════════════════════════════
export const SECTION_SECURITY: OSFloor = {
  id: 'section-security',
  name: 'Security & Governance',
  icon: Shield,
  emoji: '🔐',
  description: 'User management, invitations, access control',
  roles: ['ceo', 'admin'],
  items: [
    { id: 'security-console', label: 'Security Console', path: '/security/console', icon: Shield, roles: ['ceo', 'admin'] },
    { id: 'security-invitations', label: 'User Invitations', path: '/security/invitations', icon: UserPlus, roles: ['ceo', 'admin'] },
    { id: 'security-devices', label: 'Devices', path: '/security/devices', icon: Cpu, roles: ['ceo', 'admin'] },
    { id: 'security-sessions', label: 'Sessions', path: '/security/sessions', icon: Activity, roles: ['ceo', 'admin'] },
  ],
};

export const ADDITIONAL_SECTIONS: OSFloor[] = [
  SECTION_MARKETPLACE_ADMIN,
  // SECTION_ACCOUNTING removed — lives exclusively in Penthouse
  SECTION_GLOBAL,
  SECTION_REAL_ESTATE,
  SECTION_REAL_ESTATE_EXTENDED,
  SECTION_POD,
  SECTION_CALL_CENTER,
  SECTION_COMMUNICATION,
  SECTION_GRABBA_OS,
  SECTION_WAREHOUSE,
  SECTION_LEGACY_CRM,
  SECTION_FUNDING,
  SECTION_AI_TOOLS,
  SECTION_VA_CENTER,
  SECTION_HOLDINGS,
  SECTION_LEGACY_SYSTEMS,
  SECTION_EXPANSION,
  SECTION_ROUTE_OPS,
  SECTION_SECURITY,
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
  { id: 'customer-portal', role: 'customer', label: 'Customer Portal', path: '/portal/customer', icon: Heart, color: 'hsl(340, 100%, 50%)', description: 'Orders, rewards, support' },
  { id: 'store-portal', role: 'store', label: 'Store Buyer Portal', path: '/portal/store', icon: Store, color: 'hsl(270, 100%, 50%)', description: 'Orders, products, invoices' },
  { id: 'wholesaler-portal', role: 'wholesaler', label: 'Wholesaler Seller Portal', path: '/portal/wholesaler', icon: Boxes, color: 'hsl(30, 100%, 50%)', description: 'Products, orders, payouts' },
  { id: 'ambassador-portal', role: 'ambassador', label: 'Ambassador Portal', path: '/ambassador/dashboard', icon: Star, color: 'hsl(150, 100%, 40%)', description: 'Portfolio, commissions, stores' },
  { id: 'driver-portal', role: 'driver', label: 'Driver Portal', path: '/portal/driver', icon: Car, color: 'hsl(210, 100%, 50%)', description: 'Routes, deliveries, earnings' },
  { id: 'biker-portal', role: 'biker', label: 'Biker Portal', path: '/portal/biker', icon: Bike, color: 'hsl(180, 100%, 40%)', description: 'Pickups, dropoffs, checks' },
  { id: 'production-portal', role: 'production', label: 'Manufacturing OS', path: '/portals/production', icon: Factory, color: 'hsl(45, 100%, 50%)', description: 'Office production, variance, closeouts' },
  { id: 'production-worker', role: 'production', label: 'Worker View (Read-Only)', path: '/portal/production', icon: Factory, color: 'hsl(45, 80%, 45%)', description: 'View batches, progress' },
  { id: 'va-portal', role: 'va', label: 'VA Portal', path: '/va/dashboard', icon: UserCircle, color: 'hsl(200, 100%, 50%)', description: 'CRM, tasks, communications' },
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

export function getNavForRole(role: OSRole): OSFloor[] {
  return OS_FLOORS
    .filter(floor => floor.roles.includes(role))
    .map(floor => ({
      ...floor,
      items: floor.items.filter(item => item.roles.includes(role)),
    }))
    .filter(floor => floor.items.length > 0);
}

export function getPortalForRole(role: OSRole): PortalConfig | undefined {
  return PORTALS.find(p => p.role === role);
}

export function getRoleRedirectPath(role: OSRole): string {
  if (role === 'pending') return '/pending-approval';
  // Admin-tier roles land on the main OS dashboard.
  if (role === 'admin' || role === 'ceo') return '/';
  // VAs land on the VA Portal dashboard (aligned with VAAuthPage post-login nav).
  if (role === 'va') return '/va/dashboard';
  const normalizedRole = role === 'store_owner' ? 'store' : role;
  const portal = getPortalForRole(normalizedRole);
  return portal?.path || '/portal/home';
}

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

export function getFloorByPath(path: string): OSFloor | undefined {
  return ALL_FLOORS.find(floor => 
    floor.items.some(item => item.path === path || path.startsWith(item.path + '/'))
  );
}

export function isAdminRole(role: OSRole): boolean {
  return role === 'admin' || role === 'ceo' || role === 'va';
}

export function isFieldRole(role: OSRole): boolean {
  return role === 'driver' || role === 'biker';
}

export function isPortalRole(role: OSRole): boolean {
  return ['store', 'wholesaler', 'ambassador', 'customer', 'production'].includes(role);
}
