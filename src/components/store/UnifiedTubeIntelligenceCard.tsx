import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSimulationSafeMutation } from '@/hooks/useSimulationSafeMutation';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { Package, Save, RefreshCw, Clock, Calendar, ShoppingCart, FlaskConical, Gift, ThumbsUp, ThumbsDown, HelpCircle, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TUBE_BRAND_COLORS } from '@/constants/tubeColors';

// ═══════════════════════════════════════════════════════════════════════════════
// UNIFIED TUBE INTELLIGENCE CARD
// THE ONE AND ONLY tube component per store - combines:
//   - Editable tube counts (WRITE)
//   - Last order date per brand (READ - from v_store_tube_kpi)
//   - Color flow logic (🟢 🟡 🔴)
//   - Operational signals (interest, needs order, samples, starter kit)
// ═══════════════════════════════════════════════════════════════════════════════

// AUTHORITATIVE TUBE BRANDS
export const VALID_TUBE_BRANDS = [
  { id: 'gasmask', name: 'GasMask Bags', color: TUBE_BRAND_COLORS.gasmask.hex },
  { id: 'gasmasktubes', name: 'GasMask Tubes', color: TUBE_BRAND_COLORS.gasmasktubes.hex },
  { id: 'hotmama', name: 'HotMama', color: TUBE_BRAND_COLORS.hotmama.hex },
  { id: 'grabba', name: 'Grabba r us', color: TUBE_BRAND_COLORS.grabba.hex },
  { id: 'hotscolatti-light', name: 'Hot Scolatti Light', color: TUBE_BRAND_COLORS['hotscolatti-light'].hex },
  { id: 'hotscolatti-dark', name: 'Hot Scolatti Dark', color: TUBE_BRAND_COLORS['hotscolatti-dark'].hex },
] as const;

interface TubeInventoryRecord {
  id: string;
  brand: string;
  current_tubes_left: number;
  last_updated: string;
  created_by: string;
}

interface TubeKPIData {
  brand_id: string;
  brand_name: string;
  tube_count: number;
  last_order_date: string | null;
  last_order_label: string;
  color_status: 'green' | 'yellow' | 'red' | 'muted';
  needs_order: boolean;
  bring_samples: boolean;
  bring_starter_kit: boolean;
  owner_interested: boolean | null;
  inventory_updated_at: string | null;
}

interface UnifiedTubeIntelligenceCardProps {
  storeId: string;
  role?: 'admin' | 'ambassador' | 'driver' | 'biker';
}

