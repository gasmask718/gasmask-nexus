import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { MapPin, Store, AlertTriangle, Users, Lock, Unlock, ChevronRight } from 'lucide-react';
import type { WholesalerTerritory } from '@/hooks/useWholesalerIntelligence';

interface WholesalerTerritoryProps {
  territory: WholesalerTerritory[];
  profile: any;
  onMetricClick?: (metricType: string, value: number, label: string) => void;
  onTerritoryClick?: (territory: WholesalerTerritory) => void;
}

export function WholesalerTerritorySection({ territory, profile, onMetricClick, onTerritoryClick }: WholesalerTerritoryProps) {
  const totalStores = territory.reduce((sum, t) => sum + t.store_count, 0);
  const exclusiveZones = territory.filter(t => t.is_exclusive).length;
  const overlappingZones = territory.filter(t => t.overlap_with && t.overlap_with.length > 0).length;

  const getDensityColor = (density: string) => {
    switch (density?.toLowerCase()) {
      case 'high': return 'bg-green-500/20 text-green-400';
      case 'medium': return 'bg-amber-500/20 text-amber-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  // Group by borough
  const byBorough = territory.reduce((acc, t) => {
    const borough = t.borough || 'Other';
    if (!acc[borough]) acc[borough] = [];
    acc[borough].push(t);
    return acc;
  }, {} as Record<string, WholesalerTerritory[]>);

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <MapPin className="h-5 w-5 text-cyan-500" />
          Territory & Coverage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div 
            className="text-center p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors group"
            onClick={() => onMetricClick?.('neighborhoods', territory.length, 'Neighborhoods')}
          >
            <MapPin className="h-5 w-5 mx-auto text-cyan-500 mb-1" />
            <p className="text-2xl font-bold">{territory.length}</p>
            <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">Neighborhoods</p>
          </div>
          <div 
            className="text-center p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors group"
            onClick={() => onMetricClick?.('stores', totalStores, 'Total Stores')}
          >
            <Store className="h-5 w-5 mx-auto text-green-500 mb-1" />
            <p className="text-2xl font-bold">{totalStores}</p>
            <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">Total Stores</p>
          </div>
          <div 
            className="text-center p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors group"
            onClick={() => onMetricClick?.('exclusive', exclusiveZones, 'Exclusive Zones')}
          >
            <Lock className="h-5 w-5 mx-auto text-purple-500 mb-1" />
            <p className="text-2xl font-bold">{exclusiveZones}</p>
            <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">Exclusive Zones</p>
          </div>
          <div 
            className="text-center p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors group"
            onClick={() => onMetricClick?.('overlap', overlappingZones, 'Overlap Zones')}
          >
            <Users className="h-5 w-5 mx-auto text-amber-500 mb-1" />
            <p className="text-2xl font-bold">{overlappingZones}</p>
            <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">Overlap Zones</p>
          </div>
        </div>

        {/* Exclusive Territories from Profile */}
        {profile?.exclusive_zones && profile.exclusive_zones.length > 0 && (
          <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="h-4 w-4 text-purple-400" />
              <span className="text-sm font-medium text-purple-400">Exclusive Territory Rights</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile.exclusive_zones.map((zone: string, i: number) => (
                <Badge key={i} variant="outline" className="bg-purple-500/20 text-purple-400">
                  {zone}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Territory by Borough */}
        <ScrollArea className="h-64">
          <div className="space-y-4">
            {Object.entries(byBorough).map(([borough, neighborhoods]) => (
              <div key={borough}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">{borough}</h4>
                  <span className="text-xs text-muted-foreground">
                    {neighborhoods.reduce((sum, n) => sum + n.store_count, 0)} stores
                  </span>
                </div>
                <div className="space-y-2">
                  {neighborhoods.map((area) => (
                    <div 
                      key={area.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors group"
                      onClick={() => onTerritoryClick?.(area)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          {area.is_exclusive ? (
                            <Lock className="h-4 w-4 text-purple-400" />
                          ) : (
                            <Unlock className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{area.neighborhood}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Store className="h-3 w-3" />
                            <span>{area.store_count} stores</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getDensityColor(area.coverage_density)}>
                          {area.coverage_density}
                        </Badge>
                        {area.overlap_with && area.overlap_with.length > 0 && (
                          <Badge variant="outline" className="text-amber-400 border-amber-500/30">
                            <Users className="h-3 w-3 mr-1" />
                            {area.overlap_with.length} overlap
                          </Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {territory.length === 0 && (
              <div className="text-center py-8">
                <MapPin className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No territory data available</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Gap Alert */}
        {profile?.territories && territory.length > 0 && (
          <div className="pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Coverage Analysis</p>
            <div className="flex items-center gap-2">
              <Progress 
                value={(territory.filter(t => t.store_count > 0).length / territory.length) * 100} 
                className="flex-1 h-2"
              />
              <span className="text-sm">
                {((territory.filter(t => t.store_count > 0).length / territory.length) * 100).toFixed(0)}% active
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
