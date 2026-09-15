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
import { FeedbackDialog } from '@/components/feedback/FeedbackDialog';

import { EmpireHealthMonitor } from '@/components/system/EmpireHealthMonitor';
import { GlobalSimulationToggle } from '@/components/simulation/GlobalSimulationToggle';
import { SimulationWatermark } from '@/components/simulation/SimulationWatermark';
import { exportEmpireDataToExcel, exportOsBlueprintToJson } from '@/services/exportService';
import '@/theme/departmentStyles.css';
import { useLocation, Link } from 'react-router-dom';
import { isDispatchWired, sectionHasDispatch, DISPATCH_TOOLTIP } from '@/config/dispatchRegistry';
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
  MessageSquareWarning,
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
  Lightbulb,

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
  Megaphone,
  Power,
  Wrench,
  ShieldCheck,
  Banknote,
  Key,
  User,
  UserPlus,
  UserMinus,
  Accessibility,
  Star,
  Link2,
  Swords,
  Landmark,
  Sunrise,
  CheckSquare,
  Camera,
  MessageCircle,
  Handshake,
  Gift,
  Scale,
  FolderOpen,
  Film,
  Video,
  Settings2,
  Receipt,
  Moon,
  BookOpen,
  Navigation,
  Hotel,
  Anchor,
  Plane,
  BarChart,
  Grid3x3,
  ListFilter,
  ToggleLeft,
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
      { path: '/directory', label: '🗺️ OS Directory', icon: Map },
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
      { path: '/sbo-ai-engine/nightly', label: '🌙 Nightly Board', icon: Moon },
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
      { path: '/sbo-ai-engine/signals', label: '📡 Signals', icon: Radio },
      { path: '/sbo-ai-engine/health', label: '🩺 Health', icon: Heart },
      { path: '/sbo-ai-engine/sync', label: '⚙️ Sync', icon: Settings },
      { path: '/sbo-ai-engine/va-entry', label: '📋 VA Entry', icon: ClipboardList },
      { path: '/os/sbo', label: '🧭 SBO Dashboard', icon: LayoutDashboard },
      { path: '/os/sbo/picks', label: '🎯 All Picks', icon: ListFilter },
    ],
  },
  securityGovernance: {
    id: 'security-governance',
    name: '🛡️ Security & Governance',
    items: [
      { path: '/security/console', label: 'Security Console', icon: Shield },
      { path: '/security/users', label: 'User Management', icon: Users },
      { path: '/security/invitations', label: 'User Invitations', icon: UserPlus, adminOnly: true },
      { path: '/security/roles', label: 'Roles & Permissions', icon: Lock },
      { path: '/security/devices', label: 'Device Management', icon: Key },
      { path: '/security/sessions', label: 'Active Sessions', icon: Clock },
      { path: '/security/audit', label: 'Audit Logs', icon: FileText },
      { path: '/security/ambassador-requests', label: 'Ambassador Requests', icon: UserPlus },
      { path: '/admin/ambassador-invites', label: 'Ambassador Invite Governance', icon: Mail, adminOnly: true },
      { path: '/admin/qa-command-center', label: 'QA Command Center', icon: ClipboardList, adminOnly: true },
      { path: '/admin/deleted-records', label: 'Deleted Records', icon: Trash },
      { path: '/admin/store-deduplication', label: 'Data Quality — Store Dedup', icon: Database, adminOnly: true },
      { path: '/admin/store-merge-preview', label: 'Data Quality — Store Merge Preview', icon: Database, adminOnly: true },
      { path: '/admin/merge-dry-run', label: 'Data Quality — Merge Dry-Run', icon: Database, adminOnly: true },
      { path: '/brandaro/admin-scripts', label: 'Brandaro Scripts & Playbooks', icon: FileText, adminOnly: true },
    ],
  },
  dynastyPartners: {
    id: 'dynasty-partners',
    name: '🤝 Dynasty Partners Hub',
    items: [
      { path: '/admin', label: 'Partners Dashboard', icon: Building, adminOnly: true },
      { path: '/admin/partners', label: 'Partners', icon: Users, adminOnly: true },
      { path: '/admin/mrr', label: 'MRR', icon: TrendingUp, adminOnly: true },
      { path: '/admin/platforms', label: 'Platforms', icon: Layers, adminOnly: true },
      { path: '/admin/recruitment', label: 'Recruitment', icon: Megaphone, adminOnly: true },
      { path: '/admin/financials', label: 'Financials', icon: DollarSign, adminOnly: true },
      { path: '/admin/controls', label: 'Kill Switches', icon: Power, adminOnly: true },
      { path: '/admin/activity', label: 'Activity', icon: Activity, adminOnly: true },
      { path: '/admin/manual', label: 'Manual Tools', icon: Wrench, adminOnly: true },
      { path: '/admin/notifications', label: 'Notifications', icon: Bell, adminOnly: true },
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
        { path: '/new-arrivals', label: '🆕 New Arrivals', icon: Sparkles },
        { path: '/gasmask/store-intelligence', label: '🎯 Store Intelligence', icon: BarChart3 },
        { path: '/grabba/store-master', label: 'Store Master Profile', icon: Database },
        { path: '/grabba/flower-customers', label: '🌿 Flower Customers', icon: Target },
        { path: '/ideas', label: '💡 Idea & Improvement Box', icon: Lightbulb },

        { path: '/grabba/crm', label: 'Grabba CRM', icon: Users },
        { path: '/grabba/brand/grabba', label: 'Brand CRM', icon: Target },
        { path: '/sell-through-analytics', label: 'Sell-Through Analytics', icon: BarChart3 },
        { path: '/crm', label: 'Global CRM', icon: UserCheck },
        { path: '/crm/contacts', label: 'CRM Contacts', icon: User },
        { path: '/crm/customers', label: 'Customers', icon: Users },
        { path: '/brand-crm', label: 'Brand CRM', icon: Target },
        { path: '/sales/prospects', label: 'Sales Prospects', icon: TrendingUp },
        { path: '/sales/report', label: 'Sales Report', icon: BarChart3 },
        // T3 M4: CRM Customers is a tab inside Global CRM; sidebar entry removed.
        { path: '/crm/follow-ups', label: 'Follow-Ups', icon: Clock },
        { path: '/opportunities', label: 'All Opportunities', icon: Target },
        { path: '/reports/account-activity', label: '📊 Account Activity Report', icon: Activity },
        { path: '/reports/samples-by-store', label: '🎁 Samples by Store', icon: Gift },
        { path: '/reports/samples-by-brand', label: '🥧 Samples by Brand', icon: PieChart },
      ],
    },

    {
      id: 'floor-2',
      name: '📞 Floor 2 — Communication Hub',
      items: [
        { path: '/communication', label: 'Command Center', icon: Radio },
        { path: '/grabba/communication', label: 'Communication Hub', icon: MessageSquare },
        { path: '/grabba/daily-briefing', label: '🌅 Daily Briefing', icon: Sunrise },
        { path: '/tasks', label: 'Task Center', icon: CheckSquare },
        { path: '/messages', label: 'Messages', icon: MessageSquare },

        { path: '/communication/inbox', label: 'Inbox', icon: MessageSquare },
        { path: '/communication/follow-ups', label: 'Follow-Up Manager', icon: Clock },
        { path: '/communication/field-submissions', label: 'Field Activity Review', icon: ClipboardList, adminOnly: true },
        { path: '/communication/dialer', label: 'Dialer', icon: PhoneCall },
        { path: '/communication/power-dialer', label: 'Power Dialer', icon: Zap },
        { path: '/phone-log', label: 'Phone Log', icon: PhoneCall },
        { path: '/communication/live', label: 'Live Calls', icon: Phone },
        { path: '/communication/campaigns', label: 'Campaigns', icon: Target },
        { path: '/communication/agents', label: 'AI Agents', icon: Bot },
        { path: '/communication/predictions', label: 'Predictions', icon: Brain },
        { path: '/communication/voice-matrix', label: 'Voice Matrix', icon: Radio },
        { path: '/communication/heatmap', label: 'Heatmap', icon: Flame },
        { path: '/communication/business-numbers', label: 'Caller IDs & Routing', icon: Phone, adminOnly: true },
        { path: '/communication/provision-numbers', label: '📱 Buy Numbers', icon: ShoppingCart, adminOnly: true },
        { path: '/communication/dialer-integrity', label: 'Dialer Integrity', icon: Activity, adminOnly: true },
        { path: '/communication/comms-health', label: '🩺 Comms Health', icon: Activity, adminOnly: true },
        { path: '/outreach-switchboard', label: '🎛️ Outreach Switchboard', icon: ToggleLeft, adminOnly: true },
        { path: '/communication/settings', label: 'Settings', icon: Settings },
      ],
    },
    {
      id: 'floor-3',
      name: '📦 Floor 3 — Inventory Engine',
      items: [
        { path: '/grabba/inventory', label: 'Inventory Dashboard', icon: Boxes },
        { path: '/os/inventory/dashboard', label: 'Inventory Dashboard (OS)', icon: Boxes },
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
        { path: '/routes/command-center', label: '🚀 Route Command Center', icon: Target, gold: true },
        { path: '/gasmask/driver-route', label: 'Driver View', icon: MapPin },
        { path: '/live-map', label: 'Live Map', icon: MapPin },
        { path: '/delivery/deliveries', label: 'Deliveries', icon: Truck },
        { path: '/dispatch/pending-stops', label: 'Pending Stops (AI)', icon: ClipboardList },
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
        { path: '/billing-center', label: 'Billing Center (New)', icon: CreditCard },
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
        { path: '/portals/production', label: 'Production Floor (Manufacturing OS)', icon: Factory },
        { path: '/portals/production/offices', label: 'Offices', icon: Factory, adminOnly: true },
        { path: '/portals/production/staff', label: 'Production Staff', icon: Clock, adminOnly: true },
        { path: '/portals/production/conversion', label: 'Conversion Intelligence', icon: Flame, adminOnly: true },
        { path: '/portals/production/yield-watch', label: 'Yield Watch', icon: Scale, adminOnly: true },
        { path: '/portals/production/intelligence', label: 'Owner Intelligence', icon: BarChart, adminOnly: true },
        { path: '/portals/production/supplier-yield', label: 'Supplier Yield Rankings', icon: Factory, adminOnly: true },
        { path: '/portals/production/sales-velocity', label: 'Sales Velocity Intelligence', icon: TrendingUp, adminOnly: true },
        { path: '/portals/production/task-timer', label: 'Task Timer', icon: Clock },
        { path: '/production/cost-history', label: 'Cost Ledger', icon: Factory },
        { path: '/portal/production', label: 'Worker View (Read-Only)', icon: Settings },
      ],
    },
    {
      id: 'floor-7',
      name: '🛒 Floor 7 — Wholesale Platform',
      items: [
        { path: '/grabba/wholesale-platform', label: 'Wholesale Platform', icon: ShoppingCart },
        { path: '/wholesale/marketplace', label: 'Wholesale Marketplace', icon: Globe },
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
        { path: '/ambassadors/assignments', label: 'Assignments & Routes', icon: Map },
        { path: '/ambassadors/route-planning', label: 'Route Planning', icon: Map },
        { path: '/ambassadors/tasks', label: 'Ambassador Tasks', icon: ClipboardList },
        { path: '/ambassadors/box-requests', label: 'Box Requests', icon: Package },
        { path: '/ambassador-regions', label: 'Ambassador Regions', icon: Map },
        { path: '/ambassador-payouts', label: 'Ambassador Payouts', icon: DollarSign },
        { path: '/influencers', label: 'Influencers', icon: Star },
        { path: '/influencers/campaigns', label: 'Influencer Campaigns', icon: Target },
        { path: '/leaderboard', label: '🏆 Leaderboard', icon: Award },
        { path: '/grabba/risk-radar', label: '⚠️ Risk Radar', icon: AlertTriangle },
        { path: '/opportunity-radar', label: '🎯 Opportunity Radar', icon: Target },
        { path: '/revenue-brain', label: '🧠 Revenue Brain', icon: Brain },
      ],
    },
    {
      id: 'floor-9',
      name: '🤖 Floor 9 — AI Operations',
      items: [
        // T3 K2: Agent Center merged into Floor 9 hub.
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
      { path: '/gasmask/driver', label: '🚗 Driver App', icon: Truck },
      { path: '/brand/gasmask', label: '🔴 GasMask OS', icon: Flame },
      { path: '/brand/hotmama', label: '🟠 HotMama OS', icon: Heart },
      { path: '/brand/hotscolati', label: '🟡 Hotscolatti OS', icon: Sparkles },
      { path: '/brand/grabba-r-us', label: '🟢 Grabba R Us OS', icon: ShoppingBag },
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
      { path: '/os/unforgettable/pricing-intelligence', label: '💰 Floor 8 — Pricing Intelligence', icon: DollarSign },
      { path: '/os/unforgettable/event-spaces', label: '🏛️ Floor 9 — Event Spaces', icon: Building },
      { path: '/os/unforgettable/virtual-tours', label: '📸 Floor 10 — Virtual Tours', icon: Camera },
      { path: '/os/unforgettable/coverage-map', label: '🗺️ Coverage Map', icon: Map },
    ],
  },
  uftPlatform: {
    id: 'uft-platform',
    name: '🎊 UFT Platform Command',
    items: [
      { path: '/uft/dashboard', label: '🎯 Command Center', icon: PartyPopper },
      { path: '/uft/revenue', label: '💰 Revenue', icon: DollarSign },
      { path: '/uft/vendors', label: '🏪 Vendors', icon: Store },
      { path: '/uft/ambassadors', label: '🎖️ Ambassadors', icon: Award },
      { path: '/uft/verification', label: '🛡️ Verification Queue', icon: ShieldCheck },
      { path: '/uft/payouts', label: '💵 Payout Requests', icon: Banknote },
      { path: '/uft/suppliers', label: '📦 Suppliers', icon: Truck },
      { path: '/uft/recruiting', label: '📣 Recruiting', icon: Megaphone },
      { path: '/uft/ambassador-recruiting', label: '🎯 Ambassador Recruiting', icon: UserPlus },
      { path: '/uft/launch', label: '🚀 Launch Checklist', icon: Target },
    ],
  },
  dynastyBusiness: {
    id: 'dynasty-business',
    name: '🌐 Dynasty Business Units',
    items: [
      { path: '/os/iclean', label: '🧹 iClean WeClean OS', icon: Home },
      { path: '/os/icw', label: '🧼 ICW Command', icon: Home },
      { path: '/os/icw/workers', label: '👷 ICW Worker Roster', icon: Users },
      { path: '/os/icw/my-jobs', label: '📋 My ICW Jobs', icon: Home },
      { path: '/os/icw/map', label: '🗺️ IClean Hub Map', icon: Home },
      { path: '/os/icw/crm', label: '📇 ICW CRM', icon: Users },
      { path: '/os/icw/candidates', label: '🧾 ICW Applicants', icon: Users },
      { path: '/os/playboxxx', label: '🎮 PlayBoxxx OS', icon: Sparkles },
      { path: '/os/special-needs', label: '♿ Special Needs App OS', icon: Accessibility },
    ],
  },
  playboxxHub: {
    id: 'playboxx-hub',
    name: '🎭 Playboxx OS Hub',
    items: [
      { path: '/os/playboxxx/recruiting', label: '📊 Recruiting Dashboard', icon: Sparkles },
      { path: '/os/playboxxx/recruiting/staff-sourcing', label: '👷 Staff Sourcing', icon: Sparkles },
      { path: '/os/playboxxx/recruiting/creator-sourcing', label: '✨ Creator / Model Sourcing', icon: Sparkles },
      { path: '/os/playboxxx/recruiting/search-assignments', label: '🗂 Search Assignments', icon: Sparkles },
      { path: '/os/playboxxx/recruiting/candidates', label: '🧑‍🤝‍🧑 Candidates', icon: Sparkles },
      { path: '/os/playboxxx/recruiting/automation-runs', label: '⚙️ Automation Runs', icon: Sparkles },
      { path: '/os/playboxxx/recruiting/audit-logs', label: '📝 Audit / Logs', icon: Sparkles },
      { path: '/os/playboxxx/recruiting/settings', label: '🔧 Settings', icon: Sparkles },
    ],
  },
  topTierExperience: {
    id: 'toptier-experience',
    name: '🚗 TopTier Experience',
    items: [
      { path: '/os/toptier', label: '🏠 Overview', icon: LayoutDashboard },
      { path: '/os/toptier/bookings', label: '📋 Bookings', icon: BookOpen },
      { path: '/os/toptier/dispatch', label: '🚕 Dispatch Center', icon: Navigation },
      { path: '/os/toptier/fleet', label: '🚗 Fleet', icon: Car },
      { path: '/os/toptier/drivers', label: '👨‍✈️ Drivers', icon: User },
      { path: '/os/toptier/partners', label: '🤝 Partners', icon: Handshake },
      { path: '/os/toptier/pricing', label: '💰 Pricing Engine', icon: DollarSign },
      { path: '/os/toptier/payments', label: '💳 Payments', icon: CreditCard },
      { path: '/os/toptier/revenue', label: '📈 Revenue', icon: TrendingUp },
      { path: '/os/toptier/reviews', label: '⭐ Reviews', icon: Star },
      { path: '/os/toptier/corporate', label: '🏢 Corporate', icon: Building2 },
      { path: '/os/toptier/affiliates', label: '🔗 Affiliates', icon: Link2 },
      { path: '/os/toptier/ambassadors', label: '🌟 Ambassadors', icon: Users },
      { path: '/os/toptier/packages', label: '📦 Packages', icon: Package },
      { path: '/os/toptier/ai-brain', label: '🧠 AI Brain', icon: Brain },
      { path: '/os/toptier/settings', label: '⚙️ Settings', icon: Settings },
    ],
  },
  topTierCRM: {
    id: 'toptier-crm',
    name: '🚗 TopTier CRM',
    items: [
      { path: '/crm/toptier-experience/customers', label: '👤 Customers', icon: Users },
      { path: '/crm/toptier-experience/bookings', label: '📅 CRM Bookings', icon: Calendar },
      { path: '/crm/toptier-experience/deals', label: '🤝 Deals', icon: Handshake },
      { path: '/crm/toptier-experience/partners', label: '🏢 Partner CRM', icon: Building },
      { path: '/crm/toptier-experience/analytics/revenue', label: '📊 Analytics', icon: BarChart },
      { path: '/crm/toptier-experience/supply-map', label: '🗺️ Supply Coverage Map', icon: MapPin },
      { path: '/crm/toptier-experience/interactions', label: '💬 Interactions', icon: MessageSquare },
      { path: '/crm/toptier-experience/kpis/manage', label: '🎯 KPIs', icon: Target },
    ],
  },
  topTierPenthouse: {
    id: 'toptier-penthouse',
    name: '🏰 TopTier Penthouse',
    items: [
      { path: '/os/toptier/penthouse', label: '🏰 Penthouse Hub', icon: Crown },
      { path: '/os/toptier/penthouse/drivers', label: '🚗 Driver Admin', icon: Car },
      { path: '/os/toptier/penthouse/hotels', label: '🏨 Hotels', icon: Hotel },
      { path: '/os/toptier/penthouse/nightlife', label: '🌙 Nightlife', icon: Moon },
      { path: '/os/toptier/penthouse/security', label: '🔒 Security', icon: Shield },
      { path: '/os/toptier/penthouse/yacht-ops', label: '⛵ Yacht Ops', icon: Anchor },
      { path: '/os/toptier/penthouse/exotic-car-ops', label: '🏎️ Exotic Cars', icon: Car },
      { path: '/os/toptier/penthouse/private-jet-dispatch', label: '✈️ Private Jets', icon: Plane },
      { path: '/os/toptier/penthouse/corporate-events', label: '🎪 Corporate Events', icon: Calendar },
      { path: '/os/toptier/penthouse/finance', label: '💰 Finance Admin', icon: DollarSign },
      { path: '/os/toptier/penthouse/analytics', label: '📊 Penthouse Analytics', icon: BarChart },
      { path: '/os/toptier/penthouse/audit', label: '🔍 Audit Log', icon: FileText },
    ],
  },
  dynastyFundingHub: {
    id: 'dynasty-funding-hub',
    name: '🏦 Dynasty Funding Hub',
    items: [
      { path: '/funding-machine', label: '🏦 Penthouse — Command Center', icon: Landmark },
      { path: '/funding-machine/briefing', label: '🌅 Floor 1 — Morning Briefing', icon: Sunrise },
      { path: '/funding-machine/clients', label: '👥 Clients', icon: UserPlus },
      { path: '/funding-machine/funding-invites', label: '✉️ Funding Invites', icon: UserPlus },
      { path: '/funding-machine/intake', label: '➕ Floor 2 — Client Intake', icon: UserPlus },
      { path: '/funding-machine/credit-repair', label: '🛡️ Floor 3 — Credit Repair', icon: Shield },
      { path: '/funding-machine/business-builder', label: '🏗️ Floor 4 — Business Builder', icon: Building2 },
      { path: '/funding-machine/bureau-intel', label: '💳 Floor 5 — Bureau Intelligence', icon: CreditCard },
      { path: '/funding-machine/funding-matrix', label: '🏛️ Floor 6 — Funding Matrix', icon: Landmark },
      { path: '/funding-machine/applications', label: '📋 Floor 7 — Applications', icon: ClipboardList },
      { path: '/funding-machine/automation', label: '🤖 Application Automation', icon: ClipboardList },
      { path: '/funding-machine/velocity', label: '📈 Floor 8 — Velocity Calculator', icon: TrendingUp },
      { path: '/funding-machine/tradeline-vault', label: '📄 Floor 9 — Tradeline Vault', icon: FileText },
      { path: '/funding-machine/tasks', label: '✅ Floor 10 — Task Cards', icon: CheckSquare },
      { path: '/funding-machine/revenue', label: '💰 Revenue Dashboard', icon: TrendingUp },
      { path: '/funding-machine/settings', label: '⚙️ Settings', icon: Settings },
    ],
  },
  ubenHq: {
    id: 'uben-hq',
    name: '💛 UBEN HQ',
    items: [
      { path: '/os/uben', label: '💛 UBEN Dashboard', icon: Heart },
      { path: '/os/uben/grants', label: '🏆 Grant Tracker', icon: Trophy },
      { path: '/os/uben/applications', label: '📋 Applications', icon: ClipboardList },
      { path: '/os/uben/programs', label: '💛 Programs', icon: Heart },
      { path: '/os/uben/impact', label: '📊 Impact Reports', icon: BarChart3 },
      { path: '/os/uben/donors', label: '🎁 Donors', icon: Gift },
      { path: '/os/uben/compliance', label: '⚖️ Compliance', icon: Scale },
      { path: '/os/uben/documents', label: '📁 Documents', icon: FolderOpen },
      { path: '/os/uben/commissions', label: '💰 Commissions', icon: DollarSign },
      
      { path: '/os/brand-acquisition', label: '👑 Brand Acquisition', icon: Crown },
      { path: '/os/dynasty-sales', label: '🔥 Sales Domination', icon: Target },
    ],
  },
  dynastyEarn: {
    id: 'dynasty-earn',
    name: '💰 Dynasty Earn',
    items: [
      { path: '/os/dynasty-earn', label: '💰 Earn Dashboard', icon: DollarSign },
      { path: '/os/dynasty-earn/earners', label: '👥 Earners', icon: Users },
      { path: '/os/dynasty-earn/brands', label: '🏢 Brands', icon: Building2 },
      { path: '/os/dynasty-earn/programs', label: '📋 Programs', icon: ClipboardList },
      { path: '/os/dynasty-earn/commissions', label: '🧾 Commissions', icon: Receipt },
      { path: '/os/dynasty-earn/campaigns', label: '📢 Campaigns', icon: Megaphone },
      { path: '/os/dynasty-earn/payouts', label: '💳 Payouts', icon: CreditCard },
      { path: '/os/dynasty-earn/settings', label: '⚙️ Settings', icon: Settings2 },
    ],
  },
  clipperNation: {
    id: 'clipper-nation',
    name: '🎬 Clipper Nation',
    items: [
      { path: '/os/clipper-nation', label: '🎬 Dashboard', icon: Film },
      { path: '/os/clipper-nation/applications', label: '📝 Applications', icon: ClipboardList },
      { path: '/os/clipper-nation/clippers', label: '👥 Clippers', icon: Users },
      { path: '/os/clipper-nation/campaigns', label: '📢 Campaigns', icon: Megaphone },
      { path: '/os/clipper-nation/submissions', label: '📹 Submissions', icon: Video },
      { path: '/os/clipper-nation/analytics', label: '📊 Analytics', icon: BarChart3 },
      { path: '/os/clipper-nation/conversions', label: '💰 Conversions', icon: DollarSign },
      { path: '/os/clipper-nation/payouts', label: '💳 Payouts', icon: CreditCard },
      { path: '/os/clipper-nation/settings', label: '⚙️ Settings', icon: Settings2 },
    ],
  },
  financeAcquisition: {
    id: 'finance-acquisition',
    name: '💰 Finance & Acquisition',
    items: [
      { path: '/os/wealth-engine', label: '📈 Wealth Engine OS', icon: TrendingUp },
    ],
  },
  grantOS: {
    id: 'grant-os',
    name: '🏆 Grant OS',
    items: [
      { path: '/os/grants/dashboard', label: '📊 Dashboard', icon: LayoutDashboard },
      { path: '/os/grants/opportunities', label: '🗂️ Opportunities', icon: Database },
      { path: '/os/grants/applications', label: '📝 Applications', icon: FileText },
      { path: '/os/grants/funder-crm', label: '🤝 Funder CRM', icon: Handshake },
      { path: '/os/grants/businesses', label: '🏢 Business Profiles', icon: Building2 },
      { path: '/os/grants/eligibility', label: '🧮 Eligibility Matrix', icon: Grid3x3 },
    ],
  },
  communicationSystems: {
    id: 'communication-systems',
    name: '📡 Communication Systems',
    // T3 K3: entire /comm-systems subtree killed — Floor 2 Communication Hub is canonical.
    items: [],
  },
  dynastyDirect: {
    id: 'dynasty-direct',
    name: '🚀 Dynasty Direct Hub',
    items: [
      { path: '/dynasty-direct', label: '🏠 DD Home', icon: LayoutDashboard },
      { path: '/dynasty-direct/readiness', label: '🚦 Launch Readiness', icon: LayoutDashboard },
      { path: '/dynasty-direct/catalog', label: '📦 Catalog', icon: Package },
      { path: '/dynasty-direct/products', label: '📦 Products', icon: Package },
      { path: '/dynasty-direct/pricing', label: '💰 Pricing', icon: DollarSign },
      { path: '/dynasty-direct/catalog/onboard', label: '✨ Onboard Product', icon: Sparkles },
      { path: '/dynasty-direct/catalog/review', label: '🛡️ Review Queue', icon: Sparkles },
      { path: '/dynasty-direct/content-library', label: '🎬 Content Library', icon: Sparkles },
      { path: '/dynasty-direct/store-storefront', label: '🏪 Store Storefront', icon: Store },
      { path: '/dynasty-direct/d2c-storefront', label: '🛒 D2C Storefront', icon: ShoppingCart },
      { path: '/dynasty-direct/orders', label: '📋 Orders', icon: ClipboardList },
      { path: '/dynasty-direct/returns', label: '↩️ Returns / RMA', icon: ClipboardList },
      { path: '/dynasty-direct/inr-claims', label: '📦 Not-Received Claims', icon: ClipboardList },
      { path: '/dynasty-direct/support', label: '💬 Support Tickets', icon: MessageCircle },
      { path: '/dynasty-direct/delivery', label: '🚗 Local Delivery', icon: Truck },
      { path: '/dynasty-direct/stores', label: '🏪 Store Accounts', icon: Store },
      { path: '/dynasty-direct/fulfillment', label: '🚚 Fulfillment', icon: Truck },
      { path: '/dynasty-direct/shipping', label: '🚚 Shipping', icon: Truck },
      { path: '/dynasty-direct/splits', label: '💵 Splits & Reserves', icon: DollarSign },
      { path: '/dynasty-direct/commission-rates', label: '％ Commission Rates', icon: DollarSign },
      { path: '/dynasty-direct/suppliers/network', label: '🗺️ Supplier Network', icon: Map },
      { path: '/dynasty-direct/suppliers/portal', label: '👥 Supplier Onboarding', icon: Users },
      { path: '/dynasty-direct/suppliers/instructions', label: '📦 Supplier Instructions', icon: FileText },
      { path: '/dynasty-direct/inventory', label: '📦 Master Inventory', icon: Boxes },
      { path: '/dynasty-direct/suppliers/inventory', label: '📊 Supplier Products', icon: Boxes },
      { path: '/dynasty-direct/suppliers/performance', label: '📈 Supplier Performance', icon: TrendingUp },
      { path: '/dynasty-direct/purchase-orders', label: '📄 Purchase Orders', icon: FileText },
      { path: '/dynasty-direct/grabba-bridge', label: '⚡ Grabba Bridge', icon: Zap },
      { path: '/dynasty-direct/analytics', label: '📈 Analytics', icon: BarChart3 },
      { path: '/dynasty-direct/qa', label: '❓ Q&A', icon: MessageCircle },
      { path: '/dynasty-direct/reviews', label: '⭐ Reviews', icon: Star },
      { path: '/dynasty-direct/flash-sales', label: '⚡ Flash Sales', icon: Zap },
      { path: '/dynasty-direct/invites', label: '✉️ Invites & Access', icon: Send },
      { path: '/dynasty-direct/store-applications', label: '🏪 Apply-as-Store Queue', icon: Send },
      { path: '/dynasty-direct/partners', label: '🤝 Partner Campaigns', icon: Handshake },
      { path: '/dynasty-direct/wholesaler-map', label: '🗺️ Wholesaler Map', icon: Map },
      { path: '/dynasty-direct/wholesaler-crm', label: '📊 Wholesaler CRM', icon: Users },
      { path: '/dynasty-direct/settings', label: '⚙️ Settings', icon: Settings },
      { path: '/admin/dynasty-direct-ops', label: '🛠️ Ops Console', icon: Settings },
    ],
  },
  highway: {
    id: 'highway',
    name: '🛣️ Highway',
    items: [
      { path: '/highway/map', label: '🗺️ Dispensary Map', icon: Map },
      { path: '/highway/crm', label: '📊 Highway CRM', icon: Users },
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
      { path: '/pod/generate', label: 'POD Generator', icon: Sparkles },
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
      { path: '/delivery/pool', label: '📡 Live Delivery Pool', icon: Package },
      { path: '/delivery/orders', label: '📦 Orders & Deliveries', icon: Package },
      { path: '/gasmask/route-engine', label: '🗺 Route Engine', icon: Route },
      { path: '/activity', label: '🧾 Account Activity', icon: Activity },
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
      // T3 K5: CRM Backup page killed; backups now live with Floor Exports.
      // T3 K4: /communications-center ghosts removed; Floor 2 hub is canonical.
    ],
  },
  aiSystems: {
    id: 'ai-systems',
    name: '🧠 AI & Automation',
    items: [
      { path: '/ai/workforce', label: '🤖 AI Workforce Automation OS', icon: Bot },
      { path: '/system-operations/ai-ceo-control-room', label: 'AI CEO Control Room', icon: Crown },
      { path: '/dynasty-automations', label: 'Dynasty Automations', icon: Zap },
      { path: '/settings/automation', label: 'Automation Settings', icon: Settings },
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
      // T3 K6: HR Payroll consolidated into Floor 5 Payroll Manager.
      { path: '/my-hr', label: 'My HR', icon: User },
      { path: '/va-performance', label: '📊 VA OS', icon: Activity },
      { path: '/va-ranking', label: 'VA Ranking', icon: Award },
      { path: '/va-task-center', label: 'VA Task Center', icon: ClipboardList },
      { path: '/portal/va', label: 'VA Portal', icon: User },
      { path: '/portal/ambassador', label: '🎖️ Ambassador OS', icon: Award },
      { path: '/admin/feedback', label: '📣 Feedback Inbox', icon: MessageSquareWarning },
      { path: '/admin/field-day-notes', label: '📋 Field Day Notes', icon: ClipboardList },
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
      { path: '/brandaro/demo-engine', label: 'Demo Engine', icon: Zap },
      { path: '/brandaro/builder', label: 'Website Builder', icon: Wrench },
      { path: '/brandaro/closer-ai', label: 'Closer AI', icon: Brain },
      { path: '/brandaro/revenue', label: 'Revenue Analytics', icon: TrendingUp },
      { path: '/brandaro/competitors', label: 'Competitor Takeover', icon: Swords },
      { path: '/brandaro/proposals', label: 'Proposal Builder', icon: FileText },
      { path: '/brandaro/campaigns', label: 'Campaign Manager', icon: Target },
      { path: '/brandaro/clients', label: 'Client Portal', icon: Users },
      { path: '/brandaro/inbox', label: 'Inbox', icon: Mail },
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
  voiceOps: {
    id: 'voice-ops',
    name: '🎙️ Voice Ops',
    items: [
      { path: '/voice-ops', label: '🎙️ Voice Ops Dashboard', icon: Headphones },
      { path: '/voice-ops/numbers', label: '📞 Phone Numbers', icon: Phone },
      { path: '/voice-ops/agents', label: '🤖 Agents', icon: Bot },
      { path: '/voice-ops/secrets', label: '🔑 Secrets', icon: Key },
      { path: '/voice-ops/outbound', label: '📤 Outbound', icon: Send },
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
      { path: '/surplus-funds/attorney-crm', label: '📇 Attorney CRM', icon: Users },
      { path: '/surplus-funds/coverage-map', label: '🗺️ Attorney Coverage Map', icon: Map },
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
  realEstateHq: {
    id: 'real-estate-hq',
    name: '🏠 Real Estate HQ',
    items: [
      { path: '/realestate', label: '🏠 Real Estate HQ', icon: Building },
      { path: '/realestate/leads', label: '🎯 Lead Intelligence', icon: Target },
      { path: '/realestate/pipeline', label: '📋 Acquisition Pipeline', icon: TrendingUp },
      { path: '/realestate/investors', label: '🏦 Investor Marketplace', icon: Users },
      { path: '/realestate/closings', label: '💰 Deal Closings & Payments', icon: CreditCard },
      { path: '/realestate/expansion', label: '🗺️ Expansion Engine', icon: MapPin },
      { path: '/realestate/subscriptions', label: '💳 Investor Subscriptions', icon: DollarSign },
      { path: '/realestate/partners', label: '🤝 Closing Partners', icon: Briefcase },
      { path: '/realestate/pl', label: '📊 P&L', icon: Calculator },
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
      { path: '/solar/installer-map', label: '🗺️ Installer Map', icon: MapPin },
      { path: '/solar/crm', label: '📇 CRM', icon: Users },
    ],
  },
  goddessInYou: {
    id: 'goddess-in-you',
    name: '💜 Goddess In You Hub',
    items: [
      { path: '/goddess-in-you/leads', label: '🎯 Leads Queue', icon: Target },
    ],
  },
  servicesIo: {
    id: 'services-io',
    name: '🛠️ Services.io Hub',
    items: [
      { path: '/services-io/leads', label: '🎯 Leads Queue', icon: Target },
    ],
  },
  fieldVerification: {
    id: 'field-verification',
    name: '🔍 Field Verification',
    items: [
      { path: '/field-verification/map', label: '🗺️ Live Map', icon: MapPin },
      { path: '/field-verification/photos', label: '📸 Photo Feed', icon: Camera },
      { path: '/field-verification/crew', label: '👥 Per-Crew', icon: Users },
      { path: '/field-verification/stores', label: '🏪 Per-Store', icon: Store },
      { path: '/field-verification/coverage', label: '🧭 Coverage', icon: Map },
      { path: '/field-verification/manage', label: '⚙️ Manage Crew & Zones', icon: Settings },
    ],
  },
  globalDashboard: {
    id: 'global-dashboard',
    name: '🌍 Global Dynasty Dashboard',
    items: [
      { path: '/', label: 'Main Dashboard', icon: LayoutDashboard },
      { path: '/analytics', label: 'Analytics', icon: BarChart3 },
      { path: '/executive-reports', label: 'Executive Reports', icon: FileText },
      { path: '/analytics/revenue-brain', label: 'Revenue Brain', icon: Brain },
      // T1 K8: Opportunity Radar killed (theatre); /opportunities is canonical
      { path: '/missions-hq', label: 'Missions HQ', icon: Zap },
      { path: '/gasmask/leaderboard', label: 'Leaderboard', icon: Trophy },
      { path: '/team', label: 'Team', icon: Users },
      { path: '/companies', label: 'Companies', icon: Building2 },
      { path: '/gasmask/territories', label: 'Territories', icon: Map },
      { path: '/expansion', label: 'Expansion', icon: TrendingUp },
    ],
  },
  portals: [
    { path: '/portal/driver', label: '🚗 Driver Portal', icon: Car },
    { path: '/portal/biker', label: '🚴 Biker Portal', icon: Bike },
    { path: '/portal/ambassador', label: '🎖️ Ambassador Portal', icon: Award },
    { path: '/portal/store', label: '🏪 Store Portal', icon: Store },
    { path: '/portal/wholesaler', label: '📦 Wholesaler Portal', icon: Package },
    { path: '/portal/wholesaler/order-grabba', label: '🍃 Order Grabba', icon: Zap },
    { path: '/portals/production', label: '🏭 Manufacturing OS', icon: Factory },
    { path: '/portal/production', label: '👷 Worker View (Read-Only)', icon: Factory },
    { path: '/portal/verification-crew', label: '📍 Field Verification Crew', icon: MapPin },
    { path: '/portal/va', label: '💼 VA Portal', icon: Briefcase },
    { path: '/portal/customer', label: '👤 Customer Portal', icon: User },
    { path: '/portal/national-wholesale', label: '🌎 National Wholesale Portal', icon: Globe },
    { path: '/portal/marketplace-admin', label: '⚙️ Marketplace Admin Portal', icon: Settings },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// TOP-LEVEL NAVIGATION CONSOLIDATION
// Nine work-type groups. Every existing section is nested inside one of them —
// nothing is deleted, no route is removed.
// ═══════════════════════════════════════════════════════════════════════════════

type NavSection = { id: string; name: string; items: any[]; adminOnly?: boolean };

const floorOf = (id: string): NavSection =>
  (DYNASTY_NAVIGATION.grabbaSkyscraper as NavSection[]).find(f => f.id === id) as NavSection;

const TERRITORY_SECTION: NavSection = {
  id: 'territory-intelligence',
  name: '🌍 Territory Intelligence',
  items: [
    { path: '/territory', label: 'Territory Control', icon: Map },
    { path: '/territory/coverage', label: 'Neighborhood Coverage', icon: MapPin },
    { path: '/territory/tube-intelligence', label: 'Tube Territory', icon: MapPin },
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
  ],
};

const RECRUITING_SECTION: NavSection = {
  id: 'recruiting-intake',
  name: '🧑‍💼 Recruiting Intake',
  items: [
    { path: '/os/recruiting/applicants', label: 'Recruiting Applicants', icon: ClipboardList },
    { path: '/admin/recruitment', label: 'Recruitment Campaigns', icon: Megaphone, adminOnly: true },
    { path: '/security/ambassador-requests', label: 'Ambassador Requests', icon: UserPlus },
  ],
};

const PORTALS_SECTION: NavSection = {
  id: 'role-portals',
  name: '🚪 Role Portals',
  items: DYNASTY_NAVIGATION.portals,
};

const NAV_GROUPS: Array<{ id: string; name: string; icon: any; adminOnly?: boolean; sections: NavSection[] }> = [
  {
    id: 'g-command',
    name: 'Command',
    icon: Crown,
    sections: [
      DYNASTY_NAVIGATION.globalDashboard as NavSection,
      DYNASTY_NAVIGATION.penthouse as NavSection,
      floorOf('grabba-command'),
      DYNASTY_NAVIGATION.exportsFloor as NavSection,
    ],
  },
  {
    id: 'g-operations',
    name: 'Operations',
    icon: Store,
    sections: [
      floorOf('floor-1'),
      TERRITORY_SECTION,
      floorOf('floor-3'),
      floorOf('floor-4'),
      floorOf('floor-6'),
      DYNASTY_NAVIGATION.logistics as NavSection,
      DYNASTY_NAVIGATION.highway as NavSection,
      DYNASTY_NAVIGATION.fieldVerification as NavSection,
    ],
  },
  {
    id: 'g-leads-sales',
    name: 'Leads & Sales',
    icon: TrendingUp,
    sections: [
      floorOf('floor-2'),
      DYNASTY_NAVIGATION.communicationSystems as NavSection,
      DYNASTY_NAVIGATION.dynastyConnect as NavSection,
      DYNASTY_NAVIGATION.voiceOps as NavSection,
      DYNASTY_NAVIGATION.brandaroHub as NavSection,
      DYNASTY_NAVIGATION.crmCustomerService as NavSection,
    ],
  },
  {
    id: 'g-people',
    name: 'Recruiting & People',
    icon: Users,
    sections: [
      RECRUITING_SECTION,
      floorOf('floor-8'),
      DYNASTY_NAVIGATION.systemsHR as NavSection,
      PORTALS_SECTION,
    ],
  },
  {
    id: 'g-businesses',
    name: 'Businesses',
    icon: Building2,
    sections: [
      DYNASTY_NAVIGATION.grabbaBrands as NavSection,
      DYNASTY_NAVIGATION.dynastyDirect as NavSection,
      DYNASTY_NAVIGATION.unforgettableHub as NavSection,
      DYNASTY_NAVIGATION.uftPlatform as NavSection,
      DYNASTY_NAVIGATION.dynastyBusiness as NavSection,
      DYNASTY_NAVIGATION.playboxxHub as NavSection,
      DYNASTY_NAVIGATION.topTierExperience as NavSection,
      DYNASTY_NAVIGATION.topTierCRM as NavSection,
      DYNASTY_NAVIGATION.topTierPenthouse as NavSection,
      DYNASTY_NAVIGATION.ubenHq as NavSection,
      DYNASTY_NAVIGATION.dynastyEarn as NavSection,
      DYNASTY_NAVIGATION.clipperNation as NavSection,
      DYNASTY_NAVIGATION.realEstateOs as NavSection,
      DYNASTY_NAVIGATION.realEstateHq as NavSection,
      DYNASTY_NAVIGATION.solarOs as NavSection,
      DYNASTY_NAVIGATION.goddessInYou as NavSection,
      DYNASTY_NAVIGATION.servicesIo as NavSection,
    ],
  },
  {
    id: 'g-intelligence',
    name: 'Intelligence & Automation',
    icon: Brain,
    sections: [
      floorOf('floor-9'),
      DYNASTY_NAVIGATION.aiSystems as NavSection,
      DYNASTY_NAVIGATION.sboAiEngine as NavSection,
    ],
  },
  {
    id: 'g-finance',
    name: 'Finance & Commerce',
    icon: DollarSign,
    sections: [
      floorOf('floor-5'),
      floorOf('floor-7'),
      DYNASTY_NAVIGATION.marketplaces as NavSection,
      DYNASTY_NAVIGATION.financeAcquisition as NavSection,
      DYNASTY_NAVIGATION.dynastyFundingHub as NavSection,
      DYNASTY_NAVIGATION.surplusFundsOs as NavSection,
      DYNASTY_NAVIGATION.grantOS as NavSection,
    ],
  },
  {
    id: 'g-admin',
    name: 'Admin & System',
    icon: Shield,
    adminOnly: true,
    sections: [
      DYNASTY_NAVIGATION.securityGovernance as NavSection,
      DYNASTY_NAVIGATION.dynastyPartners as NavSection,
    ],
  },
];


const Layout = ({ children }: LayoutProps) => {
  const { signOut } = useAuth();
  const { role, isAdmin } = useUserRole();
  const { currentBusiness, loading: businessLoading } = useBusiness();
  const location = useLocation();
  const [unreadReportsCount, setUnreadReportsCount] = useState(0);
  const [brandaroPendingCount, setBrandaroPendingCount] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sendMessageOpen, setSendMessageOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);


  // ⚔️ BRANDARO PERMANENT VERIFICATION — Self-heal if missing
  const verifiedNav = ensureBrandaroInNav(DYNASTY_NAVIGATION);
  const brandaroStatus = useBrandaroVerify(verifiedNav);
  
  // Sections are collapsed by default. The section holding the current route
  // opens automatically; anything the operator opens/closes by hand is
  // remembered for the session (and across reloads). No section is removed.
  const SECTION_STATE_KEY = 'nexus.sidebar.sections';
  const [sectionOverrides, setSectionOverrides] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(SECTION_STATE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });

  const currentPath = location.pathname;

  // Close the mobile nav sheet whenever the route changes
  useEffect(() => { setMobileNavOpen(false); }, [currentPath]);
  const isFloor9Route = currentPath.startsWith('/grabba/floor9') || currentPath.startsWith('/gasmask/note-cleaner');

  const isPathActive = (path: string) => {
    if (path === '/') return currentPath === '/';
    return currentPath === path || currentPath.startsWith(path + '/');
  };

  const toggleSection = (id: string, currentlyOpen: boolean) => {
    setSectionOverrides(prev => {
      const next = { ...prev, [id]: !currentlyOpen };
      try { localStorage.setItem(SECTION_STATE_KEY, JSON.stringify(next)); } catch { /* storage disabled */ }
      return next;
    });
  };

  const openSections = Object.keys(sectionOverrides).filter(id => sectionOverrides[id]);

  // ── Top-level group accordion: one open at a time, current route's group wins
  const GROUP_STATE_KEY = 'nexus.sidebar.group';
  const RAIL_STATE_KEY = 'nexus.sidebar.rail';
  const activeGroupId =
    NAV_GROUPS.find(g =>
      g.sections.some(s =>
        s.items.some((i: any) =>
          i.path === '/' ? currentPath === '/' : currentPath === i.path || currentPath.startsWith(i.path + '/'),
        ),
      ),
    )?.id ?? null;

  const [openGroup, setOpenGroup] = useState<string | null>(() => {
    try { return localStorage.getItem(GROUP_STATE_KEY); } catch { return null; }
  });
  const [railMode, setRailMode] = useState<boolean>(() => {
    try { return localStorage.getItem(RAIL_STATE_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    if (activeGroupId) setOpenGroup(activeGroupId);
  }, [activeGroupId]);

  const selectGroup = (id: string) => {
    setOpenGroup(prev => {
      const next = prev === id ? null : id;
      try { next ? localStorage.setItem(GROUP_STATE_KEY, next) : localStorage.removeItem(GROUP_STATE_KEY); } catch { /* storage disabled */ }
      return next;
    });
  };

  const toggleRail = () => {
    setRailMode(prev => {
      try { localStorage.setItem(RAIL_STATE_KEY, prev ? '0' : '1'); } catch { /* storage disabled */ }
      return !prev;
    });
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
  }, [isFloor9Route, sectionOverrides]);

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

  // Brandaro Inbox — pending message live count (30s refresh)
  useEffect(() => {
    let cancelled = false;
    const fetchPending = async () => {
      const { count } = await (supabase as any)
        .from('brandaro_pending_messages')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (!cancelled) setBrandaroPendingCount(count || 0);
    };
    fetchPending();
    const interval = window.setInterval(fetchPending, 30_000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, []);

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

  const renderSection = (id: string, name: string, allItems: Array<{ path: string; label: string; icon: any; testId?: string; badge?: number; highlight?: boolean; gold?: boolean; adminOnly?: boolean }>) => {
    const navPrivileged = ['owner', 'admin', 'ceo'].includes(role || '');
    const items = allItems.filter(i => !i.adminOnly || navPrivileged);
    if (items.length === 0) return null;
    const hasActiveItem = items.some(i => isPathActive(i.path));
    const isOpen = sectionOverrides[id] ?? hasActiveItem;
    const sectionWired = sectionHasDispatch(items.map(i => i.path));

    return (
      <div key={id} className="mb-1">
        <button
          onClick={() => toggleSection(id, isOpen)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-foreground/80 hover:bg-muted/50 rounded-md transition-colors"
        >
          <span className="flex-1 text-left truncate text-xs">{name}</span>
          {sectionWired && (
            <span
              title={DISPATCH_TOOLTIP}
              aria-label={DISPATCH_TOOLTIP}
              className="inline-block h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]"
            />
          )}
          {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>

        {isOpen && (
          <div className="ml-4 mt-0.5 space-y-0.5">
            {items.map(item => {
              const wired = isDispatchWired(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  data-testid={item.testId}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1 text-xs rounded-md transition-colors",
                    item.highlight
                      ? "bg-destructive/15 text-destructive font-semibold ring-1 ring-destructive/50 hover:bg-destructive/25"
                      : item.gold
                        ? "text-gold font-semibold hover:bg-gold/10"
                        : isPathActive(item.path)
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <item.icon className="h-3 w-3 shrink-0" />
                  <span className="truncate flex-1">{item.label}</span>
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[16px] px-1 rounded-full bg-orange-500/90 text-[10px] font-semibold text-white shrink-0">
                      {item.badge > 999 ? '999+' : item.badge}
                    </span>
                  )}
                  {wired && (
                    <span
                      title={DISPATCH_TOOLTIP}
                      aria-label={DISPATCH_TOOLTIP}
                      className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.7)] shrink-0"
                    />
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const NavigationContent = () => {
    const isPrivileged = ['owner', 'admin', 'ceo'].includes(role || '');
    const withBadges = (section: NavSection) =>
      section.id === 'brandaro-hub'
        ? { ...section, items: section.items.map((i: any) => (i.path === '/brandaro/inbox' ? { ...i, badge: brandaroPendingCount } : i)) }
        : section;

    return (
      <div className="space-y-1">
        {/* 🔴 PINNED — People & Access (owner/admin) */}
        {isPrivileged && (
          <Link
            to="/admin/field-assignments"
            data-testid="pinned-people-access"
            className="flex items-center gap-2 px-2 py-2 text-xs rounded-md font-semibold bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors"
          >
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate flex-1">People &amp; Access</span>
          </Link>
        )}

        <div id="__FLOOR_0_ASSERT__" data-floor="0" data-section="territory-intelligence" className="hidden" />

        {NAV_GROUPS.filter(g => !g.adminOnly || isPrivileged).map(group => {
          const isOpen = openGroup === group.id;
          const GroupIcon = group.icon;
          return (
            <div key={group.id}>
              <button
                onClick={() => selectGroup(group.id)}
                data-testid={`nav-group-${group.id}`}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-2 rounded-md text-xs font-semibold uppercase tracking-wide transition-colors',
                  isOpen ? 'bg-muted/60 text-foreground' : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                )}
              >
                <GroupIcon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left truncate">{group.name}</span>
                {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>

              {isOpen && (
                <div className="ml-2 mt-0.5 border-l border-border/40 pl-1.5">
                  {group.sections
                    .filter(Boolean)
                    .map(section => renderSection(section.id, section.name, withBadges(section).items))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };


  return (
    <div className="min-h-screen bg-background safe-area-top safe-area-x">
      {/* 🔐 Dynasty OS Auto-Saver / Reset strip (admin-only) */}
      <SystemCheckpointBar />
      
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/95 backdrop-blur-sm supports-[backdrop-filter]:bg-card/90 safe-area-top">
        <div className="flex h-14 items-center px-3 sm:px-4 gap-2 sm:gap-4">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFeedbackOpen(true)}
              className="border-amber-500/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20 touch-target"
              aria-label="Report a problem"
              title="Report a problem"
            >
              <MessageSquareWarning className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Report</span>
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
        <aside
          className={cn(
            'hidden md:flex flex-col border-r border-border/50 bg-card h-[calc(100vh-3.5rem)] overflow-hidden sticky top-14 self-start transition-[width]',
            railMode ? 'w-14' : 'w-56',
          )}
          style={{ opacity: 1, filter: 'none', backdropFilter: 'none', zIndex: 40 }}
        >
          <div className="p-2 border-b border-border/50 space-y-2">
            <div className="flex items-center gap-1">
              {!railMode && <h2 className="text-sm font-bold flex-1 truncate">🏛️ Dynasty OS</h2>}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={toggleRail}
                aria-label={railMode ? 'Expand navigation' : 'Collapse navigation to icons'}
                title={railMode ? 'Expand navigation' : 'Collapse navigation to icons'}
              >
                {railMode ? <ChevronRight className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            </div>
            {!railMode && !businessLoading && currentBusiness && <BusinessSwitcher />}
          </div>
          {railMode ? (
            <nav className="flex flex-col items-center gap-1 p-1.5">
              {NAV_GROUPS.filter(g => !g.adminOnly || ['owner', 'admin', 'ceo'].includes(role || '')).map(group => {
                const GroupIcon = group.icon;
                return (
                  <button
                    key={group.id}
                    onClick={() => { setRailMode(false); try { localStorage.setItem(RAIL_STATE_KEY, '0'); localStorage.setItem(GROUP_STATE_KEY, group.id); } catch { /* noop */ } setOpenGroup(group.id); }}
                    title={group.name}
                    aria-label={group.name}
                    className={cn(
                      'h-9 w-9 flex items-center justify-center rounded-md transition-colors',
                      openGroup === group.id ? 'bg-muted/60 text-foreground' : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                    )}
                  >
                    <GroupIcon className="h-4 w-4" />
                  </button>
                );
              })}
            </nav>
          ) : (
            <ScrollArea className="flex-1">
              <nav className="p-2">
                <NavigationContent />
              </nav>
            </ScrollArea>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 md:pb-6 pt-0 overflow-auto relative">
          <SimulationWatermark />
          {children}
        </main>
      </div>

      <SendMessageModal open={sendMessageOpen} onOpenChange={setSendMessageOpen} />
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />

    </div>
  );
};

export default Layout;