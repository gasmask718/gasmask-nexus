import {
  Package, Truck, MapPin, Users, Building, ShoppingBag, Flame, Droplet,
  Calendar, Sparkles, Home, Heart, Video, DollarSign, CreditCard, TrendingUp,
  ShoppingCart, MessageSquare, Phone, Settings, Activity, Bot, Database,
  BarChart3, Map, Box, Store, Megaphone, FileText, Navigation, Target, Award,
  Briefcase, GraduationCap, FileCheck, Send, Calculator, Rocket, Brain, Shield,
  Zap, Wallet, Gift, Bell, ClipboardList
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface BrandRoute {
  path: string;
  label: string;
  icon: LucideIcon;
  roles?: string[];
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
        routes: [
          { path: '/', icon: Activity, label: 'Dashboard' },
          { path: '/gasmask/analytics', icon: BarChart3, label: 'AI Analytics' },
          { path: '/gasmask/routes', icon: Truck, label: 'Biker Route Manager' },
          { path: '/gasmask/routes/optimizer', icon: Navigation, label: 'Route Optimizer' },
          { path: '/gasmask/routes/ops-center', icon: Activity, label: 'Route Ops Center' },
          { path: '/gasmask/stores', icon: Store, label: 'Store Performance' },
          { path: '/gasmask/store-performance', icon: TrendingUp, label: 'Store Rankings' },
          { path: '/gasmask/products', icon: Package, label: 'Products' },
          { path: '/gasmask/inventory', icon: Box, label: 'Inventory Dashboard' },
          { path: '/gasmask/map', icon: Map, label: 'Retail Heatmap' },
          { path: '/gasmask/live-map', icon: MapPin, label: 'Live Map' },
          { path: '/gasmask/ambassadors', icon: Users, label: 'Ambassador Manager' },
          { path: '/gasmask/ambassador-payouts', icon: DollarSign, label: 'Ambassador Payouts' },
          { path: '/gasmask/ambassador-regions', icon: MapPin, label: 'Ambassador Regions' },
          { path: '/gasmask/wholesale', icon: ShoppingBag, label: 'Wholesale Accounts' },
          { path: '/gasmask/wholesale/marketplace', icon: Building, label: 'Wholesale Marketplace' },
          { path: '/gasmask/wholesale/fulfillment', icon: Truck, label: 'Wholesale Fulfillment' },
          { path: '/gasmask/driver', icon: Truck, label: 'Driver Portal' },
          { path: '/gasmask/team', icon: Users, label: 'Team Management' },
          { path: '/gasmask/training', icon: GraduationCap, label: 'Training' },
          { path: '/gasmask/missions', icon: Target, label: 'Missions' },
          { path: '/gasmask/leaderboard', icon: Award, label: 'Leaderboard' },
          { path: '/gasmask/rewards', icon: Gift, label: 'Rewards' },
          { path: '/gasmask/territories', icon: Map, label: 'Territories' },
          { path: '/gasmask/expansion', icon: Rocket, label: 'Expansion' },
          { path: '/gasmask/expansion/regions', icon: MapPin, label: 'Expansion Regions' },
          { path: '/gasmask/expansion/heatmap', icon: Map, label: 'Expansion Heatmap' },
          { path: '/gasmask/communications', icon: MessageSquare, label: 'Communication Center' },
          { path: '/gasmask/templates', icon: FileText, label: 'Templates' },
          { path: '/gasmask/reminders', icon: Bell, label: 'Reminders' },
          { path: '/gasmask/sales', icon: TrendingUp, label: 'Sales Pipeline' },
          { path: '/gasmask/sales/prospects', icon: Users, label: 'Sales Prospects' },
          { path: '/gasmask/sales/report', icon: FileText, label: 'Sales Report' },
          { path: '/gasmask/billing', icon: DollarSign, label: 'Billing' },
          { path: '/gasmask/billing-center', icon: CreditCard, label: 'Billing Center' },
          { path: '/gasmask/billing/invoices', icon: FileText, label: 'Invoices' },
          { path: '/gasmask/payroll', icon: DollarSign, label: 'Payroll' },
          { path: '/gasmask/biker-payouts', icon: DollarSign, label: 'Biker Payouts' },
          { path: '/gasmask/delivery-capacity', icon: Truck, label: 'Delivery Capacity' },
          { path: '/gasmask/subscriptions', icon: Package, label: 'Subscriptions' },
          { path: '/gasmask/wallet', icon: Wallet, label: 'Wallet' },
          { path: '/gasmask/settings', icon: Settings, label: 'Brand Settings' },
        ]
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
        routes: [
          { path: '/hotmama', icon: Flame, label: 'Dashboard' },
          { path: '/hotmama/products', icon: Package, label: 'Products' },
          { path: '/hotmama/inventory', icon: Package, label: 'Inventory' },
          { path: '/hotmama/stores', icon: Building, label: 'Stores' },
          { path: '/hotmama/ambassadors', icon: Users, label: 'Ambassadors' },
          { path: '/hotmama/wholesale', icon: ShoppingBag, label: 'Wholesale Portal' },
          { path: '/hotmama/routes', icon: Truck, label: 'Biker Routes' },
          { path: '/hotmama/analytics', icon: TrendingUp, label: 'Retail Analytics' },
          { path: '/hotmama/settings', icon: Settings, label: 'Brand Settings' },
        ]
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
          { path: '/grabba', icon: ShoppingBag, label: 'Dashboard' },
          { path: '/grabba/products', icon: Package, label: 'Products' },
          { path: '/grabba/inventory', icon: Package, label: 'Inventory' },
          { path: '/grabba/stores', icon: Building, label: 'Stores' },
          { path: '/grabba/ambassadors', icon: Users, label: 'Ambassadors' },
          { path: '/grabba/wholesale', icon: ShoppingBag, label: 'Wholesale Portal' },
          { path: '/grabba/routes', icon: Truck, label: 'Biker Routes' },
          { path: '/grabba/analytics', icon: TrendingUp, label: 'Retail Analytics' },
          { path: '/grabba/settings', icon: Settings, label: 'Brand Settings' },
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
        routes: [
          { path: '/scalati', icon: Flame, label: 'Dashboard' },
          { path: '/scalati/products', icon: Package, label: 'Products' },
          { path: '/scalati/inventory', icon: Package, label: 'Inventory' },
          { path: '/scalati/stores', icon: Building, label: 'Stores' },
          { path: '/scalati/ambassadors', icon: Users, label: 'Ambassadors' },
          { path: '/scalati/wholesale', icon: ShoppingBag, label: 'Wholesale Portal' },
          { path: '/scalati/routes', icon: Truck, label: 'Biker Routes' },
          { path: '/scalati/analytics', icon: TrendingUp, label: 'Retail Analytics' },
          { path: '/scalati/settings', icon: Settings, label: 'Brand Settings' },
        ]
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
          { path: '/ai-ceo-control-room', icon: Brain, label: 'AI CEO Control Room', roles: ['admin'] },
          { path: '/meta-ai', icon: Zap, label: 'Meta AI Supervisor', roles: ['admin'] },
          { path: '/executive-reports', icon: FileText, label: 'Executive Reports', roles: ['admin'] },
          { path: '/missions-hq', icon: Target, label: 'Missions HQ', roles: ['admin'] },
          { path: '/crm', icon: Users, label: 'Global CRM', roles: ['admin', 'csr'] },
          { path: '/communication', icon: MessageSquare, label: 'Communication Center', roles: ['admin', 'csr'] },
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
