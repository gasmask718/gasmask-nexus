import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { FilterBar } from '@/components/map/FilterBar';
import { SearchBar } from '@/components/map/SearchBar';
import { StoreCard } from '@/components/map/StoreCard';
import { Package } from 'lucide-react';

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
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [filteredStores, setFilteredStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [storeCounts, setStoreCounts] = useState<Record<string, number>>({});

  // Fetch stores from Supabase
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

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const mapboxToken = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;
    
    if (!mapboxToken) {
      console.error('Mapbox token not found');
      return;
    }

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/navigation-night-v1',
      center: [-73.935242, 40.730610], // NYC center
      zoom: 11,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      map.current?.remove();
    };
  }, []);

  // Load stores initially
  useEffect(() => {
    fetchStores();
  }, []);

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('stores-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stores',
        },
        () => {
          fetchStores();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filter stores based on active filter
  useEffect(() => {
    if (activeFilter === 'all') {
      setFilteredStores(stores);
    } else {
      setFilteredStores(stores.filter((store) => store.status === activeFilter));
    }

    // Calculate counts
    const counts: Record<string, number> = {
      active: 0,
      prospect: 0,
      needsFollowUp: 0,
      inactive: 0,
    };

    stores.forEach((store) => {
      if (counts[store.status] !== undefined) {
        counts[store.status]++;
      }
    });

    setStoreCounts(counts);
  }, [stores, activeFilter]);

  // Render markers
  useEffect(() => {
    if (!map.current || loading || filteredStores.length === 0) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add new markers
    filteredStores.forEach((store) => {
      if (!map.current) return;

      const color =
        store.status === 'active' ? '#22c55e' :
        store.status === 'prospect' ? '#eab308' :
        store.status === 'needsFollowUp' ? '#f97316' :
        '#6b7280';

      // Create marker element
      const el = document.createElement('div');
      el.className = 'custom-marker';
      el.style.width = '32px';
      el.style.height = '32px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = color;
      el.style.border = '3px solid white';
      el.style.cursor = 'pointer';
      el.style.boxShadow = `0 0 20px ${color}40, 0 4px 10px rgba(0,0,0,0.3)`;
      el.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';

      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.3)';
        el.style.boxShadow = `0 0 30px ${color}60, 0 6px 15px rgba(0,0,0,0.4)`;
      });

      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
        el.style.boxShadow = `0 0 20px ${color}40, 0 4px 10px rgba(0,0,0,0.3)`;
      });

      const marker = new mapboxgl.Marker(el)
        .setLngLat([store.lng, store.lat])
        .addTo(map.current);

      el.addEventListener('click', () => {
        setSelectedStore(store);
        map.current?.flyTo({
          center: [store.lng, store.lat],
          zoom: 15,
          duration: 1000,
          essential: true,
        });

        // Pulse animation
        el.style.animation = 'pulse 0.6s ease-out';
        setTimeout(() => {
          el.style.animation = '';
        }, 600);
      });

      markersRef.current.push(marker);
    });

    // Fit map to markers
    if (filteredStores.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      filteredStores.forEach((store) => {
        bounds.extend([store.lng, store.lat]);
      });
      map.current.fitBounds(bounds, { padding: 80, maxZoom: 14 });
    }

    map.current?.resize();
  }, [filteredStores, loading]);

  const handleSearch = (store: Store) => {
    setSelectedStore(store);
    map.current?.flyTo({
      center: [store.lng, store.lat],
      zoom: 15,
      duration: 1500,
      essential: true,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Store Intelligence Map</h2>
        <p className="text-muted-foreground">
          Live operational command center with real-time store tracking
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SearchBar stores={stores} onSelectStore={handleSearch} />
        </div>
      </div>

      <FilterBar
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        storeCounts={storeCounts}
      />

      <div className="relative h-[calc(100vh-280px)] rounded-xl overflow-hidden border border-border/50 shadow-2xl">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10 backdrop-blur-sm">
            <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        
        <div ref={mapContainer} className="absolute inset-0" style={{ minHeight: '600px' }} />

        {/* Store Detail Card */}
        {selectedStore && (
          <div className="absolute top-4 left-4 w-full max-w-sm z-10 sm:left-4 sm:w-96 px-4 sm:px-0">
            <StoreCard store={selectedStore} onClose={() => setSelectedStore(null)} />
          </div>
        )}

        {/* Store Counter */}
        <div className="absolute bottom-4 left-4 bg-card/95 backdrop-blur rounded-lg px-4 py-3 border border-border/50 shadow-lg">
          <div className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-primary" />
            <span className="font-semibold">{filteredStores.length}</span>
            <span className="text-muted-foreground">
              {activeFilter === 'all' ? 'stores on map' : `${activeFilter} stores`}
            </span>
          </div>
        </div>

        {/* Map Legend */}
        <div className="absolute bottom-4 right-4 bg-card/95 backdrop-blur rounded-lg px-4 py-3 border border-border/50 shadow-lg">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white shadow-sm"></div>
              <span>Active</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full bg-yellow-500 border-2 border-white shadow-sm"></div>
              <span>Prospect</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full bg-orange-500 border-2 border-white shadow-sm"></div>
              <span>Follow Up</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full bg-gray-500 border-2 border-white shadow-sm"></div>
              <span>Inactive</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
};

export default Map;
