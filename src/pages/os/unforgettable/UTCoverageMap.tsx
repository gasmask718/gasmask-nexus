import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GeoMapView, type GeoPoint } from '@/components/map/GeoMapView';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { MapPin, ArrowRight } from 'lucide-react';

/** Canonical business_leads.category values, grouped into service groups. */
const SERVICE_GROUPS: { key: string; label: string; categories: string[] }[] = [
  { key: 'venues', label: 'Venues', categories: ['event_hall', 'nightclub'] },
  { key: 'rentals', label: 'Rentals', categories: ['rental_company', 'party_bus', 'limo', 'exotic_car', 'yacht', 'transportation', 'chauffeur'] },
  { key: 'food_bev', label: 'Food & Bev', categories: ['caterer', 'bartender', 'private_chef'] },
  { key: 'creative', label: 'Creative', categories: ['photographer', 'videographer', 'photo_booth', 'decorator', 'florist', 'lighting'] },
  { key: 'talent', label: 'Talent', categories: ['entertainer', 'dj', 'event_planner', 'beauty'] },
  { key: 'staffing_ops', label: 'Staffing & Ops', categories: ['staff', 'security', 'security_firm', 'cleaner', 'authenticator', 'other'] },
];

const PHASE_COLORS: Record<string, string> = {
  '1': '#22c55e',
  '2': '#eab308',
  '3': '#f97316',
  '4': '#6366f1',
};

type SourceFilter = 'all' | 'google_places' | 'overture';

interface CoverageMetro {
  metro_id: number;
  metro_name: string;
  state: string | null;
  phase: number | null;
  latitude: number | null;
  longitude: number | null;
  total_n: number;
  overture_n: number;
  places_n: number;
  security_n: number;
}

interface CoverageBreakdown {
  metro_id: number;
  metro_name: string;
  category: string | null;
  source: string | null;
  n: number;
}

