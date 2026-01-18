import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Building2, Store, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { TerritoryCoverage } from '@/hooks/useWholesalerProfileAPI';

interface WholesalerTerritoryCoverageProps {
  territoryCoverage: TerritoryCoverage | null | undefined;
  isLoading?: boolean;
  onStoreClick?: (storeId: string) => void;
}

export function WholesalerTerritoryCoverage({
  territoryCoverage,
  isLoading,
  onStoreClick,
}: WholesalerTerritoryCoverageProps) {
  if (isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Territory & Coverage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-muted rounded"></div>
            <div className="h-12 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state - no stores assigned
  if (!territoryCoverage || territoryCoverage.totalStores === 0) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Territory & Coverage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground font-medium">No stores assigned</p>
            <p className="text-xs text-muted-foreground mt-1">
              Territory will be derived from assigned stores
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { totalStores, activeStores, dormantStores, boros, zips, coverageScore, stores } = territoryCoverage;

  // Coverage status
  const getCoverageStatus = () => {
    if (coverageScore >= 70) {
      return { label: 'Strong', color: 'text-green-400', bgColor: 'bg-green-500/20', icon: CheckCircle2 };
    } else if (coverageScore >= 40) {
      return { label: 'Partial', color: 'text-amber-400', bgColor: 'bg-amber-500/20', icon: AlertTriangle };
    } else {
      return { label: 'At Risk', color: 'text-red-400', bgColor: 'bg-red-500/20', icon: XCircle };
    }
  };

  const status = getCoverageStatus();
  const StatusIcon = status.icon;

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Territory & Coverage
          </CardTitle>
          <Badge className={`${status.bgColor} ${status.color}`}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {status.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI Grid */}
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <p className="text-2xl font-bold">{totalStores}</p>
            <p className="text-xs text-muted-foreground">Total Stores</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-green-500/10">
            <p className="text-2xl font-bold text-green-400">{activeStores}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-amber-500/10">
            <p className="text-2xl font-bold text-amber-400">{dormantStores}</p>
            <p className="text-xs text-muted-foreground">Dormant</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-primary/10">
            <p className="text-2xl font-bold text-primary">{coverageScore}%</p>
            <p className="text-xs text-muted-foreground">Score</p>
          </div>
        </div>

        {/* Boros Covered */}
        {boros.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Boros/Cities Covered</p>
            <div className="flex flex-wrap gap-1.5">
              {boros.map((boro) => (
                <Badge key={boro} variant="outline" className="text-xs">
                  {boro}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* ZIP Codes */}
        {zips.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">ZIP Codes</p>
            <div className="flex flex-wrap gap-1.5">
              {zips.slice(0, 8).map((zip) => (
                <Badge key={zip} variant="secondary" className="text-xs">
                  {zip}
                </Badge>
              ))}
              {zips.length > 8 && (
                <Badge variant="secondary" className="text-xs">
                  +{zips.length - 8} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Store List (collapsed) */}
        {stores.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Recent Stores</p>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {stores.slice(0, 5).map((store) => (
                <div
                  key={store.id}
                  className="flex items-center justify-between p-2 rounded bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => onStoreClick?.(store.id)}
                >
                  <div className="flex items-center gap-2">
                    <Store className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm truncate max-w-[200px]">{store.name}</span>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={store.status === 'active' ? 'text-green-400 border-green-500/30' : 'text-muted-foreground'}
                  >
                    {store.status || 'Unknown'}
                  </Badge>
                </div>
              ))}
              {stores.length > 5 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  +{stores.length - 5} more stores
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
