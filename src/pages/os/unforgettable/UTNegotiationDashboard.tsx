import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TrendingDown, Trophy, Zap, DollarSign, BarChart3, AlertTriangle, Clock, Target } from 'lucide-react';

export default function UTNegotiationDashboard() {
  const { data: negotiations = [] } = useQuery({
    queryKey: ['ut-negotiations-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ut_supplier_negotiations').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const stats = useMemo(() => {
    const active = negotiations.filter(n => !['finalized', 'rejected'].includes(n.status || ''));
    const finalized = negotiations.filter(n => n.status === 'finalized');
    const rejected = negotiations.filter(n => n.status === 'rejected');
    const totalSavings = finalized.reduce((s, n) => s + (Number(n.total_savings) || 0), 0);
    const avgPriceReduction = negotiations.filter(n => Number(n.price_reduction_pct) > 0);
    const avgReduction = avgPriceReduction.length > 0
      ? avgPriceReduction.reduce((s, n) => s + Number(n.price_reduction_pct), 0) / avgPriceReduction.length
      : 0;
    const avgMoqReduction = negotiations.filter(n => Number(n.moq_reduction_pct) > 0);
    const avgMoq = avgMoqReduction.length > 0
      ? avgMoqReduction.reduce((s, n) => s + Number(n.moq_reduction_pct), 0) / avgMoqReduction.length
      : 0;
    const winRate = negotiations.length > 0 ? (finalized.length / negotiations.length * 100) : 0;
    const avgRounds = finalized.length > 0
      ? finalized.reduce((s, n) => s + (n.negotiation_round || 0), 0) / finalized.length
      : 0;

    // Alerts
    const stalled = active.filter(n => {
      const updated = new Date(n.updated_at || n.created_at || '');
      return (Date.now() - updated.getTime()) > 48 * 60 * 60 * 1000;
    });
    const awaiting = active.filter(n => n.status === 'awaiting_supplier_response');

    return { active, finalized, rejected, totalSavings, avgReduction, avgMoq, winRate, avgRounds, stalled, awaiting };
  }, [negotiations]);

  const bestDeals = useMemo(() => {
    return negotiations
      .filter(n => n.status === 'finalized' && Number(n.price_reduction_pct) > 0)
      .sort((a, b) => Number(b.price_reduction_pct) - Number(a.price_reduction_pct))
      .slice(0, 5);
  }, [negotiations]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <BarChart3 className="h-8 w-8 text-primary" /> Negotiation Dashboard
        </h1>
        <p className="text-muted-foreground">Track AI negotiation performance and savings</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Savings', value: `$${stats.totalSavings.toFixed(0)}`, icon: DollarSign, color: 'text-green-600' },
          { label: 'Avg Price Reduction', value: `${stats.avgReduction.toFixed(1)}%`, icon: TrendingDown, color: 'text-blue-600' },
          { label: 'Avg MOQ Reduction', value: `${stats.avgMoq.toFixed(1)}%`, icon: Target, color: 'text-purple-600' },
          { label: 'Deal Win Rate', value: `${stats.winRate.toFixed(0)}%`, icon: Trophy, color: 'text-amber-600' },
        ].map((kpi, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <kpi.icon className={`h-8 w-8 ${kpi.color}`} />
                <div>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{stats.active.length}</p>
          <p className="text-xs text-muted-foreground">Active Negotiations</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{stats.finalized.length}</p>
          <p className="text-xs text-muted-foreground">Deals Closed</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{stats.avgRounds.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground">Avg Rounds to Close</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{stats.rejected.length}</p>
          <p className="text-xs text-muted-foreground">Rejected</p>
        </CardContent></Card>
      </div>

      {/* Alerts */}
      {(stats.stalled.length > 0 || stats.awaiting.length > 0) && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" /> Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.stalled.map(n => (
              <div key={n.id} className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-red-500" />
                <span className="font-medium">{n.supplier_name}</span> — Stalled &gt;48h, no update
              </div>
            ))}
            {stats.awaiting.map(n => (
              <div key={n.id} className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span className="font-medium">{n.supplier_name}</span> — Awaiting supplier response
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Best Deals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" /> Best Negotiated Deals
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bestDeals.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No finalized deals yet</p>
            ) : (
              <div className="space-y-3">
                {bestDeals.map((deal, i) => (
                  <div key={deal.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🏅'}</span>
                      <div>
                        <p className="font-medium">{deal.supplier_name}</p>
                        <p className="text-xs text-muted-foreground">
                          ${Number(deal.original_price || 0).toFixed(2)} → ${Number(deal.best_offer_price || deal.current_offer_price || 0).toFixed(2)}/unit
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">−{Number(deal.price_reduction_pct).toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">{deal.negotiation_round} rounds</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Strategy Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" /> Strategy Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {['aggressive', 'balanced', 'relationship'].map(mode => {
              const modeNegs = negotiations.filter(n => n.ai_strategy_mode === mode);
              const modeFinalized = modeNegs.filter(n => n.status === 'finalized');
              const modeAvgReduction = modeNegs.filter(n => Number(n.price_reduction_pct) > 0);
              const avg = modeAvgReduction.length > 0
                ? modeAvgReduction.reduce((s, n) => s + Number(n.price_reduction_pct), 0) / modeAvgReduction.length
                : 0;
              const winRate = modeNegs.length > 0 ? (modeFinalized.length / modeNegs.length * 100) : 0;

              return (
                <div key={mode} className="flex items-center justify-between p-3 border-b last:border-0">
                  <div>
                    <p className="font-medium capitalize">{mode === 'relationship' ? '💛 Relationship' : mode === 'aggressive' ? '🔥 Aggressive' : '⚖️ Balanced'}</p>
                    <p className="text-xs text-muted-foreground">{modeNegs.length} negotiations</p>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <div className="text-center">
                      <p className="font-bold text-green-600">{avg.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">Avg Reduction</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold">{winRate.toFixed(0)}%</p>
                      <p className="text-xs text-muted-foreground">Win Rate</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* All Negotiations Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Negotiations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2">Supplier</th>
                  <th className="p-2">Strategy</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Original</th>
                  <th className="p-2">Current</th>
                  <th className="p-2">Best</th>
                  <th className="p-2">Reduction</th>
                  <th className="p-2">Rounds</th>
                </tr>
              </thead>
              <tbody>
                {negotiations.map(neg => (
                  <tr key={neg.id} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-medium">{neg.supplier_name}</td>
                    <td className="p-2 capitalize">{neg.ai_strategy_mode}</td>
                    <td className="p-2">
                      <Badge variant="outline" className="text-xs">{neg.status}</Badge>
                    </td>
                    <td className="p-2">${Number(neg.original_price || 0).toFixed(2)}</td>
                    <td className="p-2">${Number(neg.current_offer_price || 0).toFixed(2)}</td>
                    <td className="p-2 font-medium text-green-600">${Number(neg.best_offer_price || 0).toFixed(2)}</td>
                    <td className="p-2">
                      {Number(neg.price_reduction_pct) > 0 && (
                        <span className="text-green-600">−{Number(neg.price_reduction_pct).toFixed(1)}%</span>
                      )}
                    </td>
                    <td className="p-2">{neg.negotiation_round || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
