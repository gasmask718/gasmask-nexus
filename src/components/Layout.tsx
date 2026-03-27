import { ReactNode, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useBusiness } from '@/contexts/BusinessContext';
import { useUserRole } from '@/hooks/useUserRole';
import { BusinessSwitcher } from '@/components/business/BusinessSwitcher';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { SendMessageModal } from '@/components/communication/SendMessageModal';
import SystemCheckpointBar from '@/components/system/SystemCheckpointBar';
import { EmpireHealthMonitor } from '@/components/system/EmpireHealthMonitor';
import { GlobalSimulationToggle } from '@/components/simulation/GlobalSimulationToggle';
import { SimulationWatermark } from '@/components/simulation/SimulationWatermark';
import { exportEmpireDataToExcel, exportOsBlueprintToJson } from '@/services/exportService';
import '@/theme/departmentStyles.css';
import { useLocation, Link } from 'react-router-dom';
import { 
  LogOut,
  Menu,
  MessageSquarePlus,
  Package,
  ChevronDown,
  ChevronRight,
  Crown,
  Building2,
  Phone,
  Boxes,
  Truck,
  DollarSign,
  Factory,
  Store,
  Users,
  Brain,
  Flame,
  Heart,
  Sparkles,
  ShoppingBag,
  Car,
  PartyPopper,
  Home,
  Briefcase,
  CreditCard,
  TrendingUp,
  Building,
  Calculator,
  PhoneCall,
  MessageSquare,
  Mail,
  Radio,
  ShoppingCart,
  Globe,
  Palette,
  MapPin,
  Bike,
  UserCheck,
  Headphones,
  Bot,
  Trophy,
  UserCog,
  ClipboardList,
  ClipboardCheck,
  Award,
  LayoutDashboard,
  Wallet,
  BarChart3,
  Settings,
  FileText,
  Target,
  Zap,
  Activity,
  AlertTriangle,
  Calendar,
  Database,
  Map,
  Route,
  Bell,
  Clock,
  Send,
  Search,
  Filter,
  Download,
  Upload,
  Layers,
  PieChart,
  LineChart,
  List,
  Grid,
  Eye,
  Edit,
  Trash,
  Plus,
  Minus,
  Check,
  X,
  Info,
  HelpCircle,
  Lock,
  Unlock,
  Shield,
  ShieldCheck,
  Key,
  User,
  UserPlus,
  UserMinus,
  Accessibility,
  Star,
  Link2,
  Swords,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useBrandaroVerify, ensureBrandaroInNav } from '@/hooks/useBrandaroVerify';

