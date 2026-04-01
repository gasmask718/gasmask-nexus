import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Send, Package, Trophy, AlertTriangle, Clock, CheckCircle, DollarSign, MessageSquare, Shield, TrendingUp, Zap } from 'lucide-react';

export default function UTSupplierCommandDashboard() {
  const { data: suppliers = [] } = useQuery({
    queryKey: ['ut-suppliers-cmd'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_suppliers' as any).select('*');
      return (data || []) as any[];
    },
  });

  const { data: rfqs = [] } = useQuery({
    queryKey: ['ut-rfqs-cmd'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_rfq_requests' as any).select('*');
      return (data || []) as any[];
    },
  });

  const { data: rfqResponses = [] } = useQuery({
    queryKey: ['ut-rfq-responses-cmd'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_rfq_supplier_responses' as any).select('*');
      return (data || []) as any[];
    },
  });

  const { data: shipments = [] } = useQuery({
    queryKey: ['ut-shipments-cmd'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_shipments' as any).select('*');
      return (data || []) as any[];
    },
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ['ut-conversations-cmd'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_supplier_conversations' as any).select('*');
      return (data || []) as any[];
    },
  });

  const { data: negotiations = [] } = useQuery({
    queryKey: ['ut-negotiations-cmd'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_supplier_negotiations' as any).select('*');
      return (data || []) as any[];
    },
  });

  const { data: brandingRequests = [] } = useQuery({
    queryKey: ['ut-branding-cmd'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_branding_requests' as any).select('*');
      return (data || []) as any[];
    },
  });

  const activeSuppliers = suppliers.filter((s: any) => s.is_active).length;
  const preferredSuppliers = suppliers.filter((s: any) => s.preferred).length;
  const activeRFQs = rfqs.filter((r: any) => r.status !== 'draft').length;
  const pendingResponses = rfqResponses.filter((r: any) => r.status === 'pending').length;
  const inTransit = shipments.filter((s: any) => s.status === 'in_transit').length;
  const unreadMsgs = conversations.filter((c: any) => !c.read_status && c.direction === 'received').length;
  const pendingBranding = brandingRequests.filter((b: any) => b.sample_status === 'pending').length;

  // New intelligence metrics
  const avgRisk = suppliers.length > 0
    ? Math.round(suppliers.reduce((acc: number, s: any) => acc + (s.risk_score || 50), 0) / suppliers.length)
    : 0;

  const totalSavings = negotiations.reduce((acc: number, n: any) => acc + (n.total_savings || 0), 0);
  const avgSavingsPct = negotiations.length > 0
    ? (negotiations.reduce((acc: number, n: any) => acc + (n.price_reduction_pct || 0), 0) / negotiations.length).toFixed(1)
    : '0';

  const avgResponseTime = suppliers.filter((s: any) => s.avg_response_time).length > 0
    ? (suppliers.filter((s: any) => s.avg_response_time).reduce((acc: number, s: any) => acc + s.avg_response_time, 0) / suppliers.filter((s: any) => s.avg_response_time).length).toFixed(1)
    : '—';

  const delayedShipments = shipments.filter((s: any) => {
    if (s.status === 'delivered') return false;
    if (!s.estimated_arrival) return false;
    return new Date(s.estimated_arrival) < new Date();
  });

  const highRiskSuppliers = suppliers.filter((s: any) => (s.risk_score || 50) > 70);

  const overdueShipments = delayedShipments;

  const noResponseRFQs = rfqs.filter((r: any) => {
    if (r.status !== 'sent') return false;
    const daysSinceSent = (Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceSent > 2 && !rfqResponses.some((resp: any) => resp.rfq_id === r.id);
  });

  const missingShippingQuotes = rfqs.filter((r: any) => r.status === 'sent');

  const stats = [
    { label: 'Total Suppliers', value: suppliers.length, icon: Package, color: 'text-blue-400' },
    { label: 'Active', value: activeSuppliers, icon: CheckCircle, color: 'text-green-400' },
    { label: 'Preferred', value: preferredSuppliers, icon: Trophy, color: 'text-yellow-400' },
    { label: 'Avg Risk Score', value: avgRisk, icon: Shield, color: avgRisk > 60 ? 'text-red-400' : 'text-green-400', suffix: '/100' },
    { label: 'Negotiation Savings', value: `${avgSavingsPct}%`, icon: TrendingUp, color: 'text-green-400' },
    { label: 'Avg Response Time', value: avgResponseTime, icon: Clock, color: 'text-orange-400', suffix: 'hrs' },
    { label: 'Delayed Shipments', value: delayedShipments.length, icon: AlertTriangle, color: delayedShipments.length > 0 ? 'text-red-400' : 'text-green-400' },
    { label: 'Unread Messages', value: unreadMsgs, icon: MessageSquare, color: unreadMsgs > 0 ? 'text-pink-400' : 'text-muted-foreground' },
  ];

  const topSuppliers = [...suppliers]
    .map((s: any) => {
      const riskPenalty = ((s.risk_score || 50) - 50) * 0.3;
      return {
        ...s,
        score: Math.max(0, Math.round(((s.cost_score || 5) * 0.35 + (s.speed_score || 5) * 0.25 + (s.reliability_score || 5) * 0.2 + (s.supports_private_label ? 8 : 4) * 0.02) * 10 - riskPenalty)),
      };
    })
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 5);

  const recentResponses = [...rfqResponses].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

  const hasAlerts = overdueShipments.length > 0 || noResponseRFQs.length > 0 || unreadMsgs > 0 || highRiskSuppliers.length > 0;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><BarChart3 className="h-8 w-8" /> Supplier Command Dashboard</h1>
        <p className="text-muted-foreground">Procurement intelligence at a glance</p>
      </div>

      {/* Savings Banner */}
      {totalSavings > 0 && (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-green-400" />
              <div>
                <p className="text-sm text-muted-foreground">Total Negotiation Savings</p>
                <p className="text-3xl font-bold text-green-400">${totalSavings.toLocaleString()}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Active Negotiations</p>
              <p className="text-2xl font-bold">{negotiations.filter((n: any) => n.status !== 'finalized').length}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(st => (
          <Card key={st.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{st.label}</p>
                  <p className="text-2xl font-bold">{st.value}{st.suffix ? <span className="text-sm text-muted-foreground ml-1">{st.suffix}</span> : null}</p>
                </div>
                <st.icon className={`h-8 w-8 ${st.color} opacity-50`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts */}
      {hasAlerts && (
        <Card className="border-destructive/50">
          <CardHeader><CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" /> Alerts Needing Attention</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {overdueShipments.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="destructive">🔴</Badge>
                <span>{overdueShipments.length} shipment(s) overdue</span>
              </div>
            )}
            {noResponseRFQs.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Badge className="bg-yellow-500/20 text-yellow-400">🟡</Badge>
                <span>{noResponseRFQs.length} RFQ(s) with no response &gt; 48hrs</span>
              </div>
            )}
            {highRiskSuppliers.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="destructive">🔴</Badge>
                <span>{highRiskSuppliers.length} high-risk supplier(s) detected</span>
              </div>
            )}
            {unreadMsgs > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Badge className="bg-blue-500/20 text-blue-400">🔵</Badge>
                <span>{unreadMsgs} unread supplier message(s)</span>
              </div>
            )}
            {pendingBranding > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Badge className="bg-orange-500/20 text-orange-400">🟠</Badge>
                <span>{pendingBranding} branding sample(s) pending review</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Suppliers */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-400" /> Top Suppliers</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topSuppliers.map((s: any, i: number) => (
                <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                  <span className="text-lg font-bold text-muted-foreground w-6">#{i + 1}</span>
                  <div className="flex-1">
                    <p className="font-medium flex items-center gap-2">
                      {s.name}
                      {(s.risk_score || 50) > 70 && <Badge className="bg-red-500/20 text-red-400 text-[9px]">⚠️</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.successful_orders || 0} orders · {s.dispute_count || 0} disputes
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">{s.score}</p>
                    <p className="text-xs text-muted-foreground">score</p>
                  </div>
                </div>
              ))}
              {topSuppliers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No suppliers yet</p>}
            </div>
          </CardContent>
        </Card>

        {/* Recent Responses */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-green-400" /> Recent RFQ Responses</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentResponses.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium">{r.supplier_name}</p>
                    <p className="text-xs text-muted-foreground">
                      ${r.unit_price}/unit · MOQ {r.moq} · {r.production_days}d
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">${r.total_landed_cost?.toFixed(0) || '—'}</p>
                    <p className="text-xs text-muted-foreground">landed</p>
                  </div>
                </div>
              ))}
              {recentResponses.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No responses yet</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Shipments */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Active Shipments</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Product</th>
                  <th className="text-left p-2">Supplier</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Carrier</th>
                  <th className="text-left p-2">ETA</th>
                  <th className="text-right p-2">Cost</th>
                </tr>
              </thead>
              <tbody>
                {shipments.filter((s: any) => s.status !== 'delivered').map((s: any) => {
                  const isOverdue = s.estimated_arrival && new Date(s.estimated_arrival) < new Date();
                  return (
                    <tr key={s.id} className="border-b">
                      <td className="p-2 font-medium">{s.product_name}</td>
                      <td className="p-2">{s.supplier_name}</td>
                      <td className="p-2">
                        <Badge variant="outline" className={isOverdue ? 'border-red-500 text-red-400' : ''}>
                          {s.status === 'in_transit' ? '📦' : s.status === 'at_customs' ? '🛃' : '🚚'} {s.status}
                        </Badge>
                      </td>
                      <td className="p-2">{s.carrier || '—'}</td>
                      <td className="p-2">
                        <span className={isOverdue ? 'text-red-400 font-medium' : ''}>
                          {isOverdue ? '⚠️ OVERDUE' : s.estimated_arrival ? new Date(s.estimated_arrival).toLocaleDateString() : '—'}
                        </span>
                      </td>
                      <td className="p-2 text-right font-mono">${s.total_cost?.toFixed(0) || '—'}</td>
                    </tr>
                  );
                })}
                {shipments.filter((s: any) => s.status !== 'delivered').length === 0 && (
                  <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No active shipments</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
