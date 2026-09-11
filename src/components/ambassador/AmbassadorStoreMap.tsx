/**
 * AmbassadorStoreMap — renders assigned stores / route stops as real map pins.
 * Coordinates are read from the canonical `stores` record only. Stores without
 * lat/lng are NEVER given invented coordinates — they are listed as needing geocoding.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAmbassadorPortfolio } from '@/hooks/useAmbassadorPortfolio';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, MapPin } from 'lucide-react';
import { GeoMapView, type GeoPoint } from '@/components/map/GeoMapView';

export interface MapStore {
  id: string;
  name: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  /** e.g. stop status: planned | complete | skipped */
  statusKey?: string;
  order?: number;
}

const STATUS_COLORS: Record<string, string> = {
  planned: '#3b82f6',
  pending: '#3b82f6',
  complete: '#22c55e',
  completed: '#22c55e',
  skipped: '#f97316',
  assigned: '#8b5cf6',
};

interface Props {
  /** When omitted, the map self-loads the signed-in ambassador's assigned stores. */
  stores?: MapStore[];
  title?: string;
  height?: number;
}

/** Self-loading variant: the signed-in ambassador's own assigned stores. */
function PortfolioStoreMap({ title, height }: { title?: string; height?: number }) {
  const { stores: portfolio } = useAmbassadorPortfolio();
  const ids = (portfolio || []).map((s) => s.store_id).filter(Boolean);

  const { data: coords } = useQuery({
    queryKey: ['ambassador-map-coords', ids.length, ids.slice().sort()[0]],
    queryFn: async () => {
      if (!ids.length) return [] as any[];
      // Chunked: a single .in() with hundreds of ids overflows the request URL
      // and silently returns nothing, leaving the map empty.
      const out: any[] = [];
      for (let i = 0; i < ids.length; i += 150) {
        const { data, error } = await supabase
          .from('stores')
          .select('id, lat, lng')
          .in('id', ids.slice(i, i + 150));
        if (error) throw error;
        out.push(...(data || []));
      }
      return out;
    },
    enabled: ids.length > 0,
  });

  const coordMap = new Map<string, { lat: number | null; lng: number | null }>(
    ((coords || []) as any[]).map((c) => [c.id as string, { lat: c.lat, lng: c.lng }]),
  );
  const mapped: MapStore[] = (portfolio || []).map((s) => ({
    id: s.store_id,
    name: s.store_name,
    address: [s.store_address, s.store_city, s.store_state].filter(Boolean).join(', '),
    lat: coordMap.get(s.store_id)?.lat ?? null,
    lng: coordMap.get(s.store_id)?.lng ?? null,
    statusKey: 'assigned',
  }));

  return <MapBody stores={mapped} title={title || 'My Stores'} height={height ?? 420} />;
}

export function AmbassadorStoreMap({ stores, title, height }: Props) {
  if (!stores) return <PortfolioStoreMap title={title} height={height} />;
  return <MapBody stores={stores} title={title || 'Store Map'} height={height ?? 420} />;
}

function MapBody({ stores, title, height }: { stores: MapStore[]; title: string; height: number }) {
  const withCoords = useMemo(
    () => stores.filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number'),
    [stores],
  );
  const missing = useMemo(
    () => stores.filter((s) => typeof s.lat !== 'number' || typeof s.lng !== 'number'),
    [stores],
  );

  const points: GeoPoint[] = useMemo(
    () =>
      withCoords.map((s) => ({
        id: s.id,
        lat: s.lat as number,
        lng: s.lng as number,
        title: s.order ? `${s.order}. ${s.name}` : s.name,
        subtitle: s.address,
        statusKey: s.statusKey || 'assigned',
      })),
    [withCoords],
  );

  const center = useMemo<[number, number]>(() => {
    if (!points.length) return [-73.94, 40.65];
    const lng = points.reduce((a, p) => a + p.lng, 0) / points.length;
    const lat = points.reduce((a, p) => a + p.lat, 0) / points.length;
    return [lng, lat];
  }, [points]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <MapPin className="h-4 w-4" /> {title}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{withCoords.length} mapped</Badge>
          {missing.length > 0 && (
            <Badge variant="outline" className="text-amber-500 border-amber-500/40">
              {missing.length} need geocoding
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {points.length > 0 ? (
          <div style={{ height }} className="rounded-lg overflow-hidden border">
            <GeoMapView
              points={points}
              statusColors={STATUS_COLORS}
              initialCenter={center}
              initialZoom={points.length === 1 ? 13 : 10}
              clustering={false}
              className="h-full"
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No mapped locations yet — none of these stores have coordinates on file.
          </p>
        )}

        {missing.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-500 mb-2">
              <AlertTriangle className="h-4 w-4" />
              Missing coordinates — needs geocoding
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {missing.map((s) => (
                <li key={s.id}>
                  <span className="text-foreground">{s.name}</span>
                  {s.address ? ` — ${s.address}` : ' — no address on file'}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
