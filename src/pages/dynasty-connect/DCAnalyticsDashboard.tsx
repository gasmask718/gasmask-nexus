import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useMemo } from 'react';
import { Phone, Flame, TrendingUp, Clock, BarChart3 } from 'lucide-react';

export default function DCAnalytics() {
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');

  const startDate = useMemo(() => {
    const d = new Date();
    if (period === 'today') d.setHours(0, 0, 0, 0);
    else if (period === 'week') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    return d.toISOString();
  }, [period]);

  const { data: calls = [] } = useQuery({
    queryKey: ['dc-analytics-calls', startDate],
    queryFn: async () => {
      const { data } = await (supabase as any).from('dynasty_ai_calls').select('*').gte('created_at', startDate).order('created_at');
      return data || [];
    },
  });

  const { data: analyses = [] } = useQuery({
    queryKey: ['dc-analytics-analyses', startDate],
    queryFn: async () => {
      const { data } = await (supabase as any).from('dynasty_call_analysis').select('*').gte('analyzed_at', startDate);
      return data || [];
    },
  });

  const { data: objections = [] } = useQuery({
    queryKey: ['dc-objections'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('dynasty_objection_library').select('*').order('times_encountered', { ascending: false }).limit(10);
      return data || [];
    },
  });

  const totalCalls = calls.length;
  const hotLeads = calls.filter((c: any) => c.lead_quality === 'hot').length;
  const warmLeads = calls.filter((c: any) => c.lead_quality === 'warm').length;
  const coldLeads = calls.filter((c: any) => c.lead_quality === 'cold').length;
  const deadLeads = calls.filter((c: any) => c.lead_quality === 'dead').length;
  const avgDuration = totalCalls > 0 ? Math.round(calls.reduce((s: number, c: any) => s + (c.duration_seconds || 0), 0) / totalCalls) : 0;
  const avgScore = analyses.length > 0 ? (analyses.reduce((s: number, a: any) => s + (a.overall_score || 0), 0) / analyses.length).toFixed(1) : '0';
  const conversionRate = totalCalls > 0 ? ((hotLeads / totalCalls) * 100).toFixed(1) : '0';

  // Calls by business
  const byBusiness = calls.reduce((acc: any, c: any) => {
    acc[c.business_unit] = (acc[c.business_unit] || 0) + 1;
    return acc;
  }, {});

  // Calls by source (Brandaro vs Direct vs other)
  const bySource = calls.reduce((acc: any, c: any) => {
    const src = c.source_table === 'brandaro_qualified_leads' ? '🅱️ Brandaro'
      : c.source_table ? c.source_table.replace(/_/g, ' ')
      : 'Direct Upload';
    acc[src] = (acc[src] || 0) + 1;
    return acc;
  }, {});

  // Calls by date
  const byDate = calls.reduce((acc: any, c: any) => {
    const d = new Date(c.created_at).toLocaleDateString();
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {});

  // Score distribution
  const scoreCategories = { excellent: 0, good: 0, average: 0, poor: 0 };
  analyses.forEach((a: any) => {
    if (a.overall_score >= 8) scoreCategories.excellent++;
    else if (a.overall_score >= 6) scoreCategories.good++;
    else if (a.overall_score >= 4) scoreCategories.average++;
    else scoreCategories.poor++;
  });

  const maxDailyCount = Math.max(1, ...Object.values(byDate) as number[]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">📈 Analytics</h1><p className="text-sm text-muted-foreground">Performance metrics and trends</p></div>
        <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 text-center"><Phone className="h-6 w-6 mx-auto mb-2 text-primary" /><p className="text-3xl font-bold">{totalCalls}</p><p className="text-xs text-muted-foreground">Total Calls</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><Flame className="h-6 w-6 mx-auto mb-2 text-red-500" /><p className="text-3xl font-bold">{hotLeads}</p><p className="text-xs text-muted-foreground">Hot Leads</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><TrendingUp className="h-6 w-6 mx-auto mb-2 text-green-500" /><p className="text-3xl font-bold">{conversionRate}%</p><p className="text-xs text-muted-foreground">Hot Lead Rate</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><Clock className="h-6 w-6 mx-auto mb-2 text-muted-foreground" /><p className="text-3xl font-bold">{avgDuration}s</p><p className="text-xs text-muted-foreground">Avg Duration</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Calls Over Time */}
        <Card>
          <CardHeader><CardTitle className="text-base">Calls Over Time</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(byDate).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No call data yet</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(byDate).map(([date, count]) => (
                  <div key={date} className="flex items-center gap-2">
                    <span className="text-xs w-20 text-muted-foreground">{date}</span>
                    <div className="flex-1 h-4 bg-muted rounded"><div className="h-full bg-primary rounded transition-all" style={{ width: `${((count as number) / maxDailyCount) * 100}%` }} /></div>
                    <span className="text-xs font-mono w-8">{count as number}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lead Quality Distribution */}
        <Card>
          <CardHeader><CardTitle className="text-base">Lead Quality Distribution</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: '🔥 Hot', count: hotLeads, color: 'bg-red-500', pct: totalCalls > 0 ? (hotLeads / totalCalls * 100).toFixed(0) : 0 },
                { label: '🟡 Warm', count: warmLeads, color: 'bg-yellow-500', pct: totalCalls > 0 ? (warmLeads / totalCalls * 100).toFixed(0) : 0 },
                { label: '🔵 Cold', count: coldLeads, color: 'bg-blue-500', pct: totalCalls > 0 ? (coldLeads / totalCalls * 100).toFixed(0) : 0 },
                { label: '⚫ Dead', count: deadLeads, color: 'bg-muted-foreground', pct: totalCalls > 0 ? (deadLeads / totalCalls * 100).toFixed(0) : 0 },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="text-sm w-20">{item.label}</span>
                  <div className="flex-1 h-4 bg-muted rounded"><div className={`h-full ${item.color} rounded`} style={{ width: `${item.pct}%` }} /></div>
                  <span className="text-xs font-mono w-16">{item.count} ({item.pct}%)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* By Business */}
        <Card>
          <CardHeader><CardTitle className="text-base">Calls by Business</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(byBusiness).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([biz, count]) => (
                <div key={biz} className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <Badge variant="outline">{biz}</Badge>
                  <span className="font-bold">{count as number}</span>
                </div>
              ))}
              {Object.keys(byBusiness).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No data</p>}
            </div>
          </CardContent>
        </Card>

        {/* By Source */}
        <Card>
          <CardHeader><CardTitle className="text-base">Calls by Source</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(bySource).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([src, count]) => (
                <div key={src} className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <Badge variant="outline" className={src.includes('Brandaro') ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' : ''}>
                    {src}
                  </Badge>
                  <span className="font-bold">{count as number}</span>
                </div>
              ))}
              {Object.keys(bySource).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No data</p>}
            </div>
          </CardContent>
        </Card>

        {/* Top Objections */}
        <Card>
          <CardHeader><CardTitle className="text-base">Top Objections</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {objections.map((o: any) => (
                <div key={o.id} className="p-2 rounded border border-border">
                  <p className="text-sm font-medium">{o.objection_text}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>Encountered: {o.times_encountered}x</span>
                    <span>Success: {o.success_rate ? `${o.success_rate}%` : 'N/A'}</span>
                  </div>
                </div>
              ))}
              {objections.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No objections tracked yet</p>}
            </div>
          </CardContent>
        </Card>

        {/* Score Distribution */}
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">Score Distribution (Avg: {avgScore}/10)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Excellent (8-10)', count: scoreCategories.excellent, color: 'text-green-500 border-green-500' },
                { label: 'Good (6-7)', count: scoreCategories.good, color: 'text-blue-500 border-blue-500' },
                { label: 'Average (4-5)', count: scoreCategories.average, color: 'text-yellow-500 border-yellow-500' },
                { label: 'Poor (1-3)', count: scoreCategories.poor, color: 'text-red-500 border-red-500' },
              ].map(s => (
                <div key={s.label} className={`text-center p-3 rounded border ${s.color}`}>
                  <p className="text-2xl font-bold">{s.count}</p>
                  <p className="text-xs">{s.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
