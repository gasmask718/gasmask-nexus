import {
  Crown, Building2, MessageSquare, Package, Truck, FileText, 
  Factory, Boxes, Users, Map, DollarSign, Bell, BarChart3,
  Calculator, Store, Zap, Target, Award, Settings,
  LayoutDashboard, Box, Shield, Send, Phone, Mail
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

export const GRABBA_BRANDS = [
  { id: 'all', name: 'All Brands', color: '#6366F1' },
  { id: 'gasmask', name: 'GasMask', color: '#D30000' },
  { id: 'hotmama', name: 'HotMama', color: '#B76E79' },
  { id: 'scalati', name: 'Hot Scalati', color: '#FF7A00' },
  { id: 'grabba', name: 'Grabba R Us', color: '#FFD400' },
] as const;

export type GrabbaBrandId = typeof GRABBA_BRANDS[number]['id'];

// ═══════════════════════════════════════════════════════════════════════════════
// 👑 PENTHOUSE — Master Command Center
// ═══════════════════════════════════════════════════════════════════════════════
export const GRABBA_PENTHOUSE: GrabbaFloor = {
  id: 'penthouse',
  name: 'Command Penthouse',
  icon: Crown,
  path: '/grabba/command-penthouse',
  description: 'Master control for all Grabba brands - KPIs, alerts, intelligence',
  emoji: '👑'
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🏢 8-FLOOR STRUCTURE
// ═══════════════════════════════════════════════════════════════════════════════
export const GRABBA_FLOORS: GrabbaFloor[] = [
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
    description: 'Bulk Text, Email, AI Calls, VA Dialer, Templates, Automation',
    emoji: '📞'
  },
  {
    id: 'floor-3-inventory',
    name: 'Inventory Engine',
    icon: Package,
    path: '/grabba/inventory',
    description: 'Tube counts, Box tracking, ETA predictions, Restock alerts',
    emoji: '📦'
  },
  {
    id: 'floor-4-delivery',
    name: 'Delivery & Drivers',
    icon: Truck,
    path: '/grabba/deliveries',
    description: 'Routes, Driver management, Bikers, Delivery confirmations',
    emoji: '🚴'
  },
  {
    id: 'floor-5-orders',
    name: 'Orders & Invoices',
    icon: FileText,
    path: '/grabba/finance',
    description: 'Orders, Invoices, Payments, Unpaid accounts, Reliability scores',
    emoji: '📑'
  },
  {
    id: 'floor-6-production',
    name: 'Production & Machinery',
    icon: Factory,
    path: '/grabba/production',
    description: 'Box output, Tools, Machine servicing, Quality control',
    emoji: '🏭'
  },
  {
    id: 'floor-7-wholesale',
    name: 'Wholesale Marketplace',
    icon: Boxes,
    path: '/grabba/wholesale-platform',
    description: 'Wholesaler signup, Orders, Marketplace, AI sourcing',
    emoji: '🏬'
  },
  {
    id: 'floor-8-ambassadors',
    name: 'Ambassadors & Reps',
    icon: Users,
    path: '/grabba/ambassadors',
    description: 'Ambassador network, Commissions, Territory tracking, Missions',
    emoji: '🤝'
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
    borderColor: 'border-indigo-500'
  },
  gasmask: {
    primary: '#D30000',
    secondary: '#000000',
    gradient: 'from-red-600 to-black',
    bgLight: 'bg-red-50',
    textColor: 'text-red-600',
    borderColor: 'border-red-500'
  },
  hotmama: {
    primary: '#B76E79',
    secondary: '#E0BFB8',
    gradient: 'from-rose-400 to-rose-600',
    bgLight: 'bg-rose-50',
    textColor: 'text-rose-600',
    borderColor: 'border-rose-500'
  },
  scalati: {
    primary: '#FF7A00',
    secondary: '#5A3A2E',
    gradient: 'from-orange-500 to-amber-600',
    bgLight: 'bg-orange-50',
    textColor: 'text-orange-600',
    borderColor: 'border-orange-500'
  },
  grabba: {
    primary: '#FFD400',
    secondary: '#245BFF',
    gradient: 'from-yellow-400 to-blue-500',
    bgLight: 'bg-yellow-50',
    textColor: 'text-yellow-600',
    borderColor: 'border-yellow-500'
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
// ═══════════════════════════════════════════════════════════════════════════════

export const FLOOR_ROUTE_MAP: Record<string, string[]> = {
  'penthouse': ['/grabba/command-penthouse'],
  'floor-1-crm': ['/grabba/crm', '/grabba/brand/', '/grabba/store-master/'],
  'floor-2-communication': ['/grabba/communication', '/grabba/brand/*/communications'],
  'floor-3-inventory': ['/grabba/inventory'],
  'floor-4-delivery': ['/grabba/deliveries', '/grabba/delivery-runs'],
  'floor-5-orders': ['/grabba/finance', '/unpaid-accounts', '/wholesale-orders', '/billing'],
  'floor-6-production': ['/grabba/production'],
  'floor-7-wholesale': ['/grabba/wholesale-platform', '/wholesale/marketplace'],
  'floor-8-ambassadors': ['/grabba/ambassadors', '/ambassadors/regions'],
};

// Helper to find which floor a route belongs to
export const getFloorByRoute = (path: string): GrabbaFloor | undefined => {
  // Check penthouse first
  if (path === '/grabba/command-penthouse') {
    return GRABBA_PENTHOUSE;
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
