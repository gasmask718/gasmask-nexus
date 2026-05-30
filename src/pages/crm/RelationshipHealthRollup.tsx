import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronRight, ChevronDown, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  STORE_RELATIONSHIP_STATUSES,
  RELATIONSHIP_STATUS_COLORS,
  RELATIONSHIP_STATUS_SHORT,
  type StoreRelationshipStatus,
} from '@/config/storeRelationshipStatus';

interface RollupRow {
  state: string;
  city: string;
  neighborhood: string;
  borough_id: string | null;
  total: number;
  active_good: number;
  non_active_new: number;
  follow_up: number;
  not_interested: number;
  not_interested_sold_past: number;
  no_tobacco: number;
  selling_slow: number;
  need_promo: number;
  closed_permanently: number;
}

const FIELD_BY_STATUS: Record<StoreRelationshipStatus, keyof RollupRow> = {
  'Active (Good)':                       'active_good',
  'Non-active (New - need to speak)':    'non_active_new',
  'Follow-up (secure relationship)':     'follow_up',
  'Not interested':                      'not_interested',
  'Not interested - sold in past':       'not_interested_sold_past',
  'No tobacco':                          'no_tobacco',
  'Selling slow':                        'selling_slow',
  'Need promo (bring samples)':          'need_promo',
  'Closed permanently':                  'closed_permanently',
};

function StatusBar({ row }: { row: RollupRow }) {
  return (
    <div className="flex flex-wrap gap-1">
      {STORE_RELATIONSHIP_STATUSES.map((s) => {
        const n = row[FIELD_BY_STATUS[s]] as number;
        if (!n) return null;
        return (
          <Badge
            key={s}
            variant="outline"
            className={cn('text-[10px] font-medium', RELATIONSHIP_STATUS_COLORS[s])}
            title={s}
          >
            {RELATIONSHIP_STATUS_SHORT[s]} · {n}
          </Badge>
        );
      })}
    </div>
  );
}

function aggregate(rows: RollupRow[], group: (r: RollupRow) => string) {
  const map = new Map<string, RollupRow>();
  for (const r of rows) {
    const k = group(r);
    const cur = map.get(k) ?? {
      state: r.state, city: r.city, neighborhood: r.neighborhood, borough_id: r.borough_id,
      total: 0, active_good: 0, non_active_new: 0, follow_up: 0,
      not_interested: 0, not_interested_sold_past: 0, no_tobacco: 0,
      selling_slow: 0, need_promo: 0, closed_permanently: 0,
    };
    cur.total += r.total;
    cur.active_good += r.active_good;
    cur.non_active_new += r.non_active_new;
    cur.follow_up += r.follow_up;
    cur.not_interested += r.not_interested;
    cur.not_interested_sold_past += r.not_interested_sold_past;
    cur.no_tobacco += r.no_tobacco;
    cur.selling_slow += r.selling_slow;
    cur.need_promo += r.need_promo;
    cur.closed_permanently += r.closed_permanently;
    map.set(k, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export default function RelationshipHealthRollup() {
  const [expandedStates, setExpandedStates] = useState<Set<string>>(new Set());
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['store-relationship-rollup'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_store_relationship_rollup' as any)
        .select('*');
      if (error) throw error;
      return (data || []) as RollupRow[];
    },
  });

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.state.toLowerCase().includes(q) ||
      r.city.toLowerCase().includes(q) ||
      r.neighborhood.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const stateRows = useMemo(() => aggregate(filtered, r => r.state), [filtered]);
  const cityRowsByState = useMemo(() => {
    const m = new Map<string, RollupRow[]>();
    for (const s of stateRows) {
      m.set(s.state, aggregate(filtered.filter(r => r.state === s.state), r => r.city));
    }
    return m;
  }, [stateRows, filtered]);

  const toggleState = (s: string) => {
    const next = new Set(expandedStates);
    next.has(s) ? next.delete(s) : next.add(s);
    setExpandedStates(next);
  };
  const toggleCity = (key: string) => {
    const next = new Set(expandedCities);
    next.has(key) ? next.delete(key) : next.add(key);
    setExpandedCities(next);
  };

  const totals = useMemo(() => aggregate(filtered, () => 'all')[0], [filtered]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MapPin className="h-6 w-6" /> Relationship Health Rollup
        </h1>
        <p className="text-sm text-muted-foreground">
          Store relationship status breakdown by State → City → Neighborhood.
        </p>
      </div>

      {totals && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">All territories · {totals.total} stores</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBar row={totals} />
          </CardContent>
        </Card>
      )}

      <Input
        placeholder="Search state, city, or neighborhood..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      {isLoading && <p className="text-muted-foreground">Loading…</p>}

      <div className="space-y-2">
        {stateRows.map((sr) => {
          const stateOpen = expandedStates.has(sr.state);
          const cities = cityRowsByState.get(sr.state) || [];
          return (
            <Card key={sr.state}>
              <CardHeader className="py-3 cursor-pointer" onClick={() => toggleState(sr.state)}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    {stateOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span className="font-semibold">{sr.state}</span>
                    <Badge variant="secondary">{sr.total}</Badge>
                  </div>
                  <StatusBar row={sr} />
                </div>
              </CardHeader>
              {stateOpen && (
                <CardContent className="pt-0 space-y-1">
                  {cities.map((cr) => {
                    const cityKey = `${sr.state}::${cr.city}`;
                    const cityOpen = expandedCities.has(cityKey);
                    const nbhs = aggregate(
                      filtered.filter(r => r.state === sr.state && r.city === cr.city),
                      r => r.neighborhood,
                    );
                    return (
                      <div key={cityKey} className="border-l-2 border-border ml-2 pl-3">
                        <div className="flex items-center justify-between gap-4 py-2 cursor-pointer hover:bg-muted/30 rounded" onClick={() => toggleCity(cityKey)}>
                          <div className="flex items-center gap-2">
                            {cityOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <span className="text-sm font-medium">{cr.city}</span>
                            <Badge variant="outline">{cr.total}</Badge>
                          </div>
                          <StatusBar row={cr} />
                        </div>
                        {cityOpen && (
                          <div className="ml-5 space-y-1 pb-2">
                            {nbhs.map((nr) => (
                              <div key={`${cityKey}::${nr.neighborhood}`} className="flex items-center justify-between gap-4 py-1.5 text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">↳</span>
                                  <span>{nr.neighborhood}</span>
                                  <Badge variant="outline" className="text-xs">{nr.total}</Badge>
                                </div>
                                <StatusBar row={nr} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Neighborhood granularity comes from <code>store_master.borough_id</code>;
        stores without one show under "Unspecified". Closed-permanently stores
        are also excluded from dispatch.
      </p>
      <div className="pt-2">
        <Button variant="outline" size="sm" asChild>
          <a href="/stores">Open store directory</a>
        </Button>
      </div>
    </div>
  );
}
