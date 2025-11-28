// ═══════════════════════════════════════════════════════════════════════════════
// GRABBA EMPIRE SKYSCRAPER — FLOOR MAP & PAGE REGISTRY
// Complete mapping of all pages to their floors
// ═══════════════════════════════════════════════════════════════════════════════

export interface FloorPage {
  path: string;
  component: string;
  label: string;
  description: string;
  status: 'active' | 'planned' | 'legacy';
}

export interface SkyscraperFloor {
  id: string;
  floor: string;
  label: string;
  icon: string;
  primaryPath: string;
  pages: FloorPage[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PENTHOUSE — Command Center
// ═══════════════════════════════════════════════════════════════════════════════
export const PENTHOUSE: SkyscraperFloor = {
  id: 'penthouse',
  floor: '👑',
  label: 'Command Penthouse',
  icon: 'Crown',
  primaryPath: '/grabba/command-penthouse',
  pages: [
    {
      path: '/grabba/command-penthouse',
      component: 'GrabbaCommandPenthouse',
      label: 'Master Command',
      description: 'Live KPIs, AI alerts, and global actions for all Grabba brands',
      status: 'active',
    },
    {
      path: '/grabba/cluster',
      component: 'GrabbaClusterDashboard',
      label: 'Cluster Dashboard',
      description: 'Regional cluster performance view',
      status: 'active',
    },
    {
      path: '/grabba/ai-insights',
      component: 'AIInsights',
      label: 'AI Intelligence Feed',
      description: 'AI-generated insights and recommendations',
      status: 'active',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR 1 — CRM & Store Control
// ═══════════════════════════════════════════════════════════════════════════════
export const FLOOR_1_CRM: SkyscraperFloor = {
  id: 'floor-1-crm',
  floor: 'F1',
  label: 'CRM & Store Control',
  icon: 'Building2',
  primaryPath: '/grabba/crm',
  pages: [
    {
      path: '/grabba/crm',
      component: 'GrabbaCRM',
      label: 'Unified CRM',
      description: 'All stores, wholesalers, and customers with brand filtering',
      status: 'active',
    },
    {
      path: '/grabba/store-master/:id',
      component: 'StoreMasterProfile',
      label: 'Store Profile',
      description: 'Individual store/company profile with full intelligence',
      status: 'active',
    },
    {
      path: '/grabba/brand/:brand',
      component: 'BrandCRM',
      label: 'Brand-Specific CRM',
      description: 'CRM filtered by specific brand',
      status: 'active',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR 2 — Communication Center
// ═══════════════════════════════════════════════════════════════════════════════
export const FLOOR_2_COMMUNICATION: SkyscraperFloor = {
  id: 'floor-2-communication',
  floor: 'F2',
  label: 'Communication Center',
  icon: 'MessageSquare',
  primaryPath: '/grabba/communication',
  pages: [
    {
      path: '/grabba/communication',
      component: 'GrabbaCommunication',
      label: 'Communication Hub',
      description: 'Bulk text, email, AI calls, VA dialer, templates',
      status: 'active',
    },
    {
      path: '/grabba/brand/:brand/communications',
      component: 'BrandCommunications',
      label: 'Brand Communications',
      description: 'Brand-specific communication tools',
      status: 'active',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR 3 — Inventory Engine
// ═══════════════════════════════════════════════════════════════════════════════
export const FLOOR_3_INVENTORY: SkyscraperFloor = {
  id: 'floor-3-inventory',
  floor: 'F3',
  label: 'Inventory Engine',
  icon: 'Package',
  primaryPath: '/grabba/inventory',
  pages: [
    {
      path: '/grabba/inventory',
      component: 'GrabbaInventory',
      label: 'Tube Tracker',
      description: 'Manual tube counts, ETA predictions, restock alerts',
      status: 'active',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR 4 — Delivery & Drivers
// ═══════════════════════════════════════════════════════════════════════════════
export const FLOOR_4_DELIVERY: SkyscraperFloor = {
  id: 'floor-4-delivery',
  floor: 'F4',
  label: 'Delivery & Drivers',
  icon: 'Truck',
  primaryPath: '/grabba/deliveries',
  pages: [
    {
      path: '/grabba/deliveries',
      component: 'GrabbaDeliveries',
      label: 'Delivery Dashboard',
      description: 'Routes, drivers, bikers, delivery confirmations',
      status: 'active',
    },
    {
      path: '/grabba/delivery-runs',
      component: 'MultiBrandDelivery',
      label: 'Multi-Brand Runs',
      description: 'Cross-brand delivery stacking',
      status: 'active',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR 5 — Orders & Invoices
// ═══════════════════════════════════════════════════════════════════════════════
export const FLOOR_5_ORDERS: SkyscraperFloor = {
  id: 'floor-5-orders',
  floor: 'F5',
  label: 'Orders & Invoices',
  icon: 'FileText',
  primaryPath: '/grabba/finance',
  pages: [
    {
      path: '/grabba/finance',
      component: 'GrabbaFinance',
      label: 'Finance Hub',
      description: 'Orders, invoices, payments, unpaid accounts, reliability scores',
      status: 'active',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR 6 — Production & Machinery
// ═══════════════════════════════════════════════════════════════════════════════
export const FLOOR_6_PRODUCTION: SkyscraperFloor = {
  id: 'floor-6-production',
  floor: 'F6',
  label: 'Production & Machinery',
  icon: 'Factory',
  primaryPath: '/grabba/production',
  pages: [
    {
      path: '/grabba/production',
      component: 'GrabbaProduction',
      label: 'Production Center',
      description: 'Box output, tools, machine servicing, quality control',
      status: 'active',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR 7 — Wholesale Marketplace
// ═══════════════════════════════════════════════════════════════════════════════
export const FLOOR_7_WHOLESALE: SkyscraperFloor = {
  id: 'floor-7-wholesale',
  floor: 'F7',
  label: 'Wholesale Marketplace',
  icon: 'Boxes',
  primaryPath: '/grabba/wholesale-platform',
  pages: [
    {
      path: '/grabba/wholesale-platform',
      component: 'GrabbaWholesalePlatform',
      label: 'Marketplace',
      description: 'Wholesaler signup, orders, marketplace, AI sourcing',
      status: 'active',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR 8 — Ambassadors & Reps
// ═══════════════════════════════════════════════════════════════════════════════
export const FLOOR_8_AMBASSADORS: SkyscraperFloor = {
  id: 'floor-8-ambassadors',
  floor: 'F8',
  label: 'Ambassadors & Reps',
  icon: 'Users',
  primaryPath: '/grabba/ambassadors',
  pages: [
    {
      path: '/grabba/ambassadors',
      component: 'GrabbaAmbassadors',
      label: 'Ambassador Network',
      description: 'Ambassador signup, commissions, territory tracking, missions',
      status: 'active',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLETE SKYSCRAPER
// ═══════════════════════════════════════════════════════════════════════════════
export const GRABBA_SKYSCRAPER = [
  PENTHOUSE,
  FLOOR_1_CRM,
  FLOOR_2_COMMUNICATION,
  FLOOR_3_INVENTORY,
  FLOOR_4_DELIVERY,
  FLOOR_5_ORDERS,
  FLOOR_6_PRODUCTION,
  FLOOR_7_WHOLESALE,
  FLOOR_8_AMBASSADORS,
];

// Helper to get all pages as flat array
export const getAllGrabbaPages = (): FloorPage[] => {
  return GRABBA_SKYSCRAPER.flatMap(floor => floor.pages);
};

// Helper to find which floor a path belongs to
export const getFloorByPath = (path: string): SkyscraperFloor | undefined => {
  return GRABBA_SKYSCRAPER.find(floor => 
    floor.pages.some(page => page.path === path || path.startsWith(page.path.replace(':id', '').replace(':brand', '')))
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE TABLE CONNECTIONS
// Tables that support brand filtering
// ═══════════════════════════════════════════════════════════════════════════════
export const BRAND_CONNECTED_TABLES = {
  companies: { brandColumn: 'brand_focus', type: 'array' },
  wholesale_orders: { brandColumn: 'brand', type: 'string' },
  store_tube_inventory: { brandColumn: 'brand', type: 'string' },
  communication_logs: { brandColumn: 'brand', type: 'string' },
  invoices: { brandColumn: 'brand', type: 'string' },
  production_batches: { brandColumn: 'brand', type: 'string' },
  store_ai_insights: { brandColumn: 'brand', type: 'string' },
  store_brand_accounts: { brandColumn: 'brand', type: 'string' },
  brand_crm_contacts: { brandColumn: 'brand', type: 'string' },
  brand_inventory_movements: { brandColumn: 'brand', type: 'string' },
  automation_rules: { brandColumn: 'brand', type: 'string' },
  automation_logs: { brandColumn: 'brand', type: 'string' },
  communication_templates: { brandColumn: 'brand', type: 'string' },
  driver_route_stops: { brandColumn: 'brand', type: 'string' },
  customer_payment_methods: { brandColumn: 'brand', type: 'string' },
} as const;

// Tables connected via foreign keys (not direct brand column)
export const INDIRECT_BRAND_TABLES = {
  stores: { via: 'wholesale_orders.store_id' },
  store_payments: { via: 'stores or companies' },
  ambassadors: { via: 'ambassador_assignments' },
  wholesalers: { via: 'wholesale_orders.wholesaler_id' },
  crm_contacts: { via: 'companies' },
  grabba_drivers: { via: 'driver_route_stops' },
} as const;
