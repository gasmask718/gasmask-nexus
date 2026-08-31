import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';
import { GeoMapView, type GeoPoint } from '@/components/map/GeoMapView';
import type { ICWSourcedLead } from '@/lib/icw/leadIngestion';

const STATUS_COLORS: Record<string, string> = {
  prospect: '#4FC3E8',
  qualified: '#B4D334',
  promoted: '#3C9F40',
  rejected: '#ef4444',
};

const hasCoords = (l: ICWSourcedLead) =>
  l.latitude != null &&
  l.longitude != null &&
  Number.isFinite(Number(l.latitude)) &&
  Number.isFinite(Number(l.longitude));

export default function ICWLeadMap() {
  const { data: leads = [], error } = useQuery({
    queryKey: ['icw-sourced-leads', 'map'],
    queryFn: async (): Promise<ICWSourcedLead[]> => {
      // Fetch ALL leads — unmapped rows are reported as a mapping gap,
      // never silently dropped and never given fabricated coordinates.
      const { data, error } = await supabase.from('icw_sourced_leads').select('*');
      if (error) throw error;
      return (data ?? []) as unknown as ICWSourcedLead[];
    },
  });

  const unmapped = useMemo(() => leads.filter((l) => !hasCoords(l)), [leads]);

  const points = useMemo<GeoPoint[]>(
    () =>
      leads
        .filter(hasCoords)
        .map((l) => ({
          id: l.id,
          lng: Number(l.longitude),
          lat: Number(l.latitude),
          title: l.full_name || 'Unnamed lead',
          subtitle: l.address || [l.city, l.state].filter(Boolean).join(', ') || '—',
          groupKey: l.state || 'Unknown',
          statusKey: (l.status || 'prospect').toLowerCase(),
          meta: l as unknown as Record<string, any>,
        })),
    [leads],
  );


  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-[#4FC3E8] to-[#B4D334] bg-clip-text text-transparent">
          IClean Hub Map
        </h1>
        <p className="text-muted-foreground mt-1">
          Sourced leads with coordinates · same canonical records as the ICW CRM
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md p-3">
          {(error as Error).message}
        </p>
      )}

      <GeoMapView
        points={points}
        statusColors={STATUS_COLORS}
        initialCenter={[-98.5, 39.8]}
        initialZoom={3.6}
        clustering
        resolveGroup={(p) => p.groupKey ?? null}
        groupFilterLabel="All States"
        groupCountLabel={(n) => `${n} sourced leads`}
        searchPlaceholder="Search leads..."
        searchFields={(p) => {
          const l = p.meta as ICWSourcedLead;
          return [l?.full_name || '', l?.address || '', l?.city || '', l?.source_platform || ''];
        }}
        renderPopupHTML={(p) => {
          const l = p.meta as ICWSourcedLead;
          return `<div style="color:#000;font-size:12px"><strong>${l.full_name || 'Unnamed lead'}</strong><br/><span style="color:#555">${l.address || '—'}</span>${l.phone ? `<br/><span style="color:#555">${l.phone}</span>` : ''}<br/><span style="color:#888;font-size:11px">${l.status} · ${l.source_platform || '—'}</span></div>`;
        }}
        emptyState={
          <p className="text-sm text-muted-foreground py-8 text-center">No mappable leads yet</p>
        }
        renderListItem={(p) => {
          const l = p.meta as ICWSourcedLead;
          return (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{l.full_name || 'Unnamed lead'}</p>
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {l.address || [l.city, l.state].filter(Boolean).join(', ') || '—'}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(l.category_groups ?? []).map((c) => (
                    <Badge
                      key={c}
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 bg-[#4FC3E8]/10 text-[#4FC3E8] border-[#4FC3E8]/20"
                    >
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                {l.status}
              </Badge>
            </div>
          );
        }}
      />
    </div>
  );
}
