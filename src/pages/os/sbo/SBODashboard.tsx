import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Lock, Users, Clock, TrendingUp } from 'lucide-react';

const SPORTS = ['NFL','NBA','MLB','NHL','NCAAF','NCAAB','MLS','UFC','Tennis','Golf','Boxing','NASCAR'] as const;
type Sport = typeof SPORTS[number];

const GRADE_STYLES: Record<string, string> = {
  LOCK:     'bg-green-600 text-white',
  BEST_BET: 'bg-blue-600 text-white',
  PLAY:     'bg-cyan-600 text-white',
  LEAN:     'bg-amber-600 text-white',
  NO_PLAY:  'bg-red-600 text-white',
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function startOfTodayISO() {
  const d = new Date(); d.setHours(0,0,0,0); return d.toISOString();
}

function useStats() {
  return useQuery({
    queryKey: ['sbo-dashboard-stats', todayISO()],
    queryFn: async () => {
      const since = startOfTodayISO();
      const today = todayISO();

      const [picksRes, locksRes, cappersRes] = await Promise.all([
        (supabase as any).from('sbo_capper_picks')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', since),
        (supabase as any).from('sbo_signals')
          .select('id', { count: 'exact', head: true })
          .eq('signal_grade', 'LOCK')
          .eq('game_date', today),
        (supabase as any).from('sbo_capper_picks')
          .select('capper_id')
          .gte('created_at', since),
      ]);

      const activeCappers = new Set(
        (cappersRes.data ?? []).map((r: any) => r.capper_id).filter(Boolean)
      ).size;

      return {
        picksToday: picksRes.count ?? 0,
        locksToday: locksRes.count ?? 0,
        activeCappers,
      };
    },
    refetchInterval: 60_000,
  });
}

function useSignalsForSport(sport: Sport) {
  return useQuery({
    queryKey: ['sbo-dashboard-signals', sport, todayISO()],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('sbo_signals')
        .select('*')
        .eq('sport', sport)
        .eq('game_date', todayISO())
        .order('combined_confidence', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
  });
}

function useCapperPicksToday() {
  return useQuery({
    queryKey: ['sbo-dashboard-capper-picks', todayISO()],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('sbo_capper_picks')
        .select('id, sport, pick_text, bet_type, direction, stake, parse_confidence, result, created_at, capper_id')
        .gte('created_at', startOfTodayISO())
        .order('parse_confidence', { ascending: false, nullsFirst: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
  });
}

function StatCard({ icon: Icon, label, value, loading }: { icon: any; label: string; value: number | string; loading: boolean }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            {loading
              ? <Skeleton className="h-8 w-16 mt-1" />
              : <p className="text-3xl font-bold">{value}</p>}
          </div>
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

function SignalCard({ s }: { s: any }) {
  const grade = s.signal_grade ?? 'NO_PLAY';
  const confirming = Array.isArray(s.confirming_cappers) ? s.confirming_cappers.length : 0;
  const conf = Number(s.combined_confidence ?? 0);
  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-center justify-between">
          <Badge className={GRADE_STYLES[grade] ?? 'bg-gray-500 text-white'}>{grade}</Badge>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {s.game_time ?? '—'}
          </div>
        </div>
        <div>
          <p className="font-semibold">{s.pick_detail ?? s.game ?? 'Unnamed pick'}</p>
          <p className="text-sm text-muted-foreground">
            {s.side ?? ''}{s.line != null ? ` ${s.line}` : ''}{s.odds != null ? ` @ ${s.odds}` : ''}
          </p>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Combined Confidence</span>
            <span className="font-medium">{conf.toFixed(1)}</span>
          </div>
          <Progress value={Math.min(100, Math.max(0, conf))} />
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          {confirming} confirming capper{confirming === 1 ? '' : 's'}
        </div>
      </CardContent>
    </Card>
  );
}

function SportPanel({ sport }: { sport: Sport }) {
  const { data: signals, isLoading } = useSignalsForSport(sport);
  if (isLoading) {
    return <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {[1,2,3].map(i => <Skeleton key={i} className="h-48" />)}
    </div>;
  }
  if (!signals || signals.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          No {sport} signals for today. Signal generator not yet active — picks from{' '}
          <code>sbo_capper_picks</code> will appear here once signals are generated.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {signals.map((s: any) => <SignalCard key={s.id} s={s} />)}
    </div>
  );
}

function CapperPicksToday() {
  const { data, isLoading } = useCapperPicksToday();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Capper Picks Today
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading
          ? <Skeleton className="h-24" />
          : !data || data.length === 0
            ? <p className="text-sm text-muted-foreground">No capper picks posted yet today.</p>
            : <div className="divide-y">
                {data.map((p: any) => (
                  <div key={p.id} className="py-2 flex items-start justify-between gap-3 text-sm">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{p.sport ?? '—'}</Badge>
                        <Badge variant="secondary">{p.bet_type ?? '—'}</Badge>
                        {p.direction && <span className="text-xs text-muted-foreground">{p.direction}</span>}
                      </div>
                      <p className="mt-1">{p.pick_text}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Confidence</p>
                      <p className="font-semibold">{p.parse_confidence ?? '—'}</p>
                    </div>
                  </div>
                ))}
              </div>}
      </CardContent>
    </Card>
  );
}

export default function SBODashboard() {
  const [tab, setTab] = useState<Sport>('NFL');
  const { data: stats, isLoading: statsLoading } = useStats();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">SBO Dashboard</h1>
        <p className="text-muted-foreground">Today's signals, LOCKs, and capper pick activity</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Trophy} label="Picks Today" value={stats?.picksToday ?? 0} loading={statsLoading} />
        <StatCard icon={Lock} label="LOCKs Today" value={stats?.locksToday ?? 0} loading={statsLoading} />
        <StatCard icon={Users} label="Active Cappers Today" value={stats?.activeCappers ?? 0} loading={statsLoading} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Sport)}>
        <TabsList className="flex flex-wrap h-auto">
          {SPORTS.map(s => <TabsTrigger key={s} value={s}>{s}</TabsTrigger>)}
        </TabsList>
        {SPORTS.map(s => (
          <TabsContent key={s} value={s} className="mt-4">
            <SportPanel sport={s} />
          </TabsContent>
        ))}
      </Tabs>

      <CapperPicksToday />
    </div>
  );
}
