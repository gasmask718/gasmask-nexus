/**
 * Ambassador Portal Dashboard - Portfolio command center
 * Shows KPIs, assigned stores, commissions, and quick actions
 * Commission data now sourced from real ledger (SQL views, zero client math)
 * MASTER GENIUS ARCHITECT: Complete portfolio visibility for all entity types
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Store, DollarSign, TrendingUp, Package, Users, 
  ArrowRight, Phone, MessageSquare, MapPin, AlertTriangle,
  Plus, Calendar, BarChart3, Clock, ShoppingCart, UserPlus,
  Camera
} from 'lucide-react';
import { AmbassadorLayout } from '@/components/ambassador/AmbassadorLayout';
import { PortalRBACGate } from '@/components/portal/PortalRBACGate';
import { CommandCenterKPI } from '@/components/portal/CommandCenterKPI';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useAmbassadorPortfolio, type PortfolioStore } from '@/hooks/useAmbassadorPortfolio';
import { useCommissionTotals, useCommissionLedger } from '@/hooks/useCommissionLedger';
import { useEffectiveAmbassadorId } from '@/hooks/useAmbassadorComms';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import { PortfolioSection } from '@/components/ambassador/PortfolioSection';
import { InviteAmbassadorCard } from '@/components/ambassador/InviteAmbassadorCard';
import { ReferralLinkCard } from '@/components/ambassador/ReferralLinkCard';
import { DashboardPurchasesCard } from '@/components/ambassador/purchases/DashboardPurchasesCard';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { StoreCaptureForm } from '@/components/store/StoreCaptureForm';
import { AmbassadorStoreMap } from '@/components/ambassador/AmbassadorStoreMap';
import NextStopNavigator from '@/components/map/NextStopNavigator';
import { useTranslation } from '@/hooks/useTranslation';
import { BilingualLabel } from '@/components/portal/BilingualLabel';

// MASTER GENIUS ARCHITECT: Lead KPI config - all lead types must be represented
const LEAD_KPI_CONFIG = {
  store: { 
    tKey: 'amb.lead.store_leads', label: 'Store Leads', 
    icon: Store, 
    variant: 'rose' as const,
    bgClass: 'bg-rose-500/10',
    borderClass: 'border-rose-500/30',
    iconClass: 'text-rose-400'
  },
  wholesaler: { 
    tKey: 'amb.lead.wholesaler_leads', label: 'Wholesaler Leads', 
    icon: ShoppingCart, 
    variant: 'amber' as const,
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/30',
    iconClass: 'text-amber-400'
  },
  influencer: { 
    tKey: 'amb.lead.influencer_leads', label: 'Influencer / Street Team', 
    icon: Users, 
    variant: 'purple' as const,
    bgClass: 'bg-purple-500/10',
    borderClass: 'border-purple-500/30',
    iconClass: 'text-purple-400'
  },
  ambassador: { 
    tKey: 'amb.lead.ambassador_leads', label: 'Ambassador Recruits', 
    icon: UserPlus, 
    variant: 'cyan' as const,
    bgClass: 'bg-cyan-500/10',
    borderClass: 'border-cyan-500/30',
    iconClass: 'text-cyan-400'
  },
} as const;

type LeadType = keyof typeof LEAD_KPI_CONFIG;

function StoreCard({ store, onClick }: { store: PortfolioStore; onClick: () => void }) {
  return (
    <Card 
      className="cursor-pointer hover:border-primary/50 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold truncate">{store.store_name}</h3>
              <Badge variant={store.assignment_type === 'sourced' ? 'default' : 'secondary'} className="text-xs">
                {store.assignment_type}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {store.store_address}, {store.store_city}
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              {store.store_phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {store.store_phone}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Assigned {formatDistanceToNow(new Date(store.assigned_at), { addSuffix: true })}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-muted-foreground">Commission</span>
            <span className="font-semibold text-primary">{store.commission_rate}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MyCapturedStores() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();


  // Resolve ambassador_id for this user (store_master uses ambassador_id, not user_id)
  const { data: ambassadorId } = useQuery({
    queryKey: ['ambassador-self-id', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassadors')
        .select('id')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0]?.id ?? null;
    },
  });

  const { data: myStores } = useQuery({
    queryKey: ['ambassador-captured-stores', ambassadorId],
    enabled: !!ambassadorId,
    queryFn: async () => {
      // Canonical: query store_master scoped by sourced_by_ambassador_id.
      // RLS also restricts to this ambassador via get_ambassador_id_for_user(auth.uid()).
      const { data, error } = await supabase
        .from('store_master')
        .select('id, store_name, address, city, state, store_type, sourced_at, status')
        .eq('sourced_by_ambassador_id', ambassadorId!)
        .is('deleted_at', null)
        .order('sourced_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!myStores || myStores.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Store className="h-4 w-4" />
            <BilingualLabel tKey="amb.dashboard.my_stores" en="My Stores" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("amb.dashboard.my_stores_empty")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Store className="h-4 w-4" />
          <BilingualLabel tKey="amb.dashboard.my_stores" en="My Stores" />
          <Badge variant="secondary" className="ml-1">{myStores.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-72">
          <div className="space-y-2">
            {myStores.map((store: any) => (
              <button
                key={store.id}
                onClick={() => navigate(`/ambassador/stores/${store.id}`)}
                className="w-full text-left flex items-start justify-between gap-3 p-3 rounded-lg border hover:border-primary/50 hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{store.store_name}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {[store.address, store.city, store.state].filter(Boolean).join(', ')}
                    </span>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">
                  {String(store.store_type || '').replace('_', ' ')}
                </Badge>
              </button>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}


function DashboardContent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { ambassador, stores, metrics, isLoading: portfolioLoading } = useAmbassadorPortfolio();
  // Real commission data from SQL views
  const { data: commissionTotals, isLoading: totalsLoading } = useCommissionTotals();
  const ambassadorId = useEffectiveAmbassadorId();
  const { data: recentLedger, isLoading: ledgerLoading } = useCommissionLedger({ limit: 5, ambassadorId });
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  
  // MASTER GENIUS ARCHITECT: Fetch lead counts by type for KPI cards
  // CRITICAL: Use 'assigned_to' column (created_by does NOT exist in sales_prospects)
  // Query key matches the hook invalidation key for instant refresh on lead create
  const { data: leadCounts, isLoading: leadsLoading } = useQuery({
    queryKey: ['ambassador-leads', user?.id], // SAME KEY as useAmbassadorLeads so invalidation works
    queryFn: async () => {
      if (!user?.id) return { store: 0, wholesaler: 0, influencer: 0, ambassador: 0 };
      
      // Canonical query: count by lead_type where ambassador is assigned AND not archived
      const { data, error } = await supabase
        .from('sales_prospects')
        .select('lead_type')
        .eq('assigned_to', user.id) // CORRECT COLUMN - matches useAmbassadorLeads hook
        .eq('archived', false);
      
      if (error) {
        console.error('Lead count fetch error:', error);
        return { store: 0, wholesaler: 0, influencer: 0, ambassador: 0 };
      }
      
      // Count by lead_type
      const counts = { store: 0, wholesaler: 0, influencer: 0, ambassador: 0 };
      (data || []).forEach((row) => {
        const lt = row.lead_type as LeadType;
        if (lt && lt in counts) {
          counts[lt]++;
        }
      });
      
      
      return counts;
    },
    enabled: !!user?.id,
  });
  
  const isLoading = portfolioLoading || totalsLoading || ledgerLoading || leadsLoading;

  const handleStoreClick = (storeId: string) => {
    navigate(`/ambassador/stores/${storeId}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  // Separate stores by type
  const assignedStores = stores.filter(s => s.assignment_type === 'assigned');
  const sourcedStores = stores.filter(s => s.assignment_type === 'sourced');

  // Real commission totals from SQL view
  const pendingTotal = Number(commissionTotals?.pending_total || 0);
  const approvedTotal = Number(commissionTotals?.approved_total || 0);
  const paidTotal = Number(commissionTotals?.paid_total || 0);
  const lifetimeTotal = Number(commissionTotals?.lifetime_total || 0);

  return (
    <div className="space-y-6">
      {/* Scope Banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center gap-3">
        <MapPin className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-medium"><BilingualLabel tKey="amb.dashboard.your_portfolio" en="Your Portfolio" /></p>
          <p className="text-xs text-muted-foreground">
            {t("amb.dashboard.viewing_portfolio", { total: metrics.totalStores, assigned: metrics.assignedStores, sourced: metrics.sourcedStores })}
          </p>
        </div>
      </div>

      {/* Live navigation to next store (Waze-style, live traffic) */}
      <NextStopNavigator role="ambassador" />

      {/* Portfolio map — RLS-scoped to this ambassador's stores */}
      <AmbassadorStoreMap />

      {/* My Captured Stores - portfolio of stores ambassador captured */}
      <MyCapturedStores />

      {/* MASTER GENIUS ARCHITECT: Lead KPI Cards - ALWAYS render, never conditional */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(Object.keys(LEAD_KPI_CONFIG) as LeadType[]).map((leadType) => {
          const config = LEAD_KPI_CONFIG[leadType];
          // CRITICAL: typeof check ensures we render even when count is 0
          const rawCount = leadCounts?.[leadType];
          const count = typeof rawCount === 'number' ? rawCount : 0;
          const Icon = config.icon;
          
          return (
            <Card 
              key={leadType}
              className={`${config.bgClass} ${config.borderClass} border hover:scale-[1.02] transition-transform cursor-pointer`}
              onClick={() => navigate('/ambassador/leads')}
            >
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${config.bgClass}`}>
                    <Icon className={`h-5 w-5 ${config.iconClass}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground"><BilingualLabel tKey={config.tKey} en={config.label} /></p>
                    <p className="text-2xl font-bold font-mono">{count}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Portfolio KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <CommandCenterKPI
          label={t("amb.kpi.total_stores")}
          value={metrics.totalStores}
          icon={Store}
          variant="cyan"
          isActive={selectedKpi === 'stores'}
          onClick={() => setSelectedKpi(selectedKpi === 'stores' ? null : 'stores')}
        />
        <CommandCenterKPI
          label={t("amb.kpi.total_commission")}
          value={`$${lifetimeTotal.toFixed(2)}`}
          icon={DollarSign}
          trend={pendingTotal > 0 ? `$${pendingTotal.toFixed(2)} pending` : undefined}
          variant="green"
          isActive={selectedKpi === 'commissions'}
          onClick={() => setSelectedKpi(selectedKpi === 'commissions' ? null : 'commissions')}
        />
        <CommandCenterKPI
          label={t("amb.kpi.approved")}
          value={`$${approvedTotal.toFixed(2)}`}
          icon={TrendingUp}
          variant="purple"
        />
        <CommandCenterKPI
          label={t("amb.kpi.total_orders")}
          value={metrics.totalOrders}
          icon={Package}
          variant="amber"
        />
        <CommandCenterKPI
          label={t("amb.kpi.revenue")}
          value={`$${metrics.totalRevenue.toFixed(2)}`}
          icon={BarChart3}
          variant="cyan"
          onClick={() => navigate('/ambassador/profit')}
        />
      </div>

      {/* MASTER GENIUS ARCHITECT: Unified Portfolio Section */}
      {/* Shows all managed contacts: Stores, Wholesalers, Ambassadors, Influencers */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <PortfolioSection />
        </div>
        <div className="space-y-6">
          <InviteAmbassadorCard />
          <ReferralLinkCard />
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Purchases Card */}
        <DashboardPurchasesCard />

        {/* Recent Commissions */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  <BilingualLabel tKey="amb.dashboard.recent_commissions" en="Recent Commissions" />
                </CardTitle>
                <CardDescription>{t("amb.dashboard.latest_earnings")}</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/ambassador/commissions')}>
                {t("amb.dashboard.view_all")}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[320px] pr-4">
              {(!recentLedger || recentLedger.length === 0) ? (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>{t("amb.dashboard.no_commissions")}</p>
                  <p className="text-sm">{t("amb.dashboard.start_acquiring")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentLedger.map((entry) => (
                    <div 
                      key={entry.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border"
                    >
                      <div>
                        <p className="font-medium text-sm">{entry.store_name || entry.source_channel}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(entry.earned_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${Number(entry.commission_amount) >= 0 ? 'text-primary' : 'text-red-500'}`}>
                          {Number(entry.commission_amount) >= 0 ? '+' : ''}${Number(entry.commission_amount).toFixed(2)}
                        </p>
                        <Badge variant={entry.status === 'paid' ? 'default' : 'secondary'} className="text-xs">
                          {entry.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle><BilingualLabel tKey="amb.dashboard.quick_actions" en="Quick Actions" /></CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
            <Button 
              className="h-auto py-4 flex-col gap-2" 
              onClick={() => navigate('/ambassador/stores')}
            >
              <Store className="h-5 w-5" />
              <span>{t("amb.quick.view_stores")}</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigate('/ambassador/orders?action=create')}
            >
              <Package className="h-5 w-5" />
              <span>{t("amb.quick.create_order")}</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigate('/ambassador/purchases')}
            >
              <ShoppingCart className="h-5 w-5" />
              <span>{t("amb.quick.my_purchases")}</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col gap-2 border-green-500/30 hover:bg-green-500/5"
              onClick={() => navigate('/ambassador/profit')}
            >
              <TrendingUp className="h-5 w-5 text-green-500" />
              <span>{t("amb.quick.my_profits")}</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigate('/ambassador/commissions')}
            >
              <DollarSign className="h-5 w-5" />
              <span>{t("amb.quick.commissions")}</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigate('/ambassador/routes')}
            >
              <MapPin className="h-5 w-5" />
              <span>{t("amb.quick.plan_route")}</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigate('/ambassador/leads')}
            >
              <Plus className="h-5 w-5" />
              <span>{t("amb.quick.add_lead")}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Store Capture FAB */}
      <Sheet open={captureOpen} onOpenChange={setCaptureOpen}>
        <SheetTrigger asChild>
          <Button
            className="fixed bottom-6 right-6 h-14 rounded-full shadow-lg gap-2 z-50"
          >
            <Camera className="h-5 w-5" />
            <span className="hidden sm:inline"><BilingualLabel tKey="amb.dashboard.capture_new_store" en="Capture New Store" inline /></span>
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[90vh] sm:h-auto sm:max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle><BilingualLabel tKey="amb.dashboard.capture_new_store" en="Capture New Store" /></SheetTitle>
            <SheetDescription>{t("amb.dashboard.capture_new_store_desc")}</SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <StoreCaptureForm
              onCaptured={() => setCaptureOpen(false)}
              onCancel={() => setCaptureOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// UI Version for debugging - change key to force re-mount
const AMBASSADOR_UI_VERSION = 'ambassador-ui-v3';

export default function AmbassadorDashboard() {
  const { t } = useTranslation();
  return (
    <PortalRBACGate allowedRoles={['ambassador', 'admin']} portalName="Ambassador Portal" key={AMBASSADOR_UI_VERSION}>
      <AmbassadorLayout 
        title={t("amb.dashboard.title")} 
        subtitle={t("amb.dashboard.subtitle")}
        portalIcon={<Users className="h-4 w-4 text-primary-foreground" />}
      >
        {/* Debug version stamp - visible in dev */}
        {import.meta.env.DEV && (
          <div className="fixed bottom-4 right-4 z-50 bg-primary/10 text-primary text-xs px-2 py-1 rounded border border-primary/20">
            {AMBASSADOR_UI_VERSION}
          </div>
        )}
        <DashboardContent />
      </AmbassadorLayout>
    </PortalRBACGate>
  );
}
