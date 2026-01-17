import React, { useState } from 'react';
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
import { Textarea } from "@/components/ui/textarea";
import { 
  MapPin, Store, Lock, Unlock, Users, 
  ArrowRight, Building2, AlertTriangle, DollarSign, 
  Package, TrendingUp, Edit, History, Plus, Check, X
} from 'lucide-react';
import type { WholesalerTerritory } from '@/hooks/useWholesalerIntelligence';
import { toast } from 'sonner';

interface TerritoryDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'neighborhoods' | 'stores' | 'exclusive' | 'overlap' | 'area';
  territory: WholesalerTerritory[];
  selectedArea?: WholesalerTerritory | null;
  profile: any;
  onViewStores?: (neighborhood: string) => void;
  onAssignTerritory?: () => void;
  onToggleExclusivity?: (areaId: string, isExclusive: boolean) => void;
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
  onToggleExclusivity,
}: TerritoryDetailDrawerProps) {
  const [showNotes, setShowNotes] = useState(false);
  const [noteText, setNoteText] = useState('');
  
  const totalStores = territory.reduce((sum, t) => sum + t.store_count, 0);
  const exclusiveZones = territory.filter(t => t.is_exclusive);
  const overlappingZones = territory.filter(t => t.overlap_with && t.overlap_with.length > 0);
  
  // Mock revenue data per territory
  const getAreaRevenue = (storeCount: number) => storeCount * 2500 + Math.random() * 5000;
  const getAreaOrders = (storeCount: number) => Math.floor(storeCount * 8 + Math.random() * 20);

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

  const handleAddNote = () => {
    if (noteText.trim()) {
      toast.success('Note added to territory');
      setNoteText('');
      setShowNotes(false);
    }
  };

  const handleToggleExclusivity = (areaId: string, currentStatus: boolean) => {
    if (onToggleExclusivity) {
      onToggleExclusivity(areaId, !currentStatus);
    } else {
      toast.success(`Territory ${currentStatus ? 'set to shared' : 'marked as exclusive'}`);
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
              <div className="grid grid-cols-3 gap-2 mt-4">
                <div className="text-center p-2 rounded-lg bg-background/50">
                  <p className="text-lg font-semibold text-green-400">{totalStores}</p>
                  <p className="text-xs text-muted-foreground">Stores</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-background/50">
                  <p className="text-lg font-semibold text-purple-400">{exclusiveZones.length}</p>
                  <p className="text-xs text-muted-foreground">Exclusive</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-background/50">
                  <p className="text-lg font-semibold text-amber-400">{overlappingZones.length}</p>
                  <p className="text-xs text-muted-foreground">Overlaps</p>
                </div>
              </div>
            </div>

            <ScrollArea className="h-[calc(100vh-380px)] mt-6">
              <div className="space-y-6">
                {Object.entries(byBorough).map(([borough, neighborhoods]) => {
                  const boroughRevenue = neighborhoods.reduce((sum, n) => sum + getAreaRevenue(n.store_count), 0);
                  return (
                    <div key={borough}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium">{borough}</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {neighborhoods.reduce((sum, n) => sum + n.store_count, 0)} stores
                          </span>
                          <Badge variant="outline" className="text-xs text-green-400 border-green-500/30">
                            ${(boroughRevenue / 1000).toFixed(0)}K
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {neighborhoods.map((area) => {
                          const areaRevenue = getAreaRevenue(area.store_count);
                          return (
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
                                    {area.store_count} stores • ${(areaRevenue / 1000).toFixed(1)}K
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
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        );

      case 'stores':
        const totalRevenue = territory.reduce((sum, t) => sum + getAreaRevenue(t.store_count), 0);
        return (
          <>
            <div className="p-6 rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20">
              <div className="text-center">
                <p className="text-4xl font-bold">{totalStores}</p>
                <p className="text-sm text-muted-foreground mt-1">Total Stores Covered</p>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="text-center p-2 rounded-lg bg-background/50">
                  <DollarSign className="h-4 w-4 mx-auto text-green-400 mb-1" />
                  <p className="text-lg font-semibold">${(totalRevenue / 1000).toFixed(0)}K</p>
                  <p className="text-xs text-muted-foreground">Est. Revenue</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-background/50">
                  <Package className="h-4 w-4 mx-auto text-blue-400 mb-1" />
                  <p className="text-lg font-semibold">{territory.reduce((sum, t) => sum + getAreaOrders(t.store_count), 0)}</p>
                  <p className="text-xs text-muted-foreground">Orders/Month</p>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="text-sm font-medium mb-3">Store Distribution by Revenue</p>
                {territory.sort((a, b) => b.store_count - a.store_count).slice(0, 5).map((area) => {
                  const revenue = getAreaRevenue(area.store_count);
                  return (
                    <div key={area.id} className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs">{area.neighborhood}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{area.store_count} stores</span>
                          <span className="text-xs font-medium text-green-400">${(revenue / 1000).toFixed(1)}K</span>
                        </div>
                      </div>
                      <Progress 
                        value={(area.store_count / (territory[0]?.store_count || 1)) * 100} 
                        className="h-1.5" 
                      />
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/30 text-center">
                  <TrendingUp className="h-5 w-5 mx-auto text-cyan-400 mb-2" />
                  <p className="text-2xl font-bold">
                    {(totalStores / territory.length).toFixed(1)}
                  </p>
                  <p className="text-xs text-muted-foreground">Avg per Neighborhood</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 text-center">
                  <Store className="h-5 w-5 mx-auto text-amber-400 mb-2" />
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
                    {exclusiveZones.map((area) => {
                      const revenue = getAreaRevenue(area.store_count);
                      return (
                        <div
                          key={area.id}
                          className="p-4 rounded-lg bg-purple-500/5 border border-purple-500/20"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Lock className="h-4 w-4 text-purple-400" />
                              <span className="font-medium">{area.neighborhood}</span>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleToggleExclusivity(area.id, true)}
                              className="h-7 text-xs"
                            >
                              <Unlock className="h-3 w-3 mr-1" />
                              Make Shared
                            </Button>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Borough:</span>
                              <span className="ml-1">{area.borough}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Stores:</span>
                              <span className="ml-1">{area.store_count}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Revenue:</span>
                              <span className="ml-1 text-green-400">${(revenue / 1000).toFixed(1)}K</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
                        <p className="text-xs text-muted-foreground mb-2">
                          Overlapping with: {area.overlap_with?.join(', ')}
                        </p>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="h-7 text-xs flex-1">
                            <Lock className="h-3 w-3 mr-1" />
                            Claim Exclusive
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs">
                            <History className="h-3 w-3" />
                          </Button>
                        </div>
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
        const areaRevenue = getAreaRevenue(selectedArea.store_count);
        const areaOrders = getAreaOrders(selectedArea.store_count);
        
        return (
          <>
            <div className="p-6 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
              <div className="text-center">
                <p className="text-2xl font-bold">{selectedArea.neighborhood}</p>
                <p className="text-sm text-muted-foreground mt-1">{selectedArea.borough}</p>
              </div>
            </div>

            {/* Key Metrics */}
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

            {/* Revenue & Order Stats */}
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                <DollarSign className="h-5 w-5 mx-auto text-green-400 mb-2" />
                <p className="text-xl font-bold text-green-400">${(areaRevenue / 1000).toFixed(1)}K</p>
                <p className="text-xs text-muted-foreground">Est. Monthly Revenue</p>
              </div>
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                <Package className="h-5 w-5 mx-auto text-blue-400 mb-2" />
                <p className="text-xl font-bold text-blue-400">{areaOrders}</p>
                <p className="text-xs text-muted-foreground">Orders/Month</p>
              </div>
            </div>

            {/* Coverage Info */}
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

            {/* Assignment History */}
            <div className="mt-4 p-4 rounded-lg bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium flex items-center gap-1">
                  <History className="h-4 w-4" />
                  Assignment History
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Assigned to {profile?.name}</span>
                  <span>Jan 15, 2024</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Marked as {selectedArea.is_exclusive ? 'exclusive' : 'shared'}</span>
                  <span>Jan 15, 2024</span>
                </div>
              </div>
            </div>

            {/* Notes Section */}
            {showNotes ? (
              <div className="mt-4 space-y-2">
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note about this territory..."
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddNote} className="flex-1">
                    <Check className="h-4 w-4 mr-1" />
                    Save Note
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowNotes(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-4"
                onClick={() => setShowNotes(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Note
              </Button>
            )}

            {/* Actions */}
            <div className="mt-4 space-y-2">
              {onViewStores && (
                <Button 
                  className="w-full" 
                  onClick={() => onViewStores(selectedArea.neighborhood)}
                >
                  <Store className="h-4 w-4 mr-2" />
                  View Stores in {selectedArea.neighborhood}
                </Button>
              )}
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => handleToggleExclusivity(selectedArea.id, selectedArea.is_exclusive)}
              >
                {selectedArea.is_exclusive ? (
                  <>
                    <Unlock className="h-4 w-4 mr-2" />
                    Make Shared Territory
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Mark as Exclusive
                  </>
                )}
              </Button>
            </div>
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
