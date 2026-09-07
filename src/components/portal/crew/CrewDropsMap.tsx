import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface Point { id: string; latitude: number | null; longitude: number | null; drop_type: string }

export function CrewDropsMap({ points }: { points: Point[] }) {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const token = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN || '';

  useEffect(() => {
    if (!container.current || map.current || !token) return;
    mapboxgl.accessToken = token;
    map.current = new mapboxgl.Map({
      container: container.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-73.95, 40.68],
      zoom: 10,
    });
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    return () => { map.current?.remove(); map.current = null; };
  }, [token]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const valid = points.filter(p => p.latitude != null && p.longitude != null);
    const markers = valid.map(p => {
      const el = document.createElement('div');
      el.style.cssText = 'width:12px;height:12px;border-radius:9999px;background:hsl(var(--destructive));border:2px solid #fff;';
      return new mapboxgl.Marker(el).setLngLat([p.longitude!, p.latitude!]).addTo(m);
    });
    if (valid.length) {
      const bounds = new mapboxgl.LngLatBounds();
      valid.forEach(p => bounds.extend([p.longitude!, p.latitude!]));
      m.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 0 });
    }
    return () => markers.forEach(mk => mk.remove());
  }, [points]);

  if (!token) {
    return (
      <div className="h-64 rounded-md border border-border flex items-center justify-center text-sm text-muted-foreground">
        Map unavailable
      </div>
    );
  }
  return <div ref={container} className="h-64 rounded-md border border-border overflow-hidden" />;
}

export default CrewDropsMap;
