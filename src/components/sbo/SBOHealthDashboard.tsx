import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Activity, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

interface HealthMetrics {
  totalGames: number;
  totalProps: number;
  propsWithStats: number;
  propsWithoutStats: number;
  propsWithPredictions: number;
  propsWithoutPredictions: number;
  statCompleteness: number;
  predictionCoverage: number;
  lastIngestionTime: string | null;
  bookBreakdown: Record<string, number>;
  dataQualityBreakdown: { full: number; good: number; partial: number; minimal: number; none: number };
}

function StatusIcon({ score }: { score: number }) {
  if (score >= 90) return <CheckCircle className="h-4 w-4 text-emerald-500" />;
  if (score >= 60) return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
}

function MetricCard({ label, value, total, suffix = '%', icon }: { label: string; value: number; total?: number; suffix?: string; icon?: React.ReactNode }) {
  const pct = total ? Math.round((value / total) * 100) : value;
  return (
    <div className="rounded-lg bg-muted/30 border border-border p-3 text-center space-y-1">
      <div className="flex items-center justify-center gap-1.5">
        {icon}
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{total ? `${value}/${total}` : value}{!total && suffix}</p>
      {total && (
        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-destructive'}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function SBOHealthDashboard() {
  const [rebuilding, setRebuilding] = useState(false);

  const todayEST = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  const { data: metrics, isLoading, refetch } = useQuery<HealthMetrics>({
    queryKey: ['sbo-health', todayEST],
    queryFn: async () => {
      // BUG-08: Supabase caps reads at 1000 rows. sbo_player_props holds 20k+ rows
      // and a single slate can exceed 1000, so unpaginated reads silently under-report
      // totalProps and every completeness % derived from it. Page through instead.
      const pageAll = async (build: (from: number, to: number) => any) => {
        const out: any[] = [];
        const size = 1000;
        for (let from = 0; ; from += size) {
          const { data, error } = await build(from, from + size - 1);
          if (error) throw error;
          const rows = data || [];
          out.push(...rows);
          if (rows.length < size) break;
        }
        return out;
      };

      // Fetch games
      const games = await pageAll((from, to) =>
        supabase
          .from('sbo_games')
          .select('id')
          .gte('game_date', `${todayEST}T00:00:00`)
          .lte('game_date', `${todayEST}T23:59:59`)
          .range(from, to)
      );

      // Fetch props
      const allProps = await pageAll((from, to) =>
        (supabase as any)
          .from('sbo_player_props')
          .select('id, source, game_date')
          .eq('game_date', todayEST)
          .range(from, to)
      );

      // Fetch stat contexts
      const propIds = (allProps || []).map((p: any) => p.id);
      let statsMap = new Set<string>();
      let qualityMap: Record<string, string> = {};

      if (propIds.length > 0) {
        // Fetch in batches of 200
        for (let i = 0; i < propIds.length; i += 200) {
          const batch = propIds.slice(i, i + 200);
          const { data: contexts } = await (supabase as any)
            .from('sbo_prop_stat_context')
            .select('prop_id, data_quality')
            .in('prop_id', batch);
          (contexts || []).forEach((c: any) => {
            statsMap.add(c.prop_id);
            qualityMap[c.prop_id] = c.data_quality || 'minimal';
          });
        }
      }

      // Fetch predictions count
      const predictions = await pageAll((from, to) =>
        supabase
          .from('sbo_predictions')
          .select('prop_id')
          .eq('prediction_type', 'player_prop')
          .gte('created_at', `${todayEST}T00:00:00`)
          .range(from, to)
      );

      const predPropIds = new Set((predictions || []).map((p: any) => p.prop_id).filter(Boolean));

      // Book breakdown
      const bookBreakdown: Record<string, number> = {};
      (allProps || []).forEach((p: any) => {
        const src = p.source || 'unknown';
        bookBreakdown[src] = (bookBreakdown[src] || 0) + 1;
      });

      // Data quality breakdown
      const dq = { full: 0, good: 0, partial: 0, minimal: 0, none: 0 };
      (allProps || []).forEach((p: any) => {
        const q = qualityMap[p.id];
        if (!q) dq.none++;
        else if (q === 'full') dq.full++;
        else if (q === 'good') dq.good++;
        else if (q === 'partial') dq.partial++;
        else dq.minimal++;
      });

      const totalProps = allProps?.length || 0;
      const withStats = statsMap.size;
      const withPredictions = [...predPropIds].filter(id => propIds.includes(id)).length;

      return {
        totalGames: games?.length || 0,
        totalProps: totalProps,
        propsWithStats: withStats,
        propsWithoutStats: totalProps - withStats,
        propsWithPredictions: withPredictions,
        propsWithoutPredictions: totalProps - withPredictions,
        statCompleteness: totalProps > 0 ? Math.round((withStats / totalProps) * 100) : 0,
        predictionCoverage: totalProps > 0 ? Math.round((withPredictions / totalProps) * 100) : 0,
        lastIngestionTime: null,
        bookBreakdown,
        dataQualityBreakdown: dq,
      };
    },
    staleTime: 30_000,
  });

  const handleRebuildStats = async () => {
    setRebuilding(true);
    try {
      const { data, error } = await supabase.functions.invoke('sbo-build-prop-context');
      if (error) throw error;
      toast.success(`Stats rebuilt: ${data?.built || 0} contexts created`);
      refetch();
    } catch (e: any) {
      toast.error('Rebuild failed: ' + e.message);
    } finally {
      setRebuilding(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const m = metrics!;
  const overallHealth = Math.round((m.statCompleteness * 0.5 + m.predictionCoverage * 0.3 + (m.totalGames > 0 ? 100 : 0) * 0.2));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">SBO System Health</CardTitle>
              <StatusIcon score={overallHealth} />
              <Badge variant="outline" className={`text-xs ${overallHealth >= 90 ? 'text-emerald-500 border-emerald-500/30' : overallHealth >= 60 ? 'text-amber-500 border-amber-500/30' : 'text-destructive border-destructive/30'}`}>
                {overallHealth}% healthy
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => refetch()}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
              </Button>
              <Button size="sm" onClick={handleRebuildStats} disabled={rebuilding}>
                {rebuilding ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                🧠 Rebuild All Stats
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Key metrics grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MetricCard label="Games Today" value={m.totalGames} suffix="" />
            <MetricCard label="Total Props" value={m.totalProps} suffix="" />
            <MetricCard label="Stats Coverage" value={m.propsWithStats} total={m.totalProps} />
            <MetricCard label="AI Predictions" value={m.propsWithPredictions} total={m.totalProps} />
            <MetricCard label="Overall Health" value={overallHealth} />
          </div>

          {/* Data quality breakdown */}
          <div className="grid grid-cols-5 gap-2">
            {Object.entries(m.dataQualityBreakdown).map(([quality, count]) => (
              <div key={quality} className="text-center p-2 rounded-lg bg-muted/20 border border-border/50">
                <p className="text-lg font-bold text-foreground">{count}</p>
                <p className={`text-[10px] font-medium ${
                  quality === 'full' ? 'text-emerald-500' :
                  quality === 'good' ? 'text-blue-500' :
                  quality === 'partial' ? 'text-amber-500' :
                  quality === 'none' ? 'text-destructive' : 'text-muted-foreground'
                }`}>
                  {quality === 'none' ? 'No Stats' : quality.charAt(0).toUpperCase() + quality.slice(1)}
                </p>
              </div>
            ))}
          </div>

          {/* Book breakdown */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Props by Sportsbook</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(m.bookBreakdown).sort((a, b) => b[1] - a[1]).map(([book, count]) => (
                <Badge key={book} variant="outline" className="text-xs">
                  {book}: {count}
                </Badge>
              ))}
            </div>
          </div>

          {/* Missing stats warning */}
          {m.propsWithoutStats > 0 && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-500">
                  {m.propsWithoutStats} props missing stat context
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click "Rebuild All Stats" to generate statistical intelligence for all props.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
