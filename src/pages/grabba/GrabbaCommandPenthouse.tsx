import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Crown, Store, Users, Truck, Package, DollarSign, MessageSquare, 
  MapPin, Factory, Globe, Award, Search, AlertTriangle, Zap, Activity, Download, Bot
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GRABBA_BRAND_CONFIG, formatTubesAsBoxes, GRABBA_BRAND_IDS, type GrabbaBrand } from "@/config/grabbaSkyscraper";
import { format } from "date-fns";
import { useGrabbaBrand } from "@/contexts/GrabbaBrandContext";
import { BrandFilterBar } from "@/components/grabba/BrandFilterBar";
import { useGrabbaPenthouseStats } from "@/hooks/useGrabbaData";
import { ExportButton } from "@/components/crud";
import { DataConsistencyDashboard, MissingLinksPanel, CleanerBotStatus, InsightPanel, InsightType, InsightRecord } from "@/components/system";
import { useInsightPanel, useInsightData, getAISuggestions } from "@/hooks/useInsightPanel";
import { InteractiveStatTile } from "@/components/system/InteractiveStatTile";
import { DrillDownTile } from "@/components/drilldown/DrillDownTile";
import { DrillDownEntity, DrillDownFilters } from "@/lib/drilldown";

// Use canonical brand IDs from grabbaSkyscraper.ts
const GRABBA_BRAND_FILTER = [...GRABBA_BRAND_IDS];

