import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MapPin, TrendingUp, Store, Users, AlertCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = "pk.eyJ1IjoibG92YWJsZSIsImEiOiJjbTRraHBmeXEwMDZ3Mm1xdDJhYXc5NHBvIn0.5CCWFu1E1SIrFdLJ0uT5yQ";

const DEMO_TERRITORIES = [
  { name: "Manhattan", saturation: 87, active: 145, prospects: 23, failing: 8, growth: 12 },
  { name: "Brooklyn", saturation: 63, active: 98, prospects: 45, failing: 12, growth: 18 },
  { name: "Queens", saturation: 54, active: 76, prospects: 67, failing: 15, growth: 22 },
  { name: "Bronx", saturation: 41, active: 52, prospects: 89, failing: 18, growth: 28 },
  { name: "Staten Island", saturation: 28, active: 31, prospects: 34, failing: 5, growth: 15 },
];

export default function Territories() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [selectedTerritory, setSelectedTerritory] = useState<string | null>(null);

  const { data: stores } = useQuery({
    queryKey: ['stores-territories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .not('lat', 'is', null)
        .not('lng', 'is', null);

      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-73.935242, 40.730610], // NYC
      zoom: 10,
    });

    map.current.on('load', () => {
      if (!map.current || !stores) return;

      // Add store markers
      stores.forEach((store) => {
        if (!store.lat || !store.lng) return;

        const color = store.status === 'active' ? '#00ff00' : 
                     store.status === 'prospect' ? '#ffff00' : '#ff0000';

        new mapboxgl.Marker({ color })
          .setLngLat([store.lng, store.lat])
          .setPopup(new mapboxgl.Popup().setHTML(`
            <div class="p-2">
              <h3 class="font-bold">${store.name}</h3>
              <p class="text-sm">${store.status}</p>
            </div>
          `))
          .addTo(map.current!);
      });

      // Add borough boundaries (demo data)
      const boroughBoundaries = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name: 'Manhattan' },
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [-74.0479, 40.6829],
                [-73.9067, 40.6829],
                [-73.9067, 40.8820],
                [-74.0479, 40.8820],
                [-74.0479, 40.6829]
              ]]
            }
          }
        ]
      };

      map.current!.addSource('boroughs', {
        type: 'geojson',
        data: boroughBoundaries as any
      });

      map.current!.addLayer({
        id: 'borough-fills',
        type: 'fill',
        source: 'boroughs',
        paint: {
          'fill-color': '#ff0000',
          'fill-opacity': 0.1
        }
      });

      map.current!.addLayer({
        id: 'borough-borders',
        type: 'line',
        source: 'boroughs',
        paint: {
          'line-color': '#ff0000',
          'line-width': 2,
          'line-opacity': 0.5
        }
      });
    });

    return () => {
      map.current?.remove();
    };
  }, [stores]);

  const getSaturationColor = (saturation: number) => {
    if (saturation >= 70) return "text-green-500";
    if (saturation >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="grid grid-cols-1 lg:grid-cols-4 h-screen">
        {/* Sidebar */}
        <div className="lg:col-span-1 bg-card border-r border-border p-6 overflow-y-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-2">Territory War Room</h1>
            <p className="text-sm text-muted-foreground">Market saturation analysis</p>
          </div>

          <div className="space-y-4">
            {DEMO_TERRITORIES.map((territory) => (
              <Card
                key={territory.name}
                className={`p-4 cursor-pointer transition-all hover:border-primary/50 ${
                  selectedTerritory === territory.name ? 'border-primary' : ''
                }`}
                onClick={() => setSelectedTerritory(territory.name)}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold">{territory.name}</h3>
                  <Badge className={getSaturationColor(territory.saturation)}>
                    {territory.saturation}%
                  </Badge>
                </div>

                <Progress value={territory.saturation} className="mb-3" />

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <Store className="w-3 h-3 text-green-500" />
                    <span>{territory.active} active</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-yellow-500" />
                    <span>{territory.prospects} prospects</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-red-500" />
                    <span>{territory.failing} failing</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-blue-500" />
                    <span>+{territory.growth}% growth</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Card className="p-4 mt-6 bg-primary/10 border-primary/20">
            <h3 className="font-bold mb-2 text-primary">Territory Insights</h3>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Manhattan: Saturated, focus on retention</li>
              <li>• Brooklyn: High growth opportunity</li>
              <li>• Queens: Untapped market potential</li>
              <li>• Bronx: Emerging territory</li>
            </ul>
          </Card>
        </div>

        {/* Map */}
        <div className="lg:col-span-3 relative">
          <div ref={mapContainer} className="w-full h-full" />
          
          {selectedTerritory && (
            <Card className="absolute top-4 right-4 p-4 bg-card/95 backdrop-blur">
              <h3 className="font-bold mb-2">{selectedTerritory}</h3>
              <p className="text-sm text-muted-foreground">
                Click on markers to view store details
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}