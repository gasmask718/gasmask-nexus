import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, ShieldCheck, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

const SPORTS = ['mlb', 'nba'];

interface ReadinessRow {
  id: string;
  sport: string;
  evaluated_at: string;
  window_days: number;
  graded_n: number;
  wins: number;
  win_rate: number;
  ci_lower: number;
  coverage_total: number;
  coverage_full: number;
  coverage_pct: number;
  hi_bucket_n: number;
  hi_bucket_rate: number | null;
  lo_bucket_n: number;
  lo_bucket_rate: number | null;
  gate_volume: boolean;
  gate_accuracy: boolean;
  gate_ci: boolean;
  gate_coverage: boolean;
  gate_calibration: boolean;
  gates_passed: number;
  all_gates_pass: boolean;
  blocking_gates: string[];
}

const pct = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : `${(Number(v) * 100).toFixed(1)}%`;

function GateRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2">
        {ok ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-destructive" />}
        <span className="text-sm text-foreground">{label}</span>
      </div>
      <span className="text-xs font-mono text-muted-foreground">{detail}</span>
    </div>
  );
}

export function ClampReadinessCard() {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);

  const { data, isLoading } = useQuery<ReadinessRow[]>({
    queryKey: ['sbo-clamp-readiness'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sbo_clamp_readiness' as any)
        .select('*')
        .order('evaluated_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = (data ?? []) as unknown as ReadinessRow[];
      // latest row per sport
      const latest: ReadinessRow[] = [];
      for (const s of SPORTS) {
        const r = rows.find((x) => x.sport === s);
        if (r) latest.push(r);
      }
      return latest;
    },
  });

  const reEvaluate = async () => {
    setRunning(true);
    try {
      const { error } = await supabase.functions.invoke('sbo-clamp-readiness', { body: { sports: SPORTS } });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['sbo-clamp-readiness'] });
      toast.success('Clamp readiness re-evaluated');
    } catch (e: any) {
      toast.error(e?.message ?? 'Evaluation failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" /> Clamp-Lifting Readiness
        </CardTitle>
        <Button size="sm" variant="outline" onClick={reEvaluate} disabled={running}>
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          <span className="ml-1.5">Re-evaluate now</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {!isLoading && (!data || data.length === 0) && (
          <p className="text-sm text-muted-foreground">No evaluations recorded yet. Run one with "Re-evaluate now".</p>
        )}
        {data?.map((r) => (
          <div key={r.id} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold uppercase text-sm">{r.sport}</span>
                <Badge variant={r.all_gates_pass ? 'default' : 'secondary'}>
                  {r.gates_passed} / 5 gates passed
                </Badge>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {r.window_days}d window · {new Date(r.evaluated_at).toLocaleString()}
              </span>
            </div>

            {r.all_gates_pass && (
              <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2 text-xs text-emerald-600">
                {r.sport.toUpperCase()} clamp-lift criteria met (n={r.graded_n}, {pct(r.win_rate)}, CI {pct(r.ci_lower)}) — review and lift manually.
              </div>
            )}

            <div>
              <GateRow ok={r.gate_volume} label="Volume (≥150 graded)" detail={`${r.graded_n} / 150`} />
              <GateRow ok={r.gate_accuracy} label="Accuracy (≥52.4%)" detail={`${pct(r.win_rate)} (${r.wins}/${r.graded_n})`} />
              <GateRow ok={r.gate_ci} label="95% CI lower bound (≥50.0%)" detail={pct(r.ci_lower)} />
              <GateRow ok={r.gate_coverage} label="Coverage full data (≥60%)" detail={`${pct(r.coverage_pct)} (${r.coverage_full}/${r.coverage_total})`} />
              <GateRow
                ok={r.gate_calibration}
                label="Calibration (hi > lo, ≥20 each)"
                detail={`hi ${r.hi_bucket_n} @ ${pct(r.hi_bucket_rate)} · lo ${r.lo_bucket_n} @ ${pct(r.lo_bucket_rate)}`}
              />
            </div>

            {r.blocking_gates?.length > 0 && (
              <p className="text-[11px] text-muted-foreground">Blocking: {r.blocking_gates.join(', ')}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default ClampReadinessCard;