export function UnifiedTubeIntelligenceCard({ storeId, role = 'admin' }: UnifiedTubeIntelligenceCardProps) {
  const queryClient = useQueryClient();
  const { simulationMode } = useSimulationMode();
  const [editedCounts, setEditedCounts] = useState<Record<string, number>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const canEdit = role === 'admin' || role === 'ambassador' || role === 'biker';

  // Fetch combined KPI data from view (includes last order intelligence)
  const { data: kpiData, isLoading: kpiLoading, refetch: refetchKPI } = useQuery({
    queryKey: ['store-tube-kpi', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_store_tube_kpi')
        .select('*')
        .eq('store_id', storeId)
        .order('brand_name');
      
      if (error) {
        console.error('Failed to fetch tube KPI:', error);
        return [];
      }
      return (data || []) as TubeKPIData[];
    },
    enabled: !!storeId,
  });

  // Fetch editable inventory records
  const { data: inventory, isLoading: invLoading, refetch: refetchInv } = useQuery({
    queryKey: ['store-tube-inventory', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_tube_inventory')
        .select('*')
        .eq('store_id', storeId)
        .neq('brand', 'hotscolatti')
        .order('brand');
      
      if (error) throw error;
      return data as TubeInventoryRecord[];
    },
    enabled: !!storeId,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`unified-tube-intel-${storeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'store_tube_inventory',
          filter: `store_id=eq.${storeId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['store-tube-inventory', storeId] });
          queryClient.invalidateQueries({ queryKey: ['store-tube-kpi', storeId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, queryClient]);

  // Initialize edited counts
  useEffect(() => {
    if (inventory) {
      const counts: Record<string, number> = {};
      inventory.forEach(item => {
        counts[item.brand] = item.current_tubes_left;
      });
      VALID_TUBE_BRANDS.forEach(brand => {
        if (!(brand.id in counts)) {
          counts[brand.id] = 0;
        }
      });
      setEditedCounts(counts);
      setHasChanges(false);
    }
  }, [inventory]);

  const saveMutation = useSimulationSafeMutation({
    mutationFn: async (updates: { brand: string; count: number }[], isSimulation: boolean) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      for (const update of updates) {
        const { data: existing } = await supabase
          .from('store_tube_inventory')
          .select('id')
          .eq('store_id', storeId)
          .eq('brand', update.brand)
          .order('last_updated', { ascending: false })
          .limit(1)
          .maybeSingle();
          
        if (existing) {
          await supabase
            .from('store_tube_inventory')
            .update({
              current_tubes_left: update.count,
              last_updated: new Date().toISOString(),
              created_by: user?.id || 'system',
              is_simulation: isSimulation,
            })
            .eq('id', existing.id);
        } else if (update.count > 0) {
          await supabase
            .from('store_tube_inventory')
            .insert({
              store_id: storeId,
              brand: update.brand,
              current_tubes_left: update.count,
              created_by: user?.id || 'system',
              is_simulation: isSimulation,
            });
        }
      }
      return updates;
    },
    simulationMessage: 'Saving inventory to simulation database...',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-tube-inventory', storeId] });
      queryClient.invalidateQueries({ queryKey: ['store-tube-kpi', storeId] });
      toast.success(simulationMode ? 'Inventory updated (simulation)' : 'Tube inventory saved');
      setHasChanges(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const handleCountChange = (brand: string, value: string) => {
    if (!canEdit) return;
    const numValue = parseInt(value) || 0;
    setEditedCounts(prev => ({
      ...prev,
      [brand]: numValue,
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const updates = Object.entries(editedCounts).map(([brand, count]) => ({
      brand,
      count,
    }));
    saveMutation.mutate(updates);
  };

  const handleRefresh = () => {
    refetchKPI();
    refetchInv();
  };

  const getKPIForBrand = (brandId: string): TubeKPIData | undefined => {
    return kpiData?.find(k => k.brand_id === brandId);
  };

  const getColorClasses = (status: 'green' | 'yellow' | 'red' | 'muted' | undefined) => {
    switch (status) {
      case 'green':
        return { bg: 'bg-green-500/10', border: 'border-green-500/30', dot: 'bg-green-500' };
      case 'yellow':
        return { bg: 'bg-amber-500/10', border: 'border-amber-500/30', dot: 'bg-amber-500' };
      case 'red':
        return { bg: 'bg-red-500/10', border: 'border-red-500/30', dot: 'bg-red-500' };
      default:
        return { bg: 'bg-secondary/30', border: 'border-transparent', dot: 'bg-muted-foreground' };
    }
  };

  const isLoading = kpiLoading || invLoading;
  const totalTubes = Object.values(editedCounts).reduce((sum, count) => sum + count, 0);

  const getLastUpdated = () => {
    if (!inventory?.length) return null;
    const sorted = [...inventory].sort(
      (a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()
    );
    return sorted[0]?.last_updated;
  };

  const lastUpdated = getLastUpdated();

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="h-5 w-5 text-primary" />
          Tube Intelligence
          <Badge variant="outline" className="ml-2 text-xs">
            {canEdit ? 'Editable' : 'Read-only'}
          </Badge>
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            className="h-8 w-8"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {hasChanges && canEdit && (
            <Button 
              onClick={handleSave} 
              size="sm" 
              className="gap-1"
              disabled={saveMutation.isPending}
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {simulationMode && (
          <Alert variant="default" className="border-blue-500/50 bg-blue-500/10">
            <AlertTriangle className="h-4 w-4 text-blue-500" />
            <AlertDescription className="text-blue-600 dark:text-blue-400 text-sm">
              Simulation Mode: Data isolated from live
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Total summary */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
              <span className="font-medium">Total Tubes</span>
              <span className="text-2xl font-bold text-primary font-mono">{totalTubes.toLocaleString()}</span>
            </div>

            {/* Brand breakdown - ALL IN ONE */}
            <div className="space-y-2">
              {VALID_TUBE_BRANDS.map((brand) => {
                const kpi = getKPIForBrand(brand.id);
                const count = editedCounts[brand.id] ?? 0;
                const colorClasses = getColorClasses(kpi?.color_status);
                const hasFlags = kpi?.needs_order || kpi?.bring_samples || kpi?.bring_starter_kit;
                const originalItem = inventory?.find(i => i.brand === brand.id);
                const hasChange = originalItem ? count !== originalItem.current_tubes_left : count > 0;

                return (
                  <div
                    key={brand.id}
                    className={cn(
                      'p-3 rounded-lg border transition-colors',
                      hasFlags ? 'bg-orange-500/10 border-orange-500/30' : colorClasses.bg,
                      hasFlags ? 'border-orange-500/30' : colorClasses.border
                    )}
                  >
                    {/* Brand Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn('h-3 w-3 rounded-full', colorClasses.dot)}
                          style={{ backgroundColor: brand.color }}
                        />
                        <span className="font-medium" style={{ color: brand.color }}>
                          {brand.name}
                        </span>
                        {hasChange && (
                          <Badge variant="secondary" className="text-xs">Modified</Badge>
                        )}
                      </div>
                      
                      {/* Tube count input */}
                      <div className="flex items-center gap-2">
                        {canEdit ? (
                          <>
                            <Input
                              type="number"
                              min={0}
                              value={count}
                              onChange={(e) => handleCountChange(brand.id, e.target.value)}
                              className="w-20 h-8 text-right bg-background text-sm"
                            />
                            <span className="text-xs text-muted-foreground">tubes</span>
                          </>
                        ) : (
                          <Badge 
                            variant={count === 0 ? 'destructive' : count < 20 ? 'secondary' : 'default'}
                            className="font-mono"
                          >
                            {count} tubes
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Last Order Info */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>
                          Last Order:{' '}
                          <span className={cn(
                            kpi?.last_order_date ? 'text-foreground' : 'text-amber-500 font-medium'
                          )}>
                            {kpi?.last_order_label || 'Never ordered'}
                          </span>
                        </span>
                      </div>

                      {/* Action flags */}
                      {hasFlags && (
                        <div className="flex items-center gap-1">
                          {kpi?.needs_order && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <ShoppingCart className="h-4 w-4 text-red-500" />
                                </TooltipTrigger>
                                <TooltipContent>Needs Order</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {kpi?.bring_samples && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <FlaskConical className="h-4 w-4 text-purple-500" />
                                </TooltipTrigger>
                                <TooltipContent>Bring Samples</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {kpi?.bring_starter_kit && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Gift className="h-4 w-4 text-amber-500" />
                                </TooltipTrigger>
                                <TooltipContent>Bring Starter Kit</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Interest indicator */}
                    {kpi?.owner_interested !== null && (
                      <div className="flex items-center gap-1 mt-1 text-xs">
                        {kpi.owner_interested ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <ThumbsUp className="h-3 w-3" /> Interested
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-500">
                            <ThumbsDown className="h-3 w-3" /> Not Interested
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Color legend */}
            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-muted-foreground border-t border-border/50">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span>Stocked + ordered</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                <span>Stocked, never ordered</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                <span>Out of stock</span>
              </div>
            </div>

            {/* Last updated */}
            {lastUpdated && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                <Clock className="h-3 w-3" />
                <span>
                  Updated {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
