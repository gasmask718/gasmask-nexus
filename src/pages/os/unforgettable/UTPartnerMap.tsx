import { useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GeoMapView, type GeoPoint } from '@/components/map/GeoMapView';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ChevronDown, MapPin, RotateCcw, Star, ExternalLink, Phone, Globe, Loader2 } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY → COLOUR TIER
// Colour is grouped into 7 readable tiers. Filtering stays granular (raw
// category). Unknown / newly-scraped categories fall back to 'other'.
// ═══════════════════════════════════════════════════════════════════════════
export const CATEGORY_TIERS = {
  event_hall: '#ef4444',
  rental_company: '#3b82f6',
  food: '#f59e0b',
  services: '#8b5cf6',
  entertainment: '#ec4899',
  support: '#64748b',
  other: '#9ca3af',
} as const;

export type CategoryTier = keyof typeof CATEGORY_TIERS;

export const CATEGORY_TO_TIER: Record<string, CategoryTier> = {
  event_hall: 'event_hall',
  rental_company: 'rental_company',
  caterer: 'food',
  bartender: 'food',
  florist: 'services',
  photographer: 'services',
  videographer: 'services',
  decorator: 'services',
  event_planner: 'services',
  transportation: 'services',
  entertainer: 'entertainment',
  dj: 'entertainment',
  photo_booth: 'entertainment',
  lighting: 'entertainment',
  security: 'support',
  staff: 'support',
  cleaner: 'support',
  other: 'other',
};

export function tierForCategory(category?: string | null): CategoryTier {
  if (!category) return 'other';
  return CATEGORY_TO_TIER[category] ?? 'other';
}

const TIER_LABELS: Record<CategoryTier, string> = {
  event_hall: 'Event Halls',
  rental_company: 'Rental Companies',
  food: 'Food & Beverage',
  services: 'Creative Services',
  entertainment: 'Entertainment',
  support: 'Support Staff',
  other: 'Unclassified',
};

const TIER_ORDER: CategoryTier[] = [
  'event_hall', 'rental_company', 'food', 'services', 'entertainment', 'support', 'other',
];

const KNOWN_CATEGORIES = Object.keys(CATEGORY_TO_TIER).sort();
const STATUS_OPTIONS = ['new', 'needs_enrichment', 'contacted', 'onboarded'];

interface PartnerLead {
  id: string;
  business_name: string | null;
  category: string | null;
  category_group: string | null;
  phone: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  full_address: string | null;
  latitude: number | null;
  longitude: number | null;
  google_rating: number | null;
  review_count: number | null;
  status: string | null;
  external_place_id: string | null;
  maps_url: string | null;
  times_seen: number | null;
}

const SELECT_COLS =
  'id, business_name, category, category_group, phone, website, city, state, full_address, latitude, longitude, google_rating, review_count, status, external_place_id, maps_url, times_seen';

const PAGE = 1000;

