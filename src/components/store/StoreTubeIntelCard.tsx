import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StoreTubeIntelCardProps {
  storeId: string;
}

const brandColors: Record<string, string> = {
  grabba: 'bg-orange-500',
  gasmask: 'bg-purple-500',
  fronto: 'bg-green-500',
};

export function StoreTubeIntelCard({ storeId }: StoreTubeIntelCardProps) {
  const { data: inventory, isLoading, refetch } = useQuery({
    queryKey: ['store-tube-intel', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_tube_inventory')
        .select('*')
        .eq('store_id', storeId)
        .order('brand');
      
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  const totalTubes = inventory?.reduce((sum, item) => sum + (item.current_tubes_left || 0), 0) || 0;

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <Package className="h-4 w-4" />
          Tube Intel
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => refetch()}>
          <RefreshCw className="h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : inventory && inventory.length > 0 ? (
          <>
            {/* Total summary */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-primary/10 border border-primary/20">
              <span className="text-sm font-medium">Total Tubes</span>
              <span className="text-lg font-bold text-primary">{totalTubes.toLocaleString()}</span>
            </div>

            {/* Brand breakdown with exact counts */}
            <div className="space-y-2">
              {inventory.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-secondary/30"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${
                        brandColors[item.brand?.toLowerCase()] || 'bg-muted-foreground'
                      }`}
                    />
                    <span className="text-sm capitalize">{item.brand}</span>
                  </div>
                  <Badge
                    variant={
                      (item.current_tubes_left || 0) < 20 
                        ? 'destructive' 
                        : (item.current_tubes_left || 0) < 50 
                          ? 'secondary' 
                          : 'default'
                    }
                    className="font-mono"
                  >
                    {item.current_tubes_left || 0}
                  </Badge>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No tube inventory data
          </p>
        )}
      </CardContent>
    </Card>
  );
}
