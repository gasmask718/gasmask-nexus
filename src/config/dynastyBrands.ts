import {
  Package, Truck, MapPin, Users, Building, ShoppingBag, Flame, Droplet,
  Calendar, Sparkles, Home, Heart, Video, DollarSign, CreditCard, TrendingUp,
  ShoppingCart, MessageSquare, Phone, Settings, Activity, Bot, Database,
  BarChart3, Map, Box, Store, Megaphone, FileText, Navigation, Target, Award,
  Briefcase, GraduationCap, FileCheck, Send, Calculator, Rocket, Brain, Shield,
  Zap, Wallet, Gift, Bell, ClipboardList, Upload, LayoutDashboard, Hash, Mail, Crown
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
          // FLOOR 1 - CRM & Companies
          { path: '/gasmask/crm', icon: Users, label: 'CRM & Companies', description: 'Master record of all stores, wholesalers, buyers, and their order/payment history' },
          { path: '/gasmask/companies', icon: Building, label: 'All Companies', description: 'Browse and manage all company profiles' },
          // FLOOR 2 - Store Intelligence
          { path: '/gasmask/stores', icon: Store, label: 'Store Intelligence', description: 'Store list, performance, and live inventory tracking' },
          { path: '/gasmask/store-performance', icon: TrendingUp, label: 'Store Rankings', description: 'Performance rankings across all stores' },
          { path: '/gasmask/map', icon: Map, label: 'Retail Heatmap', description: 'Geographic view of store performance' },
          { path: '/gasmask/live-map', icon: MapPin, label: 'Live Map', description: 'Real-time driver and delivery tracking' },
          // FLOOR 3 - Orders & Logistics
          { path: '/gasmask/wholesale', icon: ShoppingBag, label: 'Orders & Logistics', description: 'View and manage all wholesale orders' },
          { path: '/gasmask/wholesale/marketplace', icon: Building, label: 'Wholesale Marketplace', description: 'Browse wholesale catalog and pricing' },
          { path: '/gasmask/wholesale/fulfillment', icon: Truck, label: 'Wholesale Fulfillment', description: 'Order fulfillment and dispatch' },
          // FLOOR 4 - Invoices & Collections
          { path: '/gasmask/billing', icon: DollarSign, label: 'Invoices & Collections', description: 'All invoices and payment tracking' },
          { path: '/gasmask/billing-center', icon: CreditCard, label: 'Billing Center', description: 'Payment processing and billing management' },
          { path: '/gasmask/billing/invoices', icon: FileText, label: 'All Invoices', description: 'Complete invoice history and status' },
          { path: '/gasmask/unpaid-accounts', icon: DollarSign, label: 'Unpaid Accounts', description: 'Outstanding balances and collections' },
          // FLOOR 5 - Inventory & Tube Analytics
          { path: '/gasmask/inventory', icon: Box, label: 'Inventory Dashboard', description: 'Live inventory and automated tube tracking with ETA forecasting' },
          { path: '/gasmask/products', icon: Package, label: 'Products', description: 'Product catalog and pricing' },
          // FLOOR 6 - Drivers & Route Planner
          { path: '/gasmask/routes', icon: Truck, label: 'Biker Routes', description: 'Route planner and dispatch hub for bikers/drivers' },
          { path: '/gasmask/routes/optimizer', icon: Navigation, label: 'Route Optimizer', description: 'AI-powered route optimization' },
          { path: '/gasmask/routes/ops-center', icon: Activity, label: 'Route Ops Center', description: 'Real-time operations dashboard' },
          { path: '/gasmask/driver', icon: Truck, label: 'Driver Portal', description: 'Driver dashboard and task management' },
          { path: '/gasmask/biker-payouts', icon: DollarSign, label: 'Biker Payouts', description: 'Driver pay and commission tracking' },
          { path: '/gasmask/delivery-capacity', icon: Truck, label: 'Delivery Capacity', description: 'Capacity planning and scheduling' },
          // FLOOR 7 - Ambassadors & Wholesalers
          { path: '/gasmask/ambassadors', icon: Users, label: 'Ambassador Manager', description: 'Ambassador signup and management' },
          { path: '/gasmask/ambassador-payouts', icon: DollarSign, label: 'Ambassador Payouts', description: 'Ambassador commission and payouts' },
          { path: '/gasmask/ambassador-regions', icon: MapPin, label: 'Ambassador Regions', description: 'Regional ambassador assignments' },
          // Additional Features
          { path: '/gasmask/analytics', icon: BarChart3, label: 'AI Analytics', description: 'AI-powered insights and analytics' },
          { path: '/gasmask/team', icon: Users, label: 'Team Management', description: 'Team roster and permissions' },
          { path: '/gasmask/training', icon: GraduationCap, label: 'Training', description: 'Training materials and certifications' },
          { path: '/gasmask/missions', icon: Target, label: 'Missions', description: 'Daily missions and goals' },
          { path: '/gasmask/leaderboard', icon: Award, label: 'Leaderboard', description: 'Performance rankings' },
          { path: '/gasmask/rewards', icon: Gift, label: 'Rewards', description: 'Rewards and incentives' },
          { path: '/gasmask/territories', icon: Map, label: 'Territories', description: 'Territory management' },
          { path: '/gasmask/expansion', icon: Rocket, label: 'Expansion', description: 'Growth and expansion planning' },
          { path: '/gasmask/communications', icon: MessageSquare, label: 'Communications', description: 'Communication center and logs' },
          { path: '/gasmask/templates', icon: FileText, label: 'Templates', description: 'Message and document templates' },
          { path: '/gasmask/reminders', icon: Bell, label: 'Reminders', description: 'Follow-up reminders' },
          { path: '/gasmask/sales', icon: TrendingUp, label: 'Sales Pipeline', description: 'Sales tracking and pipeline' },
          { path: '/gasmask/payroll', icon: DollarSign, label: 'Payroll', description: 'Payroll management' },
          { path: '/gasmask/subscriptions', icon: Package, label: 'Subscriptions', description: 'Subscription management' },
          { path: '/gasmask/wallet', icon: Wallet, label: 'Wallet', description: 'Financial wallet' },
          { path: '/gasmask/settings', icon: Settings, label: 'Brand Settings', description: 'Brand configuration' },
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
          // FLOOR 1 - CRM & Companies
          { path: '/hotmama/crm', icon: Users, label: 'CRM & Companies', description: 'Master record of all stores, wholesalers, and buyers' },
          // FLOOR 2 - Store Intelligence
          { path: '/hotmama/stores', icon: Building, label: 'Store Intelligence', description: 'Store list and performance tracking' },
          // FLOOR 3 - Orders & Logistics
          { path: '/hotmama/wholesale', icon: ShoppingBag, label: 'Orders & Logistics', description: 'View and manage all wholesale orders' },
          // FLOOR 4 - Invoices & Collections
          { path: '/hotmama/billing', icon: DollarSign, label: 'Invoices & Collections', description: 'All invoices and payment tracking' },
          // FLOOR 5 - Inventory & Tube Analytics
          { path: '/hotmama/inventory', icon: Package, label: 'Inventory Dashboard', description: 'Live inventory and tube tracking with ETA forecasting' },
          { path: '/hotmama/products', icon: Package, label: 'Products', description: 'Product catalog' },
          // FLOOR 6 - Drivers & Route Planner
          { path: '/hotmama/routes', icon: Truck, label: 'Biker Routes', description: 'Route planner and dispatch hub' },
          // FLOOR 7 - Ambassadors
          { path: '/hotmama/ambassadors', icon: Users, label: 'Ambassadors', description: 'Ambassador management' },
          // Analytics & Settings
          { path: '/hotmama/analytics', icon: TrendingUp, label: 'Analytics', description: 'Retail analytics and insights' },
          { path: '/hotmama/settings', icon: Settings, label: 'Brand Settings', description: 'Brand configuration' },
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
          // ═══════════════════════════════════════════════════════════════════
          // 🏰 PENTHOUSE — Grabba Command Penthouse (TOP OF NAV)
          // ═══════════════════════════════════════════════════════════════════
          { path: '/grabba/command-penthouse', icon: Crown, label: '🏰 Command Penthouse', description: 'Executive command center for all Grabba brands' },
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

          // ═══════════════════════════════════════════════════════════════════
          // 🏢 FLOOR 1 — Store CRM
          // ═══════════════════════════════════════════════════════════════════
          { path: '/grabba/store-master', icon: Store, label: '🏢 F1: Store CRM', description: 'Store Master CRM' },
          { path: '/grabba/companies', icon: Building, label: 'Company Profiles', description: 'All company profiles and details' },
          { path: '/grabba/store-contacts', icon: Users, label: 'Store Contacts', description: 'Store contact management' },
          { path: '/grabba/crm', icon: Database, label: 'Multi-Brand CRM View', description: 'Unified CRM across brands' },
          { path: '/grabba/tube-history', icon: ClipboardList, label: 'Tube History', description: 'Historical tube transactions' },

          // ═══════════════════════════════════════════════════════════════════
          // 📞 FLOOR 2 — Call & Text Hub
          // ═══════════════════════════════════════════════════════════════════
          { path: '/grabba/communications', icon: Phone, label: '📞 F2: Call & Text Hub', description: 'Communication Center' },
          { path: '/grabba/va-call-mode', icon: Phone, label: 'VA Call Mode', description: 'Virtual assistant calling' },
          { path: '/grabba/call-history', icon: Phone, label: 'Call History', description: 'All call records' },
          { path: '/grabba/text-history', icon: MessageSquare, label: 'Text History', description: 'All text message records' },
          { path: '/grabba/templates', icon: FileText, label: 'Templates', description: 'Message templates' },
          { path: '/grabba/automation-triggers', icon: Zap, label: 'Automation Triggers', description: 'Automated communication rules' },

          // ═══════════════════════════════════════════════════════════════════
          // 🚴 FLOOR 3 — Drivers & Bikers
          // ═══════════════════════════════════════════════════════════════════
          { path: '/grabba/drivers', icon: Truck, label: '🚴 F3: Drivers & Bikers', description: 'Driver List' },
          { path: '/grabba/bikers', icon: Truck, label: 'Biker List', description: 'All bikers' },
          { path: '/grabba/driver-assignments', icon: ClipboardList, label: 'Assignments', description: 'Driver/Biker assignments' },
          { path: '/grabba/driver-performance', icon: TrendingUp, label: 'Performance Board', description: 'Driver performance metrics' },
          { path: '/grabba/rpa-store-category', icon: Database, label: 'RPA Store Category', description: 'Store categorization for routing' },

          // ═══════════════════════════════════════════════════════════════════
          // 🗺️ FLOOR 4 — Routes & Logistics
          // ═══════════════════════════════════════════════════════════════════
          { path: '/grabba/routes', icon: Navigation, label: '🗺️ F4: Routes & Logistics', description: 'Route Planner' },
          { path: '/grabba/delivery-generator', icon: Truck, label: 'Delivery Generator', description: 'Generate delivery runs' },
          { path: '/grabba/active-routes', icon: Map, label: 'Active Routes', description: 'Currently active routes' },
          { path: '/grabba/map', icon: MapPin, label: 'Map View', description: 'Geographic route view' },
          { path: '/grabba/delivery-logs', icon: FileText, label: 'Delivery Logs', description: 'Delivery history and logs' },

          // ═══════════════════════════════════════════════════════════════════
          // 👥 FLOOR 5 — Representatives & Ambassadors
          // ═══════════════════════════════════════════════════════════════════
          { path: '/grabba/ambassadors', icon: Users, label: '👥 F5: Reps & Ambassadors', description: 'Rep Dashboard' },
          { path: '/grabba/store-claims', icon: Target, label: 'Store Claims', description: 'Ambassador store claims' },
          { path: '/grabba/ambassador-commissions', icon: DollarSign, label: 'Commissions', description: 'Commission tracking' },
          { path: '/grabba/ambassador-assignments', icon: ClipboardList, label: 'Assignments', description: 'Rep assignments' },
          { path: '/grabba/missions', icon: Target, label: 'Missions', description: 'Rep missions and goals' },

          // ═══════════════════════════════════════════════════════════════════
          // 🏭 FLOOR 6 — Production & Tools Center
          // ═══════════════════════════════════════════════════════════════════
          { path: '/grabba/production', icon: Box, label: '🏭 F6: Production & Tools', description: 'Production Tracker' },
          { path: '/grabba/tool-assignments', icon: Settings, label: 'Tool Assignments', description: 'Tool allocation' },
          { path: '/grabba/machine-maintenance', icon: Settings, label: 'Machine Maintenance', description: 'Maintenance tracking' },
          { path: '/grabba/production-logs', icon: FileText, label: 'Production Logs', description: 'Production history' },
          { path: '/grabba/box-output', icon: Package, label: 'Box Output Tracker', description: 'Box production metrics' },

          // ═══════════════════════════════════════════════════════════════════
          // 🌐 FLOOR 7 — National Wholesale Portal
          // ═══════════════════════════════════════════════════════════════════
          { path: '/grabba/wholesale-platform', icon: ShoppingBag, label: '🌐 F7: Wholesale Portal', description: 'Wholesaler Sign-Up' },
          { path: '/grabba/wholesale-storefront', icon: Store, label: 'Wholesale Storefront', description: 'Browse wholesale catalog' },
          { path: '/grabba/item-upload', icon: Upload, label: 'Item Upload', description: 'Upload wholesale items' },
          { path: '/grabba/wholesale-orders', icon: ShoppingCart, label: 'Wholesale Orders', description: 'Order management' },
          { path: '/grabba/sourcing-ai', icon: Brain, label: 'Sourcing AI', description: 'AI-powered sourcing' },

          // ═══════════════════════════════════════════════════════════════════
          // 💰 FLOOR 8 — Accounting & Financial Center
          // ═══════════════════════════════════════════════════════════════════
          { path: '/grabba/finance', icon: DollarSign, label: '💰 F8: Accounting & Finance', description: 'Invoices' },
          { path: '/grabba/payments', icon: CreditCard, label: 'Payments', description: 'Payment tracking' },
          { path: '/grabba/unpaid-accounts', icon: DollarSign, label: 'Unpaid Accounts', description: 'Outstanding balances' },
          { path: '/grabba/credit-control', icon: Shield, label: 'Credit Control', description: 'Credit management' },
          { path: '/grabba/payouts', icon: Wallet, label: 'Payouts (Rep/Wholesale)', description: 'Commission payouts' },
          { path: '/grabba/cash-logs', icon: FileText, label: 'Cash App/Zelle/Card Logs', description: 'Payment method tracking' },

          // Settings
          { path: '/grabba/settings', icon: Settings, label: 'Brand Settings', description: 'Brand configuration' },
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
          // FLOOR 1 - CRM & Companies
          { path: '/scalati/crm', icon: Users, label: 'CRM & Companies', description: 'Master record of all stores and wholesalers' },
          // FLOOR 2 - Store Intelligence
          { path: '/scalati/stores', icon: Building, label: 'Store Intelligence', description: 'Store list and performance' },
          // FLOOR 3 - Orders & Logistics
          { path: '/scalati/wholesale', icon: ShoppingBag, label: 'Orders & Logistics', description: 'Wholesale order management' },
          // FLOOR 4 - Invoices & Collections
          { path: '/scalati/billing', icon: DollarSign, label: 'Invoices & Collections', description: 'Invoice and payment tracking' },
          // FLOOR 5 - Inventory
          { path: '/scalati/inventory', icon: Package, label: 'Inventory Dashboard', description: 'Live inventory and ETA forecasting' },
          { path: '/scalati/products', icon: Package, label: 'Products', description: 'Product catalog' },
          // FLOOR 6 - Drivers
          { path: '/scalati/routes', icon: Truck, label: 'Biker Routes', description: 'Route planning and dispatch' },
          // FLOOR 7 - Ambassadors
          { path: '/scalati/ambassadors', icon: Users, label: 'Ambassadors', description: 'Ambassador network' },
          // Analytics & Settings
          { path: '/scalati/analytics', icon: TrendingUp, label: 'Analytics', description: 'Retail analytics' },
          { path: '/scalati/settings', icon: Settings, label: 'Brand Settings', description: 'Brand configuration' },
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