export default function UTCoverageMap() {
  const [activeGroups, setActiveGroups] = useState<string[]>([]);
  const [source, setSource] = useState<SourceFilter>('all');
  const [selected, setSelected] = useState<CoverageMetro | null>(null);

  const { data: metros = [], isLoading, error } = useQuery({
    queryKey: ['ut-coverage-by-metro'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ut_coverage_by_metro')
        .select('metro_id, metro_name, state, phase, latitude, longitude, total_n, overture_n, places_n, security_n');
      if (error) throw error;
      return (data || []) as unknown as CoverageMetro[];
    },
  });

  const { data: breakdown = [] } = useQuery({
    queryKey: ['ut-coverage-by-metro-category'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ut_coverage_by_metro_category')
        .select('metro_id, metro_name, category, source, n');
      if (error) throw error;
      return (data || []) as unknown as CoverageBreakdown[];
    },
  });

  const selectedCategories = useMemo(() => {
    if (activeGroups.length === 0) return null;
    return new Set(
      SERVICE_GROUPS.filter(g => activeGroups.includes(g.key)).flatMap(g => g.categories),
    );
  }, [activeGroups]);

  /** Filtered count per metro. Falls back to the summary view when no filter is applied. */
  const filteredCounts = useMemo(() => {
    const map = new Map<number, number>();
    if (!selectedCategories && source === 'all') {
      for (const m of metros) map.set(m.metro_id, Number(m.total_n) || 0);
      return map;
    }
    for (const row of breakdown) {
      if (selectedCategories && !selectedCategories.has(row.category || '')) continue;
      if (source !== 'all' && row.source !== source) continue;
      map.set(row.metro_id, (map.get(row.metro_id) || 0) + (Number(row.n) || 0));
    }
    for (const m of metros) if (!map.has(m.metro_id)) map.set(m.metro_id, 0);
    return map;
  }, [metros, breakdown, selectedCategories, source]);

  const maxCount = useMemo(
    () => Math.max(1, ...Array.from(filteredCounts.values())),
    [filteredCounts],
  );

  const points = useMemo<GeoPoint[]>(
    () =>
      metros
        .filter(m => m.latitude != null && m.longitude != null)
        .map(m => {
          const n = filteredCounts.get(m.metro_id) ?? 0;
          return {
            id: String(m.metro_id),
            lng: m.longitude!,
            lat: m.latitude!,
            title: m.metro_name,
            subtitle: `${m.state || '—'} · ${n.toLocaleString()} leads`,
            statusKey: String(m.phase ?? ''),
            // pin size = total_n (sqrt-scaled so large metros stay readable)
            radius: 6 + Math.sqrt(n / maxCount) * 28,
            meta: { ...m, filtered_n: n } as unknown as Record<string, any>,
          } as GeoPoint & { radius: number };
        }),
    [metros, filteredCounts, maxCount],
  );

  const toggleGroup = (key: string) =>
    setActiveGroups(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));

  const outreachHref = selected
    ? `/os/unforgettable/outreach?metro=${encodeURIComponent(selected.metro_name)}&source=${source}`
    : '#';

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MapPin className="h-6 w-6 text-primary" /> Coverage Map
        </h1>
        <p className="text-sm text-muted-foreground">
          {metros.length} metros · pin size = lead volume · colour = phase
        </p>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-2">
          {SERVICE_GROUPS.map(g => (
            <Button
              key={g.key}
              size="sm"
              variant={activeGroups.includes(g.key) ? 'default' : 'outline'}
              onClick={() => toggleGroup(g.key)}
            >
              {g.label}
            </Button>
          ))}
          {activeGroups.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setActiveGroups([])}>
              Clear
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Lead source</span>
            <Select value={source} onValueChange={v => setSource(v as SourceFilter)}>
              <SelectTrigger className="w-[170px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="google_places">Google Places</SelectItem>
                <SelectItem value="overture">Overture</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {Object.entries(PHASE_COLORS).map(([phase, color]) => (
          <span key={phase} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            Phase {phase}
          </span>
        ))}
      </div>

      {error && (
        <p className="text-sm text-destructive">{(error as Error).message}</p>
      )}

      <GeoMapView
        points={points}
        statusColors={PHASE_COLORS}
        initialCenter={[-98.5, 39.5]}
        initialZoom={3.4}
        clustering={false}
        showHulls={false}
        searchPlaceholder="Search metros..."
        searchFields={p => {
          const m = p.meta as CoverageMetro;
          return [m?.metro_name || '', m?.state || ''];
        }}
        onPointClick={p => setSelected(p.meta as unknown as CoverageMetro)}
        emptyState={
          <p className="text-sm text-muted-foreground py-8 text-center">
            {isLoading ? 'Loading metros…' : 'No metros found'}
          </p>
        }
        renderPopupHTML={p => {
          const m = p.meta as CoverageMetro & { filtered_n: number };
          return `<div style="color:#000;font-size:12px"><strong>${m.metro_name}</strong><br/><span style="color:#555">${m.state || '—'} · Phase ${m.phase ?? '—'}</span><br/><span style="color:#888">${(m.filtered_n ?? 0).toLocaleString()} leads</span></div>`;
        }}
        renderListItem={p => {
          const m = p.meta as CoverageMetro & { filtered_n: number };
          return (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{m.metro_name}</p>
                <p className="text-xs text-muted-foreground">{m.state || '—'}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="text-[10px]">Phase {m.phase ?? '—'}</Badge>
                <span className="text-xs font-semibold">{(m.filtered_n ?? 0).toLocaleString()}</span>
              </div>
            </div>
          );
        }}
      />

      <Sheet open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selected.metro_name}
                  <span
                    className={cn('h-2.5 w-2.5 rounded-full')}
                    style={{ backgroundColor: PHASE_COLORS[String(selected.phase ?? '')] || '#6b7280' }}
                  />
                </SheetTitle>
                <SheetDescription>
                  {selected.state || '—'} · Phase {selected.phase ?? '—'}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-2 text-sm">
                <div className="flex items-center justify-between border-b border-border py-1.5">
                  <span className="text-muted-foreground">Overture</span>
                  <span className="font-semibold">{Number(selected.overture_n).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between border-b border-border py-1.5">
                  <span className="text-muted-foreground">Google Places</span>
                  <span className="font-semibold">{Number(selected.places_n).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between border-b border-border py-1.5">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold">{Number(selected.total_n).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-muted-foreground">Security</span>
                  <span className="font-semibold">{Number(selected.security_n).toLocaleString()}</span>
                </div>
              </div>

              <Button asChild className="w-full mt-6">
                <Link to={outreachHref}>
                  Open in Floor 2 Outreach Command
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
              <p className="text-[11px] text-muted-foreground mt-2">
                Floor 2 does not yet read the metro parameter — the link carries it for when it does.
              </p>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
