import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MapPin, CheckCircle, AlertTriangle, Compass } from "lucide-react";

interface TerritorySnapshotProps {
  geoId?: string | null;
  regionName?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  verified?: boolean;
  lastGeoCheck?: string | null;
  className?: string;
}

export function TerritorySnapshot({
  geoId,
  regionName,
  neighborhood,
  city,
  verified,
  lastGeoCheck,
  className = "",
}: TerritorySnapshotProps) {
  const hasGeo = !!geoId;

  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          Territory
        </h4>
        {hasGeo ? (
          verified ? (
            <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-500/10 text-xs">
              <CheckCircle className="w-3 h-3 mr-1" />
              Verified
            </Badge>
          ) : (
            <Badge variant="outline" className="text-yellow-600 border-yellow-600/30 bg-yellow-500/10 text-xs">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Unresolved
            </Badge>
          )
        ) : (
          <Badge variant="outline" className="text-muted-foreground border-muted text-xs">
            <Compass className="w-3 h-3 mr-1" />
            No Geo Data
          </Badge>
        )}
      </div>

      <div className="space-y-1.5 text-sm">
        {regionName && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Region</span>
            <span className="font-medium">{regionName}</span>
          </div>
        )}
        {neighborhood && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Neighborhood</span>
            <span className="font-medium">{neighborhood}</span>
          </div>
        )}
        {city && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">City</span>
            <span className="font-medium">{city}</span>
          </div>
        )}
        {lastGeoCheck && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Last Check</span>
            <span className="text-xs text-muted-foreground">
              {new Date(lastGeoCheck).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {!hasGeo && (
        <p className="text-xs text-muted-foreground mt-2 italic">
          Address has not been geo-resolved yet.
        </p>
      )}
    </Card>
  );
}
