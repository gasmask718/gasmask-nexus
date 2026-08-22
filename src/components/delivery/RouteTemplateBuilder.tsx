import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Map, Zap, CalendarDays, User, Info } from 'lucide-react';
import { toast } from 'sonner';

interface Template {
  id: string;
  name: string;
  description: string | null;
  worker_type: string;
  default_territory: string | null;
  scope: string | null;
}

interface TemplateStats {
  total: number;
  withSignal: number;
}

interface AssignablePerson {
  userId: string;
  name: string;
  role: 'driver' | 'biker' | 'ambassador';
}

const PAGE = 1000;

// Paginated fetch (PostgREST caps at 1000 rows/request)
async function fetchAllRows(table: string, select: string): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await (supabase as any).from(table).select(select).range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE) break;
  }
  return rows;
}

const SCOPE_META: Record<string, { label: string; hint: string }> = {
  borough: { label: 'City / Borough', hint: 'Assign a whole city to one person.' },
  corridor: { label: 'Corridor', hint: 'A run within a city — one corridor is not one day’s work.' },
  special: { label: 'Special', hint: 'Cross-cutting sweeps: inventory counts, collections, wholesale calls.' },
};

export function RouteTemplateBuilder() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [workerUserId, setWorkerUserId] = useState<string>('');
  const [maxStops, setMaxStops] = useState('25');
  const [signalOnly, setSignalOnly] = useState(true);
  const [building, setBuilding] = useState(false);

  const { data: templates = [], isLoading: tplLoading } = useQuery<Template[]>({
    queryKey: ['route-templates-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('route_templates')
        .select('id, name, description, worker_type, default_territory, scope')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Stop counts per template + how many stops currently have an open signal.
  // "Open signal" matches the RPC exactly: presence in v_route_command_center.
  const { data: stats = {}, isLoading: statsLoading } = useQuery<Record<string, TemplateStats>>({
    queryKey: ['route-template-stats'],
    queryFn: async () => {
      const [stops, signals] = await Promise.all([
        fetchAllRows('route_template_stops', 'template_id, store_id'),
        fetchAllRows('v_route_command_center', 'store_id'),
      ]);
      const signalSet = new Set<string>(signals.map((s: any) => s.store_id));
      const out: Record<string, TemplateStats> = {};
      for (const s of stops) {
        const st = (out[s.template_id] ??= { total: 0, withSignal: 0 });
        st.total++;
        if (signalSet.has(s.store_id)) st.withSignal++;
      }
      return out;
    },
    staleTime: 60_000,
  });

  const { data: people = [] } = useQuery<AssignablePerson[]>({
    queryKey: ['template-assignable-people'],
    queryFn: async () => {
      const [drv, bk, amb] = await Promise.all([
        supabase.from('drivers').select('full_name, user_id').eq('status', 'active').not('user_id', 'is', null).order('full_name'),
        supabase.from('bikers').select('full_name, user_id').eq('status', 'active').not('user_id', 'is', null).order('full_name'),
        supabase.from('ambassadors').select('name, user_id').eq('is_active', true).not('user_id', 'is', null).order('name'),
      ]);
      if (drv.error) throw drv.error;
      if (bk.error) throw bk.error;
      if (amb.error) throw amb.error;
      return [
        ...(drv.data ?? []).map((r: any) => ({ userId: r.user_id, name: r.full_name || 'Driver', role: 'driver' as const })),
        ...(bk.data ?? []).map((r: any) => ({ userId: r.user_id, name: r.full_name || 'Biker', role: 'biker' as const })),
        ...(amb.data ?? []).map((r: any) => ({ userId: r.user_id, name: (r.name || '').trim() || 'Ambassador', role: 'ambassador' as const })),
      ];
    },
  });

  const selected = templates.find(t => t.id === selectedId) ?? null;
  const selectedPerson = people.find(p => p.userId === workerUserId) ?? null;

  // Prefer people whose role matches the template's worker_type
  const sortedPeople = useMemo(() => {
    if (!selected) return people;
    const wt = selected.worker_type;
    return [...people].sort((a, b) => {
      const am = a.role === wt ? 0 : 1;
      const bm = b.role === wt ? 0 : 1;
      return am - bm || a.name.localeCompare(b.name);
    });
  }, [people, selected]);

  const byScope = useMemo(() => {
    const g: Record<string, Template[]> = { borough: [], corridor: [], special: [] };
    templates.forEach(t => {
      const s = t.scope && g[t.scope] ? t.scope : 'corridor';
      g[s].push(t);
    });
    return g;
  }, [templates]);

  async function buildRoute() {
    if (!selected) return;
    const max = parseInt(maxStops, 10);
    if (maxStops.trim() !== '' && (Number.isNaN(max) || max <= 0)) {
      toast.error('Max stops must be a positive number (or clear it for no limit).');
      return;
    }
    setBuilding(true);
    try {
      const { data, error } = await supabase.rpc('create_route_from_template', {
        p_template_id: selected.id,
        p_date: date,
        p_assigned_to: selectedPerson?.userId ?? undefined,
        p_worker_name: selectedPerson?.name ?? undefined,
        p_max_stops: maxStops.trim() === '' ? undefined : max,
        p_only_with_signal: signalOnly,
      });
      if (error) throw error;
      toast.success(`Route built from “${selected.name}”.`);
      navigate(`/routes/${data}`);
    } catch (e: any) {
      toast.error(`Build failed: ${e.message ?? e}`);
      console.error('[RouteTemplateBuilder] create_route_from_template error', e);
    } finally {
      setBuilding(false);
    }
  }

  function renderTemplate(t: Template) {
    const st = stats[t.id];
    const active = selectedId === t.id;
    return (
      <button
        key={t.id}
        onClick={() => setSelectedId(active ? null : t.id)}
        className={`w-full text-left rounded-lg border p-3 transition-colors ${
          active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm">{t.name}</span>
          <Badge variant="outline" className="text-[10px] shrink-0">{t.worker_type}</Badge>
        </div>
        {t.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2 text-xs">
          <span className="text-muted-foreground">
            {statsLoading ? '…' : `${st?.total ?? 0} stops`}
          </span>
          <span className={st?.withSignal ? 'text-amber-400 font-medium' : 'text-muted-foreground'}>
            {statsLoading ? '' : `${st?.withSignal ?? 0} with open signal`}
          </span>
          {t.default_territory && (
            <span className="text-muted-foreground ml-auto">{t.default_territory}</span>
          )}
        </div>
      </button>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Map className="h-4 w-4 text-primary" />
          Route Templates
          <span className="text-xs font-normal text-muted-foreground">
            — saved coverage maps; build a day’s route from one
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {tplLoading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <Tabs defaultValue="borough">
            <TabsList>
              {(['borough', 'corridor', 'special'] as const).map(s => (
                <TabsTrigger key={s} value={s}>
                  {SCOPE_META[s].label} ({byScope[s]?.length ?? 0})
                </TabsTrigger>
              ))}
            </TabsList>
            {(['borough', 'corridor', 'special'] as const).map(s => (
              <TabsContent key={s} value={s} className="space-y-2">
                <p className="text-xs text-muted-foreground">{SCOPE_META[s].hint}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                  {(byScope[s] ?? []).map(renderTemplate)}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}

        {selected && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-4">
            <div className="text-sm font-medium">
              Build from “{selected.name}”
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {stats[selected.id]?.total ?? 0} stops · {stats[selected.id]?.withSignal ?? 0} with open signal
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Date</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><User className="h-3 w-3" /> Worker (optional)</Label>
                <Select value={workerUserId} onValueChange={setWorkerUserId}>
                  <SelectTrigger><SelectValue placeholder="Assign later" /></SelectTrigger>
                  <SelectContent>
                    {sortedPeople.map(p => (
                      <SelectItem key={p.userId} value={p.userId}>
                        {p.name} · {p.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Max stops</Label>
                <Input
                  type="number"
                  min={1}
                  value={maxStops}
                  onChange={e => setMaxStops(e.target.value)}
                  placeholder="25"
                />
                <p className="text-[11px] text-muted-foreground flex gap-1">
                  <Info className="h-3 w-3 mt-0.5 shrink-0" />
                  A corridor is not one day’s work — this template has {stats[selected.id]?.total ?? 0} stops.
                  The build takes the first N in saved order. Clear for no limit.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Signal filter</Label>
                <label className="flex items-start gap-2 rounded-md border border-border p-2 cursor-pointer">
                  <Checkbox
                    checked={signalOnly}
                    onCheckedChange={(c) => setSignalOnly(c === true)}
                    className="mt-0.5"
                  />
                  <span className="text-xs">
                    Only stores with an open signal
                    <span className="block text-[11px] text-muted-foreground">
                      Money owed, low stock, or at-risk — narrows this template to{' '}
                      {stats[selected.id]?.withSignal ?? 0} of {stats[selected.id]?.total ?? 0} stops today.
                    </span>
                  </span>
                </label>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={buildRoute} disabled={building || !date}>
                {building ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                Build route
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Stores already on another route that day are skipped automatically.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
