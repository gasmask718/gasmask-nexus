/**
 * StoreLocationMap — sharp, interactive Google map for a store, meant to sit at
 * the very top of the customer profile.
 *
 * Uses the Maps JavaScript API (vector-sharp at any zoom / DPI) instead of a
 * static image, so the map never looks blurry. The browser key comes from the
 * existing `get-maps-browser-key` edge function — same source the street view
 * component already uses. No new key, no new secret.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, ExternalLink, Loader2, ImageOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface StoreLocationMapProps {
  lat: number | null;
  lng: number | null;
  storeName?: string;
  address?: string;
  height?: number;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

let mapsLoader: Promise<any> | null = null;
function loadMapsJs(apiKey: string): Promise<any> {
  if (mapsLoader) return mapsLoader;
  mapsLoader = new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && (window as any).google?.maps) {
      resolve((window as any).google);
      return;
    }
    const cbName = `__gmapsInitStoreMap_${Date.now()}`;
    (window as any)[cbName] = () => {
      resolve((window as any).google);
      delete (window as any)[cbName];
    };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&callback=${cbName}`;
    s.async = true;
    s.defer = true;
    s.onerror = (e) => reject(e);
    document.head.appendChild(s);
  });
  return mapsLoader;
}

export function StoreLocationMap({ lat, lng, storeName, address, height = 320 }: StoreLocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const hasCoords =
    typeof lat === "number" && typeof lng === "number" && !Number.isNaN(lat) && !Number.isNaN(lng);

  useEffect(() => {
    if (!hasCoords || !mapRef.current) return;
    let cancelled = false;
    setStatus("loading");
    (async () => {
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/get-maps-browser-key`);
        const { key } = await resp.json();
        if (!key) throw new Error("Browser Maps key not configured");
        const google: any = await loadMapsJs(key);
        if (cancelled || !mapRef.current) return;
        const center = { lat: lat as number, lng: lng as number };
        const map = new google.maps.Map(mapRef.current, {
          center,
          zoom: 17,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
          gestureHandling: "greedy",
        });
        new google.maps.Marker({ position: center, map, title: storeName || "Store" });
        setStatus("ready");
      } catch (e) {
        console.error("[StoreLocationMap] load failed", e);
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasCoords, lat, lng, storeName]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-4 w-4 text-primary" />
          Location
        </CardTitle>
        {hasCoords && (
          <Button asChild size="sm" variant="outline" className="h-8">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Open in Maps
            </a>
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2 p-0">
        {!hasCoords ? (
          <div
            className="flex w-full flex-col items-center justify-center gap-2 bg-muted/40 text-xs text-muted-foreground"
            style={{ height }}
          >
            <ImageOff className="h-6 w-6 opacity-50" />
            <span>No coordinates on file — use “Geocode Address” to place this store</span>
          </div>
        ) : (
          <div className="relative">
            <div ref={mapRef} style={{ height, width: "100%" }} className="bg-muted/30" />
            {status !== "ready" && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {status === "error" ? "Map could not load" : "Loading map…"}
              </div>
            )}
          </div>
        )}
        {address && (
          <p className="px-4 pb-3 text-xs text-muted-foreground">{address}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default StoreLocationMap;
