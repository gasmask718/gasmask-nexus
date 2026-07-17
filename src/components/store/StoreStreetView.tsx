/**
 * StoreStreetView — Interactive Google Street View panorama for a store.
 *
 * Loads the Maps JavaScript API lazily (only when the section scrolls into view)
 * and mounts a StreetViewPanorama with pan / zoom / step-down-the-street
 * navigation. Falls back to the static image proxy (or a friendly message) when
 * no Street View imagery exists for the coordinates.
 *
 * Browser key is fetched from the `get-maps-browser-key` edge function so it's
 * not committed to the repo. That key should be restricted by HTTP referrer in
 * Google Cloud Console and limited to the Maps JavaScript API.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, ImageOff, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface StoreStreetViewProps {
  lat: number | null;
  lng: number | null;
  storeName?: string;
  address?: string;
  height?: number;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

// Module-level singleton so the Maps JS script is loaded at most once per page.
let mapsLoader: Promise<any> | null = null;
function loadMapsJs(apiKey: string): Promise<any> {
  if (mapsLoader) return mapsLoader;
  mapsLoader = new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && (window as any).google?.maps) {
      resolve((window as any).google);
      return;
    }
    const cbName = `__gmapsInitStreetView_${Date.now()}`;
    (window as any)[cbName] = () => {
      resolve((window as any).google);
      delete (window as any)[cbName];
    };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&callback=${cbName}&libraries=streetView`;
    s.async = true;
    s.defer = true;
    s.onerror = (e) => reject(e);
    document.head.appendChild(s);
  });
  return mapsLoader;
}

export function StoreStreetView({ lat, lng, storeName, address, height = 260 }: StoreStreetViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const panoRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "no-imagery" | "error">("idle");

  const hasCoords =
    typeof lat === "number" && typeof lng === "number" && !Number.isNaN(lat) && !Number.isNaN(lng);

  // Lazy: only start loading Maps JS when the card is on screen.
  useEffect(() => {
    if (!hostRef.current || inView) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(hostRef.current);
    return () => io.disconnect();
  }, [inView]);

  useEffect(() => {
    if (!inView || !hasCoords || !panoRef.current) return;
    let cancelled = false;
    setStatus("loading");
    (async () => {
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/get-maps-browser-key`);
        const { key } = await resp.json();
        if (!key) throw new Error("Browser Maps key not configured");
        const google = await loadMapsJs(key);
        if (cancelled || !panoRef.current) return;

        const location = { lat: lat as number, lng: lng as number };
        const svService = new google.maps.StreetViewService();
        svService.getPanorama(
          { location, radius: 80, source: google.maps.StreetViewSource.OUTDOOR },
          (data, s) => {
            if (cancelled || !panoRef.current) return;
            if (s !== google.maps.StreetViewStatus.OK || !data?.location?.latLng) {
              setStatus("no-imagery");
              return;
            }
            const panoLatLng = data.location.latLng;
            // Face the storefront: heading from the pano toward the given point.
            const heading = google.maps.geometry?.spherical
              ? google.maps.geometry.spherical.computeHeading(panoLatLng, new google.maps.LatLng(location))
              : 0;
            new google.maps.StreetViewPanorama(panoRef.current, {
              pano: data.location.pano,
              pov: { heading: heading || 0, pitch: 0 },
              zoom: 1,
              addressControl: false,
              fullscreenControl: true,
              motionTracking: false,
              motionTrackingControl: false,
              linksControl: true,
              panControl: true,
              zoomControl: true,
              clickToGo: true,
              scrollwheel: true,
            });
            setStatus("ready");
          },
        );
      } catch (e) {
        console.error("[StoreStreetView] load failed", e);
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inView, hasCoords, lat, lng]);

  const showFallbackImage = hasCoords && (status === "no-imagery" || status === "error");

  return (
    <Card ref={hostRef}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          Storefront (Street View)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-hidden relative">
        {!hasCoords ? (
          <div
            className="w-full flex flex-col items-center justify-center bg-muted/40 text-muted-foreground text-xs gap-2"
            style={{ height }}
          >
            <ImageOff className="h-6 w-6 opacity-50" />
            <span>No coordinates on file — street view unavailable</span>
          </div>
        ) : showFallbackImage ? (
          <a
            href={`https://www.google.com/maps?q=&layer=c&cbll=${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full"
            title={address ? `Open Street View for ${address}` : "Open in Google Street View"}
          >
            <img
              src={`${SUPABASE_URL}/functions/v1/street-view-image?lat=${lat}&lng=${lng}&w=800&h=${height}&fov=90`}
              alt={storeName ? `Street view of ${storeName}` : "Street view"}
              className="w-full object-cover"
              style={{ height, display: "block" }}
              loading="lazy"
            />
            <div className="absolute bottom-2 left-2 text-[10px] px-2 py-0.5 rounded bg-black/60 text-white">
              {status === "no-imagery" ? "No interactive imagery — static fallback" : "Static fallback"}
            </div>
          </a>
        ) : (
          <>
            <div ref={panoRef} style={{ height, width: "100%" }} className="bg-muted/30" />
            {status !== "ready" && (
              <div
                className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-muted-foreground pointer-events-none"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                {status === "idle" ? "Scroll to load street view" : "Loading street view…"}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
