import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ChevronLeft, ChevronRight, ListFilter } from 'lucide-react';
import { dynastyDateTime } from '@/lib/dates';

const SPORTS = ['NFL','NBA','MLB','NHL','NCAAF','NCAAB','MLS','UFC','Tennis','Golf','Boxing','NASCAR'] as const;
const RESULTS = ['pending','won','lost','push'] as const;
const BET_TYPES = ['spread','moneyline','total','prop','parlay'] as const;
const PAGE_SIZE = 50;

type Row = {
  id: string;
  sport: string | null;
  team: string | null;
  player_name: string | null;
  pick_text: string | null;
  bet_type: string | null;
  line: number | null;
  stake: number | null;
  parse_confidence: number | null;
  result: string | null;
  created_at: string;
  extracted_capper_name: string | null;
  capper_detection_confidence: number | null;
  sbo_cappers: { name: string | null } | null;
};

function confidenceBadge(v: number | null) {
  if (v === null || v === undefined) return { label: 'UNSCORED', cls: 'bg-gray-500 text-white' };
  if (v >= 90) return { label: 'HIGH', cls: 'bg-green-600 text-white' };
  if (v >= 70) return { label: 'MEDIUM', cls: 'bg-amber-600 text-white' };
  return { label: 'LOW', cls: 'bg-red-600 text-white' };
}

function resultBadge(r: string | null) {
  switch (r) {
    case 'won':  return 'bg-green-600 text-white';
    case 'lost': return 'bg-red-600 text-white';
    case 'push': return 'bg-blue-600 text-white';
    default:     return 'bg-gray-500 text-white';
  }
}

export default function SBOAllPicks() {
  const [sport, setSport] = useState<string>('all');
  const [result, setResult] = useState<string>('all');
  const [betType, setBetType] = useState<string>('all');
  const [page, setPage] = useState(1);

  const filters = useMemo(() => ({ sport, result, betType }), [sport, result, betType]);

  const { data, isLoading } = useQuery({
    queryKey: ['sbo-all-picks', filters, page],
    queryFn: async () => {
      let q = (supabase as any)
        .from('sbo_capper_picks')
        .select('id,sport,team,player_name,pick_text,bet_type,line,stake,parse_confidence,result,created_at', { count: 'exact' })
        .order('parse_confidence', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (sport !== 'all')   q = q.eq('sport', sport);
      if (result !== 'all')  q = q.eq('result', result);
      if (betType !== 'all') q = q.eq('bet_type', betType);

      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as Row[], total: count ?? 0 };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  const resetAndSet = (setter: (v: string) => void) => (v: string) => { setter(v); setPage(1); };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <ListFilter className="h-6 w-6" />
        <h1 className="text-2xl font-bold">🎯 All Capper Picks</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Select value={sport} onValueChange={resetAndSet(setSport)}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Sport" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sports</SelectItem>
              {SPORTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={result} onValueChange={resetAndSet(setResult)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Result" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Results</SelectItem>
              {RESULTS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={betType} onValueChange={resetAndSet(setBetType)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Bet Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Bet Types</SelectItem>
              {BET_TYPES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sport</TableHead>
                <TableHead>Player / Team</TableHead>
                <TableHead>Pick</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Line</TableHead>
                <TableHead>Stake</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Posted At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No picks match these filters.
                  </TableCell>
                </TableRow>
              ) : rows.map((r) => {
                const cb = confidenceBadge(r.parse_confidence);
                const playerTeam = r.player_name && r.team && r.team !== r.player_name
                  ? `${r.player_name} (${r.team})`
                  : (r.player_name || r.team || '—');
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.sport ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{playerTeam}</TableCell>
                    <TableCell className="max-w-md truncate" title={r.pick_text ?? ''}>{r.pick_text ?? '—'}</TableCell>
                    <TableCell>{r.bet_type ?? '—'}</TableCell>
                    <TableCell>{r.line ?? '—'}</TableCell>
                    <TableCell>{r.stake ?? '—'}</TableCell>
                    <TableCell>
                      <Badge className={cb.cls}>
                        {cb.label}{r.parse_confidence !== null && r.parse_confidence !== undefined ? ` ${Number(r.parse_confidence).toFixed(0)}` : ''}
                      </Badge>
                    </TableCell>
                    <TableCell><Badge className={resultBadge(r.result)}>{r.result ?? 'pending'}</Badge></TableCell>
                    <TableCell className="whitespace-nowrap">{dynastyDateTime(r.created_at)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {from}–{to} of {total} picks
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <span className="text-sm">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