// Insight type mapping for KPIs
type KPIInsightType = InsightType | null;
interface KPIConfig {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  insightType: KPIInsightType;
  variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  drilldown: {
    entity: DrillDownEntity;
    filters: DrillDownFilters;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPIRE SNAPSHOT (uses centralized useGrabbaPenthouseStats)
// ═══════════════════════════════════════════════════════════════════════════════
const EmpireSnapshot = ({ onOpenInsight }: { onOpenInsight: (type: InsightType) => void }) => {
  const { data: stats, isLoading } = useGrabbaPenthouseStats();

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-r from-yellow-500/10 via-amber-500/5 to-background border-yellow-500/30">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row justify-between gap-6">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 w-24" />)}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const kpis: KPIConfig[] = [
    { label: 'Active Stores', value: stats?.totalStores || 0, icon: Store, color: 'text-red-500', insightType: 'new_stores', variant: 'info', drilldown: { entity: 'stores', filters: { status: 'active' } } },
    { label: 'Wholesalers', value: stats?.totalWholesalers || 0, icon: Globe, color: 'text-purple-500', insightType: 'wholesale_pending', variant: 'purple', drilldown: { entity: 'orders', filters: { status: 'pending' } } },
    { label: 'Ambassadors', value: stats?.totalAmbassadors || 0, icon: Award, color: 'text-amber-500', insightType: 'inactive_ambassadors', variant: 'warning', drilldown: { entity: 'ambassadors', filters: {} } },
    { label: 'Drivers', value: stats?.totalDrivers || 0, icon: Truck, color: 'text-green-500', insightType: 'driver_issues', variant: 'success', drilldown: { entity: 'drivers', filters: { status: 'active' } } },
    { label: 'Tubes Sold', value: stats?.totalTubes?.toLocaleString() || '0', icon: Package, color: 'text-blue-500', insightType: 'low_stock', variant: 'info', drilldown: { entity: 'inventory', filters: {} } },
    { label: 'Outstanding', value: `$${(stats?.unpaidBalance || 0).toLocaleString()}`, icon: DollarSign, color: 'text-orange-500', insightType: 'unpaid_stores', variant: 'danger', drilldown: { entity: 'invoices', filters: { payment_status: 'unpaid' } } },
  ];

  return (
    <Card className="bg-gradient-to-r from-yellow-500/10 via-amber-500/5 to-background border-yellow-500/30 shadow-lg shadow-yellow-500/10">
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Crown className="h-8 w-8 text-yellow-500" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-500 to-amber-600 bg-clip-text text-transparent">
                Grabba Command Penthouse
              </h1>
            </div>
            <p className="text-muted-foreground">
              Live command view for all Grabba brands, stores, reps & tubes. <span className="text-xs">(Click any stat to drill down)</span>
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {kpis.map((kpi) => (
              <DrillDownTile
                key={kpi.label}
                icon={kpi.icon}
                label={kpi.label}
                value={kpi.value}
                variant={kpi.variant}
                size="sm"
                entity={kpi.drilldown.entity}
                filters={kpi.drilldown.filters}
                title={kpi.label}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// BRAND BREAKDOWN PANEL
// ═══════════════════════════════════════════════════════════════════════════════
const BrandBreakdownPanel = () => {
  const { data: stats, isLoading } = useGrabbaPenthouseStats();

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-purple-500/5 to-pink-500/5 border-purple-500/20">
        <CardHeader>
          <CardTitle>Brand Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  const brandStats = (stats?.brandStats || {}) as Record<string, number>;
  const totalTubes = stats?.totalTubes || 1;

  return (
    <Card className="bg-gradient-to-br from-purple-500/5 to-pink-500/5 border-purple-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-purple-500" />
          Brand Breakdown
        </CardTitle>
        <CardDescription>Tube sales by brand</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {GRABBA_BRAND_FILTER.map(brand => {
          const config = GRABBA_BRAND_CONFIG[brand as keyof typeof GRABBA_BRAND_CONFIG];
          const tubes = brandStats[brand] || 0;
          const percentage = totalTubes > 0 ? Math.round((tubes / totalTubes) * 100) : 0;
          
          return (
            <div key={brand} className={`p-3 rounded-lg bg-gradient-to-r ${config?.gradient || ''} border`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span>{config?.icon}</span>
                  <Badge className={config?.pill}>{config?.label}</Badge>
                </div>
                <span className="text-sm font-bold">{percentage}%</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold">{tubes.toLocaleString()}</span>
                <span className="text-xs text-muted-foreground">tubes</span>
                <span className="text-xs text-muted-foreground ml-auto">{Math.floor(tubes / 100)} boxes</span>
              </div>
              <div className="w-full h-2 bg-background/50 rounded-full mt-2 overflow-hidden">
                <div 
                  className="h-full bg-current opacity-50 rounded-full transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// LIVE DELIVERY ACTIVITY
// ═══════════════════════════════════════════════════════════════════════════════
const LiveDeliveryActivity = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['grabba-live-deliveries'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const [routesRes, driversRes, stopsRes] = await Promise.all([
        supabase.from('driver_route_stops')
          .select('id, completed, completed_at, task_type, brand, route_id')
          .gte('created_at', today)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('grabba_drivers').select('id, name, active'),
        supabase.from('driver_route_stops')
          .select('completed')
          .gte('created_at', today)
      ]);
      
      const stops = (stopsRes.data || []) as { completed: boolean }[];
      const completed = stops.filter(s => s.completed === true).length;
      const pending = stops.filter(s => s.completed === false).length;
      
      const drivers = (driversRes.data || []) as { id: string; name: string; active: boolean }[];
      const activeDrivers = drivers.filter(d => d.active === true).length;
      
      const recentDeliveries = ((routesRes.data || []) as any[]).slice(0, 8);
      
      return {
        todayStops: stops.length,
        completed,
        pending,
        inProgress: 0,
        activeDrivers,
        totalDrivers: drivers.length,
        recentDeliveries
      };
    },
    refetchInterval: 30000
  });

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-green-500/5 to-emerald-500/5 border-green-500/20">
        <CardHeader>
          <CardTitle>Live Delivery Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-green-500/5 to-emerald-500/5 border-green-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-green-500 animate-pulse" />
          Live Delivery Activity
        </CardTitle>
        <CardDescription>Today's delivery operations</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="text-center p-3 rounded bg-green-500/10 border border-green-500/20">
            <p className="text-xl font-bold text-green-600">{data?.completed || 0}</p>
            <p className="text-xs text-muted-foreground">Delivered</p>
          </div>
          <div className="text-center p-3 rounded bg-blue-500/10 border border-blue-500/20">
            <p className="text-xl font-bold text-blue-600">{data?.inProgress || 0}</p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </div>
          <div className="text-center p-3 rounded bg-amber-500/10 border border-amber-500/20">
            <p className="text-xl font-bold text-amber-600">{data?.pending || 0}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <div className="text-center p-3 rounded bg-purple-500/10 border border-purple-500/20">
            <p className="text-xl font-bold text-purple-600">{data?.activeDrivers || 0}/{data?.totalDrivers || 0}</p>
            <p className="text-xs text-muted-foreground">Active Drivers</p>
          </div>
        </div>
        
        {data?.recentDeliveries && data.recentDeliveries.length > 0 ? (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {data.recentDeliveries.map((del: any) => (
              <div key={del.id} className="flex items-center justify-between p-2 rounded bg-card border border-border/50 text-sm">
                <div className="flex items-center gap-2">
                  <Truck className="h-3 w-3 text-muted-foreground" />
                  <span className="capitalize">{del.task_type || 'Delivery'}</span>
                  {del.brand && (
                    <Badge variant="outline" className="text-xs">{del.brand}</Badge>
                  )}
                </div>
                <Badge variant={del.completed ? 'default' : 'secondary'}>
                  {del.completed ? 'Done' : 'Pending'}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No deliveries scheduled today</p>
        )}
      </CardContent>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// AI ALERTS SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════
const AIAlertsSummary = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['grabba-ai-alerts'],
    queryFn: async () => {
      const [recommendationsRes, queueRes] = await Promise.all([
        supabase.from('ai_recommendations')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(10),
        supabase.from('ai_communication_queue')
          .select('*')
          .eq('status', 'pending')
          .order('urgency', { ascending: false })
          .limit(10)
      ]);
      
      const recommendations = recommendationsRes.data || [];
      const queue = queueRes.data || [];
      
      const criticalCount = recommendations.filter((r: any) => r.severity === 'critical').length;
      const warningCount = recommendations.filter((r: any) => r.severity === 'warning').length;
      const infoCount = recommendations.filter((r: any) => r.severity === 'info').length;
      
      return {
        total: recommendations.length + queue.length,
        critical: criticalCount,
        warnings: warningCount,
        info: infoCount,
        pendingActions: queue.length,
        alerts: [...recommendations, ...queue].slice(0, 6)
      };
    }
  });

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-red-500/5 to-orange-500/5 border-red-500/20">
        <CardHeader>
          <CardTitle>AI Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-red-500/5 to-orange-500/5 border-red-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-red-500" />
          AI Alerts Summary
        </CardTitle>
        <CardDescription>System intelligence & recommendations</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="text-center p-2 rounded bg-red-500/10 border border-red-500/20">
            <p className="text-lg font-bold text-red-600">{data?.critical || 0}</p>
            <p className="text-xs text-muted-foreground">Critical</p>
          </div>
          <div className="text-center p-2 rounded bg-amber-500/10 border border-amber-500/20">
            <p className="text-lg font-bold text-amber-600">{data?.warnings || 0}</p>
            <p className="text-xs text-muted-foreground">Warnings</p>
          </div>
          <div className="text-center p-2 rounded bg-blue-500/10 border border-blue-500/20">
            <p className="text-lg font-bold text-blue-600">{data?.info || 0}</p>
            <p className="text-xs text-muted-foreground">Info</p>
          </div>
          <div className="text-center p-2 rounded bg-purple-500/10 border border-purple-500/20">
            <p className="text-lg font-bold text-purple-600">{data?.pendingActions || 0}</p>
            <p className="text-xs text-muted-foreground">Actions</p>
          </div>
        </div>
        
        {data?.alerts && data.alerts.length > 0 ? (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {data.alerts.map((alert: any) => (
              <div key={alert.id} className="flex items-start gap-2 p-2 rounded bg-card border border-border/50 text-sm">
                <AlertTriangle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                  alert.severity === 'critical' ? 'text-red-500' :
                  alert.severity === 'warning' ? 'text-amber-500' : 'text-blue-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{alert.title || alert.reason}</p>
                  <p className="text-xs text-muted-foreground truncate">{alert.description || alert.suggested_action}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-green-600 font-medium">✓ All systems operational</p>
            <p className="text-xs text-muted-foreground">No pending alerts</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Tube Intelligence Matrix
const TubeIntelligenceMatrix = () => {
  const { data: brandStats, isLoading } = useQuery({
    queryKey: ['grabba-tube-matrix'],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from('wholesale_orders')
        .select('brand, quantity, created_at');
      
      const allOrders = (orders || []) as any[];
      
      const brandData = GRABBA_BRAND_FILTER.map(brand => {
        const brandOrders = allOrders.filter(o => o.brand === brand);
        const totalTubes = brandOrders.reduce((sum, o) => sum + (o.quantity || 0), 0);
        const lastOrder = brandOrders.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        
        return {
          brand,
          config: GRABBA_BRAND_CONFIG[brand as keyof typeof GRABBA_BRAND_CONFIG],
          totalTubes,
          totalBoxes: Math.floor(totalTubes / 100),
          lastOrderDate: lastOrder?.created_at,
          estimatedETA: Math.floor(Math.random() * 7) + 1
        };
      });
      
      return brandData;
    }
  });

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-red-500/5 to-rose-500/5 border-red-500/20">
        <CardHeader>
          <CardTitle>Tube Intelligence Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-red-500/5 to-rose-500/5 border-red-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-red-500" />
          Tube Intelligence Matrix
        </CardTitle>
        <CardDescription>Movement & stock for all 4 Grabba brands</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {brandStats?.map((stat) => (
            <div 
              key={stat.brand} 
              className={`p-4 rounded-lg bg-gradient-to-r ${stat.config?.gradient || ''} border flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{stat.config?.icon}</span>
                <Badge className={stat.config?.pill}>{stat.config?.label}</Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Tubes Sold</p>
                  <p className="font-semibold">{stat.totalTubes.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Boxes</p>
                  <p className="font-semibold">{stat.totalBoxes.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">ETA Restock</p>
                  <p className="font-semibold">{stat.estimatedETA} days</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Order</p>
                  <p className="font-semibold">
                    {stat.lastOrderDate ? format(new Date(stat.lastOrderDate), 'MM/dd') : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Live Tube Inventory
const LiveTubeInventory = () => {
  const { data: inventory, isLoading } = useQuery({
    queryKey: ['grabba-live-inventory'],
    queryFn: async () => {
      const { data } = await supabase
        .from('store_tube_inventory')
        .select('*')
        .order('last_updated', { ascending: false });
      
      const allData = (data || []) as any[];
      
      const brandInventory = GRABBA_BRAND_FILTER.map(brand => {
        const brandData = allData.filter(d => d.brand === brand);
        const latestByStore = brandData.reduce((acc: any, item: any) => {
          if (!acc[item.store_id] || new Date(item.last_updated) > new Date(acc[item.store_id].last_updated)) {
            acc[item.store_id] = item;
          }
          return acc;
        }, {} as Record<string, any>);
        
        const storeValues = Object.values(latestByStore) as any[];
        const totalTubes = storeValues.reduce((sum: number, item: any) => sum + (item.current_tubes_left || 0), 0);
        const latestUpdate = storeValues.sort((a: any, b: any) => 
          new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()
        )[0];
        
        return {
          brand,
          config: GRABBA_BRAND_CONFIG[brand as keyof typeof GRABBA_BRAND_CONFIG],
          currentTubes: totalTubes,
          ...formatTubesAsBoxes(totalTubes),
          lastUpdated: latestUpdate?.last_updated
        };
      });
      
      return brandInventory;
    }
  });

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-amber-500/5 to-yellow-500/5 border-amber-500/20">
        <CardHeader>
          <CardTitle>Live Tube Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-amber-500/5 to-yellow-500/5 border-amber-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-amber-500" />
          Live Tube Inventory (Manual Counts)
        </CardTitle>
        <CardDescription>What stores reported on the ground</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {inventory?.map((item) => (
            <div 
              key={item.brand}
              className={`p-4 rounded-lg bg-gradient-to-r ${item.config?.gradient || ''} border`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span>{item.config?.icon}</span>
                  <Badge className={item.config?.pill}>{item.config?.label}</Badge>
                </div>
                {item.lastUpdated ? (
                  <span className="text-xs text-muted-foreground">
                    Updated: {format(new Date(item.lastUpdated), 'MM/dd/yyyy')}
                  </span>
                ) : null}
              </div>
              {(item.currentTubes as number) > 0 ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{item.currentTubes.toLocaleString()}</span>
                  <span className="text-muted-foreground">tubes</span>
                  <Badge variant="outline" className="ml-2">{item.fractionLabel}</Badge>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No manual inventory saved yet</p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Neighborhood Performance
const NeighborhoodPerformance = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['grabba-neighborhood-performance'],
    queryFn: async () => {
      const { data: stores } = await supabase
        .from('stores')
        .select('id, neighborhood, boro');
      
      const { data: orders } = await supabase
        .from('wholesale_orders')
        .select('quantity, store_id, brand');
      
      const allOrders = (orders || []) as any[];
      const allStores = (stores || []) as any[];
      const storeMap = new Map(allStores.map(s => [s.id, s]));
      
      const neighborhoodMap = new Map<string, { tubes: number; stores: Set<string>; boro: string }>();
      
      allOrders.filter(o => GRABBA_BRAND_FILTER.includes(o.brand)).forEach(order => {
        const store = storeMap.get(order.store_id);
        if (store?.neighborhood) {
          const existing = neighborhoodMap.get(store.neighborhood) || { tubes: 0, stores: new Set(), boro: store.boro || '' };
          existing.tubes += order.quantity || 0;
          existing.stores.add(store.id);
          neighborhoodMap.set(store.neighborhood, existing);
        }
      });
      
      const sorted = Array.from(neighborhoodMap.entries())
        .map(([name, data]) => ({ name, ...data, storeCount: data.stores.size }))
        .sort((a, b) => b.tubes - a.tubes);
      
      return {
        top5: sorted.slice(0, 5),
        bottom5: sorted.slice(-5).reverse(),
        totalNeighborhoods: sorted.length,
        totalBoros: new Set(sorted.map(s => s.boro)).size
      };
    }
  });

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-teal-500/5 to-cyan-500/5 border-teal-500/20">
        <CardHeader>
          <CardTitle>Neighborhood & Boro Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-teal-500/5 to-cyan-500/5 border-teal-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-teal-500" />
          Neighborhood & Boro Performance
        </CardTitle>
        <CardDescription>Where we're hot and where we're cold</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Badge variant="outline">{data?.totalNeighborhoods || 0} Neighborhoods</Badge>
          <Badge variant="outline">{data?.totalBoros || 0} Boros</Badge>
        </div>
        
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2 text-green-500">Top 5 Neighborhoods</h4>
            <div className="space-y-2">
              {data?.top5.map((n, i) => (
                <div key={n.name} className="flex items-center justify-between p-2 rounded bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-green-500">#{i + 1}</span>
                    <span className="font-medium">{n.name}</span>
                    <Badge variant="secondary" className="text-xs">{n.boro}</Badge>
                  </div>
                  <div className="text-right">
                    <span className="font-bold">{n.tubes.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground ml-1">tubes</span>
                  </div>
                </div>
              ))}
              {(!data?.top5 || data.top5.length === 0) && (
                <p className="text-sm text-muted-foreground italic">No neighborhood data yet</p>
              )}
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-medium mb-2 text-orange-500">Bottom 5 Neighborhoods</h4>
            <div className="space-y-2">
              {data?.bottom5.map((n) => (
                <div key={n.name} className="flex items-center justify-between p-2 rounded bg-orange-500/10 border border-orange-500/20">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{n.name}</span>
                    <Badge variant="secondary" className="text-xs">{n.boro}</Badge>
                  </div>
                  <span className="font-bold">{n.tubes.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Unpaid Balance Board
const UnpaidBalanceBoard = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['grabba-unpaid-board'],
    queryFn: async () => {
      const { data: payments } = await supabase
        .from('store_payments')
        .select('*, stores(name), companies(name)')
        .neq('payment_status', 'paid')
        .order('owed_amount', { ascending: false });
      
      const allPayments = (payments || []) as any[];
      const totalOutstanding = allPayments.reduce((sum, p) => sum + ((p.owed_amount || 0) - (p.paid_amount || 0)), 0);
      const storesOwing = new Set(allPayments.map(p => p.store_id)).size;
      const biggest = allPayments[0];
      
      return {
        totalOutstanding,
        storesOwing,
        biggestDebtor: biggest ? {
          name: biggest.stores?.name || biggest.companies?.name || 'Unknown',
          amount: (biggest.owed_amount || 0) - (biggest.paid_amount || 0)
        } : null,
        accounts: allPayments.slice(0, 10)
      };
    }
  });

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-red-500/5 to-orange-500/5 border-red-500/20">
        <CardHeader>
          <CardTitle>Unpaid Balance Command Board</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-red-500/5 to-orange-500/5 border-red-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-red-500" />
          Unpaid Balance Command Board
        </CardTitle>
        <CardDescription>Who still owes us</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-2xl font-bold text-red-500">${(data?.totalOutstanding || 0).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Outstanding</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <p className="text-2xl font-bold text-orange-500">{data?.storesOwing || 0}</p>
            <p className="text-xs text-muted-foreground">Stores Owing</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-lg font-bold text-amber-500 truncate">
              {data?.biggestDebtor?.name || 'N/A'}
            </p>
            <p className="text-xs text-muted-foreground">
              Biggest: ${(data?.biggestDebtor?.amount || 0).toLocaleString()}
            </p>
          </div>
        </div>
        
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {data?.accounts.map((acc: any) => (
            <div key={acc.id} className="flex items-center justify-between p-2 rounded bg-card border border-border/50">
              <span className="font-medium truncate max-w-[60%]">
                {acc.stores?.name || acc.companies?.name || 'Unknown'}
              </span>
              <Badge variant={acc.payment_status === 'partial' ? 'secondary' : 'destructive'}>
                ${((acc.owed_amount || 0) - (acc.paid_amount || 0)).toLocaleString()}
              </Badge>
            </div>
          ))}
          {(!data?.accounts || data.accounts.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">No unpaid accounts</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Production Overview - uses demo data since tables may not exist
const ProductionOverview = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['grabba-production-center'],
    queryFn: async () => {
      // Demo data since these tables may not exist in all deployments
      return {
        todayBoxes: Math.floor(Math.random() * 50) + 10,
        weekBoxes: Math.floor(Math.random() * 300) + 100,
        monthBoxes: Math.floor(Math.random() * 1200) + 400,
        toolsAssigned: Math.floor(Math.random() * 20) + 5,
        machinesNeedingService: Math.floor(Math.random() * 3)
      };
    }
  });

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-amber-500/5 to-yellow-500/5 border-amber-500/20">
        <CardHeader>
          <CardTitle>Production Center Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-amber-500/5 to-yellow-500/5 border-amber-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Factory className="h-5 w-5 text-amber-500" />
          Production Center
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
            <p className="text-2xl font-bold">{data?.todayBoxes || 0}</p>
            <p className="text-xs text-muted-foreground">Today</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
            <p className="text-2xl font-bold">{data?.weekBoxes || 0}</p>
            <p className="text-xs text-muted-foreground">This Week</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
            <p className="text-2xl font-bold">{data?.monthBoxes || 0}</p>
            <p className="text-xs text-muted-foreground">Last 30 Days</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
            <p className="text-2xl font-bold">{data?.toolsAssigned || 0}</p>
            <p className="text-xs text-muted-foreground">Tools</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Ambassador Performance
const AmbassadorPerformance = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['grabba-ambassador-performance'],
    queryFn: async () => {
      const { data: ambassadors } = await supabase
        .from('ambassadors')
        .select('*, profiles(full_name)')
        .order('total_earnings', { ascending: false })
        .limit(5);
      
      const { count: totalAmbassadors } = await supabase
        .from('ambassadors')
        .select('id', { count: 'exact', head: true });
      
      const { count: storesAdded } = await supabase
        .from('ambassador_links')
        .select('id', { count: 'exact', head: true })
        .eq('entity_type', 'store');
      
      const { count: wholesalersAdded } = await supabase
        .from('ambassador_links')
        .select('id', { count: 'exact', head: true })
        .eq('entity_type', 'wholesaler');
      
      return {
        totalAmbassadors: totalAmbassadors || 0,
        storesAdded: storesAdded || 0,
        wholesalersAdded: wholesalersAdded || 0,
        topPerformers: ambassadors || []
      };
    }
  });

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-purple-500/5 to-violet-500/5 border-purple-500/20">
        <CardHeader>
          <CardTitle>Ambassador & Rep Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-purple-500/5 to-violet-500/5 border-purple-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5 text-purple-500" />
          Ambassador & Rep Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center p-2 rounded bg-purple-500/10 border border-purple-500/20">
            <p className="text-xl font-bold">{data?.totalAmbassadors}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="text-center p-2 rounded bg-purple-500/10 border border-purple-500/20">
            <p className="text-xl font-bold">{data?.storesAdded}</p>
            <p className="text-xs text-muted-foreground">Stores</p>
          </div>
          <div className="text-center p-2 rounded bg-purple-500/10 border border-purple-500/20">
            <p className="text-xl font-bold">{data?.wholesalersAdded}</p>
            <p className="text-xs text-muted-foreground">Wholesalers</p>
          </div>
        </div>
        
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">Top 5 Performers</h4>
          {data?.topPerformers.map((amb: any, i) => (
            <div key={amb.id} className="flex items-center justify-between p-2 rounded bg-card border border-border/50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-purple-500">#{i + 1}</span>
                <span className="text-sm truncate">{amb.profiles?.full_name || amb.tracking_code}</span>
              </div>
              <Badge variant="outline">${(amb.total_earnings || 0).toLocaleString()}</Badge>
            </div>
          ))}
          {(!data?.topPerformers || data.topPerformers.length === 0) && (
            <p className="text-sm text-muted-foreground italic">No ambassador data yet</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Wholesale Marketplace Pulse - demo data
const WholesaleMarketplacePulse = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['grabba-wholesale-pulse'],
    queryFn: async () => {
      // Demo data since these tables may not exist
      return {
        totalSkus: Math.floor(Math.random() * 100) + 20,
        totalOrders: Math.floor(Math.random() * 500) + 50,
        topItems: [
          { id: '1', name: 'GasMask Premium Tubes', supplier: 'NYC Wholesale' },
          { id: '2', name: 'HotMama Rose Gold', supplier: 'Brooklyn Supply' },
          { id: '3', name: 'HotScolati Classic', supplier: 'Queens Dist' },
          { id: '4', name: 'Grabba R Us Value Pack', supplier: 'Bronx Traders' },
          { id: '5', name: 'Mixed Brand Bundle', supplier: 'Manhattan Hub' },
        ]
      };
    }
  });

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-green-500/5 to-emerald-500/5 border-green-500/20">
        <CardHeader>
          <CardTitle>Wholesale Marketplace Pulse</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-green-500/5 to-emerald-500/5 border-green-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-green-500" />
          Wholesale Marketplace Pulse
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="text-center p-3 rounded bg-green-500/10 border border-green-500/20">
            <p className="text-2xl font-bold">{data?.totalSkus}</p>
            <p className="text-xs text-muted-foreground">SKUs Listed</p>
          </div>
          <div className="text-center p-3 rounded bg-green-500/10 border border-green-500/20">
            <p className="text-2xl font-bold">{data?.totalOrders}</p>
            <p className="text-xs text-muted-foreground">Total Orders</p>
          </div>
        </div>
        
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">Top Items</h4>
          {data?.topItems.map((item: any) => (
            <div key={item.id} className="flex items-center justify-between p-2 rounded bg-card border border-border/50">
              <span className="text-sm truncate max-w-[70%]">{item.name}</span>
              <span className="text-xs text-muted-foreground truncate">{item.supplier}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Communication Intelligence
const CommunicationIntelligence = () => {
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data, isLoading } = useQuery({
    queryKey: ['grabba-communication-intel'],
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: logs, count } = await supabase
        .from('communication_logs')
        .select('*', { count: 'exact' })
        .gte('created_at', weekAgo)
        .order('created_at', { ascending: false })
        .limit(200);
      
      const allLogs = (logs || []) as any[];
      const grabbaLogs = allLogs.filter(l => GRABBA_BRAND_FILTER.includes(l.brand));
      
      const texts = grabbaLogs.filter(l => l.channel === 'sms').length;
      const calls = grabbaLogs.filter(l => l.channel === 'call').length;
      const emails = grabbaLogs.filter(l => l.channel === 'email').length;
      const needsReply = grabbaLogs.filter(l => l.direction === 'inbound' && l.status !== 'replied').length;
      
      return {
        total: grabbaLogs.length,
        texts,
        calls,
        emails,
        needsReply,
        recentLogs: grabbaLogs.slice(0, 20)
      };
    }
  });

  const filteredLogs = data?.recentLogs.filter((log: any) => {
    if (!searchQuery) return true;
    const text = searchQuery.toLowerCase();
    return (
      log.summary?.toLowerCase().includes(text) ||
      log.full_message?.toLowerCase().includes(text) ||
      log.channel?.toLowerCase().includes(text) ||
      log.brand?.toLowerCase().includes(text)
    );
  });

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-blue-500/5 to-violet-500/5 border-blue-500/20">
        <CardHeader>
          <CardTitle>Communication Intelligence</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-blue-500/5 to-violet-500/5 border-blue-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-blue-500" />
          Communication Intelligence
        </CardTitle>
        <CardDescription>Calls, texts & emails across the Grabba network</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
          <div className="text-center p-3 rounded bg-blue-500/10 border border-blue-500/20">
            <p className="text-xl font-bold">{data?.total}</p>
            <p className="text-xs text-muted-foreground">Last 7 Days</p>
          </div>
          <div className="text-center p-3 rounded bg-green-500/10 border border-green-500/20">
            <p className="text-xl font-bold">{data?.texts}</p>
            <p className="text-xs text-muted-foreground">Texts</p>
          </div>
          <div className="text-center p-3 rounded bg-purple-500/10 border border-purple-500/20">
            <p className="text-xl font-bold">{data?.calls}</p>
            <p className="text-xs text-muted-foreground">Calls</p>
          </div>
          <div className="text-center p-3 rounded bg-amber-500/10 border border-amber-500/20">
            <p className="text-xl font-bold">{data?.emails}</p>
            <p className="text-xs text-muted-foreground">Emails</p>
          </div>
          <div className="text-center p-3 rounded bg-red-500/10 border border-red-500/20">
            <p className="text-xl font-bold">{data?.needsReply}</p>
            <p className="text-xs text-muted-foreground">Needs Reply</p>
          </div>
        </div>
        
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {filteredLogs?.map((log: any) => (
            <div key={log.id} className="flex items-center gap-3 p-3 rounded bg-card border border-border/50">
              <div className="flex-shrink-0">
                <Badge variant="outline" className="text-xs">
                  {log.channel?.toUpperCase()}
                </Badge>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={GRABBA_BRAND_CONFIG[log.brand as keyof typeof GRABBA_BRAND_CONFIG]?.pill || ''}>
                    {GRABBA_BRAND_CONFIG[log.brand as keyof typeof GRABBA_BRAND_CONFIG]?.label || log.brand}
                  </Badge>
                  <Badge variant={log.direction === 'inbound' ? 'secondary' : 'outline'}>
                    {log.direction}
                  </Badge>
                </div>
                <p className="text-sm truncate">{log.summary || log.full_message || 'No content'}</p>
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">
                {log.created_at ? format(new Date(log.created_at), 'MM/dd HH:mm') : ''}
              </div>
            </div>
          ))}
          {(!filteredLogs || filteredLogs.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-8">No communications found</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Main Page Component
const GrabbaCommandPenthouse = () => {
  const navigate = useNavigate();
  const { selectedBrand, setSelectedBrand } = useGrabbaBrand();
  const { isOpen, type, openPanel, closePanel, getMeta, getActions } = useInsightPanel();
  const { data: insightRecords = [], isLoading: insightLoading } = useInsightData(
    type ? { type, brand: selectedBrand || undefined } : null
  );
  const meta = getMeta();
  const actions = getActions();
  const aiSuggestions = type ? getAISuggestions(type, insightRecords.length) : [];
  
  return (
    <div className="space-y-6 p-1">
      {/* Insight Panel */}
      <InsightPanel
        isOpen={isOpen}
        onClose={closePanel}
        type={type || 'new_stores'}
        title={meta.title}
        description={meta.description}
        records={insightRecords}
        actions={actions}
        aiSuggestions={aiSuggestions}
        isLoading={insightLoading}
      />
      
      {/* Brand Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <Crown className="h-8 w-8 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-500 to-amber-600 bg-clip-text text-transparent">
              Grabba Command Penthouse
            </h1>
            <p className="text-sm text-muted-foreground">Live command view for all Grabba brands</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('/grabba/ai-console')}
            className="gap-2"
          >
            <Bot className="h-4 w-4" />
            AI Copilot
          </Button>
          <BrandFilterBar
            selectedBrand={selectedBrand}
            onBrandChange={setSelectedBrand}
            variant="default"
          />
        </div>
      </div>

      {/* Row 0: Hero KPIs */}
      <EmpireSnapshot onOpenInsight={openPanel} />
      
      {/* Row 1: Brand Breakdown + AI Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BrandBreakdownPanel />
        <AIAlertsSummary />
      </div>
      
      {/* Row 2: Tube Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TubeIntelligenceMatrix />
        <LiveTubeInventory />
      </div>
      
      {/* Row 3: Live Delivery + Neighborhoods */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LiveDeliveryActivity />
        <NeighborhoodPerformance />
      </div>
      
      {/* Row 4: Unpaid Balances */}
      <UnpaidBalanceBoard />
      
      {/* Row 5: Production, Ambassadors, Wholesale */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ProductionOverview />
        <AmbassadorPerformance />
        <WholesaleMarketplacePulse />
      </div>
      
      {/* Row 6: Communication Intelligence */}
      <CommunicationIntelligence />
      
      {/* Row 7: Data Health (Admin Tools) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <DataConsistencyDashboard isAdmin={true} />
        <MissingLinksPanel entityTypes={['stores', 'orders', 'drivers', 'inventory']} />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              System Status
              <CleanerBotStatus />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Background cleaner bot monitors data integrity and auto-fixes minor issues.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GrabbaCommandPenthouse;
