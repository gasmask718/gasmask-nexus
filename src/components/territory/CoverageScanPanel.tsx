import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Scan, Phone, MapPin, Store, Plus, Loader2, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  city: string;
  state: string;
  /** When omitted, scan runs at city scope (every neighborhood) */
  neighborhood?: string;
}

type CoverageRow = {
  row_id: string;
  coverage_status: 'have' | 'donthave';
  name: string;
  address: string;
  city: string;
  state: string;
  neighborhood: string | null;
  phone: string | null;
  place_id: string | null;
  store_id: string | null;
  relationship_status: string | null;
  territory_address_id: string | null;
  match_score: number | null;
};

/**
 * CoverageScanPanel
 * GasMask territory intelligence — discovers every smoke / tobacco /
 * convenience store that EXISTS in an area, splits into HAVE vs DON'T-HAVE,
 * and lets a rep promote a prospect via the existing
 * `request_store_promotion` RPC (NEVER inflates active-store KPIs).
 */
export function CoverageScanPanel({ city, state, neighborhood }: Props) {
  const qc = useQueryClient();
  const scope = neighborhood ? 'neighborhood' : 'city';
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'have' | 'donthave'>('donthave');

  // Most recent scan (cache freshness UI)
  const lastScan = useQuery({
    queryKey: ['coverage-last-scan', scope, city, state, neighborhood],
    queryFn: async () => {
      let q = supabase
        .from('territory_coverage_scans')
        .select('*')
        .eq('scope', scope)
        .eq('city', city)
        .eq('state', state)
        .order('scanned_at', { ascending: false })
        .limit(1);
      q = neighborhood ? q.eq('neighborhood', neighborhood) : q.is('neighborhood', null);
      const { data } = await q.maybeSingle();
      return data;
    },
  });

  // Universe rows for this area
  const universe = useQuery<CoverageRow[]>({
    queryKey: ['coverage-universe', city, state, neighborhood],
    queryFn: async () => {
      let q = supabase
        .from('v_neighborhood_coverage_universe' as any)
        .select('*')
        .ilike('city', `%${city}%`)
        .ilike('state', `%${state}%`)
        .limit(2000);
      if (neighborhood) q = q.eq('neighborhood', neighborhood);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const scan = useMutation({
    mutationFn: async (force: boolean) => {
      const { data, error } = await supabase.functions.invoke('coverage-scan', {
        body: { city, state, neighborhood, force },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.cached) {
        toast.info('Using recent scan (cached). Click "Force re-scan" to refresh from Google.');
      } else {
        toast.success(`Scan complete: ${data?.have ?? 0} we have / ${data?.donthave ?? 0} we don't`);
      }
      qc.invalidateQueries({ queryKey: ['coverage-last-scan'] });
      qc.invalidateQueries({ queryKey: ['coverage-universe'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Scan failed'),
  });

  const promote = useMutation({
    mutationFn: async (row: CoverageRow) => {
      if (!row.territory_address_id) throw new Error('Missing address id');
      const { error } = await supabase.rpc('request_store_promotion', {
        p_territory_address_id: row.territory_address_id,
        p_proposed_store_name: row.name,
        p_proposed_phone: row.phone,
        p_verified_sells_tobacco: true,
        p_verification_method: 'visit',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Promotion requested — awaiting admin approval');
      qc.invalidateQueries({ queryKey: ['coverage-universe'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Promotion failed'),
  });

  const rows = universe.data ?? [];
  const have = rows.filter((r) => r.coverage_status === 'have').length;
  const donthave = rows.filter((r) => r.coverage_status === 'donthave').length;
  const total = rows.length;

  const visible = rows
    .filter((r) => filter === 'all' || r.coverage_status === filter)
    .filter((r) =>
      !search
        ? true
        : (r.name || '').toLowerCase().includes(search.toLowerCase()) ||
          (r.address || '').toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      // prospects first
      if (a.coverage_status !== b.coverage_status)
        return a.coverage_status === 'donthave' ? -1 : 1;
      return (a.name || '').localeCompare(b.name || '');
    })
    .slice(0, 300);

  const label = neighborhood ? `${neighborhood}` : `${city}`;
  const lastScanAt = lastScan.data?.scanned_at
    ? new Date(lastScan.data.scanned_at as string).toLocaleString()
    : 'never';

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Scan className="h-4 w-4 text-primary" /> Full-Coverage Intelligence — {label}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Every smoke / tobacco / convenience store that EXISTS — what we have vs what we're missing.
            Last scan: <span className="font-medium">{lastScanAt}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => scan.mutate(false)} disabled={scan.isPending}>
            {scan.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Scan className="h-3 w-3" />}
            Scan
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => scan.mutate(true)}
            disabled={scan.isPending}
            title="Bypass 7-day cache"
          >
            <RefreshCcw className="h-3 w-3" /> Force
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Coverage counts */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-md border bg-muted/40 p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Shops exist</div>
            <div className="text-2xl font-bold tabular-nums">{total.toLocaleString()}</div>
          </div>
          <div className="rounded-md border bg-emerald-50 dark:bg-emerald-950/30 p-3">
            <div className="text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300">We have</div>
            <div className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{have.toLocaleString()}</div>
          </div>
          <div className="rounded-md border bg-amber-50 dark:bg-amber-950/30 p-3">
            <div className="text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300">We don't (prospect)</div>
            <div className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-300">{donthave.toLocaleString()}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {(['donthave', 'have', 'all'] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              onClick={() => setFilter(f)}
            >
              {f === 'donthave' ? "Don't have" : f === 'have' ? 'We have' : 'All'}
            </Button>
          ))}
          <Input
            placeholder="Search by name or address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs h-9"
          />
        </div>

        {/* List */}
        {universe.isLoading ? (
          <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : visible.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            No rows. Run a scan to discover stores that exist in this area.
          </div>
        ) : (
          <div className="divide-y rounded-md border">
            {visible.map((r) => (
              <div key={r.row_id} className="grid grid-cols-12 gap-2 px-3 py-2 items-center text-sm">
                <div className="col-span-5 min-w-0">
                  <div className="font-medium truncate flex items-center gap-2">
                    {r.coverage_status === 'have' ? (
                      <Store className="h-3 w-3 text-emerald-600 shrink-0" />
                    ) : (
                      <MapPin className="h-3 w-3 text-amber-600 shrink-0" />
                    )}
                    <span className="truncate">{r.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{r.address}</div>
                </div>
                <div className="col-span-2 text-xs text-muted-foreground truncate">
                  {r.phone ? (
                    <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone}</span>
                  ) : '—'}
                </div>
                <div className="col-span-3">
                  {r.coverage_status === 'have' ? (
                    <Badge variant="secondary" className="text-[10px]">{r.relationship_status || 'active'}</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700">
                      Prospect / Never contacted
                    </Badge>
                  )}
                  {r.match_score != null && (
                    <span className="ml-2 text-[10px] text-muted-foreground">match {Math.round(r.match_score * 100)}%</span>
                  )}
                </div>
                <div className="col-span-2 flex justify-end">
                  {r.coverage_status === 'donthave' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => promote.mutate(r)}
                      disabled={promote.isPending}
                    >
                      <Plus className="h-3 w-3" /> Promote
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
