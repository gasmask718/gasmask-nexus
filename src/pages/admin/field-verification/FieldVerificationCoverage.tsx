import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Grid3x3 } from 'lucide-react';
import { useCrewDrops, useCrewZones } from '@/hooks/useFieldVerification';

function barColor(pct: number) {
  if (pct >= 100) return 'bg-emerald-500';
  if (pct >= 66) return 'bg-lime-500';
  if (pct >= 33) return 'bg-amber-500';
  return 'bg-destructive';
}

export default function FieldVerificationCoverage() {
  const { data: zones, isLoading: zonesLoading, error: zonesError } = useCrewZones();
  const { data: drops, isLoading: dropsLoading, error: dropsError } = useCrewDrops();

  const cards = useMemo(() => {
    return (zones ?? []).map((z) => {
      const mine = (drops ?? []).filter((d) => d.zone_id === z.id);
      const verified = mine.filter((d) => d.status === 'verified').length;
      const target = Number(z.target_drops ?? 0);
      const pct = target > 0 ? Math.min(100, (mine.length / target) * 100) : 0;
      return {
        id: z.id,
        name: z.name || 'Unnamed zone',
        place: [z.city, z.state].filter(Boolean).join(', '),
        active: z.is_active !== false,
        target,
        actual: mine.length,
        verified,
        pct,
      };
    });
  }, [zones, drops]);

  const loading = zonesLoading || dropsLoading;
  const error = zonesError || dropsError;

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Grid3x3 className="h-6 w-6 text-primary" /> Coverage by Zone</h1>
        <p className="text-sm text-muted-foreground">Live drop counts against each zone’s target.</p>
      </div>

      {loading && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>}
      {error && <Card><CardContent className="p-4 text-sm text-destructive">{(error as Error).message}</CardContent></Card>}
      {!loading && !error && cards.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No zones have been set up yet.</CardContent></Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <span>{c.name}</span>
                {!c.active && <Badge variant="secondary">Inactive</Badge>}
              </CardTitle>
              {c.place && <p className="text-xs text-muted-foreground">{c.place}</p>}
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-2xl font-bold">{c.actual}</span>
                <span className="text-muted-foreground">of {c.target || '—'} target</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className={`h-full ${barColor(c.pct)}`} style={{ width: `${c.pct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">
                {c.target > 0 ? `${Math.round(c.pct)}% of target` : 'No target set'} · {c.verified} verified
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
