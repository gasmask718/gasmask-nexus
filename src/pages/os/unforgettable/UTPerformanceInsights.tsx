// ═══════════════════════════════════════════════════════════════════════════
// MON-02 — Performance Insights.
// A recommendation engine running on three rows is confidently wrong, which is
// worse than silent. Insights are suppressed below MIN_ROWS_FOR_INSIGHTS.
// ═══════════════════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';
import { isConfirmed, contractedValue, pipelineValue, lastWritten, formatLastUpdated, money } from './utRevenue';
import { errText } from "@/lib/errText";

const MIN_ROWS_FOR_INSIGHTS = 20;

export default function UTPerformanceInsights() {
  const { data: bookings, error: bookingsError } = useQuery({
    queryKey: ['ut-insights-bookings'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('ut_event_bookings' as any).select('*') as any);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: ambassadors, error: ambassadorsError } = useQuery({
    queryKey: ['ut-insights-ambassadors'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('unforgettable_ambassadors' as any).select('*') as any);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const bk = bookings || [];
  const amb = ambassadors || [];
  const confirmed = bk.filter(isConfirmed);
  const enoughBookings = bk.length >= MIN_ROWS_FOR_INSIGHTS;
  const enoughAmbassadors = amb.length >= MIN_ROWS_FOR_INSIGHTS;

  const insights = useMemo(() => {
    const results: { icon: string; text: string; data: string }[] = [];

    if (enoughBookings) {
      const types: Record<string, number> = {};
      bk.forEach((b: any) => {
        types[b.event_type || 'Unknown'] = (types[b.event_type || 'Unknown'] || 0) + 1;
      });
      const topType = Object.entries(types).sort((a, b) => b[1] - a[1])[0];
      if (topType)
        results.push({
          icon: '🎉',
          text: `${topType[0]} is your most popular event type with ${topType[1]} bookings.`,
          data: `${topType[1]} bookings`,
        });

      if (confirmed.length > 0) {
        const contracted = confirmed.reduce((s, b) => s + contractedValue(b), 0);
        results.push({
          icon: '💰',
          text: `Average contracted booking value is ${money(
            contracted / confirmed.length
          )}, across ${confirmed.length} confirmed bookings.`,
          data: money(contracted / confirmed.length),
        });
      }
    }

    if (enoughAmbassadors) {
      const active = amb.filter((a: any) => a.status === 'active' || a.status === 'approved');
      results.push({
        icon: '🤝',
        text: `${active.length} of ${amb.length} ambassadors are active (${Math.round(
          (active.length / amb.length) * 100
        )}%).`,
        data: `${Math.round((active.length / amb.length) * 100)}%`,
      });

      const gold = amb.filter((a: any) => a.tier === 'gold' || a.tier === 'platinum' || a.tier === 'legend');
      if (gold.length > 0)
        results.push({ icon: '⭐', text: `${gold.length} ambassadors are Gold+ tier.`, data: `${gold.length} Gold+` });
    }

    return results;
  }, [bk, amb, confirmed, enoughBookings, enoughAmbassadors]);

  const stamp = (text: string) => <p className="text-[11px] text-muted-foreground/70 mt-2">{text}</p>;
  const bookingsStamp = formatLastUpdated(lastWritten(bk));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">📈 Performance Insights</h1>
        <p className="text-muted-foreground">Trend analysis — suppressed until there is enough data to trend on</p>
      </div>

      {(bookingsError || ambassadorsError) && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Data could not be read
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {[bookingsError, ambassadorsError].filter(Boolean).map((e: any, i) => (
              <p key={i} className="text-xs text-destructive">
                {errText(e, 300)}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {insights.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.map((insight, i) => (
            <Card key={i}>
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
      ) : (
        <Card>
          <CardContent className="p-6 space-y-1">
            <p className="text-sm font-medium">Not enough data to draw conclusions</p>
            <p className="text-sm text-muted-foreground">
              {bk.length} booking{bk.length === 1 ? '' : 's'} and {amb.length} ambassador
              {amb.length === 1 ? '' : 's'} on file. Insights need at least {MIN_ROWS_FOR_INSIGHTS} rows in a source
              before a recommendation means anything.
            </p>
            {stamp(`ut_event_bookings — ${bookingsStamp}`)}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Counts (no interpretation)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>📊 Bookings: {bk.length} total · {confirmed.length} confirmed</p>
            <p>🤝 Ambassadors: {amb.length}</p>
            <p>
              💼 Contracted: {money(confirmed.reduce((s, b) => s + contractedValue(b), 0))} · Pipeline:{' '}
              {money(bk.filter((b) => !isConfirmed(b)).reduce((s, b) => s + pipelineValue(b), 0))}
            </p>
          </div>
          {stamp(`ut_event_bookings — ${bookingsStamp} · unforgettable_ambassadors — ${formatLastUpdated(lastWritten(amb))}`)}
        </CardContent>
      </Card>
    </div>
  );
}
