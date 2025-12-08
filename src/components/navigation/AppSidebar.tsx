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
// DYNASTY OS — COMPLETE EMPIRE NAVIGATION (FULLY RESTORED)
// Penthouse + Floors 1-9 + ALL Business Units + ALL OS Systems
// ═══════════════════════════════════════════════════════════════════════════════

interface AppSidebarProps {
  className?: string;
}

export default function AppSidebar({ className }: AppSidebarProps) {
  const location = useLocation();
  const { data: profileData } = useCurrentUserProfile();
  const { signOut, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  
  // All sections open by default
  const [openSections, setOpenSections] = useState<string[]>([
    'penthouse', 'floor-1', 'floor-2', 'floor-3', 'floor-4', 'floor-5', 'floor-6', 'floor-7', 'floor-8', 'floor-9'
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
      collapsed ? "w-16" : "w-72",
      className
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
          
          {/* 👑 PENTHOUSE */}
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

          {/* 🏢 FLOORS 1-9 */}
          <div className="mb-4 pt-2 border-t border-sidebar-border">
            <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
              🏢 Grabba Skyscraper (Floors 1-9)
            </div>
            
            {renderSection('floor-1', 'Floor 1: CRM & Stores', '🏢', [
              { path: '/grabba/crm', label: 'CRM Hub', emoji: '📋' },
              { path: '/stores', label: 'Store Master', emoji: '🏪' },
              { path: '/companies', label: 'Companies', emoji: '🏛️' },
              { path: '/crm/contacts', label: 'Contacts', emoji: '👥' },
              { path: '/crm/customers', label: 'Customers', emoji: '🧑‍💼' },
              { path: '/sales/prospects', label: 'Sales Prospects', emoji: '🎯' },
              { path: '/store-performance', label: 'Store Performance', emoji: '📈' },
            ])}

            {renderSection('floor-2', 'Floor 2: Communication', '📞', [
              { path: '/communication', label: 'Command Center', emoji: '🎛️' },
              { path: '/communication/inbox', label: 'Inbox', emoji: '📥' },
              { path: '/communication/dialer', label: 'Dialer', emoji: '📱' },
              { path: '/communication/live', label: 'Live Calls', emoji: '📞' },
              { path: '/communication/campaigns', label: 'Campaigns', emoji: '🚀' },
              { path: '/communication/agents', label: 'AI Agents', emoji: '🤖' },
              { path: '/communication/predictions', label: 'Predictions', emoji: '🧠' },
              { path: '/communication/voice-matrix', label: 'Voice Matrix', emoji: '🔊' },
              { path: '/communication/heatmap', label: 'Heatmap', emoji: '🔥' },
              { path: '/communication/settings', label: 'Settings', emoji: '⚙️' },
            ])}

            {renderSection('floor-3', 'Floor 3: Inventory', '📦', [
              { path: '/grabba/inventory', label: 'Grabba Inventory', emoji: '📦' },
              { path: '/grabba/production', label: 'Tube Counts', emoji: '🧪' },
              { path: '/inventory/stock', label: 'Stock Overview', emoji: '📊' },
              { path: '/products', label: 'Products', emoji: '🏷️' },
              { path: '/inventory/alerts', label: 'Low Stock Alerts', emoji: '🚨' },
            ])}

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

            {renderSection('floor-5', 'Floor 5: Orders & Finance', '📑', [
              { path: '/grabba/finance', label: 'Business Ledger', emoji: '📒' },
              { path: '/billing-center', label: 'Billing Center', emoji: '💳' },
              { path: '/billing/invoices', label: 'Invoices', emoji: '🧾' },
              { path: '/unpaid-accounts', label: 'Unpaid Accounts', emoji: '⚠️' },
              { path: '/grabba/personal-finance', label: 'Personal Finance', emoji: '👤' },
              { path: '/payroll', label: 'Payroll', emoji: '💵' },
            ])}

            {renderSection('floor-6', 'Floor 6: Production', '🏭', [
              { path: '/grabba/production', label: 'Production Center', emoji: '🏭' },
              { path: '/production/box-output', label: 'Box Output', emoji: '📦' },
              { path: '/production/tools', label: 'Tool Distribution', emoji: '🔧' },
              { path: '/production/machines', label: 'Machine Servicing', emoji: '⚙️' },
              { path: '/production/quality', label: 'Quality Control', emoji: '✅' },
            ])}

            {renderSection('floor-7', 'Floor 7: Wholesale', '🏬', [
              { path: '/grabba/wholesale-platform', label: 'Wholesale Platform', emoji: '🏬' },
              { path: '/wholesale', label: 'Wholesale Orders', emoji: '📦' },
              { path: '/wholesale/marketplace', label: 'Marketplace', emoji: '🛒' },
              { path: '/wholesale/fulfillment', label: 'Fulfillment', emoji: '📤' },
              { path: '/grabba/upload-center', label: 'Upload Center', emoji: '⬆️' },
              { path: '/portal/national-wholesale', label: 'National Wholesale', emoji: '🌎' },
            ])}

            {renderSection('floor-8', 'Floor 8: Ambassadors', '🤝', [
              { path: '/grabba/ambassadors', label: 'Ambassador CRM', emoji: '👥' },
              { path: '/ambassador-commissions', label: 'Commissions', emoji: '💰' },
              { path: '/ambassador-signup', label: 'Signup Center', emoji: '📝' },
              { path: '/ambassador-regions', label: 'Ambassador Regions', emoji: '🗺️' },
              { path: '/ambassador-payouts', label: 'Ambassador Payouts', emoji: '💵' },
              { path: '/ambassador-leaderboard', label: 'Leaderboard', emoji: '🏆' },
            ])}

            {renderSection('floor-9', 'Floor 9: AI Operations', '🤖', [
              { path: '/grabba/ai', label: 'AI Copilot', emoji: '🤖' },
              { path: '/ai/workforce', label: 'AI Workforce', emoji: '👾' },
              { path: '/grabba/ai-insights', label: 'AI Insights', emoji: '💡' },
              { path: '/grabba/ai-playbooks', label: 'AI Playbooks', emoji: '📋' },
              { path: '/grabba/ai-routines', label: 'AI Routines', emoji: '🔄' },
              { path: '/grabba/risk-radar', label: 'Risk Radar', emoji: '🛡️' },
              { path: '/grabba/autopilot', label: 'Autopilot Console', emoji: '✈️' },
              { path: '/grabba/command-console', label: 'Command Console', emoji: '🎮' },
            ])}
          </div>

          {/* 🔴 GRABBA PRODUCT BRANDS */}
          {isAdmin && (
            <div className="mb-4 pt-2 border-t border-sidebar-border">
              <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
                🔴 Grabba Product Brands
              </div>
              
              {renderSection('gasmask-os', 'GasMask OS', '🔴', [
                { path: '/grabba/brand/gasmask', label: 'GasMask Dashboard', emoji: '📊' },
                { path: '/gasmask/stores', label: 'GasMask Stores', emoji: '🏪' },
                { path: '/gasmask/inventory', label: 'GasMask Inventory', emoji: '📦' },
              ], "text-red-400 hover:bg-red-500/10")}

              {renderSection('hotmama-os', 'HotMama OS', '🟣', [
                { path: '/grabba/brand/hotmama', label: 'HotMama Dashboard', emoji: '📊' },
                { path: '/hotmama/stores', label: 'HotMama Stores', emoji: '🏪' },
                { path: '/hotmama/inventory', label: 'HotMama Inventory', emoji: '📦' },
              ], "text-rose-400 hover:bg-rose-500/10")}

              {renderSection('scalati-os', 'Hot Scalati OS', '🟠', [
                { path: '/grabba/brand/scalati', label: 'Scalati Dashboard', emoji: '📊' },
                { path: '/scalati/stores', label: 'Scalati Stores', emoji: '🏪' },
                { path: '/scalati/inventory', label: 'Scalati Inventory', emoji: '📦' },
              ], "text-orange-400 hover:bg-orange-500/10")}

              {renderSection('grabba-rus-os', 'Grabba R Us OS', '🟪', [
                { path: '/grabba/brand/grabba', label: 'Grabba Dashboard', emoji: '📊' },
                { path: '/grabba/stores', label: 'Grabba Stores', emoji: '🏪' },
                { path: '/grabba/brand-inventory', label: 'Grabba Inventory', emoji: '📦' },
              ], "text-purple-400 hover:bg-purple-500/10")}
            </div>
          )}

          {/* 🌐 DYNASTY BUSINESS UNITS */}
          {isAdmin && (
            <div className="mb-4 pt-2 border-t border-sidebar-border">
              <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
                🌐 Dynasty Business Units
              </div>

              {renderSection('toptier-os', 'TopTier Experience OS', '💎', [
                { path: '/toptier', label: 'TopTier Dashboard', emoji: '📊' },
                { path: '/toptier/bookings', label: 'Bookings', emoji: '📅' },
                { path: '/toptier/drivers', label: 'TopTier Fleet', emoji: '🚗' },
                { path: '/toptier/vehicles', label: 'Vehicles', emoji: '🚙' },
                { path: '/toptier/zones', label: 'Zones', emoji: '📍' },
                { path: '/toptier/gifts', label: 'Gifts & Roses', emoji: '🌹' },
              ], "text-blue-400 hover:bg-blue-500/10")}

              {renderSection('unforgettable-os', 'Unforgettable Times OS', '⭐', [
                { path: '/unforgettable', label: 'Dashboard', emoji: '📊' },
                { path: '/unforgettable/halls', label: 'Event Halls', emoji: '🏛️' },
                { path: '/unforgettable/vendors', label: 'Vendors', emoji: '👥' },
                { path: '/unforgettable/rentals', label: 'Rentals', emoji: '🎪' },
                { path: '/unforgettable/party-bags', label: 'Party Bags', emoji: '🎁' },
                { path: '/unforgettable/ai-builder', label: 'AI Party Builder', emoji: '🤖' },
              ], "text-yellow-400 hover:bg-yellow-500/10")}

              {renderSection('iclean-os', 'iClean WeClean OS', '🧹', [
                { path: '/iclean', label: 'Dashboard', emoji: '📊' },
                { path: '/iclean/jobs', label: 'Jobs', emoji: '📋' },
                { path: '/iclean/staff', label: 'Staff/Vendors', emoji: '👥' },
                { path: '/iclean/contracts', label: 'Contracts', emoji: '📝' },
                { path: '/iclean/schedules', label: 'Schedules', emoji: '📅' },
                { path: '/iclean/billing', label: 'Billing', emoji: '💳' },
              ], "text-cyan-400 hover:bg-cyan-500/10")}

              {renderSection('playboxxx-os', 'Playboxxx OS', '🎀', [
                { path: '/playboxxx', label: 'Platform Overview', emoji: '📊' },
                { path: '/playboxxx/models', label: 'Models', emoji: '👤' },
                { path: '/playboxxx/subscriptions', label: 'Subscriptions', emoji: '💎' },
                { path: '/playboxxx/payouts', label: 'Payouts', emoji: '💰' },
                { path: '/playboxxx/store', label: 'Celebration Store', emoji: '🛒' },
                { path: '/playboxxx/analytics', label: 'Analytics', emoji: '📈' },
              ], "text-pink-400 hover:bg-pink-500/10")}

              {renderSection('specialneeds-os', 'Special Needs App OS', '💜', [
                { path: '/specialneeds', label: 'Dashboard', emoji: '📊' },
                { path: '/specialneeds/providers', label: 'Providers', emoji: '👥' },
                { path: '/specialneeds/families', label: 'Families', emoji: '🏠' },
                { path: '/specialneeds/resources', label: 'Resources', emoji: '📚' },
                { path: '/specialneeds/scheduling', label: 'Scheduling', emoji: '📅' },
              ], "text-violet-400 hover:bg-violet-500/10")}
            </div>
          )}

          {/* 💰 FINANCE & ACQUISITION */}
          {isAdmin && (
            <div className="mb-4 pt-2 border-t border-sidebar-border">
              <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
                💰 Finance & Acquisition
              </div>
              
              {renderSection('funding-os', 'Funding Company OS', '💵', [
                { path: '/finance', label: 'Finance Overview', emoji: '📊' },
                { path: '/finance/funding', label: 'Funding Pipeline', emoji: '📈' },
                { path: '/finance/funding-requests', label: 'Funding Requests', emoji: '📝' },
                { path: '/finance/credit-repair', label: 'Credit & Deletion', emoji: '💳' },
              ], "text-green-400 hover:bg-green-500/10")}

              {renderSection('grants-os', 'Grant Company OS', '🎓', [
                { path: '/finance/grants', label: 'Grant Cases', emoji: '📋' },
                { path: '/finance/grants/approved', label: 'Approved Grants', emoji: '✅' },
                { path: '/finance/grants/pending', label: 'Pending Grants', emoji: '⏳' },
              ], "text-emerald-400 hover:bg-emerald-500/10")}

              {renderSection('wealth-os', 'Wealth Engine OS', '📈', [
                { path: '/finance/investment', label: 'Dynasty Investment', emoji: '💎' },
                { path: '/finance/trading', label: 'Trading Bots', emoji: '🤖' },
                { path: '/finance/stocks', label: 'Stocks Portfolio', emoji: '📊' },
                { path: '/finance/crypto', label: 'Crypto Portfolio', emoji: '🪙' },
                { path: '/economic-analytics', label: 'Economic Analytics', emoji: '📊' },
                { path: '/finance/revenue-brain', label: 'Revenue Brain', emoji: '🧠' },
              ], "text-amber-400 hover:bg-amber-500/10")}

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

              {renderSection('accounting-os', 'Accounting OS', '💳', [
                { path: '/grabba/finance', label: 'Business Ledger', emoji: '📒' },
                { path: '/grabba/personal-finance', label: 'Personal Finance', emoji: '👤' },
                { path: '/grabba/financial-dashboard', label: 'Financial Dashboard', emoji: '📊' },
                { path: '/grabba/payroll-manager', label: 'Payroll Manager', emoji: '💵' },
                { path: '/economic-analytics', label: 'Economic Analytics', emoji: '📈' },
              ], "text-lime-400 hover:bg-lime-500/10")}
            </div>
          )}

          {/* 📡 COMMUNICATION SYSTEMS */}
          {isAdmin && (
            <div className="mb-4 pt-2 border-t border-sidebar-border">
              <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
                📡 Communication Systems
              </div>

              {renderSection('callcenter-os', 'AI Call Center OS', '📞', [
                { path: '/callcenter', label: 'Call Center Dashboard', emoji: '📊' },
                { path: '/callcenter/dialer', label: 'Cloud Dialer', emoji: '📞' },
                { path: '/callcenter/ai-agents', label: 'AI Agents', emoji: '🤖' },
                { path: '/callcenter/logs', label: 'Call Logs', emoji: '📝' },
                { path: '/callcenter/live', label: 'Live Monitoring', emoji: '📡' },
                { path: '/callcenter/analytics', label: 'Analytics', emoji: '📈' },
                { path: '/callcenter/numbers', label: 'Phone Numbers', emoji: '📱' },
                { path: '/callcenter/settings', label: 'Settings', emoji: '⚙️' },
              ], "text-blue-400 hover:bg-blue-500/10")}

              {renderSection('textcenter-os', 'AI Text Center OS', '💬', [
                { path: '/grabba/text-center', label: 'Text Center', emoji: '📱' },
                { path: '/communication/sms', label: 'SMS Hub', emoji: '💬' },
                { path: '/callcenter/messages', label: 'Messages', emoji: '✉️' },
                { path: '/communication/campaigns', label: 'SMS Campaigns', emoji: '📢' },
              ], "text-green-400 hover:bg-green-500/10")}

              {renderSection('emailcenter-os', 'Email Center OS', '📧', [
                { path: '/grabba/email-center', label: 'Email Center', emoji: '📧' },
                { path: '/communication/email', label: 'Email Hub', emoji: '✉️' },
                { path: '/callcenter/emails', label: 'Email Logs', emoji: '📝' },
              ], "text-purple-400 hover:bg-purple-500/10")}

              {renderSection('communication-os', 'Communication Hub OS', '📡', [
                { path: '/communication', label: 'Communication Overview', emoji: '📊' },
                { path: '/communication/calls', label: 'Calls', emoji: '📞' },
                { path: '/communication/sms', label: 'SMS', emoji: '💬' },
                { path: '/communication/email', label: 'Email', emoji: '📧' },
                { path: '/communication/ai-agents', label: 'AI Agents', emoji: '🤖' },
                { path: '/communication/logs', label: 'All Logs', emoji: '📝' },
                { path: '/communication/analytics', label: 'Analytics', emoji: '📈' },
                { path: '/communication/settings', label: 'Settings', emoji: '⚙️' },
              ])}
            </div>
          )}

          {/* 🛒 E-COMMERCE & MARKETPLACES */}
          {isAdmin && (
            <div className="mb-4 pt-2 border-t border-sidebar-border">
              <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
                🛒 E-Commerce & Marketplaces
              </div>
              
              {renderSection('marketplace-os', 'Marketplace OS', '🛍️', [
                { path: '/portal/marketplace-admin', label: 'Marketplace Admin', emoji: '⚙️' },
                { path: '/marketplace/products', label: 'Product Catalog', emoji: '📦' },
                { path: '/marketplace/orders', label: 'Marketplace Orders', emoji: '🧾' },
                { path: '/marketplace/shipping', label: 'Shipping Center', emoji: '📬' },
                { path: '/shop', label: 'Shop Front', emoji: '🏪' },
              ], "text-indigo-400 hover:bg-indigo-500/10")}

              {renderSection('wholesale-os', 'National Wholesale OS', '📦', [
                { path: '/portal/national-wholesale', label: 'National Wholesale', emoji: '🌎' },
                { path: '/grabba/wholesale-platform', label: 'Wholesale Platform', emoji: '🏬' },
                { path: '/wholesale', label: 'Wholesale Orders', emoji: '📦' },
                { path: '/wholesale/fulfillment', label: 'Fulfillment', emoji: '📤' },
              ], "text-sky-400 hover:bg-sky-500/10")}

              {renderSection('pod-os', 'POD Design System OS', '🎨', [
                { path: '/pod', label: 'POD Dashboard', emoji: '📊' },
                { path: '/pod/designs', label: 'Designs Library', emoji: '🎨' },
                { path: '/pod/generator', label: 'AI Design Generator', emoji: '🤖' },
                { path: '/pod/mockups', label: 'Mockup Generator', emoji: '👕' },
                { path: '/pod/uploads', label: 'Marketplace Uploads', emoji: '⬆️' },
                { path: '/pod/analytics', label: 'Sales Analytics', emoji: '📈' },
                { path: '/pod/winners', label: 'Scaling Engine', emoji: '🏆' },
              ], "text-fuchsia-400 hover:bg-fuchsia-500/10")}
            </div>
          )}

          {/* 🚴 DELIVERY & LOGISTICS */}
          {isAdmin && (
            <div className="mb-4 pt-2 border-t border-sidebar-border">
              <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
                🚴 Delivery & Logistics
              </div>

              {renderSection('delivery-os', 'Delivery & Routing OS', '🚚', [
                { path: '/grabba/deliveries', label: 'Deliveries', emoji: '📬' },
                { path: '/routes', label: 'Route Plans', emoji: '🗺️' },
                { path: '/route-optimizer', label: 'Route Optimizer', emoji: '⚡' },
                { path: '/operations/live-map', label: 'Live Map', emoji: '📍' },
                { path: '/grabba/multi-brand-delivery', label: 'Multi-Brand Delivery', emoji: '🚛' },
              ])}

              {renderSection('drivers-os', 'Drivers / TopTier Fleet OS', '🚗', [
                { path: '/driver', label: 'Driver Management', emoji: '🚗' },
                { path: '/toptier/drivers', label: 'TopTier Fleet', emoji: '🚙' },
                { path: '/driver-payouts', label: 'Driver Payouts', emoji: '💰' },
                { path: '/driver-debt-collection', label: 'Driver Collections', emoji: '📥' },
              ], "text-blue-400 hover:bg-blue-500/10")}

              {renderSection('bikers-os', 'Store Checkers OS (Bikers)', '🚴', [
                { path: '/biker', label: 'Biker Management', emoji: '🚴' },
                { path: '/biker-payouts', label: 'Biker Payouts', emoji: '💵' },
                { path: '/my-route', label: 'My Route', emoji: '🗺️' },
              ], "text-green-400 hover:bg-green-500/10")}
            </div>
          )}

          {/* 👥 CRM & CUSTOMER SERVICE */}
          {isAdmin && (
            <div className="mb-4 pt-2 border-t border-sidebar-border">
              <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
                👥 CRM & Customer Service
              </div>

              {renderSection('crm-global-os', 'Global CRM OS', '👥', [
                { path: '/crm', label: 'CRM Dashboard', emoji: '📊' },
                { path: '/crm/contacts', label: 'Contacts', emoji: '👤' },
                { path: '/crm/customers', label: 'Customers', emoji: '🧑‍💼' },
                { path: '/crm/follow-ups', label: 'Follow-Ups', emoji: '📞' },
                { path: '/crm/data', label: 'Data Management', emoji: '📊' },
                { path: '/crm/data/export', label: 'Data Export', emoji: '📤' },
                { path: '/crm/data/import', label: 'Data Import', emoji: '📥' },
              ])}

              {renderSection('customerservice-os', 'Customer Service OS', '🎧', [
                { path: '/crm', label: 'Support Dashboard', emoji: '📊' },
                { path: '/notifications', label: 'Notifications', emoji: '🔔' },
                { path: '/reminders', label: 'Reminders', emoji: '⏰' },
                { path: '/messages', label: 'Messages', emoji: '💬' },
              ])}
            </div>
          )}

          {/* 🤖 AI & AUTOMATION */}
          {isAdmin && (
            <div className="mb-4 pt-2 border-t border-sidebar-border">
              <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
                🤖 AI & Automation
              </div>

              {renderSection('ai-workforce-os', 'AI Workforce Automation OS', '👾', [
                { path: '/ai/workforce', label: 'AI Workforce', emoji: '👾' },
                { path: '/grabba/ai', label: 'AI Copilot', emoji: '🤖' },
                { path: '/grabba/ai-playbooks', label: 'AI Playbooks', emoji: '📋' },
                { path: '/grabba/ai-routines', label: 'AI Routines', emoji: '🔄' },
                { path: '/grabba/autopilot', label: 'Autopilot Console', emoji: '✈️' },
                { path: '/grabba/command-console', label: 'Command Console', emoji: '🎮' },
                { path: '/grabba/ai-insights', label: 'AI Insights', emoji: '💡' },
              ], "text-purple-400 hover:bg-purple-500/10")}

              {renderSection('betting-ai-os', 'Sports Betting AI OS', '🎰', [
                { path: '/betting/dashboard', label: 'Betting Dashboard', emoji: '📊' },
                { path: '/betting/predictions', label: 'AI Predictions', emoji: '🤖' },
                { path: '/betting/analytics', label: 'Betting Analytics', emoji: '📈' },
                { path: '/betting/hedge', label: 'Hedge Fund AI', emoji: '💹' },
              ], "text-lime-400 hover:bg-lime-500/10")}
            </div>
          )}

          {/* ⚙️ SYSTEMS & HR */}
          {isAdmin && (
            <div className="mb-4 pt-2 border-t border-sidebar-border">
              <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
                ⚙️ Systems & HR
              </div>

              {renderSection('hr-os', 'HR & Workforce OS', '👔', [
                { path: '/hr', label: 'HR Management', emoji: '👥' },
                { path: '/hr/applicants', label: 'Applicants', emoji: '📝' },
                { path: '/hr/employees', label: 'Employees', emoji: '👤' },
                { path: '/hr/interviews', label: 'Interviews', emoji: '🎤' },
                { path: '/hr/onboarding', label: 'Onboarding', emoji: '🎓' },
                { path: '/hr/payroll', label: 'HR Payroll', emoji: '💰' },
                { path: '/my-hr', label: 'My HR Portal', emoji: '👤' },
              ])}

              {renderSection('va-os', 'VA OS', '👩‍💼', [
                { path: '/va-task-center', label: 'VA Task Center', emoji: '📋' },
                { path: '/va-performance', label: 'VA Performance', emoji: '📊' },
                { path: '/va-ranking', label: 'VA Ranking', emoji: '🏆' },
                { path: '/batch-import', label: 'Batch Import', emoji: '📤' },
                { path: '/automation-settings', label: 'Automation Settings', emoji: '⚙️' },
              ])}

              {renderSection('ambassador-os', 'Ambassador OS', '🤝', [
                { path: '/grabba/ambassadors', label: 'Ambassador CRM', emoji: '👥' },
                { path: '/ambassador-commissions', label: 'Commissions', emoji: '💰' },
                { path: '/ambassador-regions', label: 'Regions', emoji: '🗺️' },
                { path: '/ambassador-payouts', label: 'Payouts', emoji: '💵' },
                { path: '/ambassador-leaderboard', label: 'Leaderboard', emoji: '🏆' },
              ])}
            </div>
          )}

          {/* 🌍 GLOBAL DYNASTY */}
          {isAdmin && (
            <div className="mb-4 pt-2 border-t border-sidebar-border">
              <div className="px-3 py-2 text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">
                🌍 Global Dynasty
              </div>

              {renderSection('dynasty-global', 'Global Dynasty Dashboard', '🌍', [
                { path: '/dynasty/global', label: 'Global Overview', emoji: '🌐' },
                { path: '/dynasty/metrics', label: 'Empire Metrics', emoji: '📊' },
                { path: '/expansion', label: 'Expansion', emoji: '🚀' },
                { path: '/territories', label: 'Territories', emoji: '🗺️' },
                { path: '/leaderboard', label: 'Leaderboard', emoji: '🏆' },
                { path: '/analytics', label: 'Analytics', emoji: '📈' },
              ], "bg-gradient-to-r from-yellow-500/10 to-amber-500/10 text-yellow-400")}
            </div>
          )}

          {/* 🚪 ROLE PORTALS */}
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
              <Link to="/portal/national-wholesale" className={cn("flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors", isPathActive('/portal/national-wholesale') ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40")}>
                <span>🌎 National Wholesale Portal</span>
              </Link>
              <Link to="/portal/marketplace-admin" className={cn("flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors", isPathActive('/portal/marketplace-admin') ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40")}>
                <span>🛒 Marketplace Admin Portal</span>
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
                <User className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{profileData?.profile?.full_name || 'User'}</p>
                <p className="text-xs text-sidebar-foreground/60 truncate capitalize">{userRole}</p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" asChild className="flex-1 text-xs">
                <Link to="/settings">
                  <Settings className="h-3 w-3 mr-1" /> Settings
                </Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => signOut()} className="flex-1 text-xs">
                <LogOut className="h-3 w-3 mr-1" /> Logout
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/settings">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => signOut()}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
