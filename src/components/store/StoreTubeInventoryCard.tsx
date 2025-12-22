import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, Plus, RefreshCw, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface TubeInventory {
  id: string;
  brand: string;
  current_tubes_left: number;
  last_updated: string;
  created_by: string;
}

interface StoreTubeInventoryCardProps {
  storeId: string;
  onAddCount: () => void;
}

const brandColors: Record<string, string> = {
  grabba: 'bg-orange-500',
  gasmask: 'bg-purple-500',
  fronto: 'bg-green-500',
  default: 'bg-muted-foreground',
};

export function StoreTubeInventoryCard({ storeId, onAddCount }: StoreTubeInventoryCardProps) {
  const queryClient = useQueryClient();
  
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

  // Set up realtime subscription for live updates
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

  const totalTubes = inventory?.reduce((sum, item) => sum + (item.current_tubes_left || 0), 0) || 0;

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
          <Button onClick={onAddCount} size="sm" className="gap-1">
            <Plus className="h-4 w-4" />
            Add Count
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : inventory && inventory.length > 0 ? (
          <>
            {/* Total summary */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
              <span className="font-medium">Total Tubes</span>
              <span className="text-2xl font-bold text-primary">{totalTubes.toLocaleString()}</span>
            </div>

            {/* Brand breakdown */}
            <div className="space-y-2">
              {inventory.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-3 w-3 rounded-full ${
                        brandColors[item.brand.toLowerCase()] || brandColors.default
                      }`}
                    />
                    <span className="font-medium capitalize">{item.brand}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={item.current_tubes_left < 20 ? 'destructive' : item.current_tubes_left < 50 ? 'secondary' : 'default'}
                      className="font-mono text-sm"
                    >
                      {item.current_tubes_left} tubes
                    </Badge>
                  </div>
                </div>
              ))}
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
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No inventory records</p>
            <Button onClick={onAddCount} variant="outline" size="sm" className="mt-3">
              <Plus className="h-4 w-4 mr-1" />
              Add First Count
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
