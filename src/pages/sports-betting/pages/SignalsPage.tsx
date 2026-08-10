import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Radar } from 'lucide-react';

type Signal = {
  id: string;
  sport: string | null;
  game: string | null;
  home_team: string | null;
  away_team: string | null;
  game_date: string | null;
  pick_type: string | null;
  pick_detail: string | null;
  side: string | null;
  line: number | null;
  odds: number | null;
  internal_confidence: number | null;
  combined_confidence: number | null;
  confirming_cappers: unknown;
  fading_cappers: unknown;
  signal_grade: string | null;
  result: string | null;
  pnl_units: number | null;
  grading_source: string | null;
};

const GRADES = ['ALL', 'LOCK', 'BEST_BET', 'PLAY', 'LEAN', 'NO_PLAY'] as const;

// Bounded read. Signals accumulate one row per game per pick_type, so an
// unbounded select would eventually hit PostgREST's page cap and silently
// truncate the newest rows off the bottom of the board.
const PAGE_SIZE = 500;

function countOf(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

function gradeTone(grade: string | null) {
  switch (grade) {
    case 'LOCK': return 'default' as const;
    case 'BEST_BET': return 'secondary' as const;
    case 'NO_PLAY': return 'outline' as const;
    default: return 'secondary' as const;
  }
}

function resultTone(result: string | null) {
  switch (result) {
    case 'win': return 'default' as const;
    case 'loss': return 'destructive' as const;
    case 'push': return 'secondary' as const;
    default: return 'outline' as const;
  }
}

export default function SignalsPage() {
  const [grade, setGrade] = useState<(typeof GRADES)[number]>('ALL');

  const { data, isLoading, error } = useQuery({
    queryKey: ['sbo-signals', grade],
    queryFn: async () => {
      let q = supabase
        .from('sbo_signals')
        .select(
          'id, sport, game, home_team, away_team, game_date, pick_type, pick_detail, side, line, odds, internal_confidence, combined_confidence, confirming_cappers, fading_cappers, signal_grade, result, pnl_units, grading_source',
        )
        .order('game_date', { ascending: false })
        .order('combined_confidence', { ascending: false })
        .limit(PAGE_SIZE);
      if (grade !== 'ALL') q = q.eq('signal_grade', grade);
      const { data, error } = await q;
      // Surface the raw error — a silenced RLS denial here would look
      // identical to "no signals generated yet".
      if (error) throw error;
      return (data ?? []) as Signal[];
    },
  });

  const summary = useMemo(() => {
    const rows = data ?? [];
    const settled = rows.filter((r) => r.result === 'win' || r.result === 'loss');
    const wins = settled.filter((r) => r.result === 'win').length;
    const units = rows.reduce((sum, r) => sum + (Number(r.pnl_units) || 0), 0);
    return {
      total: rows.length,
      pending: rows.filter((r) => r.result === 'pending' || !r.result).length,
      settled: settled.length,
      winRate: settled.length ? Math.round((wins / settled.length) * 1000) / 10 : null,
      units: Math.round(units * 100) / 100,
    };
  }, [data]);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center gap-2">
        <Radar className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">Combined Signals</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Internal model confidence combined with confirming and fading capper coverage.
      </p>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Could not load signals</AlertTitle>
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Signals', value: summary.total },
          { label: 'Pending', value: summary.pending },
          { label: 'Settled', value: summary.settled },
          { label: 'Win rate', value: summary.winRate == null ? '—' : `${summary.winRate}%` },
          { label: 'Units', value: summary.units },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="text-xl font-semibold">{isLoading ? <Skeleton className="h-6 w-16" /> : s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {GRADES.map((g) => (
          <Button key={g} size="sm" variant={grade === g ? 'default' : 'outline'} onClick={() => setGrade(g)}>
            {g.replace('_', ' ')}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Signal board {data ? `(${data.length}${data.length === PAGE_SIZE ? '+' : ''})` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : !data?.length ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No signals for this filter.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Sport</TableHead>
                  <TableHead>Matchup</TableHead>
                  <TableHead>Pick</TableHead>
                  <TableHead className="text-right">Internal</TableHead>
                  <TableHead className="text-right">Combined</TableHead>
                  <TableHead className="text-right">Confirm / Fade</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="whitespace-nowrap">{s.game_date ?? '—'}</TableCell>
                    <TableCell>{s.sport ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {s.game ?? [s.away_team, s.home_team].filter(Boolean).join(' @ ') ?? '—'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {[s.pick_type, s.side, s.line, s.pick_detail].filter((v) => v != null && v !== '').join(' ')}
                      {s.odds != null && <span className="text-muted-foreground"> ({s.odds})</span>}
                    </TableCell>
                    <TableCell className="text-right">{s.internal_confidence ?? '—'}</TableCell>
                    <TableCell className="text-right font-medium">{s.combined_confidence ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      {countOf(s.confirming_cappers)} / {countOf(s.fading_cappers)}
                    </TableCell>
                    <TableCell>
                      {s.signal_grade ? <Badge variant={gradeTone(s.signal_grade)}>{s.signal_grade.replace('_', ' ')}</Badge> : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={resultTone(s.result)}>{s.result ?? 'pending'}</Badge>
                      {s.grading_source && (
                        <span className="ml-1 text-xs text-muted-foreground">{s.grading_source}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{s.pnl_units == null ? '—' : Number(s.pnl_units).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
