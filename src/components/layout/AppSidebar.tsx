import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  ChevronDown, ChevronRight, Menu, X, LogOut, User, Settings,
  Crown, Building2, MessageSquare, Package, Truck, FileText, 
  Factory, Boxes, Users, Map, DollarSign, BarChart3, Brain, 
  Phone, Mail, Target, Award, ShoppingCart, Wallet, Calendar,
  CheckSquare, Clipboard, Bike, Car, Store, Globe, Zap, Bot,
  Shield, Bell, Database, Megaphone, Video, Heart, Droplet,
  CreditCard, TrendingUp, Home, Rocket, Calculator
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { useAuth } from '@/contexts/AuthContext';

// ═══════════════════════════════════════════════════════════════════════════════
// DYNASTY OS — COMPLETE EMPIRE NAVIGATION (RESTORED)
// Penthouse + Floors 1-8 + ALL Business Units
// ═══════════════════════════════════════════════════════════════════════════════

export default function AppSidebar() {
  const location = useLocation();
  const { data: profileData } = useCurrentUserProfile();
  const { signOut, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  
  // All sections open by default
  const [openSections, setOpenSections] = useState<string[]>([
    'penthouse',
    'floor-1', 'floor-2', 'floor-3', 'floor-4', 'floor-5', 'floor-6', 'floor-7', 'floor-8',
    'product-companies', 'service-experience', 'platforms-digital', 'finance-acquisition',
    'ecommerce', 'systems', 'departments', 'portals'
  ]);

  const userRole = profileData?.profile?.primary_role || 'admin';
  const isAdmin = ['admin', 'ceo', 'va'].includes(userRole);

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const isPathActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Render a collapsible nav section
  const renderSection = (
    id: string, 
    title: string, 
    emoji: string, 
    items: { path: string; label: string; emoji?: string }[],
    titleClass?: string
  ) => {
    const isOpen = openSections.includes(id);
    return (
      <div key={id} className="mb-1">
        <button
          onClick={() => toggleSection(id)}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-md transition-colors",
            titleClass || "text-sidebar-foreground/80 hover:bg-sidebar-accent/30"
          )}
        >
          <span className="text-base">{emoji}</span>
          {!collapsed && (
            <>
              <span className="flex-1 text-left truncate">{title}</span>
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </>
          )}
        </button>
        {isOpen && !collapsed && (
          <div className="ml-4 mt-1 space-y-0.5">
            {items.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors",
                  isPathActive(item.path)
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                )}
              >
                {item.emoji && <span>{item.emoji}</span>}
                <span className="truncate">{item.label}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn(
      "bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border h-screen transition-all duration-300",
      collapsed ? "w-16" : "w-72"
    )}>
      {/* Header */}
      <div className="px-4 py-4 border-b border-sidebar-border bg-gradient-to-r from-purple-900/20 to-transparent flex items-center justify-between">
        {!collapsed && (
          <div>
            <h1 className="text-lg font-bold">🏛️ Dynasty OS</h1>
            <p className="text-xs text-sidebar-foreground/60">Empire Command Center</p>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {collapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </Button>
      </div>

      {/* Brand Pills */}
      {!collapsed && isAdmin && (
        <div className="px-3 py-2 border-b border-sidebar-border">
          <div className="flex gap-1 flex-wrap">
            <Badge variant="outline" className="text-xs border-red-500 text-red-400">🔴 GasMask</Badge>
            <Badge variant="outline" className="text-xs border-rose-400 text-rose-400">🟣 HotMama</Badge>
            <Badge variant="outline" className="text-xs border-orange-500 text-orange-400">🟠 Scalati</Badge>
            <Badge variant="outline" className="text-xs border-purple-500 text-purple-400">🟪 Grabba</Badge>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-2">
          
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* 👑 PENTHOUSE — Master Command Center */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <div className="mb-4">
            <div className="px-3 py-2 text-xs font-semibold uppercase text-amber-400/80 tracking-wider">
              👑 Command Penthouse
            </div>
            {renderSection('penthouse', 'Penthouse', '🏰', [
              { path: '/grabba/command-penthouse', label: 'Master Dashboard', emoji: '📊' },
              { path: '/', label: 'Home Dashboard', emoji: '🏠' },
              { path: '/grabba/ai-insights', label: 'Global Intelligence', emoji: '🧠' },
              { path: '/grabba/advisor-penthouse', label: 'Financial Command', emoji: '💰' },
              { path: '/executive-reports', label: 'Executive Reports', emoji: '📑' },
              { path: '/grabba/cluster', label: 'Regional Clusters', emoji: '🗺️' },
              { path: '/settings', label: 'OS Settings', emoji: '⚙️' },
            ], "bg-gradient-to-r from-amber-500/20 to-yellow-500/10 text-amber-300 hover:from-amber-500/30")}
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* 🏢 FLOORS 1-8 — Grabba Empire Skyscraper */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <div className="mb-4 pt-2 border-t border-sidebar-border">
            <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
              🏢 Grabba Skyscraper (Floors 1-8)
            </div>
            
            {/* Floor 1 - CRM & Store Master */}
            {renderSection('floor-1', 'Floor 1: CRM & Stores', '🏢', [
              { path: '/grabba/crm', label: 'CRM Hub', emoji: '📋' },
              { path: '/stores', label: 'Store Master', emoji: '🏪' },
              { path: '/companies', label: 'Companies', emoji: '🏛️' },
              { path: '/crm/contacts', label: 'Contacts', emoji: '👥' },
              { path: '/crm/customers', label: 'Customers', emoji: '🧑‍💼' },
              { path: '/sales/prospects', label: 'Sales Prospects', emoji: '🎯' },
              { path: '/store-performance', label: 'Store Performance', emoji: '📈' },
            ])}

            {/* Floor 2 - Communication Center */}
            {renderSection('floor-2', 'Floor 2: Communication', '📞', [
              { path: '/grabba/communication', label: 'Communication Hub', emoji: '💬' },
              { path: '/grabba/text-center', label: 'Text Center', emoji: '📱' },
              { path: '/grabba/email-center', label: 'Email Center', emoji: '📧' },
              { path: '/grabba/call-center', label: 'Call Center', emoji: '☎️' },
              { path: '/call-center/dashboard', label: 'Call Center Cloud', emoji: '☁️' },
              { path: '/grabba/communication-logs', label: 'Communication Logs', emoji: '📝' },
              { path: '/grabba/autopilot', label: 'AI Auto-Calling', emoji: '🤖' },
              { path: '/tasks', label: 'Task Center', emoji: '✅' },
              { path: '/grabba/daily-briefing', label: 'Daily Briefing', emoji: '📅' },
            ])}

            {/* Floor 3 - Inventory */}
            {renderSection('floor-3', 'Floor 3: Inventory', '📦', [
              { path: '/grabba/inventory', label: 'Grabba Inventory', emoji: '📦' },
              { path: '/grabba/production', label: 'Tube Counts', emoji: '🧪' },
              { path: '/inventory/stock', label: 'Stock Overview', emoji: '📊' },
              { path: '/products', label: 'Products', emoji: '🏷️' },
              { path: '/inventory/alerts', label: 'Low Stock Alerts', emoji: '🚨' },
            ])}

            {/* Floor 4 - Delivery & Drivers */}
            {renderSection('floor-4', 'Floor 4: Delivery & Drivers', '🚴', [
              { path: '/grabba/deliveries', label: 'Deliveries', emoji: '📬' },
              { path: '/driver', label: 'Driver Management', emoji: '🚗' },
              { path: '/biker', label: 'Biker Management', emoji: '🚴' },
              { path: '/routes', label: 'Route Plans', emoji: '🗺️' },
              { path: '/route-optimizer', label: 'Route Optimizer', emoji: '⚡' },
              { path: '/operations/live-map', label: 'Live Map', emoji: '📍' },
              { path: '/biker-payouts', label: 'Biker Payouts', emoji: '💵' },
              { path: '/driver-payouts', label: 'Driver Payouts', emoji: '💰' },
              { path: '/driver-debt-collection', label: 'Driver Collections', emoji: '📥' },
            ])}

            {/* Floor 5 - Orders & Finance */}
            {renderSection('floor-5', 'Floor 5: Orders & Finance', '📑', [
              { path: '/grabba/finance', label: 'Business Ledger', emoji: '📒' },
              { path: '/billing-center', label: 'Billing Center', emoji: '💳' },
              { path: '/billing/invoices', label: 'Invoices', emoji: '🧾' },
              { path: '/unpaid-accounts', label: 'Unpaid Accounts', emoji: '⚠️' },
              { path: '/grabba/personal-finance', label: 'Personal Finance', emoji: '👤' },
              { path: '/payroll', label: 'Payroll', emoji: '💵' },
            ])}

            {/* Floor 6 - Production */}
            {renderSection('floor-6', 'Floor 6: Production', '🏭', [
              { path: '/grabba/production', label: 'Production Center', emoji: '🏭' },
              { path: '/production/box-output', label: 'Box Output', emoji: '📦' },
              { path: '/production/tools', label: 'Tool Distribution', emoji: '🔧' },
              { path: '/production/machines', label: 'Machine Servicing', emoji: '⚙️' },
              { path: '/production/quality', label: 'Quality Control', emoji: '✅' },
            ])}

            {/* Floor 7 - Wholesale */}
            {renderSection('floor-7', 'Floor 7: Wholesale', '🏬', [
              { path: '/grabba/wholesale-platform', label: 'Wholesale Platform', emoji: '🏬' },
              { path: '/wholesale', label: 'Wholesale Orders', emoji: '📦' },
              { path: '/wholesale/marketplace', label: 'Marketplace', emoji: '🛒' },
              { path: '/wholesale/fulfillment', label: 'Fulfillment', emoji: '📤' },
              { path: '/grabba/upload-center', label: 'Upload Center', emoji: '⬆️' },
              { path: '/portal/national-wholesale', label: 'National Wholesale', emoji: '🌎' },
            ])}

            {/* Floor 8 - Ambassadors */}
            {renderSection('floor-8', 'Floor 8: Ambassadors', '🤝', [
              { path: '/grabba/ambassadors', label: 'Ambassador CRM', emoji: '👥' },
              { path: '/ambassador-commissions', label: 'Commissions', emoji: '💰' },
              { path: '/ambassador-signup', label: 'Signup Center', emoji: '📝' },
              { path: '/ambassador-regions', label: 'Ambassador Regions', emoji: '🗺️' },
              { path: '/ambassador-payouts', label: 'Ambassador Payouts', emoji: '💵' },
              { path: '/ambassador-leaderboard', label: 'Leaderboard', emoji: '🏆' },
            ])}
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* 🤖 AI & INTELLIGENCE */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {isAdmin && (
            <div className="mb-4 pt-2 border-t border-sidebar-border">
              <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
                🤖 AI & Intelligence
              </div>
              {renderSection('ai-intelligence', 'AI Operations', '🧠', [
                { path: '/grabba/ai', label: 'AI Copilot', emoji: '🤖' },
                { path: '/ai/workforce', label: 'AI Workforce', emoji: '👾' },
                { path: '/grabba/ai-insights', label: 'AI Insights', emoji: '💡' },
                { path: '/grabba/ai-playbooks', label: 'AI Playbooks', emoji: '📋' },
                { path: '/grabba/ai-routines', label: 'AI Routines', emoji: '🔄' },
                { path: '/grabba/risk-radar', label: 'Risk Radar', emoji: '🛡️' },
                { path: '/analytics', label: 'Analytics', emoji: '📊' },
                { path: '/territories', label: 'Territories', emoji: '🗺️' },
                { path: '/leaderboard', label: 'Leaderboard', emoji: '🏆' },
              ])}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* 🔴 GRABBA PRODUCT COMPANIES */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {isAdmin && (
            <div className="mb-4 pt-2 border-t border-sidebar-border">
              <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
                🔴 Grabba Product Brands
              </div>
              
              {/* GasMask OS */}
              {renderSection('gasmask-os', 'GasMask OS', '🔴', [
                { path: '/grabba/brand/gasmask', label: 'GasMask Dashboard', emoji: '📊' },
                { path: '/gasmask/stores', label: 'GasMask Stores', emoji: '🏪' },
                { path: '/gasmask/inventory', label: 'GasMask Inventory', emoji: '📦' },
              ], "text-red-400 hover:bg-red-500/10")}

              {/* HotMama OS */}
              {renderSection('hotmama-os', 'HotMama OS', '🟣', [
                { path: '/grabba/brand/hotmama', label: 'HotMama Dashboard', emoji: '📊' },
                { path: '/hotmama/stores', label: 'HotMama Stores', emoji: '🏪' },
                { path: '/hotmama/inventory', label: 'HotMama Inventory', emoji: '📦' },
              ], "text-rose-400 hover:bg-rose-500/10")}

              {/* Scalati OS */}
              {renderSection('scalati-os', 'Hot Scalati OS', '🟠', [
                { path: '/grabba/brand/scalati', label: 'Scalati Dashboard', emoji: '📊' },
                { path: '/scalati/stores', label: 'Scalati Stores', emoji: '🏪' },
                { path: '/scalati/inventory', label: 'Scalati Inventory', emoji: '📦' },
              ], "text-orange-400 hover:bg-orange-500/10")}

              {/* Grabba R Us OS */}
              {renderSection('grabba-rus-os', 'Grabba R Us OS', '🟪', [
                { path: '/grabba/brand/grabba', label: 'Grabba Dashboard', emoji: '📊' },
                { path: '/grabba/stores', label: 'Grabba Stores', emoji: '🏪' },
                { path: '/grabba/brand-inventory', label: 'Grabba Inventory', emoji: '📦' },
              ], "text-purple-400 hover:bg-purple-500/10")}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* 🌐 EXTERNAL DYNASTY BRANDS */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {isAdmin && (
            <div className="mb-4 pt-2 border-t border-sidebar-border">
              <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
                🌐 Dynasty Business Units
              </div>

              {/* TopTier Experience */}
              {renderSection('toptier-os', 'TopTier Experience', '💎', [
                { path: '/toptier', label: 'TopTier Dashboard', emoji: '📊' },
                { path: '/toptier/bookings', label: 'Bookings', emoji: '📅' },
                { path: '/toptier/drivers', label: 'TopTier Drivers', emoji: '🚗' },
                { path: '/toptier/vehicles', label: 'Vehicles', emoji: '🚙' },
                { path: '/toptier/zones', label: 'Zones', emoji: '📍' },
                { path: '/toptier/gifts', label: 'Gifts & Roses', emoji: '🌹' },
              ], "text-blue-400 hover:bg-blue-500/10")}

              {/* Unforgettable Times */}
              {renderSection('unforgettable-os', 'Unforgettable Times', '⭐', [
                { path: '/unforgettable', label: 'Dashboard', emoji: '📊' },
                { path: '/unforgettable/halls', label: 'Event Halls', emoji: '🏛️' },
                { path: '/unforgettable/vendors', label: 'Vendors', emoji: '👥' },
                { path: '/unforgettable/rentals', label: 'Rentals', emoji: '🎪' },
                { path: '/unforgettable/party-bags', label: 'Party Bags', emoji: '🎁' },
                { path: '/unforgettable/ai-builder', label: 'AI Party Builder', emoji: '🤖' },
              ], "text-yellow-400 hover:bg-yellow-500/10")}

              {/* iClean WeClean */}
              {renderSection('iclean-os', 'iClean WeClean', '🧹', [
                { path: '/iclean', label: 'Dashboard', emoji: '📊' },
                { path: '/iclean/jobs', label: 'Jobs', emoji: '📋' },
                { path: '/iclean/staff', label: 'Staff/Vendors', emoji: '👥' },
                { path: '/iclean/contracts', label: 'Contracts', emoji: '📝' },
                { path: '/iclean/schedules', label: 'Schedules', emoji: '📅' },
                { path: '/iclean/billing', label: 'Billing', emoji: '💳' },
              ], "text-cyan-400 hover:bg-cyan-500/10")}

              {/* Playboxxx */}
              {renderSection('playboxxx-os', 'Playboxxx', '🎀', [
                { path: '/playboxxx', label: 'Platform Overview', emoji: '📊' },
                { path: '/playboxxx/models', label: 'Models', emoji: '👤' },
                { path: '/playboxxx/subscriptions', label: 'Subscriptions', emoji: '💎' },
                { path: '/playboxxx/payouts', label: 'Payouts', emoji: '💰' },
                { path: '/playboxxx/store', label: 'Celebration Store', emoji: '🛒' },
                { path: '/playboxxx/analytics', label: 'Analytics', emoji: '📈' },
              ], "text-pink-400 hover:bg-pink-500/10")}

              {/* Special Needs App */}
              {renderSection('specialneeds-os', 'Special Needs App', '💜', [
                { path: '/specialneeds', label: 'Dashboard', emoji: '📊' },
                { path: '/specialneeds/providers', label: 'Providers', emoji: '👥' },
                { path: '/specialneeds/families', label: 'Families', emoji: '🏠' },
                { path: '/specialneeds/resources', label: 'Resources', emoji: '📚' },
                { path: '/specialneeds/scheduling', label: 'Scheduling', emoji: '📅' },
              ], "text-violet-400 hover:bg-violet-500/10")}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* 💰 FINANCE & ACQUISITION */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {isAdmin && (
            <div className="mb-4 pt-2 border-t border-sidebar-border">
              <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
                💰 Finance & Acquisition
              </div>
              
              {/* Funding Company */}
              {renderSection('funding-os', 'Funding Company', '💵', [
                { path: '/finance', label: 'Finance Overview', emoji: '📊' },
                { path: '/finance/funding', label: 'Funding Pipeline', emoji: '📈' },
                { path: '/finance/funding-requests', label: 'Funding Requests', emoji: '📝' },
                { path: '/finance/credit-repair', label: 'Credit Repair', emoji: '💳' },
              ], "text-green-400 hover:bg-green-500/10")}

              {/* Grant Company */}
              {renderSection('grants-os', 'Grant Company', '🎓', [
                { path: '/finance/grants', label: 'Grant Cases', emoji: '📋' },
              ], "text-emerald-400 hover:bg-emerald-500/10")}

              {/* Investment / Wealth Engine */}
              {renderSection('investment-os', 'Investment & Wealth', '📈', [
                { path: '/finance/investment', label: 'Dynasty Investment', emoji: '💎' },
                { path: '/finance/trading', label: 'Trading Bots', emoji: '🤖' },
                { path: '/economic-analytics', label: 'Economic Analytics', emoji: '📊' },
                { path: '/finance/revenue-brain', label: 'Revenue Brain', emoji: '🧠' },
              ], "text-amber-400 hover:bg-amber-500/10")}

              {/* Real Estate */}
              {renderSection('realestate-os', 'Real Estate OS', '🏠', [
                { path: '/realestate', label: 'Real Estate HQ', emoji: '🏢' },
                { path: '/realestate/leads', label: 'Lead Intelligence', emoji: '🎯' },
                { path: '/realestate/pipeline', label: 'Acquisition Pipeline', emoji: '📈' },
                { path: '/realestate/investors', label: 'Investor Marketplace', emoji: '💼' },
                { path: '/realestate/closings', label: 'Deal Closings', emoji: '✅' },
                { path: '/realestate/partners', label: 'Closing Partners', emoji: '🤝' },
                { path: '/holdings/overview', label: 'Holdings Overview', emoji: '🏘️' },
                { path: '/holdings/airbnb', label: 'Airbnb Properties', emoji: '🛏️' },
              ], "text-teal-400 hover:bg-teal-500/10")}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* 🛒 E-COMMERCE & POD */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {isAdmin && (
            <div className="mb-4 pt-2 border-t border-sidebar-border">
              <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
                🛒 E-Commerce & Marketplaces
              </div>
              
              {/* E-Commerce Hub */}
              {renderSection('ecommerce-os', 'E-Commerce Hub', '🛍️', [
                { path: '/ecommerce', label: 'Dashboard', emoji: '📊' },
                { path: '/ecommerce/products', label: 'Product Sync', emoji: '🔄' },
                { path: '/ecommerce/orders', label: 'Orders', emoji: '📦' },
                { path: '/shop', label: 'Shop Front', emoji: '🏪' },
              ], "text-indigo-400 hover:bg-indigo-500/10")}

              {/* POD Department */}
              {renderSection('pod-os', 'POD Department', '🎨', [
                { path: '/pod', label: 'POD Dashboard', emoji: '📊' },
                { path: '/pod/designs', label: 'Designs', emoji: '🎨' },
                { path: '/pod/products', label: 'POD Products', emoji: '👕' },
                { path: '/pod/orders', label: 'POD Orders', emoji: '📦' },
              ], "text-fuchsia-400 hover:bg-fuchsia-500/10")}

              {/* Marketplace Admin */}
              {renderSection('marketplace-os', 'Marketplace Admin', '🛒', [
                { path: '/portal/marketplace-admin', label: 'Marketplace Admin', emoji: '⚙️' },
                { path: '/marketplace/products', label: 'Product Catalog', emoji: '📦' },
                { path: '/marketplace/orders', label: 'Marketplace Orders', emoji: '🧾' },
                { path: '/marketplace/shipping', label: 'Shipping Center', emoji: '📬' },
              ], "text-sky-400 hover:bg-sky-500/10")}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* ⚙️ SYSTEMS & HR */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {isAdmin && (
            <div className="mb-4 pt-2 border-t border-sidebar-border">
              <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
                ⚙️ Systems & Operations
              </div>
              
              {/* Communications Center */}
              {renderSection('comm-center', 'Communications Center', '📡', [
                { path: '/communications-center', label: 'Communications Center', emoji: '📡' },
                { path: '/text-center', label: 'Text Center', emoji: '📱' },
                { path: '/email-center', label: 'Email Center', emoji: '📧' },
                { path: '/communication', label: 'Legacy Comms', emoji: '💬' },
                { path: '/communication-automation', label: 'Automation', emoji: '🤖' },
                { path: '/communications-ai', label: 'Communications AI', emoji: '🧠' },
              ])}

              {/* HR Department */}
              {renderSection('hr-os', 'HR & Workforce', '👔', [
                { path: '/hr', label: 'HR Management', emoji: '👥' },
                { path: '/hr/applicants', label: 'Applicants', emoji: '📝' },
                { path: '/hr/employees', label: 'Employees', emoji: '👤' },
                { path: '/hr/interviews', label: 'Interviews', emoji: '🎤' },
                { path: '/hr/onboarding', label: 'Onboarding', emoji: '🎓' },
                { path: '/hr/payroll', label: 'HR Payroll', emoji: '💰' },
                { path: '/my-hr', label: 'My HR Portal', emoji: '👤' },
              ])}

              {/* Customer Service */}
              {renderSection('customer-service', 'Customer Service', '🎧', [
                { path: '/crm', label: 'Global CRM', emoji: '👥' },
                { path: '/crm/data', label: 'Data Management', emoji: '📊' },
                { path: '/notifications', label: 'Notifications', emoji: '🔔' },
              ])}

              {/* VA & Admin Tools */}
              {renderSection('va-tools', 'VA & Admin Tools', '👩‍💼', [
                { path: '/va-task-center', label: 'VA Task Center', emoji: '📋' },
                { path: '/va-performance', label: 'VA Performance', emoji: '📊' },
                { path: '/va-ranking', label: 'VA Ranking', emoji: '🏆' },
                { path: '/batch-import', label: 'Batch Import', emoji: '📤' },
                { path: '/audit-logs', label: 'Audit Logs', emoji: '📜' },
                { path: '/integrations', label: 'Integrations', emoji: '🔌' },
              ])}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* 🎰 SPORTS BETTING AI */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {isAdmin && (
            <div className="mb-4 pt-2 border-t border-sidebar-border">
              {renderSection('betting-ai', 'Sports Betting AI', '🎰', [
                { path: '/betting/dashboard', label: 'Betting Dashboard', emoji: '📊' },
                { path: '/betting/predictions', label: 'AI Predictions', emoji: '🤖' },
                { path: '/betting/analytics', label: 'Betting Analytics', emoji: '📈' },
              ], "text-lime-400 hover:bg-lime-500/10")}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* 🌍 GLOBAL DYNASTY DASHBOARD */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {isAdmin && (
            <div className="mb-4 pt-2 border-t border-sidebar-border">
              {renderSection('dynasty-global', 'Global Dynasty Dashboard', '🌍', [
                { path: '/dynasty/global', label: 'Global Overview', emoji: '🌐' },
                { path: '/dynasty/metrics', label: 'Empire Metrics', emoji: '📊' },
                { path: '/dynasty/expansion', label: 'Expansion', emoji: '🚀' },
              ], "text-gold-400 hover:bg-yellow-500/10")}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* 🚪 ROLE PORTALS */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <div className="mb-4 pt-2 border-t border-sidebar-border">
            <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
              🚪 Role Portals
            </div>
            <div className="space-y-0.5 ml-2">
              <Link to="/portal/home" className={cn("flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors", isPathActive('/portal/home') ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40")}>
                <span>🏠 Portal Home</span>
              </Link>
              <Link to="/portal/driver" className={cn("flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors", isPathActive('/portal/driver') ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40")}>
                <span>🚗 Driver Portal</span>
              </Link>
              <Link to="/portal/biker" className={cn("flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors", isPathActive('/portal/biker') ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40")}>
                <span>🚴 Biker Portal</span>
              </Link>
              <Link to="/portal/ambassador" className={cn("flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors", isPathActive('/portal/ambassador') ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40")}>
                <span>🤝 Ambassador Portal</span>
              </Link>
              <Link to="/portal/store" className={cn("flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors", isPathActive('/portal/store') ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40")}>
                <span>🏪 Store Portal</span>
              </Link>
              <Link to="/portal/wholesaler" className={cn("flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors", isPathActive('/portal/wholesaler') ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40")}>
                <span>📦 Wholesaler Portal</span>
              </Link>
              <Link to="/portal/production" className={cn("flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors", isPathActive('/portal/production') ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40")}>
                <span>🏭 Production Portal</span>
              </Link>
              <Link to="/portal/va" className={cn("flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors", isPathActive('/portal/va') ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40")}>
                <span>👩‍💼 VA Portal</span>
              </Link>
              <Link to="/portal/customer" className={cn("flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors", isPathActive('/portal/customer') ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40")}>
                <span>🧑 Customer Portal</span>
              </Link>
            </div>
          </div>

        </div>
      </ScrollArea>

      {/* User Footer */}
      <div className="border-t border-sidebar-border p-3">
        {!collapsed ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
                <User className="h-4 w-4 text-sidebar-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {profileData?.profile?.full_name || user?.email || 'User'}
                </p>
                <p className="text-xs text-sidebar-foreground/60 capitalize">{userRole}</p>
              </div>
            </div>
            <div className="flex gap-1">
              <Link to="/settings" className="flex-1">
                <Button variant="ghost" size="sm" className="w-full text-xs">
                  <Settings className="h-3 w-3 mr-1" />
                  Settings
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 text-xs text-destructive hover:text-destructive"
                onClick={() => signOut()}
              >
                <LogOut className="h-3 w-3 mr-1" />
                Logout
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="w-full text-destructive hover:text-destructive"
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
