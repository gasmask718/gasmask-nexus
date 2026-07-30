import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AlertTriangle, Loader2, DollarSign } from 'lucide-react';
import { useUTApiBudget, useUTApiBudgetControls } from '@/hooks/useUTApiBudget';

const money = (v: number | null | undefined) =>
  `$${Number(v ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function barClass(status: string, paused: boolean) {
  if (paused || status === 'depleted') return 'bg-red-500';
  if (status === 'critical') return 'bg-orange-500';
  if (status === 'warning') return 'bg-amber-500';
  return 'bg-emerald-500';
}

function badgeClass(status: string, paused: boolean) {
  if (paused || status === 'depleted') return 'bg-red-500/10 text-red-500 border-red-500/40';
  if (status === 'critical') return 'bg-orange-500/10 text-orange-500 border-orange-500/40';
  if (status === 'warning') return 'bg-amber-500/10 text-amber-500 border-amber-500/40';
  return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/40';
}

export default function ApiBudgetCard() {
  const { data, isLoading, error } = useUTApiBudget();
  const { setManualPause, clearAutoPause } = useUTApiBudgetControls();

  if (isLoading) {
    return (
      <Card><CardContent className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading API budget…
      </CardContent></Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-red-500/40"><CardContent className="p-6 text-sm text-red-500">
        Budget status unavailable{error ? `: ${(error as any).message}` : ''}
      </CardContent></Card>
    );
  }

  const limit = Number(data.monthly_limit ?? 0);
  const remaining = Number(data.month_remaining ?? 0);
  const usedPct = limit > 0 ? Math.min(100, Math.max(0, ((limit - remaining) / limit) * 100)) : 0;
  const paused = Boolean(data.is_paused);

  return (
    <Card className={paused ? 'border-red-500/50' : undefined}>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="h-4 w-4" /> Google Places API Budget
        </CardTitle>
        <Badge variant="outline" className={badgeClass(data.status, paused)}>
          {paused ? 'PAUSED' : String(data.status || '').toUpperCase()}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        {data.auto_paused && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-red-500/40 bg-red-500/10 p-3">
            <p className="text-sm font-medium text-red-500 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> AUTO-PAUSED — monthly budget depleted.
            </p>
            <Button size="sm" variant="outline" onClick={() => clearAutoPause.mutate()} disabled={clearAutoPause.isPending}>
              {clearAutoPause.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Resume
            </Button>
          </div>
        )}

        <div>
          <p className="text-3xl font-bold">
            {money(remaining)} <span className="text-base font-normal text-muted-foreground">of {money(limit)}</span>
          </p>
          <p className="text-xs text-muted-foreground">Remaining this month</p>
        </div>

        <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barClass(data.status, paused)}`} style={{ width: `${usedPct}%` }} />
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Spend today</p>
            <p className="font-semibold">{money(data.spend_today)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Spend this month</p>
            <p className="font-semibold">{money(data.spend_month)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Total API calls</p>
            <p className="font-semibold">{Number(data.calls_total ?? 0).toLocaleString()}</p>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <div>
            <p className="text-sm font-medium">Manual pause</p>
            <p className="text-xs text-muted-foreground">Blocks all Places API spend immediately</p>
          </div>
          <div className="flex items-center gap-2">
            {setManualPause.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <Switch
              checked={Boolean(data.manual_pause)}
              disabled={setManualPause.isPending}
              onCheckedChange={(v) => setManualPause.mutate(v)}
            />
          </div>
        </div>

        {(setManualPause.error || clearAutoPause.error) && (
          <p className="text-xs text-red-500">
            {((setManualPause.error || clearAutoPause.error) as any)?.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
