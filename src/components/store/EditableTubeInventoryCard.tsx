import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, Save, RefreshCw, Clock, Filter } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

// AUTHORITATIVE TUBE BRANDS - only these are valid
export const VALID_TUBE_BRANDS = [
  { id: 'gasmask', name: 'GasMask Bags', color: '#EF4444' }, // red-500
  { id: 'gasmasktubes', name: 'GasMask Tubes', color: '#3B82F6' }, // blue-500
  { id: 'hotmama', name: 'HotMama', color: '#EC4899' }, // pink-500
  { id: 'grabba', name: 'Grabba r us', color: '#A855F7' }, // purple-500
  { id: 'hotscolatti', name: 'Hot Scolatti', color: '#F97316' }, // orange-500
] as const;

interface TubeInventory {
  id: string;
  brand: string;
  current_tubes_left: number;
  last_updated: string;
  created_by: string;
}

interface EditableTubeInventoryCardProps {
  storeId: string;
}

export function EditableTubeInventoryCard({ storeId }: EditableTubeInventoryCardProps) {
  const queryClient = useQueryClient();
  const [filterBrand, setFilterBrand] = useState<string>('all');
  const [editedCounts, setEditedCounts] = useState<Record<string, number>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: inventory, isLoading, refetch } = useQuery({
    queryKey: ['store-tube-inventory', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_tube_inventory')
        .select('*')
        .eq('store_id', storeId)
        .order('brand');
      
      if (error) throw error;
      return data as TubeInventory[];
    },
    enabled: !!storeId,
  });

  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`store-tube-inventory-${storeId}`)
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, queryClient]);

  // Initialize edited counts when data loads
  useEffect(() => {
    if (inventory) {
      const counts: Record<string, number> = {};
      inventory.forEach(item => {
        counts[item.brand] = item.current_tubes_left;
      });
      // Also initialize for brands that don't have records yet
      VALID_TUBE_BRANDS.forEach(brand => {
        if (!(brand.id in counts)) {
          counts[brand.id] = 0;
        }
      });
      setEditedCounts(counts);
      setHasChanges(false);
    }
  }, [inventory]);

  const saveMutation = useMutation({
    mutationFn: async (updates: { brand: string; count: number }[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      for (const update of updates) {
        // Get existing record - use most recent if multiple records exist
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
            })
            .eq('id', existing.id);
        } else if (update.count > 0) {
          // Only create if count > 0
          await supabase
            .from('store_tube_inventory')
            .insert({
              store_id: storeId,
              brand: update.brand,
              current_tubes_left: update.count,
              created_by: user?.id || 'system',
            });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-tube-inventory', storeId] });
      toast.success('Tube inventory updated');
      setHasChanges(false);
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const handleCountChange = (brand: string, value: string) => {
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

  const getBrandInfo = (brandId: string) => {
    return VALID_TUBE_BRANDS.find(b => b.id === brandId) || { name: brandId, color: '#6366F1' };
  };

  const filteredBrands = filterBrand === 'all' 
    ? VALID_TUBE_BRANDS 
    : VALID_TUBE_BRANDS.filter(b => b.id === filterBrand);

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
          Tube Inventory
          <Badge variant="outline" className="ml-2">Manual</Badge>
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            className="h-8 w-8"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {hasChanges && (
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
        {/* Brand Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm text-muted-foreground">Filter:</Label>
          <Select value={filterBrand} onValueChange={setFilterBrand}>
            <SelectTrigger className="w-[160px] h-8 bg-secondary/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {VALID_TUBE_BRANDS.map(brand => (
                <SelectItem key={brand.id} value={brand.id}>
                  {brand.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Total summary */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
              <span className="font-medium">Total Tubes</span>
              <span className="text-2xl font-bold text-primary">{totalTubes.toLocaleString()}</span>
            </div>

            {/* Editable brand breakdown */}
            <div className="space-y-2">
              {filteredBrands.map((brand) => {
                const count = editedCounts[brand.id] ?? 0;
                const originalItem = inventory?.find(i => i.brand === brand.id);
                const hasChange = originalItem ? count !== originalItem.current_tubes_left : count > 0;

                return (
                  <div
                    key={brand.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: brand.color }}
                      />
                      <span className="font-medium" style={{ color: brand.color }}>
                        {brand.name}
                      </span>
                      {hasChange && (
                        <Badge variant="secondary" className="text-xs">
                          Modified
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        value={count}
                        onChange={(e) => handleCountChange(brand.id, e.target.value)}
                        className="w-24 h-9 text-right bg-background"
                      />
                      <span className="text-sm text-muted-foreground">tubes</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Last updated */}
            {lastUpdated && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                <Clock className="h-3 w-3" />
                <span>
                  Last updated {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}