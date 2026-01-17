import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { MapPin, Building2, TrendingUp, Store, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TerritoryData {
  city?: string;
  state?: string;
  region?: string;
  neighborhood?: string;
  neighborhoods?: string[];
}

interface TerritoryStats {
  storesInArea: number;
  revenueInArea: number;
  coveragePercent: number;
}

interface AmbassadorTerritoryPanelProps {
  ambassador: any;
  stats?: TerritoryStats;
  storesByArea?: Record<string, number>;
}

export function AmbassadorTerritoryPanel({ 
  ambassador, 
  stats,
  storesByArea = {}
}: AmbassadorTerritoryPanelProps) {
  const navigate = useNavigate();

  const territory: TerritoryData = {
    city: ambassador?.city,
    state: ambassador?.state,
    region: ambassador?.region,
    neighborhood: ambassador?.neighborhood,
    neighborhoods: ambassador?.neighborhoods || [],
  };

  // Build area list from available data
  const areas: { name: string; type: string; storeCount: number }[] = [];
  
  if (territory.city) {
    areas.push({ 
      name: territory.city, 
      type: 'City', 
      storeCount: storesByArea[territory.city] || 0 
    });
  }
  
  if (territory.neighborhood) {
    areas.push({ 
      name: territory.neighborhood, 
      type: 'Neighborhood', 
      storeCount: storesByArea[territory.neighborhood] || 0 
    });
  }
  
  if (territory.neighborhoods && Array.isArray(territory.neighborhoods)) {
    territory.neighborhoods.forEach(n => {
      if (n && n !== territory.neighborhood) {
        areas.push({ 
          name: n, 
          type: 'Neighborhood', 
          storeCount: storesByArea[n] || 0 
        });
      }
    });
  }

  const hasTerritory = areas.length > 0 || territory.region || territory.state;

  if (!hasTerritory) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Territory Coverage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No territory assigned</p>
            <p className="text-sm mt-1">Assign regions, cities, or neighborhoods to track coverage</p>
            <Button variant="outline" className="mt-4" size="sm">
              Assign Territory
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          Territory Coverage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary Location Summary */}
        <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-medium">
              {[territory.city, territory.state].filter(Boolean).join(', ') || territory.region || 'Unknown'}
            </p>
            <p className="text-sm text-muted-foreground">
              {areas.length} area{areas.length !== 1 ? 's' : ''} covered
            </p>
          </div>
          {stats && (
            <div className="text-right">
              <p className="font-medium">{stats.storesInArea}</p>
              <p className="text-xs text-muted-foreground">stores</p>
            </div>
          )}
        </div>

        {/* Coverage Progress */}
        {stats && stats.coveragePercent > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Territory Coverage</span>
              <span className="font-medium">{stats.coveragePercent}%</span>
            </div>
            <Progress value={stats.coveragePercent} className="h-2" />
          </div>
        )}

        {/* Area List */}
        {areas.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Covered Areas</h4>
            <div className="space-y-2">
              {areas.map((area, index) => (
                <div 
                  key={`${area.name}-${index}`}
                  className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/grabba/store-master?city=${encodeURIComponent(area.name)}`)}
                >
                  <div className="flex items-center gap-3">
                    <Store className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{area.name}</p>
                      <Badge variant="outline" className="text-xs">{area.type}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {area.storeCount} store{area.storeCount !== 1 ? 's' : ''}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Revenue by Area */}
        {stats && stats.revenueInArea > 0 && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Territory Revenue</span>
              </div>
              <span className="font-semibold text-green-600">
                ${stats.revenueInArea.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
