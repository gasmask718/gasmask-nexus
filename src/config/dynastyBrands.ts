import {
  Package, Truck, MapPin, Users, Building, ShoppingBag, Flame, Droplet,
  Calendar, Sparkles, Home, Heart, Video, DollarSign, CreditCard, TrendingUp,
  ShoppingCart, MessageSquare, Phone, Settings, Activity, Bot, Database,
  BarChart3, Map, Box, Store, Megaphone, FileText, Navigation, Target, Award,
  Briefcase, GraduationCap, FileCheck, Send, Calculator, Rocket, Brain, Shield,
  Zap, Wallet, Gift, Bell, ClipboardList, Upload, LayoutDashboard, Hash, Mail, Crown,
  Factory, Bike, Boxes
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface BrandRoute {
  path: string;
  label: string;
  icon: LucideIcon;
  roles?: string[];
  description?: string;
}

export interface Brand {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent?: string;
    rgb?: string;
  };
  style: string;
  routes: BrandRoute[];
}

export interface Floor {
  id: string;
  name: string;
  icon: LucideIcon;
  description: string;
  brands: Brand[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRABBA 8-FLOOR NAV STRUCTURE GENERATOR
// Generates consistent navigation for all Grabba brands
// ═══════════════════════════════════════════════════════════════════════════════

function generateGrabbaRoutes(brandSlug: string): BrandRoute[] {
  return [
    // ═══════════════════════════════════════════════════════════════════════════
    // 🏰 PENTHOUSE — Brand Command Deck
    // ═══════════════════════════════════════════════════════════════════════════
    { path: `/${brandSlug}/command-penthouse`, icon: Crown, label: '🏰 Penthouse: Command Deck', description: 'Executive command center' },
    { path: `/${brandSlug}/overview`, icon: LayoutDashboard, label: 'Overview Dashboard', description: 'Brand-level intelligence' },
    { path: `/${brandSlug}/tube-movement`, icon: Box, label: 'Tube Movement', description: 'Real-time tube tracking' },
    { path: `/${brandSlug}/live-inventory`, icon: Package, label: 'Live Inventory Summary', description: 'Current stock levels' },
    { path: `/${brandSlug}/store-heatmaps`, icon: Map, label: 'Store Heatmaps', description: 'Geographic performance' },
    { path: `/${brandSlug}/unpaid-snapshot`, icon: DollarSign, label: 'Unpaid Snapshot', description: 'Outstanding balances overview' },
    { path: `/${brandSlug}/ai-alerts`, icon: Bell, label: 'AI Alerts', description: 'Automated intelligence alerts' },

    // ═══════════════════════════════════════════════════════════════════════════
    // 🏢 FLOOR 1 — Store CRM
    // ═══════════════════════════════════════════════════════════════════════════
    { path: `/${brandSlug}/stores`, icon: Building, label: '🏢 F1: Store CRM', description: 'Store master list' },
    { path: `/${brandSlug}/store-profiles`, icon: Store, label: 'Store Profiles', description: 'Individual store details' },
    { path: `/${brandSlug}/store-health`, icon: Activity, label: 'Store Health', description: 'Store performance metrics' },
    { path: `/${brandSlug}/neighborhood-intel`, icon: MapPin, label: 'Neighborhood Intelligence', description: 'Area-based analytics' },
    { path: `/${brandSlug}/brand-stats`, icon: BarChart3, label: 'Brand Store Stats', description: 'Brand-wide statistics' },

    // ═══════════════════════════════════════════════════════════════════════════
    // 💬 FLOOR 2 — Communication Hub
    // ═══════════════════════════════════════════════════════════════════════════
    { path: `/${brandSlug}/communications`, icon: MessageSquare, label: '💬 F2: Communication Hub', description: 'Communication center' },
    { path: `/${brandSlug}/bulk-text`, icon: Send, label: 'Bulk Text', description: 'Mass SMS campaigns' },
    { path: `/${brandSlug}/call-center`, icon: Phone, label: 'Call Center', description: 'Phone operations' },
    { path: `/${brandSlug}/email`, icon: Mail, label: 'Email', description: 'Email campaigns' },
    { path: `/${brandSlug}/templates`, icon: FileText, label: 'Templates', description: 'Message templates' },
    { path: `/${brandSlug}/comm-logs`, icon: ClipboardList, label: 'Logs', description: 'Communication history' },

    // ═══════════════════════════════════════════════════════════════════════════
    // 🚴 FLOOR 3 — Drivers & Bikers
    // ═══════════════════════════════════════════════════════════════════════════
    { path: `/${brandSlug}/drivers`, icon: Bike, label: '🚴 F3: Drivers & Bikers', description: 'Driver management' },
    { path: `/${brandSlug}/bikers`, icon: Truck, label: 'Biker List', description: 'All bikers' },
    { path: `/${brandSlug}/driver-assignments`, icon: ClipboardList, label: 'Assignments', description: 'Driver assignments' },
    { path: `/${brandSlug}/driver-checkins`, icon: FileCheck, label: 'Check-ins', description: 'Driver check-ins' },
    { path: `/${brandSlug}/delivery-confirmations`, icon: Shield, label: 'Delivery Confirmations', description: 'Confirmed deliveries' },

    // ═══════════════════════════════════════════════════════════════════════════
    // 🗺️ FLOOR 4 — Routes & Logistics
    // ═══════════════════════════════════════════════════════════════════════════
    { path: `/${brandSlug}/routes`, icon: Map, label: '🗺️ F4: Routes & Logistics', description: 'Route planning' },
    { path: `/${brandSlug}/daily-routes`, icon: Navigation, label: 'Daily Routes', description: 'Today\'s routes' },
    { path: `/${brandSlug}/route-history`, icon: FileText, label: 'Route History', description: 'Past routes' },
    { path: `/${brandSlug}/route-optimization`, icon: Zap, label: 'Route Optimization', description: 'AI-powered routing' },

    // ═══════════════════════════════════════════════════════════════════════════
    // 👥 FLOOR 5 — Reps & Ambassadors
    // ═══════════════════════════════════════════════════════════════════════════
    { path: `/${brandSlug}/ambassadors`, icon: Users, label: '👥 F5: Reps & Ambassadors', description: 'Ambassador management' },
    { path: `/${brandSlug}/ambassador-signup`, icon: Upload, label: 'Ambassador Sign-Up', description: 'New ambassador registration' },
    { path: `/${brandSlug}/reps-tracking`, icon: Target, label: 'Reps Tracking', description: 'Rep performance tracking' },
    { path: `/${brandSlug}/store-assignments`, icon: ClipboardList, label: 'Store Assignments', description: 'Rep store assignments' },
    { path: `/${brandSlug}/commission-tracking`, icon: DollarSign, label: 'Commission Tracking', description: 'Commission management' },
    { path: `/${brandSlug}/missions`, icon: Rocket, label: 'Missions', description: 'Rep missions and goals' },

    // ═══════════════════════════════════════════════════════════════════════════
    // 🏭 FLOOR 6 — Production Center
    // ═══════════════════════════════════════════════════════════════════════════
    { path: `/${brandSlug}/production`, icon: Factory, label: '🏭 F6: Production Center', description: 'Production tracking' },
    { path: `/${brandSlug}/box-output`, icon: Box, label: 'Box Output Logs', description: 'Box production records' },
    { path: `/${brandSlug}/tool-distribution`, icon: Settings, label: 'Tool Distribution', description: 'Tool allocation' },
    { path: `/${brandSlug}/office-output`, icon: Building, label: 'Office Output Board', description: 'Office production metrics' },
    { path: `/${brandSlug}/machine-servicing`, icon: Settings, label: 'Machine Servicing', description: 'Maintenance tracking' },
    { path: `/${brandSlug}/defects`, icon: Shield, label: 'Defects / Issues', description: 'Quality control' },

    // ═══════════════════════════════════════════════════════════════════════════
    // 📦 FLOOR 7 — Wholesale Department
    // ═══════════════════════════════════════════════════════════════════════════
    { path: `/${brandSlug}/wholesale`, icon: Boxes, label: '📦 F7: Wholesale Dept', description: 'Wholesale operations' },
    { path: `/${brandSlug}/wholesale-signup`, icon: Upload, label: 'Wholesale Sign-Up', description: 'New wholesaler registration' },
    { path: `/${brandSlug}/wholesale-orders`, icon: ShoppingCart, label: 'Wholesale Orders', description: 'Order management' },
    { path: `/${brandSlug}/marketplace`, icon: Store, label: 'Marketplace', description: 'Wholesale catalog' },
    { path: `/${brandSlug}/product-upload`, icon: Upload, label: 'Product Upload', description: 'Upload wholesale items' },
    { path: `/${brandSlug}/pricing-sheet`, icon: FileText, label: 'Pricing Sheet', description: 'Wholesale pricing' },
    { path: `/${brandSlug}/wholesale-dashboard`, icon: LayoutDashboard, label: 'National Wholesale Dashboard', description: 'Wholesale analytics' },

    // ═══════════════════════════════════════════════════════════════════════════
    // 🧮 FLOOR 8 — Accounting Center
    // ═══════════════════════════════════════════════════════════════════════════
    { path: `/${brandSlug}/accounting`, icon: Calculator, label: '🧮 F8: Accounting Center', description: 'Financial operations' },
    { path: `/${brandSlug}/invoices`, icon: FileText, label: 'Invoices', description: 'Invoice management' },
    { path: `/${brandSlug}/payments`, icon: CreditCard, label: 'Payments', description: 'Payment tracking' },
    { path: `/${brandSlug}/unpaid-accounts`, icon: DollarSign, label: 'Unpaid Accounts', description: 'Outstanding balances' },
    { path: `/${brandSlug}/payment-reliability`, icon: Shield, label: 'Payment Reliability', description: 'Payment scoring' },
    { path: `/${brandSlug}/revenue-dashboard`, icon: TrendingUp, label: 'Revenue Dashboard', description: 'Revenue analytics' },

    // Settings
    { path: `/${brandSlug}/settings`, icon: Settings, label: 'Brand Settings', description: 'Brand configuration' },
  ];
}

export const dynastyFloors: Floor[] = [
  {
    id: 'product-companies',
    name: 'Product Companies',
    icon: Package,
    description: 'Physical product brands',
    brands: [
      {
        id: 'gasmask',
        name: 'GasMask',
        colors: {
          primary: '#D30000',
          secondary: '#000000',
          rgb: '211, 0, 0'
        },
        style: 'Dark industrial, premium street-luxury',
        routes: generateGrabbaRoutes('gasmask')
      },
      {
        id: 'hotmama',
        name: 'HotMama',
        colors: {
          primary: '#B76E79',
          secondary: '#000000',
          accent: '#E0BFB8',
          rgb: '183, 110, 121'
        },
        style: 'Feminine luxury metallic',
        routes: generateGrabbaRoutes('hotmama')
      },
      {
        id: 'grabba',
        name: 'Grabba R Us',
        colors: {
          primary: '#FFD400',
          secondary: '#245BFF',
          accent: '#7CF4A6',
          rgb: '255, 212, 0'
        },
        style: 'Colorful NYC nostalgic bodega aesthetic',
        routes: [
          // ═══════════════════════════════════════════════════════════════════════════
          // 🏰 GRABBA PENTHOUSE — Master Command Center (All Brands)
          // ═══════════════════════════════════════════════════════════════════════════
          { path: '/grabba/command-penthouse', icon: Crown, label: '🏰 Grabba Command Penthouse', description: 'Master control for all Grabba brands' },
          { path: '/grabba/brand-ops', icon: LayoutDashboard, label: 'Brand Operations Dashboard', description: 'Real-time operations across all brands' },
          { path: '/grabba/tube-matrix', icon: Box, label: 'Tube Intelligence Matrix', description: 'Movement & stock for all 4 Grabba brands' },
          { path: '/grabba/inventory-eta', icon: Calculator, label: 'Inventory & ETA Engine', description: 'Predictive inventory and restock timing' },
          { path: '/grabba/neighborhood-heatmap', icon: Map, label: 'Neighborhood Heatmap', description: 'Geographic performance view' },
          { path: '/grabba/revenue-board', icon: TrendingUp, label: 'Revenue & Box/Tubes Board', description: 'Sales performance metrics' },
          { path: '/grabba/unpaid-command', icon: DollarSign, label: 'Unpaid Accounts Command', description: 'Outstanding balance control' },
          { path: '/grabba/rep-leaderboard', icon: Award, label: 'Rep & Driver Leaderboard', description: 'Performance rankings' },
          { path: '/grabba/production-pulse', icon: Zap, label: 'Production Pulse', description: 'Real-time production metrics' },
          { path: '/grabba/wholesale-pulse', icon: ShoppingCart, label: 'Wholesale Pulse', description: 'National wholesale activity' },
          { path: '/grabba/communication-intel', icon: MessageSquare, label: 'Communication Intelligence', description: 'All comms across network' },
          { path: '/grabba/global-kpi', icon: BarChart3, label: 'Global KPI Dashboard', description: 'Cross-brand KPI tracking' },

          // Then standard 8-floor structure
          ...generateGrabbaRoutes('grabba').slice(7) // Skip penthouse items since we have custom ones
        ]
      },
      {
        id: 'scalati',
        name: 'Hot Scalati',
        colors: {
          primary: '#5A3A2E',
          secondary: '#FF7A00',
          rgb: '90, 58, 46'
        },
        style: 'Chocolate brown & fire orange',
        routes: generateGrabbaRoutes('scalati')
      }
    ]
  },
  {
    id: 'service-experience',
    name: 'Service & Experience',
    icon: Calendar,
    description: 'Service-based businesses',
    brands: [
      {
        id: 'toptier',
        name: 'TopTier Experience',
        colors: {
          primary: '#000000',
          secondary: '#C0C0C0',
          rgb: '0, 0, 0'
        },
        style: 'Black & Silver luxury',
        routes: [
          { path: '/toptier', icon: Calendar, label: 'Dashboard' },
          { path: '/toptier/bookings', icon: Calendar, label: 'Bookings' },
          { path: '/toptier/schedules', icon: Calendar, label: 'Schedules' },
          { path: '/toptier/drivers', icon: Users, label: 'Drivers' },
          { path: '/toptier/vehicles', icon: Truck, label: 'Vehicles' },
          { path: '/toptier/contracts', icon: Package, label: 'Contracts' },
          { path: '/toptier/zones', icon: MapPin, label: 'Zones' },
          { path: '/toptier/upsell', icon: DollarSign, label: 'Upsell Services' },
          { path: '/toptier/settings', icon: Settings, label: 'Brand Settings' },
        ]
      },
      {
        id: 'unforgettable',
        name: 'Unforgettable Times USA',
        colors: {
          primary: '#A020F0',
          secondary: '#FF2AA3',
          accent: '#FFD700',
          rgb: '160, 32, 240'
        },
        style: 'Party palette (Purple, Hot Pink, Gold, Electric Blue)',
        routes: [
          { path: '/unforgettable', icon: Sparkles, label: 'Dashboard' },
          { path: '/unforgettable/halls', icon: Building, label: 'Event Halls' },
          { path: '/unforgettable/vendors', icon: Users, label: 'Vendors' },
          { path: '/unforgettable/rentals', icon: Package, label: 'Rentals' },
          { path: '/unforgettable/marketplace', icon: ShoppingBag, label: 'Marketplace' },
          { path: '/unforgettable/party-bags', icon: Package, label: 'Party Bags' },
          { path: '/unforgettable/ai-builder', icon: Bot, label: 'AI Party Builder' },
          { path: '/unforgettable/settings', icon: Settings, label: 'Brand Settings' },
        ]
      },
      {
        id: 'iclean',
        name: 'iClean WeClean',
        colors: {
          primary: '#0094FF',
          secondary: '#00C853',
          rgb: '0, 148, 255'
        },
        style: 'Blue & Green clean aesthetic',
        routes: [
          { path: '/iclean', icon: Droplet, label: 'Dashboard' },
          { path: '/iclean/jobs', icon: Package, label: 'Jobs' },
          { path: '/iclean/staff', icon: Users, label: 'Staff/Vendors' },
          { path: '/iclean/contracts', icon: Package, label: 'Business Contracts' },
          { path: '/iclean/schedules', icon: Calendar, label: 'Cleaning Schedules' },
          { path: '/iclean/zones', icon: MapPin, label: 'Zones' },
          { path: '/iclean/equipment', icon: Package, label: 'Equipment & Supplies' },
          { path: '/iclean/billing', icon: DollarSign, label: 'Billing' },
          { path: '/iclean/settings', icon: Settings, label: 'Brand Settings' },
        ]
      }
    ]
  },
  {
    id: 'platforms-digital',
    name: 'Platforms & Digital Apps',
    icon: Video,
    description: 'Digital platforms and apps',
    brands: [
      {
        id: 'playboxxx',
        name: 'Playboxxx',
        colors: {
          primary: '#FF00C8',
          secondary: '#00E4FF',
          rgb: '255, 0, 200'
        },
        style: 'Neon Pink & Neon Blue',
        routes: [
          { path: '/playboxxx', icon: Video, label: 'Platform Overview' },
          { path: '/playboxxx/models', icon: Users, label: 'Models' },
          { path: '/playboxxx/subscriptions', icon: Package, label: 'Subscriptions' },
          { path: '/playboxxx/payouts', icon: DollarSign, label: 'Payouts' },
          { path: '/playboxxx/moderation', icon: Settings, label: 'Moderation' },
          { path: '/playboxxx/store', icon: ShoppingBag, label: 'Celebration Store' },
          { path: '/playboxxx/analytics', icon: TrendingUp, label: 'Analytics' },
          { path: '/playboxxx/settings', icon: Settings, label: 'Brand Settings' },
        ]
      },
      {
        id: 'specialneeds',
        name: 'Special Needs App',
        colors: {
          primary: '#A8D8FF',
          secondary: '#D1A7FF',
          accent: '#A7FFD1',
          rgb: '168, 216, 255'
        },
        style: 'Soft Calming Palette (Baby Blue, Lilac, Mint)',
        routes: [
          { path: '/specialneeds', icon: Heart, label: 'Dashboard' },
          { path: '/specialneeds/providers', icon: Users, label: 'Providers' },
          { path: '/specialneeds/families', icon: Home, label: 'Families' },
          { path: '/specialneeds/resources', icon: Package, label: 'Resources' },
          { path: '/specialneeds/scheduling', icon: Calendar, label: 'Scheduling' },
          { path: '/specialneeds/health', icon: Activity, label: 'Platform Health' },
          { path: '/specialneeds/settings', icon: Settings, label: 'Brand Settings' },
        ]
      }
    ]
  },
  {
    id: 'finance-acquisition',
    name: 'Finance & Acquisition',
    icon: DollarSign,
    description: 'Financial operations center',
    brands: [
      {
        id: 'finance',
        name: 'Financial Operations',
        colors: {
          primary: '#FFD700',
          secondary: '#000000',
          rgb: '255, 215, 0'
        },
        style: 'Gold & Black elite',
        routes: [
          { path: '/finance', icon: DollarSign, label: 'Overview' },
          { path: '/finance/funding', icon: DollarSign, label: 'Funding Pipeline' },
          { path: '/finance/funding-requests', icon: FileCheck, label: 'Funding Requests' },
          { path: '/finance/grants', icon: Package, label: 'Grant Cases' },
          { path: '/finance/credit-repair', icon: CreditCard, label: 'Credit Repair' },
          { path: '/finance/chexsystems', icon: CreditCard, label: 'ChexSystems' },
          { path: '/finance/investment', icon: TrendingUp, label: 'Dynasty Investment' },
          { path: '/finance/trading', icon: TrendingUp, label: 'Trading Bots' },
          { path: '/finance/economic-analytics', icon: BarChart3, label: 'Economic Analytics' },
          { path: '/finance/revenue-brain', icon: Brain, label: 'Revenue Brain' },
          { path: '/finance/opportunity-radar', icon: Target, label: 'Opportunity Radar' },
          { path: '/realestate', icon: Building, label: 'Real Estate HQ', roles: ['admin', 'realestate_worker'] },
          { path: '/realestate/leads', icon: Target, label: 'Lead Intelligence', roles: ['admin', 'realestate_worker'] },
          { path: '/realestate/pipeline', icon: TrendingUp, label: 'Acquisition Pipeline', roles: ['admin', 'realestate_worker'] },
          { path: '/realestate/investors', icon: Users, label: 'Investor Marketplace', roles: ['admin', 'realestate_worker'] },
          { path: '/realestate/closings', icon: FileCheck, label: 'Deal Closings & Payments', roles: ['admin', 'realestate_worker'] },
          { path: '/realestate/expansion', icon: Rocket, label: 'Expansion Engine', roles: ['admin', 'realestate_worker'] },
          { path: '/realestate/partners', icon: Users, label: 'Closing Partners', roles: ['admin', 'realestate_worker'] },
          { path: '/realestate/pl', icon: DollarSign, label: 'P&L Dashboard', roles: ['admin', 'realestate_worker'] },
          { path: '/realestate/subscriptions', icon: Package, label: 'Subscriptions', roles: ['admin', 'realestate_worker'] },
          { path: '/loan-products', icon: CreditCard, label: 'Loan Products' },
          { path: '/lender-directory', icon: Building, label: 'Lender Directory' },
          { path: '/loan-calculators', icon: Calculator, label: 'Loan Calculators' },
          { path: '/deal-sheets-generator', icon: FileText, label: 'Deal Sheets Generator' },
          { path: '/investor-blast-system', icon: Send, label: 'Investor Blast System' },
          { path: '/offer-analyzer', icon: BarChart3, label: 'Offer Analyzer' },
          { path: '/assignment-fee-optimizer', icon: DollarSign, label: 'Assignment Fee Optimizer' },
          { path: '/holdings/overview', icon: Building, label: 'Holdings Overview' },
          { path: '/holdings/assets', icon: Package, label: 'Assets' },
          { path: '/holdings/airbnb', icon: Home, label: 'Airbnb Properties' },
          { path: '/holdings/tenants', icon: Users, label: 'Tenants' },
          { path: '/holdings/loans', icon: CreditCard, label: 'Loans' },
          { path: '/holdings/expenses', icon: DollarSign, label: 'Expenses' },
          { path: '/holdings/strategy', icon: Target, label: 'Strategy' },
        ]
      }
    ]
  },
  {
    id: 'ecommerce-marketplaces',
    name: 'E-Commerce & Marketplaces',
    icon: ShoppingCart,
    description: 'Online marketplaces and stores',
    brands: [
      {
        id: 'ecommerce',
        name: 'E-Commerce Hub',
        colors: {
          primary: '#0094FF',
          secondary: '#000000',
          rgb: '0, 148, 255'
        },
        style: 'Modern blue-black tech palette',
        routes: [
          { path: '/ecommerce', icon: ShoppingCart, label: 'Dashboard' },
          { path: '/ecommerce/products', icon: Package, label: 'Product Sync' },
          { path: '/ecommerce/orders', icon: ShoppingBag, label: 'Orders' },
          { path: '/ecommerce/returns', icon: Package, label: 'Returns' },
          { path: '/ecommerce/payouts', icon: DollarSign, label: 'Channel Payouts' },
          { path: '/ecommerce/ads', icon: TrendingUp, label: 'Ads / ROAS' },
          { path: '/ecommerce/inventory', icon: Package, label: 'Inventory Sync' },
          { path: '/pod', icon: Package, label: 'POD Department', roles: ['admin', 'pod_worker'] },
        ]
      }
    ]
  },
  {
    id: 'systems-engine',
    name: 'Systems & Engine Room',
    icon: Settings,
    description: 'Core systems and automation',
    brands: [
      {
        id: 'systems',
        name: 'System Operations',
        colors: {
          primary: '#1F2937',
          secondary: '#374151',
          rgb: '31, 41, 55'
        },
        style: 'Dark ultra-technical theme',
        routes: [
          { path: '/systems', icon: Settings, label: 'Dashboard' },
          { path: '/communications-center', icon: MessageSquare, label: 'Communications Center', roles: ['admin', 'csr'] },
          { path: '/meta-ai', icon: Zap, label: 'Meta AI Supervisor', roles: ['admin'] },
          { path: '/executive-reports', icon: FileText, label: 'Executive Reports', roles: ['admin'] },
          { path: '/missions-hq', icon: Target, label: 'Missions HQ', roles: ['admin'] },
          { path: '/crm', icon: Users, label: 'Global CRM', roles: ['admin', 'csr'] },
          { path: '/communication', icon: MessageSquare, label: 'Legacy Communications', roles: ['admin', 'csr'] },
          { path: '/communication-automation', icon: Bot, label: 'Communication Automation', roles: ['admin'] },
          { path: '/communications-ai', icon: Brain, label: 'Communications AI', roles: ['admin'] },
          { path: '/communication-insights', icon: BarChart3, label: 'Communication Insights', roles: ['admin'] },
          { path: '/call-center/dashboard', icon: Phone, label: 'Call Center', roles: ['admin', 'callcenter_worker'] },
          { path: '/text-center', icon: MessageSquare, label: 'Text Center', roles: ['admin', 'csr'] },
          { path: '/email-center', icon: MessageSquare, label: 'Email Center', roles: ['admin', 'csr'] },
          { path: '/notifications', icon: Bell, label: 'Notifications' },
          { path: '/settings/automation', icon: Bot, label: 'Automations', roles: ['admin'] },
          { path: '/va-task-center', icon: ClipboardList, label: 'VA Task Center' },
          { path: '/va-performance', icon: BarChart3, label: 'VA Performance' },
          { path: '/va-ranking', icon: Award, label: 'VA Ranking' },
          { path: '/hr', icon: Users, label: 'HR Management', roles: ['admin', 'hr'] },
          { path: '/hr/applicants', icon: Users, label: 'Applicants', roles: ['admin', 'hr'] },
          { path: '/hr/employees', icon: Users, label: 'Employees', roles: ['admin', 'hr'] },
          { path: '/hr/interviews', icon: Calendar, label: 'Interviews', roles: ['admin', 'hr'] },
          { path: '/hr/documents', icon: FileText, label: 'Documents', roles: ['admin', 'hr'] },
          { path: '/hr/onboarding', icon: GraduationCap, label: 'Onboarding', roles: ['admin', 'hr'] },
          { path: '/hr/payroll', icon: DollarSign, label: 'HR Payroll', roles: ['admin', 'hr'] },
          { path: '/my-hr', icon: Users, label: 'My HR Portal' },
          { path: '/batch-import', icon: Database, label: 'Batch Import', roles: ['admin'] },
          { path: '/audit-logs', icon: Database, label: 'Audit Logs', roles: ['admin'] },
          { path: '/integrations', icon: Settings, label: 'Integrations', roles: ['admin'] },
        ]
      }
    ]
  }
];

export function getBrandById(brandId: string): Brand | undefined {
  for (const floor of dynastyFloors) {
    const brand = floor.brands.find(b => b.id === brandId);
    if (brand) return brand;
  }
  return undefined;
}

export function getFloorById(floorId: string): Floor | undefined {
  return dynastyFloors.find(f => f.id === floorId);
}

export function getAllBrands(): Brand[] {
  return dynastyFloors.flatMap(floor => floor.brands);
}
