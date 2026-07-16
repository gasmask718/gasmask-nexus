/**
 * StoreStreetView — Google Street View storefront preview for a store.
 *
 * Renders a Street View Static image for the store's lat/lng via the
 * `street-view-image` edge function (keeps the Google API key server-side).
 * Falls back to a placeholder card when lat/lng is null.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, ImageOff } from "lucide-react";
import { useState } from "react";

interface StoreStreetViewProps {
  lat: number | null;
  lng: number | null;
  storeName?: string;
  address?: string;
  height?: number;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export function StoreStreetView({ lat, lng, storeName, address, height = 260 }: StoreStreetViewProps) {
  const [errored, setErrored] = useState(false);

  const hasCoords = typeof lat === "number" && typeof lng === "number" && !Number.isNaN(lat) && !Number.isNaN(lng);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          Storefront (Street View)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-hidden">
        {hasCoords && !errored ? (
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
              onError={() => setErrored(true)}
            />
          </a>
        ) : (
          <div
            className="w-full flex flex-col items-center justify-center bg-muted/40 text-muted-foreground text-xs gap-2"
            style={{ height }}
          >
            <ImageOff className="h-6 w-6 opacity-50" />
            <span>
              {hasCoords
                ? "Street view unavailable for this location"
                : "No coordinates on file — street view unavailable"}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
