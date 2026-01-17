import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { 
  MapPin, Store, Lock, Unlock, Users, 
  ArrowRight, Building2, AlertTriangle
} from 'lucide-react';
import type { WholesalerTerritory } from '@/hooks/useWholesalerIntelligence';

interface TerritoryDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'neighborhoods' | 'stores' | 'exclusive' | 'overlap' | 'area';
  territory: WholesalerTerritory[];
  selectedArea?: WholesalerTerritory | null;
  profile: any;
  onViewStores?: (neighborhood: string) => void;
  onAssignTerritory?: () => void;
}

export function TerritoryDetailDrawer({
  open,
  onOpenChange,
  type,
  territory,
  selectedArea,
  profile,
  onViewStores,
  onAssignTerritory,
}: TerritoryDetailDrawerProps) {
  const totalStores = territory.reduce((sum, t) => sum + t.store_count, 0);
  const exclusiveZones = territory.filter(t => t.is_exclusive);
  const overlappingZones = territory.filter(t => t.overlap_with && t.overlap_with.length > 0);

  const getDensityColor = (density: string) => {
    switch (density?.toLowerCase()) {
      case 'high': return 'bg-green-500/20 text-green-400';
      case 'medium': return 'bg-amber-500/20 text-amber-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'neighborhoods': return 'All Neighborhoods';
      case 'stores': return 'Store Coverage';
      case 'exclusive': return 'Exclusive Territories';
      case 'overlap': return 'Overlapping Zones';
      case 'area': return selectedArea?.neighborhood || 'Area Details';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'neighborhoods': return MapPin;
      case 'stores': return Store;
      case 'exclusive': return Lock;
      case 'overlap': return Users;
      case 'area': return Building2;
    }
  };

  const Icon = getIcon();

  const renderContent = () => {
    switch (type) {
      case 'neighborhoods':
        // Group by borough
        const byBorough = territory.reduce((acc, t) => {
          const borough = t.borough || 'Other';
          if (!acc[borough]) acc[borough] = [];
          acc[borough].push(t);
          return acc;
        }, {} as Record<string, WholesalerTerritory[]>);

        return (
          <>
            <div className="p-6 rounded-xl bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20">
              <div className="text-center">
                <p className="text-4xl font-bold">{territory.length}</p>
                <p className="text-sm text-muted-foreground mt-1">Total Neighborhoods</p>
              </div>
            </div>

            <ScrollArea className="h-[calc(100vh-320px)] mt-6">
              <div className="space-y-6">
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
                          onClick={() => onViewStores?.(area.neighborhood)}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            {area.is_exclusive ? (
                              <Lock className="h-4 w-4 text-purple-400" />
                            ) : (
                              <Unlock className="h-4 w-4 text-muted-foreground" />
                            )}
                            <div>
                              <p className="text-sm font-medium">{area.neighborhood}</p>
                              <p className="text-xs text-muted-foreground">
                                {area.store_count} stores
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getDensityColor(area.coverage_density)}>
                              {area.coverage_density}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        );

      case 'stores':
        return (
          <>
            <div className="p-6 rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20">
              <div className="text-center">
                <p className="text-4xl font-bold">{totalStores}</p>
                <p className="text-sm text-muted-foreground mt-1">Total Stores Covered</p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="text-sm font-medium mb-3">Store Distribution</p>
                {territory.sort((a, b) => b.store_count - a.store_count).slice(0, 5).map((area) => (
                  <div key={area.id} className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs">{area.neighborhood}</span>
                      <span className="text-xs font-medium">{area.store_count} stores</span>
                    </div>
                    <Progress 
                      value={(area.store_count / (territory[0]?.store_count || 1)) * 100} 
                      className="h-1.5" 
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/30 text-center">
                  <p className="text-2xl font-bold">
                    {(totalStores / territory.length).toFixed(1)}
                  </p>
                  <p className="text-xs text-muted-foreground">Avg per Neighborhood</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 text-center">
                  <p className="text-2xl font-bold">
                    {territory.filter(t => t.store_count > 0).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Active Territories</p>
                </div>
              </div>
            </div>
          </>
        );

      case 'exclusive':
        return (
          <>
            <div className="p-6 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20">
              <div className="text-center">
                <p className="text-4xl font-bold">{exclusiveZones.length}</p>
                <p className="text-sm text-muted-foreground mt-1">Exclusive Territories</p>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                Exclusive Zone Details
              </p>
              {exclusiveZones.length > 0 ? (
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {exclusiveZones.map((area) => (
                      <div
                        key={area.id}
                        className="p-4 rounded-lg bg-purple-500/5 border border-purple-500/20"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Lock className="h-4 w-4 text-purple-400" />
                          <span className="font-medium">{area.neighborhood}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Borough:</span>
                            <span className="ml-1">{area.borough}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Stores:</span>
                            <span className="ml-1">{area.store_count}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Density:</span>
                            <Badge className={`ml-1 ${getDensityColor(area.coverage_density)}`}>
                              {area.coverage_density}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8">
                  <Unlock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No exclusive territories assigned</p>
                  {onAssignTerritory && (
                    <Button variant="outline" size="sm" className="mt-3" onClick={onAssignTerritory}>
                      Assign Territory
                    </Button>
                  )}
                </div>
              )}
            </div>
          </>
        );

      case 'overlap':
        return (
          <>
            <div className="p-6 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20">
              <div className="text-center">
                <p className="text-4xl font-bold">{overlappingZones.length}</p>
                <p className="text-sm text-muted-foreground mt-1">Overlapping Zones</p>
                {overlappingZones.length > 0 && (
                  <p className="text-xs text-amber-400 mt-2">
                    <AlertTriangle className="h-3 w-3 inline mr-1" />
                    Potential competition in these areas
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                Overlap Details
              </p>
              {overlappingZones.length > 0 ? (
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {overlappingZones.map((area) => (
                      <div
                        key={area.id}
                        className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{area.neighborhood}</span>
                          <Badge variant="outline" className="text-amber-400 border-amber-500/30">
                            {area.overlap_with?.length} overlap{(area.overlap_with?.length || 0) > 1 ? 's' : ''}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Overlapping with: {area.overlap_with?.join(', ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8">
                  <Lock className="h-12 w-12 mx-auto text-green-500/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No territorial overlaps</p>
                </div>
              )}
            </div>
          </>
        );

      case 'area':
        if (!selectedArea) return null;
        return (
          <>
            <div className="p-6 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
              <div className="text-center">
                <p className="text-2xl font-bold">{selectedArea.neighborhood}</p>
                <p className="text-sm text-muted-foreground mt-1">{selectedArea.borough}</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/30 text-center">
                <Store className="h-5 w-5 mx-auto text-green-400 mb-2" />
                <p className="text-2xl font-bold">{selectedArea.store_count}</p>
                <p className="text-xs text-muted-foreground">Stores</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 text-center">
                {selectedArea.is_exclusive ? (
                  <Lock className="h-5 w-5 mx-auto text-purple-400 mb-2" />
                ) : (
                  <Unlock className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
                )}
                <p className="text-sm font-medium">
                  {selectedArea.is_exclusive ? 'Exclusive' : 'Shared'}
                </p>
                <p className="text-xs text-muted-foreground">Territory Type</p>
              </div>
            </div>

            <div className="mt-4 p-4 rounded-lg bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">Coverage Density</span>
                <Badge className={getDensityColor(selectedArea.coverage_density)}>
                  {selectedArea.coverage_density}
                </Badge>
              </div>
              {selectedArea.overlap_with && selectedArea.overlap_with.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <p className="text-xs text-muted-foreground mb-1">Overlapping with:</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedArea.overlap_with.map((name, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {onViewStores && (
              <Button 
                className="w-full mt-4" 
                onClick={() => onViewStores(selectedArea.neighborhood)}
              >
                <Store className="h-4 w-4 mr-2" />
                View Stores in {selectedArea.neighborhood}
              </Button>
            )}
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-muted/50">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <SheetTitle className="text-xl">{getTitle()}</SheetTitle>
              <p className="text-sm text-muted-foreground">
                Territory coverage analysis
              </p>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6">
          {renderContent()}
        </div>
      </SheetContent>
    </Sheet>
  );
}
