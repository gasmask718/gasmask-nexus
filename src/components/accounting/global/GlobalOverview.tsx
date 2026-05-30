import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Globe, DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  Loader2, Building2, Wifi, WifiOff, Activity, Signal, Clock,
} from 'lucide-react';
import {
  useBusinessEntities,
  useFinancialSnapshots,
  getConnectionLabel,
  getConfidenceLabel,
  getReportingLabel,
  type BusinessEntity,
} from '@/hooks/useGlobalFinancialData';
import { format } from 'date-fns';

function connectionIcon(icon: string) {
  switch (icon) {
    case 'live': return <Wifi className="h-3 w-3 mr-1" />;
    case 'partial': return <Activity className="h-3 w-3 mr-1" />;
    case 'manual': return <Clock className="h-3 w-3 mr-1" />;
    case 'pending': return <Signal className="h-3 w-3 mr-1" />;
    default: return <WifiOff className="h-3 w-3 mr-1" />;
  }
}

function ConfidenceBar({ pct }: { pct: number }) {
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : pct > 0 ? 'bg-orange-500' : 'bg-muted';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground">{pct}%</span>
    </div>
  );
}

function DataSourceBadge({ entity }: { entity: BusinessEntity }) {
  const conf = getConfidenceLabel(entity.data_confidence_pct);
  return (
    <Badge className={`${conf.className} text-[10px]`}>{conf.label}</Badge>
  );
}

export default function GlobalOverview() {
  const { data: businesses, isLoading: bizLoading } = useBusinessEntities();
  const { data: snapshots, isLoading: snapLoading } = useFinancialSnapshots(1);

  if (bizLoading || snapLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const allBiz = businesses || [];
  const activeBiz = allBiz.filter(b => b.is_active);

  // Revenue/expense from snapshots (preferred), fallback to estimates
  const snapshotRevenue = (snapshots || []).reduce((s, sn) => s + sn.total_revenue, 0);
  const snapshotExpenses = (snapshots || []).reduce((s, sn) => s + sn.total_expenses, 0);

  const estimateRevenue = activeBiz.reduce((s, b) => s + b.monthly_revenue_estimate, 0);
  const estimateExpenses = activeBiz.reduce((s, b) => s + b.monthly_expense_estimate, 0);

  const totalRevenue = snapshotRevenue > 0 ? snapshotRevenue : estimateRevenue;
  const totalExpenses = snapshotExpenses > 0 ? snapshotExpenses : estimateExpenses;
  const netProfit = totalRevenue - totalExpenses;
  const dataFromSnapshots = snapshotRevenue > 0;

  const connected = activeBiz.filter(b => b.connection_status !== 'not_connected').length;
  const avgConfidence = activeBiz.length > 0
    ? Math.round(activeBiz.reduce((s, b) => s + b.data_confidence_pct, 0) / activeBiz.length)
    : 0;

  // Connection pipeline counts
  const liveCount = activeBiz.filter(b => b.connection_status === 'api_connected').length;
  const partialCount = activeBiz.filter(b => b.connection_status === 'partial').length;
  const manualCount = activeBiz.filter(b => b.connection_status === 'manual').length;
  const pendingCount = activeBiz.filter(b => b.connection_status === 'external_pending').length;
  const disconnectedCount = activeBiz.filter(b => b.connection_status === 'not_connected').length;

  return (
    <div className="space-y-6">
      {/* Dynasty KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-gradient-to-br from-emerald-950/40 to-card border-emerald-500/20">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Revenue</span>
            </div>
            <p className="text-xl font-bold text-emerald-400">${totalRevenue.toLocaleString()}</p>
            {!dataFromSnapshots && totalRevenue > 0 && (
              <p className="text-[10px] text-amber-400 mt-0.5">Estimated</p>
            )}
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Expenses</span>
            </div>
            <p className="text-xl font-bold text-red-400">${totalExpenses.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className={`h-4 w-4 ${netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
              <span className="text-xs text-muted-foreground">Net Profit</span>
            </div>
            <p className={`text-xl font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ${netProfit.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Connected</span>
            </div>
            <p className="text-xl font-bold">{connected} <span className="text-sm text-muted-foreground font-normal">/ {activeBiz.length}</span></p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Signal className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Avg Confidence</span>
            </div>
            <p className={`text-xl font-bold ${avgConfidence >= 60 ? 'text-emerald-400' : avgConfidence >= 30 ? 'text-amber-400' : 'text-muted-foreground'}`}>
              {avgConfidence}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Connection Pipeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Connection Pipeline
          </CardTitle>
          <CardDescription className="text-xs">
            Data integration status across all dynasty entities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Live', count: liveCount, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
              { label: 'Partial', count: partialCount, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
              { label: 'Manual', count: manualCount, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
              { label: 'Pending', count: pendingCount, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
              { label: 'Disconnected', count: disconnectedCount, color: 'text-muted-foreground', bg: 'bg-muted/30', border: 'border-muted' },
            ].map(tier => (
              <div key={tier.label} className={`p-3 rounded-lg ${tier.bg} border ${tier.border} text-center`}>
                <p className={`text-2xl font-bold ${tier.color}`}>{tier.count}</p>
                <p className="text-xs text-muted-foreground">{tier.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-xs text-muted-foreground">Overall integration:</span>
              <span className="text-xs font-medium">{activeBiz.length > 0 ? Math.round((connected / activeBiz.length) * 100) : 0}%</span>
            </div>
            <Progress value={activeBiz.length > 0 ? (connected / activeBiz.length) * 100 : 0} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Full Business Registry */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Dynasty Business Registry
          </CardTitle>
          <CardDescription className="text-xs">
            All {allBiz.length} entities — including inactive, prelaunch, and pending businesses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {allBiz.map(biz => {
              const conn = getConnectionLabel(biz.connection_status);
              return (
                <div
                  key={biz.id}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    biz.is_active ? 'bg-muted/30 hover:bg-muted/50' : 'bg-muted/10 opacity-60'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{biz.name}</p>
                      <Badge className={`${conn.className} text-[10px]`}>
                        {connectionIcon(conn.icon)}
                        {conn.label}
                      </Badge>
                      <DataSourceBadge entity={biz} />
                      {!biz.is_active && (
                        <Badge variant="outline" className="text-[10px] border-muted text-muted-foreground">Inactive</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground capitalize">{biz.industry?.replace(/_/g, ' ') || 'Unclassified'}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{getReportingLabel(biz.reporting_mode)}</span>
                      {biz.last_data_sync_at && (
                        <>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">
                            Last sync: {format(new Date(biz.last_data_sync_at), 'MMM d, yyyy')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <ConfidenceBar pct={biz.data_confidence_pct} />
                    {biz.monthly_revenue_estimate > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">~${biz.monthly_revenue_estimate.toLocaleString()}/mo</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
