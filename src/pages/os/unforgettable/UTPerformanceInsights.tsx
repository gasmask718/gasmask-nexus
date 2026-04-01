
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lightbulb, TrendingUp, ArrowRight } from 'lucide-react';
import { useMemo } from 'react';

export default function UTPerformanceInsights() {
  const { data: bookings } = useQuery({
    queryKey: ['ut-insights-bookings'],
    queryFn: async () => {
      const { data } = await (supabase.from('ut_event_bookings' as any).select('*') as any);
      return (data || []) as any[];
    },
  });

  const { data: ambassadors } = useQuery({
    queryKey: ['ut-insights-ambassadors'],
    queryFn: async () => {
      const { data } = await (supabase.from('unforgettable_ambassadors' as any).select('*') as any);
      return (data || []) as any[];
    },
  });

  const insights = useMemo(() => {
    const results: { icon: string; text: string; data: string }[] = [];
    const bk = bookings || [];
    const amb = ambassadors || [];

    if (bk.length > 0) {
      const types: Record<string, number> = {};
      bk.forEach((b: any) => { types[b.event_type || 'Unknown'] = (types[b.event_type || 'Unknown'] || 0) + 1; });
      const topType = Object.entries(types).sort((a, b) => b[1] - a[1])[0];
      if (topType) results.push({ icon: '🎉', text: `${topType[0]} is your most popular event type with ${topType[1]} bookings.`, data: `${topType[1]} bookings` });

      const totalRev = bk.reduce((s: number, b: any) => s + Number(b.total_price || b.budget || 0), 0);
      results.push({ icon: '💰', text: `Average booking value is $${Math.round(totalRev / bk.length).toLocaleString()}. Consider upselling add-ons to increase this.`, data: `$${Math.round(totalRev / bk.length)}` });
    }

    if (amb.length > 0) {
      const active = amb.filter((a: any) => a.status === 'active' || a.status === 'approved');
      results.push({ icon: '🤝', text: `${active.length} of ${amb.length} ambassadors are active (${Math.round((active.length / amb.length) * 100)}%). Focus on activating dormant ambassadors.`, data: `${Math.round((active.length / amb.length) * 100)}%` });

      const gold = amb.filter((a: any) => a.tier === 'gold' || a.tier === 'platinum' || a.tier === 'legend');
      if (gold.length > 0) results.push({ icon: '⭐', text: `${gold.length} ambassadors are Gold+ tier. They generate the highest conversion rates.`, data: `${gold.length} Gold+` });
    }

    if (results.length === 0) {
      results.push({ icon: '📊', text: 'Start adding bookings and ambassadors to see AI-powered insights here.', data: 'Get started' });
    }

    return results;
  }, [bookings, ambassadors]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">📈 Performance Insights</h1>
        <p className="text-muted-foreground">AI-powered trend analysis</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {insights.map((insight, i) => (
          <Card key={i} className="hover:border-primary/50 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{insight.icon}</span>
                <div className="flex-1">
                  <p className="text-sm">{insight.text}</p>
                  <p className="text-xs text-muted-foreground mt-1">{insight.data}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />Weekly Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>📊 Total Bookings: {(bookings || []).length}</p>
            <p>🤝 Total Ambassadors: {(ambassadors || []).length}</p>
            <p>💰 Total Revenue: ${(bookings || []).reduce((s: number, b: any) => s + Number(b.total_price || b.budget || 0), 0).toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
