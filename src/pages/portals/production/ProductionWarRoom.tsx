/**
 * Executive War Room Dashboard
 * 
 * Single-page consolidated production health view with four zones:
 * - Top KPI Bar (6 metrics)
 * - Left: Demand Risk
 * - Center: Production Health  
 * - Right: Procurement & Suppliers
 * - Alert Banner (critical alerts)
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProductionRBAC } from '@/hooks/useProductionRBAC';
import { AlertHistoryPanel } from '@/components/production/AlertHistoryPanel';
import { OverrideAuditPanel } from '@/components/production/OverrideAuditPanel';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ShieldAlert, Activity, TrendingUp, Package, Truck, AlertTriangle, BarChart3 } from 'lucide-react';
import { subDays, format } from 'date-fns';
import { Navigate } from 'react-router-dom';

export default function ProductionWarRoom() {
  const { tier, isLoading: rbacLoading } = useProductionRBAC();

  // ---- DATA QUERIES (must be before any early returns) ----

  // Coverage intelligence (demand risk)
  const { data: coverage = [] } = useQuery({
    queryKey: ['war-room-coverage'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_inventory_coverage_intelligence' as any)
        .select('*');
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  // Recent batches for yield trend
  const { data: recentBatches = [] } = useQuery({
    queryKey: ['war-room-batches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_batches')
        .select('id, brand, tobacco_lbs, boxes_produced, status, created_at, office_id')
        .in('status', ['completed', 'approved'])
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
  });

  // Override rate (30d)
  const { data: overrides30d = [] } = useQuery({
    queryKey: ['war-room-overrides'],
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();
      const { data, error } = await supabase
        .from('production_demand_overrides')
        .select('id, deviation_pct, created_at')
        .gte('created_at', since);
      if (error) throw error;
      return data || [];
    },
  });

  // Unresolved critical alerts
  const { data: criticalAlerts = [] } = useQuery({
    queryKey: ['war-room-critical-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_alerts' as any)
        .select('*')
        .eq('resolved', false)
        .eq('severity', 'critical');
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  // Conversion baseline
  const { data: baseline } = useQuery({
    queryKey: ['war-room-baseline'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_conversion_baseline' as any)
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  // ---- COMPUTED METRICS ----
  const totalDaysCoverage = coverage.length > 0
    ? Math.round(coverage.reduce((s: number, c: any) => s + (c.days_of_inventory_remaining || 0), 0) / coverage.length)
    : 0;

  const procurementNeeded = coverage.reduce((s: number, c: any) => s + (c.procurement_needed_lbs || 0), 0);

  const overrideRate = overrides30d.length;

  const riskScore = Math.min(100, 
    criticalAlerts.length * 20 + 
    coverage.filter((c: any) => c.risk_level === 'critical').length * 15 +
    coverage.filter((c: any) => c.risk_level === 'red').length * 8
  );

  // Yield trend data
  const yieldData = recentBatches
    .filter((b: any) => b.tobacco_lbs && b.tobacco_lbs > 0)
    .map((b: any) => ({
      date: format(new Date(b.created_at!), 'MM/dd'),
      yield: b.boxes_produced && b.tobacco_lbs ? Math.round((b.boxes_produced / b.tobacco_lbs) * 100) / 100 : 0,
    }))
    .reverse();

  // Office comparison
  const officeMap: Record<string, { totalBoxes: number; totalLbs: number }> = {};
  recentBatches.forEach((b: any) => {
    const oid = b.office_id || 'unknown';
    if (!officeMap[oid]) officeMap[oid] = { totalBoxes: 0, totalLbs: 0 };
    officeMap[oid].totalBoxes += b.boxes_produced || 0;
    officeMap[oid].totalLbs += b.tobacco_lbs || 0;
  });
  const officeData = Object.entries(officeMap).map(([office, v]) => ({
    office: office.substring(0, 8),
    ratio: v.totalLbs > 0 ? Math.round((v.totalBoxes / v.totalLbs) * 100) / 100 : 0,
  }));

  // Risk colors
  const riskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-destructive text-destructive-foreground';
      case 'red': return 'bg-red-500 text-white';
      case 'yellow': return 'bg-amber-500 text-white';
      case 'green': return 'bg-emerald-500 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (rbacLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;

  // Gate to admin only (after all hooks)
  if (tier !== 'admin') {
    return <Navigate to="/portals/production" replace />;
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* CRITICAL ALERT BANNER */}
      {criticalAlerts.length > 0 && (
        <div className="bg-destructive text-destructive-foreground px-4 py-3 rounded-lg flex items-center gap-3 animate-pulse">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-bold">{criticalAlerts.length} CRITICAL ALERT{criticalAlerts.length > 1 ? 'S' : ''} UNRESOLVED</span>
          <span className="text-sm opacity-90">
            — {criticalAlerts.map((a: any) => a.brand || a.alert_type).join(', ')}
          </span>
        </div>
      )}

      {/* TOP KPI BAR */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard label="Conversion Baseline" value={baseline?.boxes_per_lb ? `${baseline.boxes_per_lb} box/lb` : '—'} icon={<Activity className="h-4 w-4" />} />
        <KPICard label="Avg Days Coverage" value={`${totalDaysCoverage}d`} icon={<Package className="h-4 w-4" />} />
        <KPICard label="Risk Score" value={`${riskScore}/100`} icon={<ShieldAlert className="h-4 w-4" />} danger={riskScore > 50} />
        <KPICard label="Procurement Needed" value={`${Math.round(procurementNeeded)} lbs`} icon={<Truck className="h-4 w-4" />} />
        <KPICard label="Override Rate (30d)" value={`${overrideRate}`} icon={<AlertTriangle className="h-4 w-4" />} danger={overrideRate > 10} />
        <KPICard label="Active Batches" value={`${recentBatches.length}`} icon={<BarChart3 className="h-4 w-4" />} />
      </div>

      {/* THREE-PANEL LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT: Demand Risk */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Demand Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {coverage
                .sort((a: any, b: any) => {
                  const order: Record<string, number> = { critical: 0, red: 1, yellow: 2, green: 3 };
                  return (order[a.risk_level] ?? 4) - (order[b.risk_level] ?? 4);
                })
                .map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded border">
                    <div className="flex items-center gap-2">
                      <Badge className={riskColor(c.risk_level) + ' text-xs'}>{c.risk_level}</Badge>
                      <span className="font-medium text-sm">{c.brand}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{c.days_of_inventory_remaining ?? 0}d</span>
                      {c.demand_trend === 'accelerating' && <Badge variant="outline" className="text-xs text-amber-600">↑ Accel</Badge>}
                      {c.demand_trend === 'declining' && <Badge variant="outline" className="text-xs text-emerald-600">↓ Decl</Badge>}
                    </div>
                  </div>
                ))}
              {coverage.length === 0 && <p className="text-sm text-muted-foreground">No coverage data</p>}
            </div>
          </CardContent>
        </Card>

        {/* CENTER: Production Health */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" /> Production Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {yieldData.length > 1 && (
              <div>
                <h4 className="text-xs font-medium mb-1">30-Batch Yield Trend (boxes/lb)</h4>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={yieldData}>
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="yield" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {officeData.length > 0 && (
              <div>
                <h4 className="text-xs font-medium mb-1">Office Conversion Ratio</h4>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={officeData}>
                    <XAxis dataKey="office" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Bar dataKey="ratio" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* RIGHT: Procurement & Suppliers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-4 w-4" /> Procurement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {coverage
                .filter((c: any) => (c.procurement_needed_lbs || 0) > 0)
                .sort((a: any, b: any) => (b.procurement_needed_lbs || 0) - (a.procurement_needed_lbs || 0))
                .map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded border">
                    <span className="font-medium text-sm">{c.brand}</span>
                    <div className="text-right">
                      <p className="text-sm font-bold">{Math.round(c.procurement_needed_lbs)} lbs</p>
                      <p className="text-xs text-muted-foreground">
                        Raw: {Math.round(c.raw_inventory_lbs || 0)} lbs
                      </p>
                    </div>
                  </div>
                ))}
              {coverage.filter((c: any) => (c.procurement_needed_lbs || 0) > 0).length === 0 && (
                <p className="text-sm text-muted-foreground">No procurement needed</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* BOTTOM: Alerts + Override Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AlertHistoryPanel />
        <OverrideAuditPanel />
      </div>
    </div>
  );
}

function KPICard({ label, value, icon, danger }: { label: string; value: string; icon: React.ReactNode; danger?: boolean }) {
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">{icon}<span className="text-xs">{label}</span></div>
        <p className={`text-lg font-bold ${danger ? 'text-destructive' : ''}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
