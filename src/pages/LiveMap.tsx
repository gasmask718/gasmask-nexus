import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bike, Car, User, MapPin } from "lucide-react";

interface DriverLocation {
  id: string;
  driver_id: string;
  lat: number;
  lng: number;
  updated_at: string;
  profile?: {
    name: string;
    role: string;
  };
}

const LiveMap = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [locations, setLocations] = useState<DriverLocation[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<DriverLocation | null>(null);
  const markers = useRef<{ [key: string]: mapboxgl.Marker }>({});

  useEffect(() => {
    if (!mapContainer.current) return;

    // Initialize map
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN || '';
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-74.006, 40.7128], // NYC center
      zoom: 11,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    loadDriverLocations();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('driver-locations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'drivers_live_location'
        },
        () => {
          loadDriverLocations();
        }
      )
      .subscribe();

    // Refresh every 5 seconds
    const interval = setInterval(loadDriverLocations, 5000);

    return () => {
      channel.unsubscribe();
      clearInterval(interval);
      map.current?.remove();
    };
  }, []);

  const loadDriverLocations = async () => {
    const { data, error } = await supabase
      .from('drivers_live_location')
      .select(`
        *,
        profile:profiles(name, role)
      `);

    if (!error && data) {
      setLocations(data);
      updateMarkers(data);
    }
  };

  const updateMarkers = (data: DriverLocation[]) => {
    if (!map.current) return;

    // Remove markers that no longer exist
    Object.keys(markers.current).forEach(id => {
      if (!data.find(d => d.driver_id === id)) {
        markers.current[id].remove();
        delete markers.current[id];
      }
    });

    // Add or update markers
    data.forEach(location => {
      const color = getMarkerColor(location.profile?.role);
      
      if (markers.current[location.driver_id]) {
        markers.current[location.driver_id].setLngLat([location.lng, location.lat]);
      } else {
        const el = document.createElement('div');
        el.className = 'driver-marker';
        el.style.backgroundColor = color;
        el.style.width = '30px';
        el.style.height = '30px';
        el.style.borderRadius = '50%';
        el.style.border = '3px solid white';
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        el.style.cursor = 'pointer';

        const marker = new mapboxgl.Marker(el)
          .setLngLat([location.lng, location.lat])
          .addTo(map.current!);

        el.addEventListener('click', () => setSelectedDriver(location));
        
        markers.current[location.driver_id] = marker;
      }
    });
  };

  const getMarkerColor = (role?: string) => {
    switch (role) {
      case 'driver': return '#3b82f6'; // blue
      case 'biker': return '#ef4444'; // red
      case 'admin': return '#eab308'; // gold
      default: return '#6b7280'; // grey
    }
  };

  const getRoleIcon = (role?: string) => {
    switch (role) {
      case 'driver': return <Car className="h-4 w-4" />;
      case 'biker': return <Bike className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  return (
    <Layout>
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Live Driver Tracking</h1>
            <p className="text-muted-foreground">Real-time GPS tracking across all cities</p>
          </div>
          <Badge variant="outline" className="text-lg">
            {locations.length} Active
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="p-0 overflow-hidden">
              <div ref={mapContainer} className="h-[700px] w-full" />
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Active Workers</h3>
              <div className="space-y-2">
                {locations.map(location => (
                  <div
                    key={location.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedDriver(location);
                      map.current?.flyTo({
                        center: [location.lng, location.lat],
                        zoom: 15
                      });
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getMarkerColor(location.profile?.role) }}
                      />
                      <div>
                        <div className="font-medium">{location.profile?.name || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {location.profile?.role || 'worker'}
                        </div>
                      </div>
                    </div>
                    {getRoleIcon(location.profile?.role)}
                  </div>
                ))}
              </div>
            </Card>

            {selectedDriver && (
              <Card className="p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Driver Details
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-muted-foreground">Name</div>
                    <div className="font-medium">{selectedDriver.profile?.name}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Role</div>
                    <div className="capitalize">{selectedDriver.profile?.role}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Last Update</div>
                    <div>{new Date(selectedDriver.updated_at).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Location</div>
                    <div className="text-xs">
                      {selectedDriver.lat.toFixed(5)}, {selectedDriver.lng.toFixed(5)}
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default LiveMap;