async function fetchPartnerLeads(): Promise<PartnerLead[]> {
  const rows: PartnerLead[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('ut_partner_leads')
      .select(SELECT_COLS)
      .is('duplicate_of', null)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = (data ?? []) as unknown as PartnerLead[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  // Truncation canary — a future silent cap will be visible here.
  console.info(`[UTPartnerMap] fetched ${rows.length} geocoded, non-duplicate partner leads`);
  return rows;
}

function useMultiSelect(initial: string[] = []) {
  const [selected, setSelected] = useState<string[]>(initial);
  const toggle = useCallback((v: string) => {
    setSelected(prev => (prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]));
  }, []);
  return { selected, setSelected, toggle };
}

function MultiSelect({
  label, options, selected, onToggle, onClear,
}: {
  label: string;
  options: { value: string; count: number }[];
  selected: string[];
  onToggle: (v: string) => void;
  onClear: () => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="justify-between min-w-[170px]">
          <span className="truncate">
            {label}{selected.length > 0 ? ` (${selected.length})` : ''}
          </span>
          <ChevronDown className="h-4 w-4 ml-2 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onClear}>Clear</Button>
        </div>
        <ScrollArea className="h-64">
          <div className="p-2 space-y-1">
            {options.map(o => (
              <label key={o.value} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer">
                <Checkbox checked={selected.includes(o.value)} onCheckedChange={() => onToggle(o.value)} />
                <span className="text-sm flex-1 truncate">{o.value.replace(/_/g, ' ')}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{o.count}</span>
              </label>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export default function UTPartnerMap() {
  const { data: leads = [], isLoading, error } = useQuery({
    queryKey: ['ut-partner-leads-map'],
    queryFn: fetchPartnerLeads,
    staleTime: 5 * 60 * 1000,
  });

  const states = useMultiSelect();
  const categories = useMultiSelect();
  const [status, setStatus] = useState<string>('all');
  const [minReviews, setMinReviews] = useState<number>(0);
  const [detail, setDetail] = useState<GeoPoint | null>(null);

  const stateOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach(l => { const s = l.state || '—'; counts[s] = (counts[s] || 0) + 1; });
    return Object.entries(counts)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  }, [leads]);

  const categoryOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach(l => { const c = l.category || 'other'; counts[c] = (counts[c] || 0) + 1; });
    KNOWN_CATEGORIES.forEach(c => { if (!(c in counts)) counts[c] = 0; });
    return Object.entries(counts)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  }, [leads]);

  const filtered = useMemo(() => leads.filter(l => {
    if (states.selected.length && !states.selected.includes(l.state || '—')) return false;
    if (categories.selected.length && !categories.selected.includes(l.category || 'other')) return false;
    if (status !== 'all' && l.status !== status) return false;
    if ((l.review_count ?? 0) < minReviews) return false;
    return true;
  }), [leads, states.selected, categories.selected, status, minReviews]);

  const points = useMemo<GeoPoint[]>(() => filtered.map(l => ({
    id: l.id,
    lng: Number(l.longitude),
    lat: Number(l.latitude),
    title: l.business_name || 'Unnamed business',
    subtitle: l.full_address ?? [l.city, l.state].filter(Boolean).join(', '),
    statusKey: tierForCategory(l.category),
    meta: l as unknown as Record<string, any>,
  })), [filtered]);

  // ── Coverage counts (respond to filters) ──
  const tierCounts = useMemo(() => {
    const c = Object.fromEntries(TIER_ORDER.map(t => [t, 0])) as Record<CategoryTier, number>;
    filtered.forEach(l => { c[tierForCategory(l.category)] += 1; });
    return c;
  }, [filtered]);

  const categoryCounts = useMemo(() => {
    const c: Record<string, number> = Object.fromEntries(KNOWN_CATEGORIES.map(k => [k, 0]));
    filtered.forEach(l => { const k = l.category || 'other'; c[k] = (c[k] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [filtered]);

  const stateCounts = useMemo(() => {
    const c: Record<string, number> = {};
    filtered.forEach(l => { const s = l.state || '—'; c[s] = (c[s] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [filtered]);

  const maxCategoryCount = Math.max(1, ...categoryCounts.map(([, n]) => n));
  const maxStateCount = Math.max(1, ...stateCounts.map(([, n]) => n));

  const reset = () => {
    states.setSelected([]);
    categories.setSelected([]);
    setStatus('all');
    setMinReviews(0);
  };

  const renderDetail = useCallback((p: GeoPoint) => {
    const m = (p.meta ?? {}) as PartnerLead;
    return (
      <div className="space-y-2 text-sm">
        <div>
          <p className="font-semibold leading-tight">{m.business_name || p.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: CATEGORY_TIERS[tierForCategory(m.category)] }}
            />
            <span className="text-xs text-muted-foreground">{(m.category || 'other').replace(/_/g, ' ')}</span>
            {m.status && <Badge variant="secondary" className="text-[10px]">{m.status.replace(/_/g, ' ')}</Badge>}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{m.full_address || p.subtitle || '—'}</p>
        <div className="flex flex-wrap gap-3 text-xs">
          {m.phone && (
            <a href={`tel:${m.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
              <Phone className="h-3 w-3" />{m.phone}
            </a>
          )}
          {m.website && (
            <a href={m.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              <Globe className="h-3 w-3" />Website
            </a>
          )}
          {m.maps_url && (
            <a href={m.maps_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              <ExternalLink className="h-3 w-3" />Google Maps
            </a>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Star className="h-3 w-3 text-amber-400" />
            {m.google_rating ?? '—'} ({m.review_count ?? 0} reviews)
          </span>
          <span>seen {m.times_seen ?? 1}×</span>
        </div>
      </div>
    );
  }, []);

  const renderListItem = useCallback((p: GeoPoint) => {
    const m = (p.meta ?? {}) as PartnerLead;
    return (
      <div className="min-w-0">
        <p className="font-medium text-sm truncate">{p.title}</p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {(m.category || 'other').replace(/_/g, ' ')} · {m.city}, {m.state}
        </p>
      </div>
    );
  }, []);

  const renderPopupHTML = useCallback((p: GeoPoint) => {
    const m = (p.meta ?? {}) as PartnerLead;
    const esc = (s: any) => String(s ?? '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
    return `<div style="color:#000;font-size:12px;max-width:220px">
      <strong>${esc(m.business_name || p.title)}</strong><br/>
      <span style="color:#555">${esc((m.category || 'other').replace(/_/g, ' '))}</span><br/>
      <span style="color:#777">${esc(m.full_address || p.subtitle || '')}</span><br/>
      <span style="color:#888;font-size:11px">★ ${esc(m.google_rating ?? '—')} (${esc(m.review_count ?? 0)})</span>
    </div>`;
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Partner Map
          </h1>
          <p className="text-sm text-muted-foreground">
            Geocoded partner-lead coverage across the US. Halls and rental companies are the priority targets.
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums">{filtered.length.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">of {leads.length.toLocaleString()} mapped leads</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <MultiSelect
            label="States"
            options={stateOptions}
            selected={states.selected}
            onToggle={states.toggle}
            onClear={() => states.setSelected([])}
          />
          <MultiSelect
            label="Categories"
            options={categoryOptions}
            selected={categories.selected}
            onToggle={categories.toggle}
            onClear={() => categories.setSelected([])}
          />
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[170px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_OPTIONS.map(s => (
                  <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 w-[220px]">
            <Label className="text-xs text-muted-foreground">Min reviews: {minReviews}</Label>
            <div className="flex items-center gap-2">
              <Slider
                value={[minReviews]}
                onValueChange={v => setMinReviews(v[0])}
                min={0}
                max={2000}
                step={10}
                className="flex-1"
              />
              <Input
                type="number"
                value={minReviews}
                min={0}
                max={2000}
                onChange={e => setMinReviews(Math.max(0, Number(e.target.value) || 0))}
                className="w-20 h-9"
              />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={reset} className="gap-1">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {TIER_ORDER.map(t => (
          <div key={t} className="flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-md border border-border bg-card">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CATEGORY_TIERS[t] }} />
            <span>{TIER_LABELS[t]}</span>
            <span className="tabular-nums text-muted-foreground">{tierCounts[t].toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
        <div>
          {isLoading ? (
            <div className="h-[calc(100vh-380px)] flex items-center justify-center border border-border rounded-lg">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="h-[calc(100vh-380px)] flex items-center justify-center border border-destructive/40 rounded-lg text-sm text-destructive p-6 text-center">
              {(error as Error).message}
            </div>
          ) : (
            <GeoMapView
              points={points}
              statusColors={CATEGORY_TIERS as unknown as Record<string, string>}
              initialCenter={[-84.39, 33.75]}
              initialZoom={4.2}
              clustering
              showHulls={false}
              renderDetail={renderDetail}
              renderListItem={renderListItem}
              renderPopupHTML={renderPopupHTML}
              searchFields={p => [p.title, p.subtitle || '', (p.meta as PartnerLead)?.city || '']}
              searchPlaceholder="Search partners..."
              onPointClick={setDetail}
              className="relative w-full h-[calc(100vh-380px)] min-h-[520px] rounded-lg overflow-hidden border border-border"
            />
          )}
        </div>

        {/* Coverage panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Coverage by category</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {categoryCounts.map(([cat, n]) => (
                <div key={cat} className={`flex items-center gap-2 text-xs ${n === 0 ? 'opacity-40' : ''}`}>
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_TIERS[tierForCategory(cat)] }} />
                  <span className="w-28 truncate">{cat.replace(/_/g, ' ')}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{ width: `${(n / maxCategoryCount) * 100}%`, backgroundColor: CATEGORY_TIERS[tierForCategory(cat)] }}
                    />
                  </div>
                  <span className="tabular-nums w-10 text-right">{n}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Top 10 states</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {stateCounts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No leads match the current filters.</p>
              ) : stateCounts.map(([st, n]) => (
                <div key={st} className="flex items-center gap-2 text-xs">
                  <span className="w-10">{st}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded overflow-hidden">
                    <div className="h-full rounded bg-primary" style={{ width: `${(n / maxStateCount) * 100}%` }} />
                  </div>
                  <span className="tabular-nums w-10 text-right">{n}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detail sheet on point click */}
      <Sheet open={!!detail} onOpenChange={o => !o && setDetail(null)}>
        <SheetContent side="right" className="w-[380px] sm:max-w-[380px]">
          <SheetHeader><SheetTitle className="text-base">Partner detail</SheetTitle></SheetHeader>
          <div className="mt-4">{detail && renderDetail(detail)}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
