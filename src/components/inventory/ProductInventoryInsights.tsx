import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle,
  Warehouse,
  Lightbulb,
  Clock,
  TrendingDown,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ProductInventoryInsightsProps {
  productId: string;
}

const getRiskBadgeVariant = (risk: string | null) => {
  switch (risk) {
    case 'critical': return 'destructive';
    case 'high': return 'destructive';
    case 'medium': return 'secondary';
    case 'low': return 'outline';
    default: return 'outline';
  }
};

export function ProductInventoryInsights({ productId }: ProductInventoryInsightsProps) {
  // Fetch forecasts for this product
  const { data: forecasts = [], isLoading: forecastsLoading } = useQuery({
    queryKey: ['product-forecasts', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_forecasts')
        .select(`
          *,
          warehouses (id, name)
        `)
        .eq('product_id', productId);
      
      if (error) throw error;
      return (data || []).map((f: any) => ({
        ...f,
        warehouse_name: f.warehouses?.name || 'Unknown',
      }));
    },
    enabled: !!productId,
  });

  // Fetch risk flags for this product
  const { data: riskFlags = [] } = useQuery({
    queryKey: ['product-risk-flags', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_risk_flags')
        .select(`
          *,
          warehouses (id, name)
        `)
        .eq('product_id', productId);
      
      if (error) throw error;
      return (data || []).map((f: any) => ({
        ...f,
        warehouse_name: f.warehouses?.name || 'Unknown',
      }));
    },
    enabled: !!productId,
  });

  // Fetch stock levels
  const { data: stockLevels = [] } = useQuery({
    queryKey: ['product-stock-levels', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_stock')
        .select(`
          *,
          warehouses (id, name)
        `)
        .eq('product_id', productId);
      
      if (error) throw error;
      return (data || []).map((s: any) => ({
        ...s,
        warehouse_name: s.warehouses?.name || 'Unknown',
      }));
    },
    enabled: !!productId,
  });

  const deadStockFlags = riskFlags.filter((f: any) => f.flag_type === 'DEAD_STOCK');
  const overstockFlags = riskFlags.filter((f: any) => f.flag_type === 'OVERSTOCK');

  return (
    <div className="space-y-6">
      {/* Risk Flag Badges */}
      {(deadStockFlags.length > 0 || overstockFlags.length > 0) && (
        <div className="flex gap-3 flex-wrap">
          {deadStockFlags.length > 0 && (
            <Badge variant="secondary" className="gap-1 text-orange-500 border-orange-500/30">
              <Clock className="h-3 w-3" />
              Dead stock at {deadStockFlags.length} warehouse{deadStockFlags.length > 1 ? 's' : ''}
            </Badge>
          )}
          {overstockFlags.length > 0 && (
            <Badge variant="secondary" className="gap-1 text-yellow-600 border-yellow-500/30">
              <TrendingDown className="h-3 w-3" />
              Overstock risk at {overstockFlags.length} warehouse{overstockFlags.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      )}

      {/* Stock Levels by Warehouse */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5" />
            Warehouse Stock Levels
          </CardTitle>
          <CardDescription>
            Stock levels and insights across all warehouses
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stockLevels.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Warehouse className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No stock records for this product</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">On Hand</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Reorder Point</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockLevels.map((stock: any) => {
                  const available = (stock.quantity_on_hand || 0) - (stock.quantity_reserved || 0);
                  const isLow = stock.reorder_point && available <= stock.reorder_point;
                  const isOut = available <= 0;
                  
                  return (
                    <TableRow key={stock.id}>
                      <TableCell className="font-medium">{stock.warehouse_name}</TableCell>
                      <TableCell className="text-right font-mono">{stock.quantity_on_hand || 0}</TableCell>
                      <TableCell className="text-right font-mono">{stock.quantity_reserved || 0}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={isOut ? 'destructive' : isLow ? 'secondary' : 'outline'}>
                          {available}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{stock.reorder_point || '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Forecast Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Forecast & Risk Analysis
          </CardTitle>
          <CardDescription>
            AI-generated insights per warehouse
          </CardDescription>
        </CardHeader>
        <CardContent>
          {forecastsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading insights...</div>
          ) : forecasts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No forecast data available</p>
              <p className="text-sm mt-1">Run "Refresh Insights" on the Insights page to generate forecasts.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead className="text-right">Avg Daily Usage</TableHead>
                  <TableHead className="text-right">Days Until Runout</TableHead>
                  <TableHead>Suggestion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forecasts.map((forecast: any) => (
                  <TableRow key={forecast.id}>
                    <TableCell className="font-medium">{forecast.warehouse_name}</TableCell>
                    <TableCell>
                      <Badge variant={getRiskBadgeVariant(forecast.risk_level)}>
                        {forecast.risk_level || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {forecast.avg_daily_usage ? Number(forecast.avg_daily_usage).toFixed(1) : '0'}
                    </TableCell>
                    <TableCell className="text-right">
                      {forecast.days_until_runout !== null ? (
                        <span className={forecast.days_until_runout <= 7 ? 'text-destructive font-medium' : ''}>
                          {forecast.days_until_runout}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <span className="text-sm text-muted-foreground line-clamp-2">
                        {forecast.suggestion}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ProductInventoryInsights;