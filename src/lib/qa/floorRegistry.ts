/**
 * Floor Registry - Comprehensive route and module mapping for Floors 1-9
 * 
 * This registry powers the QA Command Center by defining all expected
 * routes, their components, and known issues.
 */

export interface FloorModule {
  name: string;
  path: string;
  componentFile?: string;
  category?: string;
  requiresAuth?: boolean;
  hasAuthCheck?: boolean;
  isPlaceholder?: boolean;
  hasDeadActions?: boolean;
  knownDeadActions?: Array<{ label: string; type: string }>;
  expectedStates?: {
    loading: boolean;
    empty: boolean;
    error: boolean;
  };
}

export interface Floor {
  id: string;
  name: string;
  description: string;
  modules: FloorModule[];
}

export const FLOOR_REGISTRY: Floor[] = [
  {
    id: 'floor-1',
    name: 'Floor 1 — CRM / Store Master',
    description: 'Customer relationship management and store directory',
    modules: [
      { name: 'Store Directory', path: '/stores', componentFile: 'src/pages/Stores.tsx', category: 'stores', requiresAuth: true, hasAuthCheck: true },
      { name: 'Store Master Profile', path: '/grabba/store-master', componentFile: 'src/pages/grabba/StoreMasterProfile.tsx', category: 'stores', requiresAuth: true, hasAuthCheck: true },
      { name: 'Store Detail', path: '/stores/:id', componentFile: 'src/pages/StoreDetail.tsx', category: 'stores', requiresAuth: true, hasAuthCheck: true },
      { name: 'Grabba CRM', path: '/grabba/crm', componentFile: 'src/pages/grabba/GrabbaCRM.tsx', category: 'crm', requiresAuth: true, hasAuthCheck: true },
      { name: 'Brand CRM', path: '/grabba/brand/grabba', componentFile: 'src/pages/grabba/BrandCRM.tsx', category: 'crm', requiresAuth: true, hasAuthCheck: true },
      { name: 'Global CRM', path: '/crm', componentFile: 'src/pages/CRM.tsx', category: 'crm', requiresAuth: true, hasAuthCheck: true },
      { name: 'CRM Contacts', path: '/crm/contacts', componentFile: 'src/pages/CRMContacts.tsx', category: 'crm', requiresAuth: true, hasAuthCheck: true },
      { name: 'CRM Customers', path: '/crm/customers', componentFile: 'src/pages/CRMCustomers.tsx', category: 'crm', requiresAuth: true, hasAuthCheck: true },
      { name: 'Follow-Ups', path: '/crm/follow-ups', componentFile: 'src/pages/CRMFollowUps.tsx', category: 'crm', requiresAuth: true, hasAuthCheck: true },
      { name: 'Contact Profile', path: '/crm/contacts/:id', componentFile: 'src/pages/CRMContactDetail.tsx', category: 'crm', requiresAuth: true, hasAuthCheck: true },
    ],
  },
  {
    id: 'floor-2',
    name: 'Floor 2 — Communication Hub',
    description: 'Unified communication center for calls, messages, and campaigns',
    modules: [
      { name: 'Command Center', path: '/communication', componentFile: 'src/pages/communication/CommunicationHubLayout.tsx', category: 'comm', requiresAuth: true, hasAuthCheck: true },
      { name: 'Inbox', path: '/communication/inbox', componentFile: 'src/pages/communication/inbox/InboxPage.tsx', category: 'comm', requiresAuth: true, hasAuthCheck: true },
      { name: 'Dialer', path: '/communication/dialer', componentFile: 'src/pages/communication/dialer/DialerPage.tsx', category: 'comm', requiresAuth: true, hasAuthCheck: true },
      { name: 'Live Calls', path: '/communication/live', componentFile: 'src/pages/communication/live/LiveCallsPage.tsx', category: 'comm', requiresAuth: true, hasAuthCheck: true },
      { name: 'Campaigns', path: '/communication/campaigns', componentFile: 'src/pages/communication/campaigns/CampaignsPage.tsx', category: 'comm', requiresAuth: true, hasAuthCheck: true },
      { name: 'AI Agents', path: '/communication/agents', componentFile: 'src/pages/communication/agents/AgentsPage.tsx', category: 'ai', requiresAuth: true, hasAuthCheck: true },
      { name: 'Predictions', path: '/communication/predictions', componentFile: 'src/pages/communication/predictions/PredictionsPage.tsx', category: 'ai', requiresAuth: true, hasAuthCheck: true },
      { name: 'Voice Matrix', path: '/communication/voice-matrix', componentFile: 'src/pages/communication/voicematrix/VoiceMatrixPage.tsx', category: 'ai', requiresAuth: true, hasAuthCheck: true },
      { name: 'Heatmap', path: '/communication/heatmap', componentFile: 'src/pages/communication/heatmap/HeatmapPage.tsx', category: 'comm', requiresAuth: true, hasAuthCheck: true },
      { name: 'Settings', path: '/communication/settings', componentFile: 'src/pages/communication/settings/SettingsPage.tsx', category: 'settings', requiresAuth: true, hasAuthCheck: true },
    ],
  },
  {
    id: 'floor-3',
    name: 'Floor 3 — Inventory Engine',
    description: 'Product and inventory management system',
    modules: [
      { name: 'Inventory Dashboard', path: '/grabba/inventory', componentFile: 'src/pages/grabba/GrabbaInventory.tsx', category: 'inventory', requiresAuth: true, hasAuthCheck: true },
      { name: 'Products', path: '/products', componentFile: 'src/pages/Products.tsx', category: 'inventory', requiresAuth: true, hasAuthCheck: true },
      { name: 'Product Inventory', path: '/os/inventory/product-inventory', componentFile: 'src/pages/os/inventory/ProductInventoryPage.tsx', category: 'inventory', requiresAuth: true, hasAuthCheck: true },
      { name: 'Product Conversions', path: '/os/product-conversions', componentFile: 'src/pages/os/ProductConversions.tsx', category: 'inventory', requiresAuth: true, hasAuthCheck: true },
      { name: 'Warehouse', path: '/os/warehouse', componentFile: 'src/pages/os/warehouse/WarehouseDashboard.tsx', category: 'warehouse', requiresAuth: true, hasAuthCheck: true },
      { name: 'Procurement', path: '/os/procurement', componentFile: 'src/pages/os/procurement/ProcurementDashboard.tsx', category: 'procurement', requiresAuth: true, hasAuthCheck: true },
      { name: 'Suppliers', path: '/os/procurement/suppliers', componentFile: 'src/pages/os/procurement/SuppliersPage.tsx', category: 'procurement', requiresAuth: true, hasAuthCheck: true },
      { name: 'Purchase Orders', path: '/os/procurement/purchase-orders', componentFile: 'src/pages/os/procurement/PurchaseOrdersPage.tsx', category: 'procurement', requiresAuth: true, hasAuthCheck: true },
    ],
  },
  {
    id: 'floor-4',
    name: 'Floor 4 — Delivery & Routing',
    description: 'Logistics and delivery operations',
    modules: [
      { name: 'Deliveries Dashboard', path: '/delivery', componentFile: 'src/pages/delivery/DeliveryDashboard.tsx', category: 'delivery', requiresAuth: true, hasAuthCheck: true },
      { name: 'Multi-Brand Delivery', path: '/delivery/multi-brand', componentFile: 'src/pages/delivery/MultiBrandDeliveryPage.tsx', category: 'delivery', requiresAuth: true, hasAuthCheck: true },
      { name: 'Route Manager', path: '/delivery/route-manager', componentFile: 'src/pages/delivery/RouteManagerPage.tsx', category: 'routes', requiresAuth: true, hasAuthCheck: true },
      { name: 'All Routes', path: '/delivery/all-routes', componentFile: 'src/pages/delivery/AllRoutesPage.tsx', category: 'routes', requiresAuth: true, hasAuthCheck: true },
      { name: 'Route Optimizer', path: '/routes/optimizer', componentFile: 'src/pages/RouteOptimizer.tsx', category: 'routes', requiresAuth: true, hasAuthCheck: true },
      { name: 'Route Ops Center', path: '/routes/ops-center', componentFile: 'src/pages/RouteOpsCenter.tsx', category: 'routes', requiresAuth: true, hasAuthCheck: true },
      { name: 'Live Map', path: '/delivery/live-map', componentFile: 'src/pages/delivery/LiveMapPage.tsx', category: 'delivery', requiresAuth: true, hasAuthCheck: true },
      { name: 'Delivery Capacity', path: '/delivery-capacity', componentFile: 'src/pages/DeliveryCapacity.tsx', category: 'delivery', requiresAuth: true, hasAuthCheck: true },
      { name: 'Drivers', path: '/delivery/drivers', componentFile: 'src/pages/delivery/DriversManagement.tsx', category: 'workers', requiresAuth: true, hasAuthCheck: true },
      { name: 'Bikers', path: '/delivery/bikers', componentFile: 'src/pages/delivery/BikersManagement.tsx', category: 'workers', requiresAuth: true, hasAuthCheck: true },
    ],
  },
  {
    id: 'floor-5',
    name: 'Floor 5 — Finance & Orders',
    description: 'Financial operations and billing',
    modules: [
      { name: 'Finance Dashboard', path: '/grabba/finance', componentFile: 'src/pages/grabba/GrabbaFinance.tsx', category: 'finance', requiresAuth: true, hasAuthCheck: true },
      { name: 'Floor 5 Dashboard', path: '/floor5', componentFile: 'src/pages/floor5/Floor5Dashboard.tsx', category: 'finance', requiresAuth: true, hasAuthCheck: true },
      { name: 'Invoices', path: '/billing/invoices', componentFile: 'src/pages/BillingInvoices.tsx', category: 'billing', requiresAuth: true, hasAuthCheck: true },
      { name: 'Billing Center', path: '/billing-center', componentFile: 'src/pages/BillingCenter.tsx', category: 'billing', requiresAuth: true, hasAuthCheck: true },
      { name: 'Unpaid Accounts', path: '/unpaid-accounts', componentFile: 'src/pages/UnpaidAccounts.tsx', category: 'billing', requiresAuth: true, hasAuthCheck: true },
      { name: 'Wholesale Fulfillment', path: '/wholesale/fulfillment', componentFile: 'src/pages/WholesaleFulfillment.tsx', category: 'wholesale', requiresAuth: true, hasAuthCheck: true },
      { name: 'Payroll', path: '/payroll', componentFile: 'src/pages/Payroll.tsx', category: 'payroll', requiresAuth: true, hasAuthCheck: true },
      { name: 'Payroll Manager', path: '/grabba/payroll-manager', componentFile: 'src/pages/grabba/PayrollManager.tsx', category: 'payroll', requiresAuth: true, hasAuthCheck: true },
      { name: 'Business Ledger', path: '/grabba/financial-dashboard', componentFile: 'src/pages/grabba/FinancialDashboard.tsx', category: 'finance', requiresAuth: true, hasAuthCheck: true },
    ],
  },
  {
    id: 'floor-6',
    name: 'Floor 6 — Production',
    description: 'Manufacturing and production operations',
    modules: [
      { name: 'Production Dashboard', path: '/portals/production', componentFile: 'src/pages/portals/ProductionPortalPage.tsx', category: 'production', requiresAuth: true, hasAuthCheck: true },
      { name: 'Manufacturing OS', path: '/portals/production', componentFile: 'src/pages/portals/production/ProductionPortalPage.tsx', category: 'production', requiresAuth: true, hasAuthCheck: true },
      { name: 'Offices Management', path: '/portals/production/offices', componentFile: 'src/pages/portals/production/OfficesManagementPage.tsx', category: 'production', requiresAuth: true, hasAuthCheck: true },
      { name: 'Staff Management', path: '/portals/production/staff', componentFile: 'src/pages/portals/production/StaffManagementPage.tsx', category: 'production', requiresAuth: true, hasAuthCheck: true },
    ],
  },
  {
    id: 'floor-7',
    name: 'Floor 7 — HR & Training',
    description: 'Human resources and employee training',
    modules: [
      { name: 'HR Dashboard', path: '/hr', componentFile: 'src/pages/HR.tsx', category: 'hr', requiresAuth: true, hasAuthCheck: true },
      { name: 'Training', path: '/training', componentFile: 'src/pages/Training.tsx', category: 'training', requiresAuth: true, hasAuthCheck: true },
      { name: 'Employees', path: '/hr/employees', componentFile: 'src/pages/HREmployees.tsx', category: 'hr', requiresAuth: true, hasAuthCheck: true },
      { name: 'Applicants', path: '/hr/applicants', componentFile: 'src/pages/HRApplicants.tsx', category: 'hr', requiresAuth: true, hasAuthCheck: true },
    ],
  },
  {
    id: 'floor-8',
    name: 'Floor 8 — Ambassadors & Influencers',
    description: 'Ambassador and influencer management',
    modules: [
      { name: 'Ambassador Command', path: '/floor8/ambassadors', componentFile: 'src/pages/floor8/AmbassadorCommandDashboard.tsx', category: 'ambassadors', requiresAuth: true, hasAuthCheck: true },
      { name: 'All Ambassadors', path: '/floor8/ambassadors/all', componentFile: 'src/pages/floor8/AllAmbassadorsTable.tsx', category: 'ambassadors', requiresAuth: true, hasAuthCheck: true },
      { name: 'Ambassador Regions', path: '/floor8/regions', componentFile: 'src/pages/floor8/AmbassadorRegionsPage.tsx', category: 'ambassadors', requiresAuth: true, hasAuthCheck: true },
      { name: 'Ambassador Payouts', path: '/floor8/payouts', componentFile: 'src/pages/floor8/AmbassadorPayoutsPage.tsx', category: 'ambassadors', requiresAuth: true, hasAuthCheck: true },
      { name: 'Influencers', path: '/floor8/influencers', componentFile: 'src/pages/floor8/InfluencersPage.tsx', category: 'influencers', requiresAuth: true, hasAuthCheck: true },
      { name: 'Influencer Campaigns', path: '/influencers/campaigns', componentFile: 'src/pages/InfluencerCampaigns.tsx', category: 'influencers', requiresAuth: true, hasAuthCheck: true },
    ],
  },
  {
    id: 'floor-9',
    name: 'Floor 9 — AI Operations',
    description: 'AI workforce management and task execution',
    modules: [
      { name: 'AI Operations Hub', path: '/grabba/floor9', componentFile: 'src/pages/floor9/Floor9Hub.tsx', category: 'ai', requiresAuth: true, hasAuthCheck: true },
      { name: 'AI Tasks', path: '/grabba/floor9/tasks', componentFile: 'src/pages/floor9/Floor9Tasks.tsx', category: 'ai', requiresAuth: true, hasAuthCheck: true },
      { name: 'AI Results', path: '/grabba/floor9/results', componentFile: 'src/pages/floor9/Floor9Results.tsx', category: 'ai', requiresAuth: true, hasAuthCheck: true },
      { name: 'AI Playbooks', path: '/grabba/floor9/playbooks', componentFile: 'src/pages/floor9/Floor9Playbooks.tsx', category: 'ai', requiresAuth: true, hasAuthCheck: true },
      { name: 'AI Action Queue', path: '/grabba/floor9/action-queue', componentFile: 'src/pages/floor9/Floor9ActionQueue.tsx', category: 'ai', requiresAuth: true, hasAuthCheck: true },
      { name: 'AI Predictions', path: '/grabba/floor9/predictions', componentFile: 'src/pages/floor9/Floor9Predictions.tsx', category: 'ai', requiresAuth: true, hasAuthCheck: true },
      { name: 'AI Alerts', path: '/grabba/floor9/alerts', componentFile: 'src/pages/floor9/Floor9Alerts.tsx', category: 'ai', requiresAuth: true, hasAuthCheck: true },
      { name: 'AI Instinct Log', path: '/grabba/floor9/instinct-log', componentFile: 'src/pages/floor9/Floor9InstinctLog.tsx', category: 'ai', requiresAuth: true, hasAuthCheck: true },
    ],
  },
];

// Export floor names for reference
export const FLOOR_NAMES = FLOOR_REGISTRY.map(f => f.name);

// Get all routes from registry
export function getAllRegisteredRoutes(): string[] {
  return FLOOR_REGISTRY.flatMap(floor => floor.modules.map(m => m.path));
}

// Get floor by ID
export function getFloorById(id: string): Floor | undefined {
  return FLOOR_REGISTRY.find(f => f.id === id);
}
