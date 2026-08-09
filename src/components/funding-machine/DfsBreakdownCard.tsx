import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, AlertTriangle, Info } from 'lucide-react';

type ComponentEntry = {
  subscore: number | null;
  weight: number;
  raw: number | string | null;
};

type Breakdown = {
  components?: Record<string, ComponentEntry>;
  missing?: string[];
  weight_used?: number;
  weight_total?: number;
  funding_ceiling?: number;
};

const LABELS: Record<string, string> = {
  personal_credit: 'Personal credit',
  derogatories: 'Derogatory items',
  utilization: 'Credit utilization',
  inquiries: 'Inquiry velocity',
  entity_quality: 'Entity quality',
  time_in_business: 'Time in business',
  revenue: 'Revenue',
};

const RAW_HINT: Record<string, (v: ComponentEntry['raw']) => string> = {
  personal_credit: v => (v ? `best bureau score ${v}` : 'no bureau score on file'),
  derogatories: v => `${v} unresolved item${Number(v) === 1 ? '' : 's'}`,
  utilization: v => (v === null || v === undefined ? 'no limits/balances on file' : `${v}% utilised`),
  inquiries: v => `${v} in last 12 months`,
  entity_quality: v => `${v}/100 structural completeness`,
  time_in_business: v => (v === null || v === undefined ? 'not recorded' : `${v} months`),
  revenue: v => (v === null || v === undefined ? 'not recorded' : `$${Number(v).toLocaleString()}/mo`),
};

function toneFor(score: number | null) {
  if (score === null) return 'text-muted-foreground';
  if (score >= 75) return 'text-emerald-500';
  if (score >= 45) return 'text-amber-500';
  return 'text-red-500';
}

interface Props {
  clientId: string;
  totalScore: number | null | undefined;
  fundingCeiling: number | null | undefined;
  breakdown: unknown;
  completeness: number | null | undefined;
  computedAt: string | null | undefined;
}

export function DfsBreakdownCard({
  clientId,
  totalScore,
  fundingCeiling,
  breakdown,
  completeness,
  computedAt,
}: Props) {
  const [running, setRunning] = useState(false);
  const queryClient = useQueryClient();

  const parsed = (breakdown ?? {}) as Breakdown;
  const components = parsed.components ?? {};
  const missing = parsed.missing ?? [];
  const entries = Object.entries(components);

  const recompute = async () => {
    setRunning(true);
    try {
      const { error } = await supabase.rpc('compute_funding_dfs', { _client_id: clientId });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['funding-dfs', clientId] });
      await queryClient.invalidateQueries({ queryKey: ['funding-client', clientId] });
      toast.success('Fundability score recalculated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Recalculation failed');
    } finally {
      setRunning(false);
    }
  };

  const hasScore = computedAt != null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Dynasty Fundability Score</CardTitle>
        <Button size="sm" variant="outline" onClick={recompute} disabled={running}>
          <RefreshCw className={`h-4 w-4 mr-2 ${running ? 'animate-spin' : ''}`} />
          Recalculate
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {!hasScore ? (
          <div className="flex items-start gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              This score has not been computed yet. Press Recalculate to score this client from their
              current credit and business data.
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-end gap-6">
              <div>
                <div className={`text-5xl font-semibold tabular-nums ${toneFor(totalScore ?? null)}`}>
                  {totalScore ?? 0}
                  <span className="text-xl text-muted-foreground font-normal">/100</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Updated {new Date(computedAt).toLocaleString()}
                </p>
              </div>
              <div className="pb-1">
                <p className="text-xs text-muted-foreground">Estimated funding ceiling</p>
                <p className="text-2xl font-semibold tabular-nums">
                  ${Number(fundingCeiling ?? 0).toLocaleString()}
                </p>
              </div>
            </div>

            {missing.length > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
                <div>
                  <p className="font-medium">
                    Scored on {completeness ?? 0}% of available inputs
                  </p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    No data for {missing.map(m => LABELS[m] ?? m).join(', ')}. These are excluded from
                    the average rather than scored zero, so the score is not penalised for data you
                    have not collected yet.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {entries.map(([key, entry]) => {
                const sub = entry.subscore;
                const unavailable = sub === null || sub === undefined;
                return (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span>{LABELS[key] ?? key}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          weight {entry.weight}
                        </Badge>
                      </div>
                      <span className={`tabular-nums font-medium ${toneFor(unavailable ? null : sub)}`}>
                        {unavailable ? 'no data' : `${sub}/100`}
                      </span>
                    </div>
                    <Progress value={unavailable ? 0 : Number(sub)} className="h-1.5" />
                    <p className="text-xs text-muted-foreground">
                      {RAW_HINT[key]?.(entry.raw) ?? String(entry.raw ?? '')}
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
