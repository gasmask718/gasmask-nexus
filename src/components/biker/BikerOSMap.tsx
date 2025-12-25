import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Bike, Store, MapPin, UserPlus, Eye, Route } from 'lucide-react';

interface BikerLocation {
  id: string;
  name: string;
  territory: string;
  status: string;
  lat: number;
  lng: number;
  tasksToday: number;
}

interface StoreLocation {
  id: string;
  name: string;
  address: string;
  status: string;
  lat: number;
  lng: number;
  lastCheck?: string;
}

interface BikerOSMapProps {
  bikers: BikerLocation[];
  stores: StoreLocation[];
  onBikerClick?: (bikerId: string) => void;
  onStoreClick?: (storeId: string) => void;
  onAssignBiker?: (storeId: string, storeName: string) => void;
}

export const BikerOSMap: React.FC<BikerOSMapProps> = ({
  bikers,
  stores,
  onBikerClick,
  onStoreClick,
  onAssignBiker
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<{
    type: 'biker' | 'store';
    data: BikerLocation | StoreLocation;
  } | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const mapboxToken = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;
    if (!mapboxToken) {
      console.error('Mapbox token not configured');
      return;
    }

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-73.935242, 40.730610], // NYC center
      zoom: 11,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update markers when data changes
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Add biker markers
    bikers.forEach(biker => {
      const el = document.createElement('div');
      el.className = 'biker-marker';
      el.innerHTML = `
        <div class="relative cursor-pointer group">
          <div class="w-10 h-10 rounded-full bg-emerald-500 border-2 border-white shadow-lg flex items-center justify-center text-white font-bold text-sm hover:scale-110 transition-transform">
            ${biker.name.charAt(0)}
          </div>
          <div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${biker.status === 'active' ? 'bg-green-400' : 'bg-gray-400'} border border-white animate-pulse"></div>
        </div>
      `;
      el.addEventListener('click', () => {
        setSelectedEntity({ type: 'biker', data: biker });
      });

      const marker = new mapboxgl.Marker(el)
        .setLngLat([biker.lng, biker.lat])
        .addTo(map.current!);
      markersRef.current.push(marker);
    });

    // Add store markers
    stores.forEach(store => {
      const statusColors: Record<string, string> = {
        active: 'bg-blue-500',
        needs_check: 'bg-amber-500',
        issue: 'bg-red-500',
        prospect: 'bg-gray-400'
      };
      const color = statusColors[store.status] || 'bg-blue-500';

      const el = document.createElement('div');
      el.className = 'store-marker';
      el.innerHTML = `
        <div class="cursor-pointer hover:scale-110 transition-transform">
          <div class="w-6 h-6 rounded ${color} border border-white shadow flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/></svg>
          </div>
        </div>
      `;
      el.addEventListener('click', () => {
        setSelectedEntity({ type: 'store', data: store });
      });

      const marker = new mapboxgl.Marker(el)
        .setLngLat([store.lng, store.lat])
        .addTo(map.current!);
      markersRef.current.push(marker);
    });

    // Fit bounds if we have markers
    if (bikers.length > 0 || stores.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      bikers.forEach(b => bounds.extend([b.lng, b.lat]));
      stores.forEach(s => bounds.extend([s.lng, s.lat]));
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 13 });
    }
  }, [bikers, stores]);

  return (
    <>
      <div ref={mapContainer} className="w-full h-full rounded-lg" />
      
      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm p-3 rounded-lg border shadow-lg">
        <div className="text-xs font-medium mb-2">Legend</div>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-emerald-500 border border-white"></div>
            <span>Biker</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500"></div>
            <span>Active Store</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-amber-500"></div>
            <span>Needs Check</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500"></div>
            <span>Issue Reported</span>
          </div>
        </div>
      </div>

      {/* Entity Detail Sheet */}
      <Sheet open={!!selectedEntity} onOpenChange={() => setSelectedEntity(null)}>
        <SheetContent side="right" className="w-[400px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {selectedEntity?.type === 'biker' ? (
                <Bike className="h-5 w-5 text-emerald-500" />
              ) : (
                <Store className="h-5 w-5 text-blue-500" />
              )}
              {selectedEntity?.data?.name || 'Loading...'}
            </SheetTitle>
          </SheetHeader>

          {selectedEntity?.type === 'biker' && selectedEntity.data && (() => {
            const biker = selectedEntity.data as BikerLocation;
            return (
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant={biker.status === 'active' ? 'default' : 'secondary'}>
                    {biker.status}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{biker.territory}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Route className="h-4 w-4 text-muted-foreground" />
                    <span>{biker.tasksToday} tasks today</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 pt-4">
                  <Button onClick={() => onBikerClick?.(biker.id)}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Profile
                  </Button>
                  <Button variant="outline">
                    <Route className="h-4 w-4 mr-2" />
                    Assign Route
                  </Button>
                </div>
              </div>
            );
          })()}

          {selectedEntity?.type === 'store' && selectedEntity.data && (() => {
            const store = selectedEntity.data as StoreLocation;
            return (
              <div className="mt-6 space-y-4">
                <Badge variant="outline" className="capitalize">
                  {store.status.replace('_', ' ')}
                </Badge>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{store.address}</span>
                  </div>
                  {store.lastCheck && (
                    <p className="text-sm text-muted-foreground">
                      Last check: {store.lastCheck}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2 pt-4">
                  <Button onClick={() => onStoreClick?.(store.id)}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Store Profile
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      onAssignBiker?.(store.id, store.name);
                      setSelectedEntity(null);
                    }}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Assign Biker
                  </Button>
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </>
  );
};

export default BikerOSMap;