interface LayoutProps {
  children: ReactNode;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DYNASTY OS NAVIGATION STRUCTURE - FULLY RESTORED
// ═══════════════════════════════════════════════════════════════════════════════

const DYNASTY_NAVIGATION = {
  penthouse: {
    id: 'penthouse',
    name: '👑 Dynasty Owner Penthouse',
    items: [
      { path: '/os/owner', label: 'Dynasty Owner Dashboard', icon: Crown },
      { path: '/penthouse/missions', label: 'Mission Control', icon: Target },
      { path: '/penthouse/accounting', label: 'Accounting OS', icon: Calculator },
      { path: '/penthouse/audit-engine', label: '🧾 Audit Engine', icon: ShieldCheck },
      { path: '/os/owner/ai-advisor', label: 'AI Advisor', icon: Brain },
      { path: '/os/owner/cluster', label: 'Cluster Dashboard', icon: LayoutDashboard },
      { path: '/os/owner/autopilot', label: 'Autopilot Console', icon: Zap },
      { path: '/os/owner/ai-command', label: 'AI Command Console', icon: Bot },
      { path: '/os/owner/risk-radar', label: 'Risk Radar', icon: AlertTriangle },
      { path: '/os/owner/briefing', label: 'Daily Briefing', icon: Calendar },
      { path: '/os/owner/holdings', label: 'Holdings Overview', icon: Building },
      { path: '/admin/dev/marketplace-connection', label: 'Marketplace Connection', icon: Link2 },
    ],
  },
  sboAiEngine: {
    id: 'sbo-ai-engine',
    name: '🧠 SBO AI Engine',
    items: [
      { path: '/os/sports-betting/ai-os', label: '🎯 SBO Cockpit', icon: Target },
      { path: '/sbo-ai-engine/tonight', label: '🏀 Tonight', icon: Calendar },
      { path: '/sbo-ai-engine/prop-hub', label: '⚡ Prop Intelligence Hub', icon: TrendingUp },
      { path: '/sbo-ai-engine/value', label: '💎 Value Spots', icon: Star },
      { path: '/sbo-ai-engine/accuracy', label: '📈 Accuracy', icon: LineChart },
      { path: '/sbo-ai-engine/model', label: '🧬 Model Intel', icon: Brain },
      { path: '/sbo-ai-engine/my-bets', label: '📱 My Bets', icon: ClipboardList },
      { path: '/sbo-ai-engine/wallet-intelligence', label: '🔮 Wallet Intelligence', icon: Wallet },
      { path: '/sbo-ai-engine/capper-intelligence', label: '📊 Capper Intelligence', icon: BarChart3 },
      { path: '/sbo-ai-engine/signal-alignment', label: '⚡ Signal Alignment', icon: Zap },
      { path: '/os/sports-betting/profit-center', label: '💰 Profit Center', icon: DollarSign },
      { path: '/os/sports-betting/hedge-center', label: '💹 Hedge Center', icon: Shield },
      { path: '/sbo-ai-engine/simulation', label: '⚡ Simulation', icon: Activity },
      { path: '/sbo-ai-engine/history', label: '📜 History', icon: FileText },
      { path: '/sbo-ai-engine/sms', label: '📱 ChingWorld SMS', icon: MessageSquare },
      { path: '/sbo-ai-engine/health', label: '🩺 Health', icon: Heart },
      { path: '/sbo-ai-engine/sync', label: '⚙️ Sync', icon: Settings },
      { path: '/sbo-ai-engine/va-entry', label: '📋 VA Entry', icon: ClipboardList },
    ],
  },
  securityGovernance: {
    id: 'security-governance',
    name: '🛡️ Security & Governance',
    items: [
      { path: '/security/console', label: 'Security Console', icon: Shield },
      { path: '/security/users', label: 'User Management', icon: Users },
      { path: '/security/invitations', label: 'Invitations', icon: UserPlus },
      { path: '/security/roles', label: 'Roles & Permissions', icon: Lock },
      { path: '/security/devices', label: 'Device Management', icon: Key },
      { path: '/security/sessions', label: 'Active Sessions', icon: Clock },
      { path: '/security/audit', label: 'Audit Logs', icon: FileText },
      { path: '/security/ambassador-requests', label: 'Ambassador Requests', icon: UserPlus },
      { path: '/admin/qa-command-center', label: 'QA Command Center', icon: ClipboardList, adminOnly: true },
      { path: '/admin/deleted-records', label: 'Deleted Records', icon: Trash },
    ],
  },
  grabbaSkyscraper: [
    {
      id: 'grabba-command',
      name: '🔥 Grabba Command Penthouse',
      items: [
        { path: '/grabba/command-penthouse', label: 'Grabba Command Center', icon: Flame },
        { path: '/grabba/ai-insights', label: 'Grabba AI Insights', icon: Brain },
        { path: '/grabba/cluster', label: 'Grabba Cluster View', icon: LayoutDashboard },
      ],
    },
    {
      id: 'floor-1',
      name: '🏢 Floor 1 — CRM / Store Master',
      items: [
        { path: '/stores', label: 'Store Directory', icon: Store },
        { path: '/grabba/store-master', label: 'Store Master Profile', icon: Database },
        { path: '/grabba/crm', label: 'Grabba CRM', icon: Users },
        { path: '/grabba/brand/grabba', label: 'Brand CRM', icon: Target },
        { path: '/sell-through-analytics', label: 'Sell-Through Analytics', icon: BarChart3 },
        { path: '/crm', label: 'Global CRM', icon: UserCheck },
        { path: '/crm/contacts', label: 'CRM Contacts', icon: User },
        { path: '/crm/customers', label: 'CRM Customers', icon: Users },
        { path: '/crm/follow-ups', label: 'Follow-Ups', icon: Clock },
        { path: '/opportunities', label: 'All Opportunities', icon: Target },
      ],
    },
    {
      id: 'floor-2',
      name: '📞 Floor 2 — Communication Hub',
      items: [
        { path: '/communication', label: 'Command Center', icon: Radio },
        { path: '/communication/inbox', label: 'Inbox', icon: MessageSquare },
        { path: '/communication/follow-up', label: 'Follow-Up Manager', icon: Clock },
        { path: '/communication/field-submissions', label: 'Field Activity Review', icon: ClipboardList, adminOnly: true },
        { path: '/communication/dialer', label: 'Dialer', icon: PhoneCall },
        { path: '/communication/live', label: 'Live Calls', icon: Phone },
        { path: '/communication/campaigns', label: 'Campaigns', icon: Target },
        { path: '/communication/agents', label: 'AI Agents', icon: Bot },
        { path: '/communication/predictions', label: 'Predictions', icon: Brain },
        { path: '/communication/voice-matrix', label: 'Voice Matrix', icon: Radio },
        { path: '/communication/heatmap', label: 'Heatmap', icon: Flame },
        { path: '/communication/business-numbers', label: 'Caller IDs & Routing', icon: Phone, adminOnly: true },
        { path: '/communication/dialer-integrity', label: 'Dialer Integrity', icon: Activity, adminOnly: true },
        { path: '/communication/settings', label: 'Settings', icon: Settings },
      ],
    },
    {
      id: 'floor-3',
      name: '📦 Floor 3 — Inventory Engine',
      items: [
        { path: '/grabba/inventory', label: 'Inventory Dashboard', icon: Boxes },
        { path: '/products', label: 'Products', icon: Package },
        { path: '/os/inventory/product-inventory', label: 'Product Inventory', icon: BarChart3 },
        { path: '/os/product-conversions', label: 'Product Conversions', icon: Settings },
        { path: '/os/warehouse', label: 'Warehouse', icon: Building2 },
        { path: '/os/procurement', label: 'Procurement', icon: ShoppingCart },
        { path: '/os/procurement/suppliers', label: 'Suppliers', icon: Truck },
        { path: '/os/procurement/purchase-orders', label: 'Purchase Orders', icon: FileText },
      ],
    },
    {
      id: 'floor-4',
      name: '🚚 Floor 4 — Delivery & Routing',
      items: [
        { path: '/grabba/deliveries', label: 'Deliveries Dashboard', icon: Truck },
        { path: '/grabba/assignments', label: 'Order Assignments', icon: ClipboardList },
        { path: '/grabba/multi-brand-delivery', label: 'Multi-Brand Delivery', icon: Layers },
        { path: '/gasmask/route-engine', label: 'Route Engine', icon: Route },
        { path: '/gasmask/driver-route', label: 'Driver View', icon: MapPin },
        { path: '/grabba/routes', label: 'Route Manager', icon: Route },
        { path: '/routes', label: 'All Routes', icon: Map },
        { path: '/route-optimizer', label: 'Route Optimizer', icon: Zap },
        { path: '/route-ops-center', label: 'Route Ops Center', icon: Target },
        { path: '/live-map', label: 'Live Map', icon: MapPin },
        { path: '/delivery-capacity', label: 'Delivery Capacity', icon: BarChart3 },
      ],
    },
    {
      id: 'floor-5',
      name: '💰 Floor 5 — Finance & Orders',
      items: [
        { path: '/floor5', label: 'Finance Dashboard', icon: DollarSign },
        { path: '/billing/invoices', label: 'Invoices', icon: FileText },
        { path: '/admin/legacy-invoice-repair', label: 'Legacy Invoice Repair ⚠️', icon: AlertTriangle },
        { path: '/billing/center', label: 'Billing Center', icon: CreditCard },
        { path: '/unpaid-accounts', label: 'Unpaid Accounts', icon: AlertTriangle },
        { path: '/wholesale/fulfillment', label: 'Wholesale Fulfillment', icon: Package },
        { path: '/payroll', label: 'Payroll', icon: Wallet },
        { path: '/grabba/payroll-manager', label: 'Payroll Manager', icon: Calculator },
        { path: '/grabba/finance', label: 'Business Ledger', icon: PieChart },
      ],
    },
    {
      id: 'floor-6',
      name: '🏭 Floor 6 — Production',
      items: [
        { path: '/grabba/production', label: 'Production Dashboard', icon: Factory },
        { path: '/portals/production', label: 'Manufacturing OS', icon: Factory },
        { path: '/portals/production/conversion', label: 'Conversion Intelligence', icon: Flame },
        { path: '/portals/production/supplier-yield', label: 'Supplier Yield Rankings', icon: Factory },
        { path: '/portals/production/sales-velocity', label: 'Sales Velocity Intelligence', icon: TrendingUp },
        { path: '/portals/production/task-timer', label: 'Task Timer', icon: Clock },
        { path: '/production/cost-history', label: 'Cost Ledger', icon: Factory },
        { path: '/portal/production', label: 'Worker View (Read-Only)', icon: Settings },
      ],
    },
    {
      id: 'floor-7',
      name: '🛒 Floor 7 — Wholesale Platform',
      items: [
        { path: '/grabba/wholesale', label: 'Wholesale Platform', icon: ShoppingCart },
        { path: '/wholesale', label: 'Wholesale Directory', icon: Store },
        { path: '/wholesale-marketplace', label: 'Wholesale Marketplace', icon: Globe },
        { path: '/portal/national-wholesale', label: 'National Wholesale', icon: Building },
        { path: '/portal/marketplace-admin', label: 'Marketplace Admin', icon: Settings },
      ],
    },
    {
      id: 'floor-8',
      name: '🎖️ Floor 8 — Ambassadors & Reps',
      items: [
        { path: '/grabba/ambassadors', label: 'Ambassador Dashboard', icon: Award },
        { path: '/ambassadors', label: 'All Ambassadors', icon: Users },
        { path: '/ambassador-regions', label: 'Ambassador Regions', icon: Map },
        { path: '/ambassador-payouts', label: 'Ambassador Payouts', icon: DollarSign },
        { path: '/influencers', label: 'Influencers', icon: Star },
        { path: '/influencer-campaigns', label: 'Influencer Campaigns', icon: Target },
      ],
    },
    {
      id: 'floor-9',
      name: '🤖 Floor 9 — AI Operations',
      items: [
        { path: '/gasmask/agent-center', label: 'AI Agent Center', icon: Brain },
        { path: '/grabba/floor9', label: 'AI Operations Hub', icon: Brain },
        { path: '/grabba/floor9/playbooks', label: 'AI Playbooks', icon: FileText },
        { path: '/grabba/floor9/tasks', label: 'AI Tasks', icon: ClipboardList },
        { path: '/grabba/floor9/predictions', label: 'AI Predictions', icon: TrendingUp },
        { path: '/grabba/floor9/alerts', label: 'AI Alerts', icon: Bell },
        { path: '/grabba/floor9/instinct-log', label: 'Instinct Log', icon: Activity },
        { path: '/grabba/floor9/action-queue', label: 'Action Queue', icon: List },
        { path: '/grabba/floor9/results', label: 'Results', icon: BarChart3 },
        { path: '/grabba/floor9/note-cleaner', label: 'Note Cleaner', icon: Sparkles, testId: 'note-cleaner-sidebar-item' },
      ],
    },
  ],
  exportsFloor: {
    id: 'exports-floor',
    name: '📊 Exports Floor — Reports & Backup',
    items: [
      { path: '/grabba/export/command', label: '🔥 Command Export', icon: Download },
      { path: '/grabba/export/floor1', label: '🏢 Export Floor 1 — CRM', icon: Download },
      { path: '/grabba/export/floor2', label: '📞 Export Floor 2 — Comms', icon: Download },
      { path: '/grabba/export/floor3', label: '📦 Export Floor 3 — Inventory', icon: Download },
      { path: '/grabba/export/floor4', label: '🚚 Export Floor 4 — Delivery', icon: Download },
      { path: '/grabba/export/floor5', label: '💰 Export Floor 5 — Orders', icon: Download },
      { path: '/grabba/export/floor6', label: '🏭 Export Floor 6 — Production', icon: Download },
      { path: '/grabba/export/floor7', label: '🛒 Export Floor 7 — Wholesale', icon: Download },
      { path: '/grabba/export/floor8', label: '🎖️ Export Floor 8 — Ambassadors', icon: Download },
      { path: '/grabba/export/floor9', label: '🤖 Export Floor 9 — AI', icon: Download },
      { path: '/grabba/export/backup', label: '☁️ Google Drive Backup', icon: Upload },
    ],
  },
  grabbaBrands: {
    id: 'grabba-brands',
    name: '🔴 Grabba Product Brands',
    items: [
      { path: '/gasmask/driver', label: '🔴 GasMask OS', icon: Flame },
      { path: '/brand/hotmama', label: '🟠 HotMama OS', icon: Heart },
      { path: '/brand/scalati', label: '🟡 Hot Scalati OS', icon: Sparkles },
      { path: '/brand/grabba-r-us', label: '🟢 Grabba R Us OS', icon: ShoppingBag },
      { path: '/brand-dashboard', label: 'Brand Dashboard', icon: LayoutDashboard },
    ],
  },
  unforgettableHub: {
    id: 'unforgettable-hub',
    name: '🎉 Unforgettable Times HUB',
    items: [
      { path: '/os/unforgettable', label: '🎉 Penthouse — Command Center', icon: PartyPopper },
      { path: '/os/unforgettable/intelligence', label: '🎯 Floor 1 — Lead Intelligence', icon: Target },
      { path: '/os/unforgettable/outreach', label: '📞 Floor 2 — Outreach Command', icon: Phone },
      { path: '/os/unforgettable/onboarding', label: '📋 Floor 3 — Partner Onboarding', icon: ClipboardCheck },
      { path: '/os/unforgettable/marketplace', label: '🏪 Floor 4 — Marketplace Control', icon: Store },
      { path: '/os/unforgettable/products', label: '📦 Floor 5 — Product Engine', icon: Package },
      { path: '/os/unforgettable/automation', label: '🤖 Floor 6 — AI & Automation', icon: Bot },
      { path: '/os/unforgettable/analytics', label: '📊 Floor 7 — Analytics', icon: BarChart3 },
    ],
  },
  dynastyBusiness: {
    id: 'dynasty-business',
    name: '🌐 Dynasty Business Units',
    items: [
      { path: '/os/toptier', label: '🚗 TopTier Experience OS', icon: Car },
      { path: '/os/iclean', label: '🧹 iClean WeClean OS', icon: Home },
      { path: '/os/playboxxx', label: '🎮 PlayBoxxx OS', icon: Sparkles },
      { path: '/os/special-needs', label: '♿ Special Needs App OS', icon: Accessibility },
    ],
  },
  financeAcquisition: {
    id: 'finance-acquisition',
    name: '💰 Finance & Acquisition',
    items: [
      { path: '/os/funding', label: '💳 Funding Company OS', icon: CreditCard },
      { path: '/os/grants', label: '🏆 Grant Company OS', icon: Trophy },
      { path: '/os/wealth-engine', label: '📈 Wealth Engine OS', icon: TrendingUp },
    ],
  },
  communicationSystems: {
    id: 'communication-systems',
    name: '📡 Communication Systems',
    items: [
      // AI Call Center OS
      { path: '/comm-systems/dialer', label: '📞 Dialer', icon: Phone },
      { path: '/comm-systems/call-logs', label: 'Call Logs', icon: FileText },
      { path: '/comm-systems/ai-agents', label: 'AI Agents', icon: Bot },
      { path: '/comm-systems/call-analytics', label: 'Call Analytics', icon: BarChart3 },
      // AI Text Center OS
      { path: '/comm-systems/messages', label: '💬 Messages', icon: MessageSquare },
      // Email Center OS
      { path: '/comm-systems/emails', label: '📧 Emails', icon: Mail },
      // Communication Hub
      { path: '/comm-systems/comm-ai', label: '📻 Communications AI', icon: Brain },
      { path: '/comm-systems/automation', label: 'Comm Automation', icon: Zap },
      { path: '/comm-systems/insights', label: 'Comm Insights', icon: Eye },
    ],
  },
  marketplaces: {
    id: 'marketplaces',
    name: '🛍️ Marketplaces & E-Commerce',
    items: [
      { path: '/shop', label: '🛒 Marketplace OS', icon: ShoppingCart },
      { path: '/portal/national-wholesale', label: '🌎 National Wholesale OS', icon: Globe },
      { path: '/pod', label: '🎨 POD Design OS', icon: Palette },
      { path: '/pod/designs', label: 'POD Designs', icon: Layers },
      { path: '/pod/generator', label: 'POD Generator', icon: Sparkles },
      { path: '/pod/mockups', label: 'POD Mockups', icon: Eye },
      { path: '/pod/analytics', label: 'POD Analytics', icon: BarChart3 },
    ],
  },
  logistics: {
    id: 'logistics',
    name: '🚛 Delivery & Logistics',
    items: [
      { path: '/delivery/drivers', label: '🚗 Drivers OS', icon: Car },
      { path: '/delivery/bikers', label: '🚴 Bikers OS', icon: Bike },
      { path: '/gasmask/route-engine', label: '🗺 Route Engine', icon: Route },
      { path: '/gasmask/driver-route', label: '🚗 Driver View', icon: MapPin },
      { path: '/delivery/payouts', label: 'Payouts', icon: DollarSign },
      { path: '/delivery/my-route', label: 'My Route', icon: Route },
      { path: '/driver-debt-collection', label: 'Driver Debt Collection', icon: AlertTriangle },
    ],
  },
  crmCustomerService: {
    id: 'crm-customer-service',
    name: '👥 CRM & Customer Service',
    items: [
      { path: '/crm', label: '📋 Global CRM OS', icon: UserCheck },
      { path: '/crm/data', label: 'CRM Data', icon: Database },
      { path: '/crm/data/export', label: 'CRM Export', icon: Download },
      { path: '/crm/data/import', label: 'CRM Import', icon: Upload },
      { path: '/crm/backup', label: 'CRM Backup', icon: Shield },
      { path: '/communications-center', label: '🎧 Customer Service OS', icon: Headphones },
      { path: '/communications-center/logs', label: 'Service Logs', icon: FileText },
    ],
  },
  aiSystems: {
    id: 'ai-systems',
    name: '🧠 AI & Automation',
    items: [
      { path: '/ai/workforce', label: '🤖 AI Workforce Automation OS', icon: Bot },
      { path: '/ai-ceo', label: 'AI CEO Control Room', icon: Crown },
      { path: '/dynasty-automations', label: 'Dynasty Automations', icon: Zap },
      { path: '/automation-settings', label: 'Automation Settings', icon: Settings },
      { path: '/meta-ai', label: 'Meta AI', icon: Brain },
    ],
  },
  systemsHR: {
    id: 'systems-hr',
    name: '⚙️ Systems & HR',
    items: [
      { path: '/hr', label: '👔 HR OS', icon: Briefcase },
      { path: '/hr/applicants', label: 'HR Applicants', icon: UserPlus },
      { path: '/hr/employees', label: 'HR Employees', icon: Users },
      { path: '/hr/interviews', label: 'HR Interviews', icon: Calendar },
      { path: '/hr/documents', label: 'HR Documents', icon: FileText },
      { path: '/hr/onboarding', label: 'HR Onboarding', icon: Check },
      { path: '/hr/payroll', label: 'HR Payroll', icon: Wallet },
      { path: '/my-hr', label: 'My HR', icon: User },
      { path: '/va-performance', label: '📊 VA OS', icon: Activity },
      { path: '/va-ranking', label: 'VA Ranking', icon: Award },
      { path: '/va-task-center', label: 'VA Task Center', icon: ClipboardList },
      { path: '/portal/va', label: 'VA Portal', icon: User },
      { path: '/portal/ambassador', label: '🎖️ Ambassador OS', icon: Award },
    ],
  },
  brandaroHub: {
    id: 'brandaro-hub',
    name: '⚔️ Brandaro Digital Hub',
    items: [
      { path: '/brandaro', label: '⚔️ War Room', icon: Swords },
      { path: '/brandaro/ceo', label: 'CEO Dashboard', icon: Crown },
      { path: '/brandaro/leads', label: 'Lead Database', icon: Target },
      { path: '/brandaro/calling', label: 'Calling Ops', icon: PhoneCall },
      { path: '/brandaro/closer-ai', label: 'Closer AI', icon: Brain },
      { path: '/brandaro/revenue', label: 'Revenue Analytics', icon: TrendingUp },
      { path: '/brandaro/competitors', label: 'Competitor Takeover', icon: Swords },
      { path: '/brandaro/proposals', label: 'Proposal Builder', icon: FileText },
      { path: '/brandaro/campaigns', label: 'Campaign Manager', icon: Target },
      { path: '/brandaro/clients', label: 'Client Portal', icon: Users },
      { path: '/brandaro/canva-assets', label: 'Design Assets', icon: Palette },
      { path: '/brandaro/canva-templates', label: 'Canva Templates', icon: Settings },
    ],
  },
  dynastyConnect: {
    id: 'dynasty-connect',
    name: '📞 Dynasty Connect',
    items: [
      { path: '/dynasty-connect', label: '🎯 Command Center', icon: Headphones },
      { path: '/dynasty-connect/campaigns', label: '📋 Campaign Management', icon: Target },
      { path: '/dynasty-connect/agents', label: '🤖 AI Agents', icon: Brain },
      { path: '/dynasty-connect/intelligence', label: '🧠 Call Intelligence', icon: FileText },
      { path: '/dynasty-connect/pipelines', label: '🏢 Business Pipelines', icon: Building2 },
      { path: '/dynasty-connect/infrastructure', label: '⚙️ Infrastructure', icon: Settings },
      { path: '/dynasty-connect/clients', label: '💼 Client Management', icon: Briefcase },
    ],
  },
  surplusFundsOs: {
    id: 'surplus-funds-os',
    name: '💰 Surplus Funds OS',
    items: [
      { path: '/surplus-funds', label: '💰 Penthouse — Command Center', icon: DollarSign },
      { path: '/surplus-funds/leads', label: '🎯 Floor 1 — Lead Intelligence', icon: Target },
      { path: '/surplus-funds/campaigns', label: '📞 Floor 2 — Dynasty Connect', icon: Phone },
      { path: '/surplus-funds/cases', label: '📋 Floor 3 — Case Management', icon: Briefcase },
      { path: '/surplus-funds/attorneys', label: '⚖️ Floor 4 — Attorney Network', icon: UserCog },
      { path: '/surplus-funds/documents', label: '📄 Floor 5 — Documents', icon: FileText },
      { path: '/surplus-funds/automation', label: '🤖 Floor 6 — AI & Automation', icon: Bot },
      { path: '/surplus-funds/analytics', label: '📊 Floor 7 — Analytics', icon: BarChart3 },
    ],
  },
  realEstateOs: {
    id: 'real-estate-os',
    name: '🏠 Real Estate OS',
    items: [
      { path: '/real-estate', label: '🏠 Penthouse — Command Center', icon: Building },
      { path: '/real-estate/leads', label: '🎯 Floor 1 — Lead Intelligence', icon: Target },
      { path: '/real-estate/campaigns', label: '📞 Floor 2 — DC Campaigns', icon: Phone },
      { path: '/real-estate/deals', label: '📋 Floor 3 — Active Deals', icon: Briefcase },
      { path: '/real-estate/buyers', label: '🏦 Floor 4 — Buyer Network', icon: Building2 },
      { path: '/real-estate/va-desk', label: '👥 Floor 5 — VA Desk + Mastery', icon: Users },
      { path: '/real-estate/analyzer', label: '🔢 Floor 6 — Deal Analyzer', icon: Calculator },
      { path: '/real-estate/automation', label: '🤖 Floor 7 — AI & Automation', icon: Bot },
      { path: '/real-estate/markets', label: '🗺️ Floor 8 — Market Intelligence', icon: Map },
      { path: '/real-estate/analytics', label: '📊 Floor 9 — Analytics', icon: BarChart3 },
    ],
  },
  solarOs: {
    id: 'solar-os',
    name: '☀️ BrightSun Solar Hub',
    items: [
      { path: '/solar', label: '☀️ Penthouse — Command Center', icon: Building },
      { path: '/solar/leads', label: '🎯 Floor 1 — Lead Intelligence', icon: Target },
      { path: '/solar/outreach', label: '📞 Floor 2 — AI Outreach', icon: Phone },
      { path: '/solar/qualification', label: '🧠 Floor 3 — Qualification', icon: Brain },
      { path: '/solar/appointments', label: '📅 Floor 4 — Appointments', icon: Calendar },
      { path: '/solar/live-calls', label: '🔴 Floor 5 — Live Call Assist', icon: Phone },
      { path: '/solar/deals', label: '💰 Floor 6 — Deals', icon: DollarSign },
      { path: '/solar/partners', label: '🤝 Floor 7 — Partner Network', icon: Users },
      { path: '/solar/agents', label: '👥 Floor 8 — Agents', icon: Users },
      { path: '/solar/ai-brain', label: '🧠 Floor 9 — AI Brain', icon: Brain },
      { path: '/solar/analytics', label: '📊 Floor 10 — Analytics', icon: BarChart3 },
    ],
  },
  globalDashboard: {
    id: 'global-dashboard',
    name: '🌍 Global Dynasty Dashboard',
    items: [
      { path: '/', label: 'Main Dashboard', icon: LayoutDashboard },
      { path: '/analytics', label: 'Analytics', icon: BarChart3 },
      { path: '/executive-reports', label: 'Executive Reports', icon: FileText },
      { path: '/revenue-brain', label: 'Revenue Brain', icon: Brain },
      { path: '/opportunity-radar', label: 'Opportunity Radar', icon: Target },
      { path: '/missions-hq', label: 'Missions HQ', icon: Zap },
      { path: '/leaderboard', label: 'Leaderboard', icon: Trophy },
      { path: '/team', label: 'Team', icon: Users },
      { path: '/companies', label: 'Companies', icon: Building2 },
      { path: '/territories', label: 'Territories', icon: Map },
      { path: '/expansion', label: 'Expansion', icon: TrendingUp },
    ],
  },
  portals: [
    { path: '/portal/driver', label: '🚗 Driver Portal', icon: Car },
    { path: '/portal/biker', label: '🚴 Biker Portal', icon: Bike },
    { path: '/portal/ambassador', label: '🎖️ Ambassador Portal', icon: Award },
    { path: '/portal/store', label: '🏪 Store Portal', icon: Store },
    { path: '/portal/wholesaler', label: '📦 Wholesaler Portal', icon: Package },
    { path: '/portals/production', label: '🏭 Manufacturing OS', icon: Factory },
    { path: '/portal/production', label: '👷 Worker View (Read-Only)', icon: Factory },
    { path: '/portal/va', label: '💼 VA Portal', icon: Briefcase },
    { path: '/portal/customer', label: '👤 Customer Portal', icon: User },
    { path: '/portal/national-wholesale', label: '🌎 National Wholesale Portal', icon: Globe },
    { path: '/portal/marketplace-admin', label: '⚙️ Marketplace Admin Portal', icon: Settings },
  ],
};

const Layout = ({ children }: LayoutProps) => {
  const { signOut } = useAuth();
  const { role, isAdmin } = useUserRole();
  const { currentBusiness, loading: businessLoading } = useBusiness();
  const location = useLocation();
  const [unreadReportsCount, setUnreadReportsCount] = useState(0);
  const [sendMessageOpen, setSendMessageOpen] = useState(false);

  // ⚔️ BRANDARO PERMANENT VERIFICATION — Self-heal if missing
  const verifiedNav = ensureBrandaroInNav(DYNASTY_NAVIGATION);
  const brandaroStatus = useBrandaroVerify(verifiedNav);
  
  // All sections open by default — brandaro-hub PERMANENTLY included
  const [openSections, setOpenSections] = useState<string[]>([
    'penthouse', 'sbo-ai-engine', 'security-governance',
    'floor-1', 'floor-2', 'floor-3', 'floor-4', 'floor-5', 'floor-6', 'floor-7', 'floor-8', 'floor-9',
    'surplus-funds-os', 'real-estate-os', 'solar-os',
    'grabba-brands', 'dynasty-business', 'finance-acquisition', 'communication-systems',
    'marketplaces', 'logistics', 'crm-customer-service', 'ai-systems', 'systems-hr',
    'brandaro-hub', 'dynasty-connect', 'global-dashboard', 'portals'
  ]);
  
  const currentPath = location.pathname;
  const isFloor9Route = currentPath.startsWith('/grabba/floor9') || currentPath.startsWith('/gasmask/agent-center') || currentPath.startsWith('/gasmask/note-cleaner');

  const isPathActive = (path: string) => {
    if (path === '/') return currentPath === '/';
    return currentPath === path || currentPath.startsWith(path + '/');
  };

  const toggleSection = (id: string) => {
    setOpenSections(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    if (!isFloor9Route) return;

    const timer = window.setTimeout(() => {
      const noteCleanerItem = document.querySelector('[data-testid="note-cleaner-sidebar-item"]');
      if (noteCleanerItem) {
        noteCleanerItem.scrollIntoView({ block: 'center' });
      }
    }, 50);

    return () => window.clearTimeout(timer);
  }, [isFloor9Route, openSections]);

  useEffect(() => {
    if (isAdmin()) {
      const fetchUnreadCount = async () => {
        const { count } = await supabase
          .from('executive_reports')
          .select('*', { count: 'exact', head: true })
          .eq('is_read', false);
        
        setUnreadReportsCount(count || 0);
      };

      fetchUnreadCount();

      const channel = supabase
        .channel('executive-reports-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'executive_reports'
          },
          () => {
            fetchUnreadCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [role]);

  if (businessLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  const renderSection = (id: string, name: string, items: Array<{ path: string; label: string; icon: any; testId?: string }>) => {
    const isOpen = openSections.includes(id);
    
    return (
      <div key={id} className="mb-1">
        <button
          onClick={() => toggleSection(id)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-foreground/80 hover:bg-muted/50 rounded-md transition-colors"
        >
          <span className="flex-1 text-left truncate text-xs">{name}</span>
          {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        
        {isOpen && (
          <div className="ml-4 mt-0.5 space-y-0.5">
            {items.map(item => (
              <Link
                key={item.path}
                to={item.path}
                data-testid={item.testId}
                className={cn(
                  "flex items-center gap-2 px-2 py-1 text-xs rounded-md transition-colors",
                  isPathActive(item.path)
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <item.icon className="h-3 w-3 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  const NavigationContent = () => (
    <div className="space-y-2">
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 👑 PENTHOUSE — COMMAND CENTER */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {renderSection(
        DYNASTY_NAVIGATION.penthouse.id,
        DYNASTY_NAVIGATION.penthouse.name,
        DYNASTY_NAVIGATION.penthouse.items
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 🛡️ SECURITY & GOVERNANCE — Constitutional Layer (Owner/Admin/CEO Only) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {['owner', 'admin', 'ceo'].includes(role || '') && (
        <div className="pt-2 border-t border-emerald-500/30">
          <div className="px-3 py-1 text-[10px] font-semibold uppercase text-emerald-400/80 tracking-wider">
            🛡️ Security & Governance
          </div>
          {renderSection(
            DYNASTY_NAVIGATION.securityGovernance.id,
            DYNASTY_NAVIGATION.securityGovernance.name,
            DYNASTY_NAVIGATION.securityGovernance.items
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 🌍 TERRITORY INTELLIGENCE — FLOOR 0 (Constitutional — All Roles) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="pt-2 border-t border-amber-500/30">
        <div id="__FLOOR_0_ASSERT__" data-floor="0" data-section="territory-intelligence" />
        <div className="px-3 py-1 text-[10px] font-semibold uppercase text-amber-400/80 tracking-wider">
          🌍 Territory Intelligence (Floor 0)
        </div>
        <div className="ml-4 mt-0.5 space-y-0.5">
          {[
            { path: '/territory', label: 'Territory Control', icon: Map },
            { path: '/territory/gap-intelligence', label: 'Gap Intelligence', icon: Search },
            { path: '/territory/ingestion', label: 'Ingestion Wizard', icon: Upload },
            { path: '/territory/planning', label: 'Strategic Planning', icon: Target },
            { path: '/territory/planning/history', label: 'Commitment History', icon: Clock },
            { path: '/territory/ai-permissions', label: 'AI Permissions', icon: Shield },
            { path: '/territory/ai-permissions/neighborhoods', label: 'AI × Neighborhoods', icon: MapPin },
            { path: '/territory/ai-permissions/actions', label: 'AI × Actions', icon: Zap },
            { path: '/territory/ai-violations', label: 'AI Violations', icon: AlertTriangle },
            { path: '/territory/ai-review-queue', label: 'AI Review Queue', icon: ClipboardList },
            { path: '/territory/playbooks', label: 'Playbooks', icon: FileText },
          ].map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-2 px-2 py-1 text-xs rounded-md transition-colors",
                isPathActive(item.path)
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <item.icon className="h-3 w-3 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 🏢 GRABBA SKYSCRAPER — FLOORS 1-9 */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="pt-2 border-t border-border/50">
        <div className="px-3 py-1 text-[10px] font-semibold uppercase text-muted-foreground/60 tracking-wider">
          🏢 Grabba Skyscraper (Floors 1-9)
        </div>
        {DYNASTY_NAVIGATION.grabbaSkyscraper.map(floor => 
          renderSection(floor.id, floor.name, floor.items)
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 📊 EXPORTS FLOOR — REPORTS & BACKUP */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="pt-2 border-t border-border/50">
        {renderSection(
          DYNASTY_NAVIGATION.exportsFloor.id,
          DYNASTY_NAVIGATION.exportsFloor.name,
          DYNASTY_NAVIGATION.exportsFloor.items
        )}
      </div>


      {/* ⚔️ BRANDARO DIGITAL HUB — SALES WAR ROOM */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="pt-2 border-t border-orange-500/30">
        <div className="px-3 py-1 text-[10px] font-semibold uppercase text-orange-400/80 tracking-wider">
          ⚔️ Brandaro Digital Hub
        </div>
        {renderSection(
          DYNASTY_NAVIGATION.brandaroHub.id,
          DYNASTY_NAVIGATION.brandaroHub.name,
          DYNASTY_NAVIGATION.brandaroHub.items
        )}
      </div>

      {/* 📞 DYNASTY CONNECT — AI CALL CENTER HUB */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="pt-2 border-t border-teal-500/30">
        <div className="px-3 py-1 text-[10px] font-semibold uppercase text-teal-400/80 tracking-wider">
          📞 Dynasty Connect
        </div>
        {renderSection(
          DYNASTY_NAVIGATION.dynastyConnect.id,
          DYNASTY_NAVIGATION.dynastyConnect.name,
          DYNASTY_NAVIGATION.dynastyConnect.items
        )}
      </div>

      {/* 💰 SURPLUS FUNDS OS — STANDALONE HUB */}
      <div className="pt-2 border-t border-amber-500/30">
        <div className="px-3 py-1 text-[10px] font-semibold uppercase text-amber-500/80 tracking-wider">
          💰 Surplus Funds OS
        </div>
        {renderSection(
          DYNASTY_NAVIGATION.surplusFundsOs.id,
          DYNASTY_NAVIGATION.surplusFundsOs.name,
          DYNASTY_NAVIGATION.surplusFundsOs.items
        )}
      </div>

      {/* 🏠 REAL ESTATE OS — STANDALONE HUB */}
      <div className="pt-2 border-t border-green-600/30">
        <div className="px-3 py-1 text-[10px] font-semibold uppercase text-green-600/80 tracking-wider">
          🏠 Real Estate OS
        </div>
        {renderSection(
          DYNASTY_NAVIGATION.realEstateOs.id,
          DYNASTY_NAVIGATION.realEstateOs.name,
          DYNASTY_NAVIGATION.realEstateOs.items
        )}
      </div>

      {/* ☀️ BRIGHTSUN SOLAR HUB — INDEPENDENT HUB */}
      <div className="pt-2 border-t border-amber-500/30">
        <div className="px-3 py-1 text-[10px] font-semibold uppercase text-amber-400/80 tracking-wider">
          ☀️ BrightSun Solar Hub
        </div>
        {renderSection(
          DYNASTY_NAVIGATION.solarOs.id,
          DYNASTY_NAVIGATION.solarOs.name,
          DYNASTY_NAVIGATION.solarOs.items
        )}
      </div>

      {/* 🧠 SBO AI ENGINE — OWN HUB (UNDER BRIGHTSUN SOLAR HUB) */}
      <div className="pt-2 border-t border-lime-500/30">
        <div className="px-3 py-1 text-[10px] font-semibold uppercase text-lime-400/80 tracking-wider">
          🧠 SBO AI Engine
        </div>
        {renderSection(
          DYNASTY_NAVIGATION.sboAiEngine.id,
          DYNASTY_NAVIGATION.sboAiEngine.name,
          DYNASTY_NAVIGATION.sboAiEngine.items
        )}
      </div>

      {/* 🔴 GRABBA PRODUCT BRANDS */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="pt-2 border-t border-border/50">
        {renderSection(
          DYNASTY_NAVIGATION.grabbaBrands.id,
          DYNASTY_NAVIGATION.grabbaBrands.name,
          DYNASTY_NAVIGATION.grabbaBrands.items
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 🌐 DYNASTY BUSINESS UNITS */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 🎉 UNFORGETTABLE TIMES HUB */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="pt-2 border-t border-border/50">
        {renderSection(
          DYNASTY_NAVIGATION.unforgettableHub.id,
          DYNASTY_NAVIGATION.unforgettableHub.name,
          DYNASTY_NAVIGATION.unforgettableHub.items
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 🌐 DYNASTY BUSINESS UNITS */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="pt-2 border-t border-border/50">
        {renderSection(
          DYNASTY_NAVIGATION.dynastyBusiness.id,
          DYNASTY_NAVIGATION.dynastyBusiness.name,
          DYNASTY_NAVIGATION.dynastyBusiness.items
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 💰 FINANCE & ACQUISITION */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="pt-2 border-t border-border/50">
        {renderSection(
          DYNASTY_NAVIGATION.financeAcquisition.id,
          DYNASTY_NAVIGATION.financeAcquisition.name,
          DYNASTY_NAVIGATION.financeAcquisition.items
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 📡 COMMUNICATION SYSTEMS */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="pt-2 border-t border-border/50">
        {renderSection(
          DYNASTY_NAVIGATION.communicationSystems.id,
          DYNASTY_NAVIGATION.communicationSystems.name,
          DYNASTY_NAVIGATION.communicationSystems.items
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 🛍️ MARKETPLACES & E-COMMERCE */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="pt-2 border-t border-border/50">
        {renderSection(
          DYNASTY_NAVIGATION.marketplaces.id,
          DYNASTY_NAVIGATION.marketplaces.name,
          DYNASTY_NAVIGATION.marketplaces.items
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 🚛 DELIVERY & LOGISTICS */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="pt-2 border-t border-border/50">
        {renderSection(
          DYNASTY_NAVIGATION.logistics.id,
          DYNASTY_NAVIGATION.logistics.name,
          DYNASTY_NAVIGATION.logistics.items
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 👥 CRM & CUSTOMER SERVICE */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="pt-2 border-t border-border/50">
        {renderSection(
          DYNASTY_NAVIGATION.crmCustomerService.id,
          DYNASTY_NAVIGATION.crmCustomerService.name,
          DYNASTY_NAVIGATION.crmCustomerService.items
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 🧠 AI & AUTOMATION */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="pt-2 border-t border-border/50">
        {renderSection(
          DYNASTY_NAVIGATION.aiSystems.id,
          DYNASTY_NAVIGATION.aiSystems.name,
          DYNASTY_NAVIGATION.aiSystems.items
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ⚙️ SYSTEMS & HR */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="pt-2 border-t border-border/50">
        {renderSection(
          DYNASTY_NAVIGATION.systemsHR.id,
          DYNASTY_NAVIGATION.systemsHR.name,
          DYNASTY_NAVIGATION.systemsHR.items
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 🌍 GLOBAL DYNASTY DASHBOARD */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="pt-2 border-t border-border/50">
        {renderSection(
          DYNASTY_NAVIGATION.globalDashboard.id,
          DYNASTY_NAVIGATION.globalDashboard.name,
          DYNASTY_NAVIGATION.globalDashboard.items
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 🚪 ROLE PORTALS */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="pt-2 border-t border-border/50">
        <div className="px-3 py-1 text-[10px] font-semibold uppercase text-muted-foreground/60 tracking-wider">
          🚪 Role Portals
        </div>
        <div className="ml-4 space-y-0.5 mt-1">
          {DYNASTY_NAVIGATION.portals.map(portal => (
            <Link
              key={portal.path}
              to={portal.path}
              className={cn(
                "flex items-center gap-2 px-2 py-1 text-xs rounded-md transition-colors",
                isPathActive(portal.path)
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <portal.icon className="h-3 w-3 shrink-0" />
              <span className="truncate">{portal.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background safe-area-top safe-area-x">
      {/* 🔐 Dynasty OS Auto-Saver / Reset strip (admin-only) */}
      <SystemCheckpointBar />
      
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/95 backdrop-blur-sm supports-[backdrop-filter]:bg-card/90 safe-area-top">
        <div className="flex h-14 items-center px-3 sm:px-4 gap-2 sm:gap-4">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden touch-target">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <div className="flex flex-col h-full overflow-hidden py-4">
                <div className="px-4 mb-4 flex-shrink-0 space-y-2">
                  <h2 className="text-lg font-bold text-primary">🏛️ Dynasty OS</h2>
                  <p className="text-xs text-muted-foreground">Empire Command Center</p>
                  {!businessLoading && currentBusiness && (
                    <BusinessSwitcher />
                  )}
                </div>
                <ScrollArea className="flex-1 px-2">
                  <NavigationContent />
                </ScrollArea>
                <div className="px-3 pt-3 border-t border-border/50 safe-area-bottom">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-muted-foreground hover:text-foreground text-sm touch-target"
                    onClick={signOut}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <h1 className="text-base sm:text-lg font-bold hidden sm:block truncate">🏛️ Dynasty OS</h1>
            <EmpireHealthMonitor />
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {/* Global Simulation Toggle */}
            <GlobalSimulationToggle variant="compact" />
            
            {/* Export Buttons - Admin Only */}
            {isAdmin && (
              <div className="hidden lg:flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const result = await exportEmpireDataToExcel({});
                    if (!result.success) {
                      toast.error(result.message);
                    } else {
                      toast.success(result.message);
                    }
                  }}
                  className="border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 text-xs"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Export Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportOsBlueprintToJson()}
                  className="border-amber-500/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20 text-xs"
                >
                  <FileText className="h-3 w-3 mr-1" />
                  OS Blueprint
                </Button>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSendMessageOpen(true)}
              className="border-primary/50 touch-target"
            >
              <MessageSquarePlus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">New Message</span>
            </Button>
            <NotificationCenter />
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="hidden md:flex touch-target"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex w-72 flex-col border-r border-border/50 bg-card h-[calc(100vh-3.5rem)] overflow-hidden" style={{ opacity: 1, filter: 'none', backdropFilter: 'none', zIndex: 40 }}>
          <div className="p-3 border-b border-border/50">
            <h2 className="text-sm font-bold mb-1">🏛️ Dynasty OS</h2>
            <p className="text-xs text-muted-foreground mb-2">Empire Command Center</p>
            {!businessLoading && currentBusiness && (
              <BusinessSwitcher />
            )}
          </div>
          <ScrollArea className="flex-1">
            <nav className="p-2">
              <NavigationContent />
            </nav>
          </ScrollArea>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-auto relative">
          <SimulationWatermark />
          {children}
        </main>
      </div>

      <SendMessageModal open={sendMessageOpen} onOpenChange={setSendMessageOpen} />
    </div>
  );
};

export default Layout;