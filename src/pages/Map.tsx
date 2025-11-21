import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Store as StoreIcon, MapPin, Package, Phone } from 'lucide-react';

interface Store {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: string;
  type: string;
  phone: string | null;
  address_street: string | null;
  address_city: string | null;
}

const Map = () => {
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStores = async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, lat, lng, status, type, phone, address_street, address_city')
        .not('lat', 'is', null)
        .not('lng', 'is', null);

      if (error) {
        console.error('Error fetching stores:', error);
      } else {
        setStores(data || []);
      }
      setLoading(false);
    };

    fetchStores();
  }, []);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Initialize map
    const mapboxToken = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;
    if (!mapboxToken) {
      console.error('Mapbox token not found');
      return;
    }

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-73.935242, 40.730610], // NYC center
      zoom: 11,
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Cleanup
    return () => {
      map.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (!map.current || loading || stores.length === 0) return;

    // Clear existing markers
    const existingMarkers = document.querySelectorAll('.mapboxgl-marker');
    existingMarkers.forEach(marker => marker.remove());

    // Add markers for each store
    stores.forEach((store) => {
      if (!map.current) return;

      // Color based on status
      const color = 
        store.status === 'active' ? '#22c55e' :
        store.status === 'prospect' ? '#eab308' :
        store.status === 'needsFollowUp' ? '#f97316' :
        '#6b7280';

      // Create custom marker element
      const el = document.createElement('div');
      el.className = 'custom-marker';
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = color;
      el.style.border = '3px solid white';
      el.style.cursor = 'pointer';
      el.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
      el.style.transition = 'transform 0.2s';

      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.2)';
      });

      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
      });

      // Create marker
      const marker = new mapboxgl.Marker(el)
        .setLngLat([store.lng, store.lat])
        .addTo(map.current);

      // Add click event
      el.addEventListener('click', () => {
        setSelectedStore(store);
        map.current?.flyTo({
          center: [store.lng, store.lat],
          zoom: 14,
          duration: 1000,
        });
      });
    });

    // Fit map to show all markers
    if (stores.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      stores.forEach(store => {
        bounds.extend([store.lng, store.lat]);
      });
      map.current.fitBounds(bounds, { padding: 50 });
    }
  }, [stores, loading]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'prospect': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'needsFollowUp': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'inactive': return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Store Map</h2>
          <p className="text-muted-foreground">
            Interactive map showing all store locations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Active</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span>Prospect</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span>Follow Up</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full bg-gray-500"></div>
            <span>Inactive</span>
          </div>
        </div>
      </div>

      <div className="relative h-[calc(100vh-220px)] rounded-lg overflow-hidden border border-border/50">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <div ref={mapContainer} className="absolute inset-0" />

        {/* Store Detail Card */}
        {selectedStore && (
          <Card className="absolute top-4 left-4 w-80 glass-card border-border/50 z-10">
            <div className="p-4 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <StoreIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{selectedStore.name}</h3>
                    <p className="text-sm text-muted-foreground capitalize">
                      {selectedStore.type.replace('_', ' ')}
                    </p>
                  </div>
                </div>
                <Badge className={getStatusColor(selectedStore.status)}>
                  {selectedStore.status.replace(/([A-Z])/g, ' $1').trim()}
                </Badge>
              </div>

              <div className="space-y-2">
                {selectedStore.address_street && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p>{selectedStore.address_street}</p>
                      <p className="text-muted-foreground">{selectedStore.address_city}</p>
                    </div>
                  </div>
                )}
                {selectedStore.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedStore.phone}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate(`/stores/${selectedStore.id}`)}
                >
                  View Details
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-primary hover:bg-primary-hover"
                  onClick={() => {
                    // Could open visit log modal
                    navigate(`/stores/${selectedStore.id}`);
                  }}
                >
                  Log Visit
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Store Counter */}
        <div className="absolute bottom-4 left-4 bg-card/95 backdrop-blur rounded-lg px-4 py-2 border border-border/50">
          <div className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-primary" />
            <span className="font-semibold">{stores.length}</span>
            <span className="text-muted-foreground">stores on map</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Map;
