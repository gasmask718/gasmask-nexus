import {
  Crown, Building2, MessageSquare, Package, Truck, FileText, 
  Factory, Boxes, Users, Map, DollarSign, Bell, BarChart3,
  Calculator, Store, Zap, Target, Award, Settings,
  LayoutDashboard, Box, Shield, Send, Phone, Mail, Brain
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// GRABBA EMPIRE SKYSCRAPER NAVIGATION
// Penthouse + 8 Floors Architecture
// Brand filtering happens INSIDE pages, not in navigation
// ═══════════════════════════════════════════════════════════════════════════════

export interface GrabbaFloor {
  id: string;
  name: string;
  icon: LucideIcon;
  path: string;
  description: string;
  emoji: string;
}

// Brand type definitions
export const GRABBA_BRAND_IDS = ['gasmask', 'hotmama', 'scalati', 'grabba'] as const;
export type GrabbaBrand = typeof GRABBA_BRAND_IDS[number];
export type GrabbaBrandId = GrabbaBrand | 'all';

// Legacy array format for backward compatibility
export const GRABBA_BRANDS = [
  { id: 'all', name: 'All Brands', color: '#6366F1', emoji: '🏢' },
  { id: 'gasmask', name: 'GasMask', color: '#FF0000', emoji: '🔴' },
  { id: 'hotmama', name: 'HotMama', color: '#B76E79', emoji: '🟣' },
  { id: 'scalati', name: 'Hot Scalati', color: '#FF7A00', emoji: '🟠' },
  { id: 'grabba', name: 'Grabba R Us', color: '#A020F0', emoji: '🟪' },
] as const;

// All Brands option for filters
export const ALL_BRANDS_OPTION = {
  id: 'all' as const,
  name: 'All Brands',
  label: 'All Brands',
  color: '#6366F1',
  primary: '#6366F1',
  secondary: '#4F46E5',
  gradient: 'from-indigo-500 to-purple-600',
  bgLight: 'bg-indigo-50',
  textColor: 'text-indigo-600',
  borderColor: 'border-indigo-500',
  pill: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  icon: '🏢',
};

// Full brand configuration
export const GRABBA_BRAND_CONFIG: Record<GrabbaBrand, {
  id: string;
  name: string;
  label: string;
  color: string;
  primary: string;
  secondary: string;
  gradient: string;
  roseGoldGradient?: string[];
  bgLight: string;
  textColor: string;
  borderColor: string;
  pill: string;
  icon: string;
}> = {
  gasmask: {
    id: 'gasmask',
    name: 'GasMask',
    label: 'GasMask',
    color: '#FF0000',
    primary: '#FF0000',
    secondary: '#000000',
    gradient: 'from-red-600 to-red-900',
    bgLight: 'bg-red-50',
    textColor: 'text-red-500',
    borderColor: 'border-red-500',
    pill: 'bg-red-500/20 text-red-300 border-red-500/40',
    icon: '🔴',
  },
  hotmama: {
    id: 'hotmama',
    name: 'HotMama',
    label: 'HotMama',
    color: '#FF4F9D',
    primary: '#FF4F9D',
    secondary: '#FFC2D6',
    gradient: 'from-pink-500 via-pink-400 to-pink-300',
    roseGoldGradient: ['#FF4F9D', '#FFC2D6', '#FFE5EF'],
    bgLight: 'bg-pink-50',
    textColor: 'text-pink-500',
    borderColor: 'border-pink-500',
    pill: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
    icon: '💖',
  },
  scalati: {
    id: 'scalati',
    name: 'Hot Scalati',
    label: 'Hot Scalati',
    color: '#FF7A00',
    primary: '#FF7A00',
    secondary: '#5A3A2E',
    gradient: 'from-orange-500 to-amber-600',
    bgLight: 'bg-orange-50',
    textColor: 'text-orange-500',
    borderColor: 'border-orange-500',
    pill: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    icon: '🟠',
  },
  grabba: {
    id: 'grabba',
    name: 'Grabba R Us',
    label: 'Grabba R Us',
    color: '#A020F0',
    primary: '#A020F0',
    secondary: '#7B68EE',
    gradient: 'from-purple-600 to-violet-700',
    bgLight: 'bg-purple-50',
    textColor: 'text-purple-500',
    borderColor: 'border-purple-500',
    pill: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    icon: '🟪',
  },
};

// Helper to get brand config
export const getBrandConfig = (brand: string) => {
  return GRABBA_BRAND_CONFIG[brand as GrabbaBrand] || GRABBA_BRAND_CONFIG.gasmask;
};

// Format tubes as boxes helper
export function formatTubesAsBoxes(tubes: number) {
  const TUBES_PER_BOX = 100;
  const fullBoxes = Math.floor(tubes / TUBES_PER_BOX);
  const remainder = tubes % TUBES_PER_BOX;
  
  let fractionLabel = '';
  if (remainder === 0) {
    fractionLabel = fullBoxes > 0 ? `${fullBoxes} box${fullBoxes > 1 ? 'es' : ''}` : '0 boxes';
  } else if (remainder <= 25) {
    fractionLabel = fullBoxes > 0 ? `${fullBoxes} + ¼ box` : '¼ box';
  } else if (remainder <= 50) {
    fractionLabel = fullBoxes > 0 ? `${fullBoxes} + ½ box` : '½ box';
  } else if (remainder <= 75) {
    fractionLabel = fullBoxes > 0 ? `${fullBoxes} + ¾ box` : '¾ box';
  } else {
    fractionLabel = `${fullBoxes + 1} box${fullBoxes + 1 > 1 ? 'es' : ''} (almost)`;
  }
  
  return { fullBoxes, remainder, fractionLabel };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 👑 PENTHOUSE — Dynasty Owner Dashboard (Global Command)
// ═══════════════════════════════════════════════════════════════════════════════
export const GRABBA_PENTHOUSE: GrabbaFloor = {
  id: 'penthouse',
  name: 'Dynasty Owner Dashboard',
  icon: Crown,
  path: '/os/owner',
  description: 'Empire-wide command center for the Dynasty Owner',
  emoji: '👑'
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🏢 GRABBA FLOORS (including Grabba Command Penthouse)
// ═══════════════════════════════════════════════════════════════════════════════
export const GRABBA_FLOORS: GrabbaFloor[] = [
  {
    id: 'grabba-command',
    name: 'Grabba Command Penthouse',
    icon: Crown,
    path: '/grabba/command-penthouse',
    description: 'Grabba-specific command center - KPIs, alerts, and intelligence for all Grabba brands.',
    emoji: '🔥'
  },
  {
    id: 'floor-1-crm',
    name: 'CRM & Store Control',
    icon: Building2,
    path: '/grabba/crm',
    description: 'Floor 1 — CRM: All stores, wholesalers, customers, and companies for Grabba brands.',
    emoji: '🏢'
  },
  {
    id: 'floor-2-communication',
    name: 'Communication Center',
    icon: MessageSquare,
    path: '/grabba/communication',
    description: 'Floor 2 — Communications: All SMS, calls, email, and AI messaging for Grabba operations.',
    emoji: '📞'
  },
  {
    id: 'floor-3-inventory',
    name: 'Inventory Engine',
    icon: Package,
    path: '/grabba/inventory',
    description: 'Floor 3 — Inventory: Live tube counts, ETA engine, consumption tracking, and neighborhood intelligence for Grabba brands.',
    emoji: '📦'
  },
  {
    id: 'floor-4-delivery',
    name: 'Delivery & Drivers',
    icon: Truck,
    path: '/grabba/deliveries',
    description: 'Floor 4 — Delivery: Routes, drivers, bikers, payouts, and delivery ops for Grabba brands.',
    emoji: '🚴'
  },
  {
    id: 'floor-5-orders',
    name: 'Orders & Invoices',
    icon: FileText,
    path: '/grabba/finance',
    description: 'Floor 5 — Orders: Invoices, payments, unpaid accounts, and billing for Grabba brands.',
    emoji: '📑'
  },
  {
    id: 'floor-6-production',
    name: 'Production & Machinery',
    icon: Factory,
    path: '/grabba/production',
    description: 'Floor 6 — Production: Box output, tools, machinery service, and office performance for Grabba.',
    emoji: '🏭'
  },
  {
    id: 'floor-7-wholesale',
    name: 'Wholesale Marketplace',
    icon: Boxes,
    path: '/grabba/wholesale-platform',
    description: 'Floor 7 — Wholesale: Marketplace, wholesaler uploads, fulfillment overview, and AI sourcing engine.',
    emoji: '🏬'
  },
  {
    id: 'floor-8-ambassadors',
    name: 'Ambassadors & Reps',
    icon: Users,
    path: '/grabba/ambassadors',
    description: 'Floor 8 — Ambassadors: Reps network, regions, payouts, assigned stores, wholesalers, and finders fees.',
    emoji: '🤝'
  },
  {
    id: 'floor-9-ai',
    name: 'AI Operations Center',
    icon: Brain,
    path: '/grabba/ai',
    description: 'Floor 9 — AI: Automated tasks, predictions, alerts, quality control, and intelligence engine.',
    emoji: '🤖'
  }
];

// ═══════════════════════════════════════════════════════════════════════════════
// PENTHOUSE SUB-PANELS (for inside the penthouse page)
// ═══════════════════════════════════════════════════════════════════════════════
export const PENTHOUSE_PANELS = [
  { id: 'tubes-sold', label: 'Total Tubes Sold', icon: Box },
  { id: 'boxes-sold', label: 'Total Boxes Sold', icon: Boxes },
  { id: 'top-stores', label: 'Top Stores', icon: Award },
  { id: 'weak-stores', label: 'Weak Stores', icon: Target },
  { id: 'neighborhoods', label: 'Neighborhoods', icon: Map },
  { id: 'wholesaler-metrics', label: 'Wholesaler Metrics', icon: Store },
  { id: 'ambassador-performance', label: 'Ambassador Performance', icon: Users },
  { id: 'driver-performance', label: 'Driver Performance', icon: Truck },
  { id: 'production-status', label: 'Production Status', icon: Factory },
  { id: 'unpaid-status', label: 'Unpaid Status', icon: DollarSign },
];

export const PENTHOUSE_AI_ALERTS = [
  { type: 'low-inventory', label: 'Low Inventory Warnings', icon: Package },
  { type: 'eta-predictions', label: 'ETA Predictions', icon: Calculator },
  { type: 'opportunities', label: 'New Opportunities', icon: Zap },
  { type: 'risk-alerts', label: 'Risk Alerts', icon: Bell },
  { type: 'wholesale-sourcing', label: 'Wholesale Sourcing', icon: Boxes },
];

export const PENTHOUSE_ACTIONS = [
  { id: 'text-blast', label: 'Global Text Blast', icon: Send, path: '/grabba/communication' },
  { id: 'email-blast', label: 'Global Email Blast', icon: Mail, path: '/grabba/communication' },
  { id: 'ai-call', label: 'AI Call Campaign', icon: Phone, path: '/grabba/communication' },
  { id: 'territory-map', label: 'Territory Expansion', icon: Map, path: '/grabba/territories' },
  { id: 'production-health', label: 'Production Health', icon: Factory, path: '/grabba/production' },
  { id: 'unpaid-accounts', label: 'Unpaid Accounts', icon: DollarSign, path: '/grabba/finance' },
  { id: 'store-master', label: 'Store Master List', icon: Building2, path: '/grabba/crm' },
  { id: 'inventory-engine', label: 'Inventory Engine', icon: Package, path: '/grabba/inventory' },
  { id: 'regional-map', label: 'Regional Map', icon: Map, path: '/grabba/cluster' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// BRAND THEME CONFIG (for applying colors inside pages)
// ═══════════════════════════════════════════════════════════════════════════════
export const GRABBA_BRAND_THEMES = {
  all: {
    primary: '#6366F1',
    secondary: '#4F46E5',
    gradient: 'from-indigo-500 to-purple-600',
    bgLight: 'bg-indigo-50',
    textColor: 'text-indigo-600',
    borderColor: 'border-indigo-500',
    icon: '🏢'
  },
  gasmask: {
    primary: '#FF0000',
    secondary: '#000000',
    gradient: 'from-red-600 to-red-900',
    bgLight: 'bg-red-50',
    textColor: 'text-red-500',
    borderColor: 'border-red-500',
    icon: '🔴'
  },
  hotmama: {
    primary: '#FF4F9D',
    secondary: '#FFC2D6',
    gradient: 'from-pink-500 via-pink-400 to-pink-300',
    bgLight: 'bg-pink-50',
    textColor: 'text-pink-500',
    borderColor: 'border-pink-500',
    icon: '💖'
  },
  scalati: {
    primary: '#FF7A00',
    secondary: '#5A3A2E',
    gradient: 'from-orange-500 to-amber-600',
    bgLight: 'bg-orange-50',
    textColor: 'text-orange-500',
    borderColor: 'border-orange-500',
    icon: '🟠'
  },
  grabba: {
    primary: '#A020F0',
    secondary: '#7B68EE',
    gradient: 'from-purple-600 to-violet-700',
    bgLight: 'bg-purple-50',
    textColor: 'text-purple-500',
    borderColor: 'border-purple-500',
    icon: '🟪'
  }
} as const;

// Helper to get theme for a brand
export const getBrandTheme = (brandId: GrabbaBrandId) => {
  return GRABBA_BRAND_THEMES[brandId] || GRABBA_BRAND_THEMES.all;
};

// Get all navigation items for the Grabba section
export const getGrabbaNavItems = () => {
  return [
    GRABBA_PENTHOUSE,
    ...GRABBA_FLOORS
  ];
};

// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR ROUTE MAPPING (which routes belong to each floor)
// Complete mapping of all legacy and new routes
// ═══════════════════════════════════════════════════════════════════════════════

export const FLOOR_ROUTE_MAP: Record<string, string[]> = {
  'penthouse': [
    '/os/owner',
  ],
  'grabba-command': [
    '/grabba/command-penthouse',
    '/grabba/cluster',
    '/grabba/ai-insights',
  ],
  'floor-1-crm': [
    '/grabba/crm',
    '/grabba/brand/',
    '/grabba/store-master/',
    '/companies',
    '/stores',
  ],
  'floor-2-communication': [
    '/grabba/communication',
    '/grabba/text-center',
    '/grabba/email-center',
    '/grabba/call-center',
    '/grabba/communication-logs',
    '/grabba/brand/*/communications',
  ],
  'floor-3-inventory': [
    '/grabba/inventory',
  ],
  'floor-4-delivery': [
    '/grabba/deliveries',
    '/grabba/delivery-runs',
    '/routes',
    '/driver-debt-collection',
  ],
  'floor-5-orders': [
    '/grabba/finance',
    '/unpaid-accounts',
    '/billing',
    '/billing-center',
  ],
  'floor-6-production': [
    '/grabba/production',
  ],
  'floor-7-wholesale': [
    '/grabba/wholesale-platform',
    '/grabba/upload-center',
    '/wholesale/marketplace',
    '/wholesale',
  ],
  'floor-8-ambassadors': [
    '/grabba/ambassadors',
    '/ambassador-regions',
    '/ambassador-payouts',
  ],
  'floor-9-ai': [
    '/grabba/ai',
    '/grabba/ai/tasks',
    '/grabba/ai/predict',
    '/grabba/ai/alerts',
  ],
};

// Helper to find which floor a route belongs to
export const getFloorByRoute = (path: string): GrabbaFloor | undefined => {
  // Check penthouse first (Dynasty Owner Dashboard)
  if (path === '/os/owner') {
    return GRABBA_PENTHOUSE;
  }
  
  // Check Grabba Command Penthouse
  if (path === '/grabba/command-penthouse') {
    return GRABBA_FLOORS.find(f => f.id === 'grabba-command');
  }
  
  // Check each floor's routes
  for (const floor of GRABBA_FLOORS) {
    const floorRoutes = FLOOR_ROUTE_MAP[floor.id] || [];
    for (const route of floorRoutes) {
      if (path === route || path.startsWith(route.replace('*', ''))) {
        return floor;
      }
    }
  }
  
  // Fallback: check if path starts with the floor's primary path
  for (const floor of GRABBA_FLOORS) {
    if (path === floor.path || path.startsWith(floor.path + '/')) {
      return floor;
    }
  }
  
  return undefined;
};

// Check if a path is a Grabba route
export const isGrabbaRoute = (path: string): boolean => {
  if (path.startsWith('/grabba')) return true;
  
  // Check non-grabba routes that belong to Grabba floors
  const grabbaRelatedPaths = [
    '/unpaid-accounts', '/wholesale-orders', '/billing',
    '/wholesale/marketplace', '/ambassadors/regions'
  ];
  
  return grabbaRelatedPaths.some(p => path === p || path.startsWith(p));
};
