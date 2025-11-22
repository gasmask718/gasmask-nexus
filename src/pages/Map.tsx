import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { FilterBar } from '@/components/map/FilterBar';
import { SearchBar } from '@/components/map/SearchBar';
import { StoreCard } from '@/components/map/StoreCard';
import { CommandPanel } from '@/components/map/CommandPanel';
import { DriverCard } from '@/components/map/DriverCard';
import { CommandMetrics } from '@/components/map/CommandMetrics';
import { CommandSidebar } from '@/components/map/CommandSidebar';
import { Alert } from '@/components/map/AlertsPanel';
import { RouteOptimizerPanel } from '@/components/map/RouteOptimizerPanel';
import { Package, Users, Layers, Star, Building2, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { territories } from '@/components/map/territories';
import { demoRoutes, DemoRoute } from '@/components/map/demoRoutes';

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

interface DemoDriver {
  id: string;
  name: string;
  role: 'driver' | 'biker';
  lat: number;
  lng: number;
  territory: string;
  updated_at: Date;
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
  const [demoDrivers, setDemoDrivers] = useState<DemoDriver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<DemoDriver | null>(null);
  const [showDrivers, setShowDrivers] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showAmbassadors, setShowAmbassadors] = useState(false);
  const [showWholesale, setShowWholesale] = useState(false);
  const [selectedTerritory, setSelectedTerritory] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<DemoRoute | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const driverMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const routeLayersRef = useRef<string[]>([]);

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

    // Add territory polygons
    map.current.on('load', () => {
      if (!map.current) return;

      // Add territory source
      map.current.addSource('territories', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: territories.map(territory => ({
            type: 'Feature',
            properties: {
              id: territory.id,
              name: territory.name,
              color: territory.color
            },
            geometry: {
              type: 'Polygon',
              coordinates: territory.coordinates
            }
          }))
        }
      });

      // Add territory fill layer
      map.current.addLayer({
        id: 'territories-fill',
        type: 'fill',
        source: 'territories',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.1
        }
      });

      // Add territory border layer
      map.current.addLayer({
        id: 'territories-border',
        type: 'line',
        source: 'territories',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2,
          'line-opacity': 0.5
        }
      });

      // Territory hover effect
      map.current.on('mouseenter', 'territories-fill', () => {
        if (map.current) map.current.getCanvas().style.cursor = 'pointer';
      });

      map.current.on('mouseleave', 'territories-fill', () => {
        if (map.current) map.current.getCanvas().style.cursor = '';
      });

      // Territory click handler
      map.current.on('click', 'territories-fill', (e) => {
        if (e.features && e.features[0]) {
          const territoryId = e.features[0].properties?.id;
          setSelectedTerritory(territoryId === selectedTerritory ? null : territoryId);
        }
      });
    });

    return () => {
      map.current?.remove();
    };
  }, []);

  // Initialize demo drivers and alerts
  useEffect(() => {
    const drivers: DemoDriver[] = [
      { id: '1', name: 'Malik Driver', role: 'driver', lat: 40.8176, lng: -73.9182, territory: 'Bronx', updated_at: new Date() },
      { id: '2', name: 'Jayden Driver', role: 'driver', lat: 40.7145, lng: -73.9565, territory: 'Brooklyn', updated_at: new Date() },
      { id: '3', name: 'Carlos Driver', role: 'driver', lat: 40.7632, lng: -73.9202, territory: 'Queens', updated_at: new Date() },
      { id: '4', name: 'Marcus Driver', role: 'driver', lat: 40.7265, lng: -73.9815, territory: 'Manhattan', updated_at: new Date() },
      { id: '5', name: 'Luis Biker', role: 'biker', lat: 40.8405, lng: -73.9157, territory: 'Bronx', updated_at: new Date() },
      { id: '6', name: 'Andre Biker', role: 'biker', lat: 40.6973, lng: -73.9197, territory: 'Brooklyn', updated_at: new Date() },
      { id: '7', name: 'Hector Biker', role: 'biker', lat: 40.7489, lng: -73.8902, territory: 'Queens', updated_at: new Date() },
      { id: '8', name: 'Pierre Biker', role: 'biker', lat: 40.7916, lng: -73.9736, territory: 'Manhattan', updated_at: new Date() },
    ];
    setDemoDrivers(drivers);

    // Generate demo alerts
    const demoAlerts: Alert[] = [
      {
        id: 'alert-1',
        type: 'inventory',
        title: 'Inventory Overdue',
        message: 'Store has not been restocked in 7 days',
        territory: 'Brooklyn',
        lat: 40.7145,
        lng: -73.9565,
        severity: 'high',
        timestamp: new Date()
      },
      {
        id: 'alert-2',
        type: 'driver-idle',
        title: 'Driver Idle',
        message: 'No movement detected for 20 minutes',
        territory: 'Queens',
        lat: 40.7632,
        lng: -73.9202,
        severity: 'medium',
        timestamp: new Date()
      },
      {
        id: 'alert-3',
        type: 'prospect-cluster',
        title: 'Prospect Cluster',
        message: '5 prospects detected within 0.5 mile radius',
        territory: 'Manhattan',
        lat: 40.7500,
        lng: -73.9900,
        severity: 'low',
        timestamp: new Date()
      }
    ];
    setAlerts(demoAlerts);

    // Simulate driver movement every 8 seconds
    const interval = setInterval(() => {
      setDemoDrivers(prev => prev.map(driver => ({
        ...driver,
        lat: driver.lat + (Math.random() - 0.5) * 0.003,
        lng: driver.lng + (Math.random() - 0.5) * 0.003,
        updated_at: new Date(),
      })));
    }, 8000);

    return () => clearInterval(interval);
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

  // Filter stores based on active filter and territory
  useEffect(() => {
    let filtered = stores;

    // Filter by status
    if (activeFilter !== 'all') {
      filtered = filtered.filter((store) => store.status === activeFilter);
    }

    // Filter by territory
    if (selectedTerritory) {
      const territory = territories.find(t => t.id === selectedTerritory);
      if (territory) {
        filtered = filtered.filter((store) => {
          // Simple point-in-polygon check (for demo purposes)
          const coords = territory.coordinates[0];
          const lngs = coords.map(c => c[0]);
          const lats = coords.map(c => c[1]);
          const minLng = Math.min(...lngs);
          const maxLng = Math.max(...lngs);
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);
          
          return store.lng >= minLng && store.lng <= maxLng && 
                 store.lat >= minLat && store.lat <= maxLat;
        });
      }
    }

    setFilteredStores(filtered);

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
  }, [stores, activeFilter, selectedTerritory]);

  // Render store markers and heatmap
  useEffect(() => {
    if (!map.current || loading) return;

    // Handle heatmap layer
    if (showHeatmap) {
      // Hide store markers
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      // Add heatmap source and layer
      if (map.current.getSource('stores-heat')) {
        (map.current.getSource('stores-heat') as mapboxgl.GeoJSONSource).setData({
          type: 'FeatureCollection',
          features: filteredStores.map(store => ({
            type: 'Feature',
            properties: {
              weight: store.status === 'active' ? 3 : store.status === 'prospect' ? 2 : store.status === 'needsFollowUp' ? 1 : 0.5
            },
            geometry: {
              type: 'Point',
              coordinates: [store.lng, store.lat]
            }
          }))
        });
      } else {
        map.current.addSource('stores-heat', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: filteredStores.map(store => ({
              type: 'Feature',
              properties: {
                weight: store.status === 'active' ? 3 : store.status === 'prospect' ? 2 : store.status === 'needsFollowUp' ? 1 : 0.5
              },
              geometry: {
                type: 'Point',
                coordinates: [store.lng, store.lat]
              }
            }))
          }
        });

        map.current.addLayer({
          id: 'stores-heat',
          type: 'heatmap',
          source: 'stores-heat',
          paint: {
            'heatmap-weight': ['get', 'weight'],
            'heatmap-intensity': 1,
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0, 'rgba(33,102,172,0)',
              0.2, 'rgb(103,169,207)',
              0.4, 'rgb(209,229,240)',
              0.6, 'rgb(253,219,199)',
              0.8, 'rgb(239,138,98)',
              1, 'rgb(178,24,43)'
            ],
            'heatmap-radius': 30,
            'heatmap-opacity': 0.8
          }
        });
      }
    } else {
      // Remove heatmap layer
      if (map.current.getLayer('stores-heat')) {
        map.current.removeLayer('stores-heat');
      }
      if (map.current.getSource('stores-heat')) {
        map.current.removeSource('stores-heat');
      }

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
    }

    map.current?.resize();
  }, [filteredStores, loading, showHeatmap]);

  // Render driver markers
  useEffect(() => {
    if (!map.current || !showDrivers) {
      driverMarkersRef.current.forEach(marker => marker.remove());
      driverMarkersRef.current = [];
      return;
    }

    // Clear existing driver markers
    driverMarkersRef.current.forEach(marker => marker.remove());
    driverMarkersRef.current = [];

    // Add driver markers
    demoDrivers.forEach(driver => {
      if (!map.current) return;

      const el = document.createElement('div');
      el.className = 'driver-marker';
      el.style.width = '20px';
      el.style.height = '20px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = '#ef4444';
      el.style.border = '3px solid white';
      el.style.cursor = 'pointer';
      el.style.boxShadow = '0 0 20px rgba(239, 68, 68, 0.6), 0 4px 10px rgba(0,0,0,0.3)';
      el.style.animation = 'pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite';

      const marker = new mapboxgl.Marker(el)
        .setLngLat([driver.lng, driver.lat])
        .addTo(map.current);

      el.addEventListener('click', () => {
        setSelectedDriver(driver);
        setSelectedStore(null);
        map.current?.flyTo({
          center: [driver.lng, driver.lat],
          zoom: 15,
          duration: 1000,
        });
      });

      driverMarkersRef.current.push(marker);
    });
  }, [demoDrivers, showDrivers]);

  // Render route lines
  useEffect(() => {
    if (!map.current || loading) return;

    // Clear existing route layers
    routeLayersRef.current.forEach(layerId => {
      if (map.current?.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
      if (map.current?.getSource(layerId)) {
        map.current.removeSource(layerId);
      }
    });
    routeLayersRef.current = [];

    // Add route lines
    demoRoutes.forEach((route) => {
      if (!map.current) return;

      const sourceId = `route-${route.id}`;
      const layerId = `route-line-${route.id}`;
      
      map.current.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: route.polyline
          }
        }
      });

      const color = route.type === 'driver' ? '#ef4444' : '#a855f7';
      const opacity = selectedRoute?.id === route.id ? 1 : 0.6;

      map.current.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': color,
          'line-width': 4,
          'line-opacity': opacity
        }
      });

      routeLayersRef.current.push(layerId);
    });
  }, [demoRoutes, selectedRoute, loading]);

  const handleSearch = (store: Store) => {
    setSelectedStore(store);
    map.current?.flyTo({
      center: [store.lng, store.lat],
      zoom: 15,
      duration: 1500,
      essential: true,
    });
  };

  const handleMetricClick = (filter: string) => {
    if (filter === 'drivers' || filter === 'bikers') {
      setShowDrivers(true);
    } else if (filter === 'ambassadors') {
      setShowAmbassadors(!showAmbassadors);
    } else if (filter === 'wholesale') {
      setShowWholesale(!showWholesale);
    } else {
      setActiveFilter(filter);
    }
  };

  const handleRouteClick = (route: DemoRoute) => {
    setSelectedRoute(route);
    if (map.current && route.polyline.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      route.polyline.forEach(coord => bounds.extend(coord as [number, number]));
      map.current.fitBounds(bounds, { padding: 100 });
    }
  };

  const handleAlertClick = (alert: Alert) => {
    if (map.current) {
      map.current.flyTo({
        center: [alert.lng, alert.lat],
        zoom: 15,
        duration: 1500
      });
    }
  };

  const driversCount = demoDrivers.filter(d => d.role === 'driver').length;
  const bikersCount = demoDrivers.filter(d => d.role === 'biker').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Operations Command Center</h2>
          <p className="text-muted-foreground">
            Real-time tactical intelligence and field operations management
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={showDrivers ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowDrivers(!showDrivers)}
          >
            <Users className="h-4 w-4 mr-2" />
            Team
          </Button>
          <Button
            variant={showHeatmap ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowHeatmap(!showHeatmap)}
          >
            <Layers className="h-4 w-4 mr-2" />
            Heatmap
          </Button>
          <Button
            variant={showAmbassadors ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowAmbassadors(!showAmbassadors)}
          >
            <Star className="h-4 w-4 mr-2" />
            Ambassadors
          </Button>
          <Button
            variant={showWholesale ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowWholesale(!showWholesale)}
          >
            <Building2 className="h-4 w-4 mr-2" />
            Wholesale
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSidebar(!showSidebar)}
          >
            {showSidebar ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <CommandMetrics
        activeStores={storeCounts.active || 0}
        needsFollowUp={storeCounts.needsFollowUp || 0}
        prospects={storeCounts.prospect || 0}
        driversLive={driversCount}
        bikersLive={bikersCount}
        ambassadorZones={3}
        wholesaleHubs={5}
        onMetricClick={handleMetricClick}
      />

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

      <div className="flex gap-4">
        <div className={`relative rounded-xl overflow-hidden border border-border/50 shadow-2xl transition-all duration-300 ${showSidebar ? 'w-2/3' : 'w-full'}`} style={{ height: 'calc(100vh - 280px)' }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10 backdrop-blur-sm">
            <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        
        <div ref={mapContainer} className="absolute inset-0" style={{ minHeight: '600px' }} />

        {/* Command Center Panel */}
        <CommandPanel 
          storeCount={filteredStores.length}
          driverCount={demoDrivers.length}
          activeRoutes={0}
        />

        {/* Store Detail Card */}
        {selectedStore && (
          <div className="absolute top-4 left-4 w-full max-w-sm z-10 sm:left-4 sm:w-96 px-4 sm:px-0">
            <StoreCard store={selectedStore} onClose={() => setSelectedStore(null)} />
          </div>
        )}

        {/* Driver Detail Card */}
        {selectedDriver && (
          <div className="absolute top-4 left-4 w-full max-w-sm z-10 sm:left-4 sm:w-96 px-4 sm:px-0">
            <DriverCard driver={selectedDriver} onClose={() => setSelectedDriver(null)} />
          </div>
        )}

        {/* Store Counter */}
        <div className="absolute bottom-4 left-4 bg-card/95 backdrop-blur rounded-lg px-4 py-3 border border-border/50 shadow-lg">
          <div className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-primary" />
            <span className="font-semibold">{filteredStores.length}</span>
            <span className="text-muted-foreground">
              {selectedTerritory ? `${selectedTerritory} stores` : activeFilter === 'all' ? 'stores on map' : `${activeFilter} stores`}
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

      {showSidebar && (
        <div className="w-1/3 h-full">
          <CommandSidebar
            stores={filteredStores}
            drivers={demoDrivers}
            routes={demoRoutes}
            alerts={alerts}
            onStoreClick={handleSearch}
            onDriverClick={(driver) => {
              setSelectedDriver(driver);
              map.current?.flyTo({
                center: [driver.lng, driver.lat],
                zoom: 15,
                duration: 1000
              });
            }}
            onRouteClick={handleRouteClick}
            onAlertClick={handleAlertClick}
            onClose={() => setShowSidebar(false)}
            onRoutesGenerated={() => {
              // Refresh stores and routes after optimization
              fetchStores();
              toast.success('Routes optimized! Refreshing map...');
            }}
          />
        </div>
      )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { 
            transform: scale(1); 
            opacity: 1;
          }
          50% { 
            transform: scale(1.3); 
            opacity: 0.8;
          }
        }
        .driver-marker {
          animation: pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
};

export default Map;
