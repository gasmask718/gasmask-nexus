import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, Calendar, Eye, Pencil, Trash2, MoreVertical } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MetricDetailDrawer } from '@/components/wholesaler/drilldown/MetricDetailDrawer';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface BrandTubeSales {
  brand: string;
  brand_display: string;
  tubes_sold: number;
  last_sold_date: string | null;
  order_count: number;
}

interface WholesalerTubesSoldByBrandProps {
  wholesalerId: string;
  tubesByBrand: BrandTubeSales[];
  onBrandClick?: (brand: BrandTubeSales) => void;
  onEditBrand?: (brand: BrandTubeSales) => void;
  onDeleteBrand?: (brand: BrandTubeSales) => void;
}

// Brand colors for visual distinction
const BRAND_COLORS: Record<string, string> = {
  grabba: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
  'hot grabba': 'from-red-500/20 to-red-600/10 border-red-500/30',
  'dark grabba': 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
  'grabba leaf': 'from-green-500/20 to-green-600/10 border-green-500/30',
  gasmask: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
  hotscolati: 'from-orange-500/20 to-orange-600/10 border-orange-500/30',
  hotmama: 'from-pink-500/20 to-pink-600/10 border-pink-500/30',
  grabba_r_us: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
};

const BRAND_TEXT_COLORS: Record<string, string> = {
  grabba: 'text-amber-400',
  'hot grabba': 'text-red-400',
  'dark grabba': 'text-purple-400',
  'grabba leaf': 'text-green-400',
  gasmask: 'text-cyan-400',
  hotscolati: 'text-orange-400',
  hotmama: 'text-pink-400',
  grabba_r_us: 'text-blue-400',
};

export function WholesalerTubesSoldByBrand({ 
  wholesalerId,
  tubesByBrand, 
  onBrandClick,
  onEditBrand,
  onDeleteBrand 
}: WholesalerTubesSoldByBrandProps) {
  const [selectedBrand, setSelectedBrand] = useState<BrandTubeSales | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Fetch order history for selected brand
  const { data: brandOrders = [] } = useQuery({
    queryKey: ['wholesaler-brand-orders', wholesalerId, selectedBrand?.brand],
    queryFn: async () => {
      if (!selectedBrand) return [];
      
      const { data, error } = await supabase
        .from('wholesale_orders')
        .select(`
          id,
          created_at,
          status,
          brand,
          tubes_total
        `)
        .eq('wholesaler_id', wholesalerId)
        .ilike('brand', selectedBrand.brand)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const statusMap: Record<string, 'positive' | 'negative' | 'neutral'> = {
        delivered: 'positive',
        completed: 'positive',
        pending: 'neutral',
        processing: 'neutral',
        cancelled: 'negative',
        rejected: 'negative',
      };
      
      return (data || []).map(order => ({
        id: order.id,
        label: `Order #${order.id.slice(0, 8)}`,
        value: `${order.tubes_total || 0} tubes`,
        sublabel: order.status || 'Unknown',
        date: order.created_at,
        status: statusMap[order.status || ''] || ('neutral' as 'positive' | 'negative' | 'neutral')
      }));
    },
    enabled: !!selectedBrand && drawerOpen,
  });

  const getActivityStatus = (lastSoldDate: string | null) => {
    if (!lastSoldDate) return { status: 'never', color: 'text-muted-foreground', bgColor: 'bg-muted/50', label: 'Never' };
    
    const daysSince = differenceInDays(new Date(), new Date(lastSoldDate));
    
    if (daysSince <= 14) {
      return { status: 'recent', color: 'text-green-400', bgColor: 'bg-green-500/20', label: 'Active' };
    } else if (daysSince <= 45) {
      return { status: 'stale', color: 'text-amber-400', bgColor: 'bg-amber-500/20', label: 'Stale' };
    } else {
      return { status: 'dormant', color: 'text-red-400', bgColor: 'bg-red-500/20', label: 'Dormant' };
    }
  };

  const formatLastSold = (date: string | null) => {
    if (!date) return 'Never';
    return format(new Date(date), 'MMM d, yyyy');
  };

  const handleViewDetails = (brand: BrandTubeSales) => {
    setSelectedBrand(brand);
    setDrawerOpen(true);
  };

  // Sort by tubes sold (highest first), but ensure brands with sales appear first
  const sortedBrands = [...tubesByBrand].sort((a, b) => {
    if (a.tubes_sold === 0 && b.tubes_sold === 0) return 0;
    if (a.tubes_sold === 0) return 1;
    if (b.tubes_sold === 0) return -1;
    return b.tubes_sold - a.tubes_sold;
  });

  const totalTubes = tubesByBrand.reduce((sum, b) => sum + b.tubes_sold, 0);
  const activeBrands = tubesByBrand.filter(b => b.tubes_sold > 0).length;

  return (
    <>
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Tubes Sold by Brand
            </CardTitle>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">
                Total: <span className="font-semibold text-foreground">{totalTubes.toLocaleString()}</span> tubes
              </span>
              <Badge variant="outline" className="text-xs">
                {activeBrands}/{tubesByBrand.length} Active
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {tubesByBrand.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No sales data available</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {sortedBrands.map((brand) => {
                const activity = getActivityStatus(brand.last_sold_date);
                const brandColor = BRAND_COLORS[brand.brand] || 'from-gray-500/20 to-gray-600/10 border-gray-500/30';
                const textColor = BRAND_TEXT_COLORS[brand.brand] || 'text-gray-400';
                
                return (
                  <div
                    key={brand.brand}
                    className={`relative p-4 rounded-lg border bg-gradient-to-br ${brandColor} group`}
                  >
                    {/* Action Menu */}
                    <div className="absolute top-2 right-2 flex items-center gap-1">
                      <Badge className={`${activity.bgColor} ${activity.color} text-xs`}>
                        {activity.label}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDetails(brand)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {onEditBrand && (
                            <DropdownMenuItem onClick={() => onEditBrand(brand)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {onDeleteBrand && (
                            <DropdownMenuItem 
                              onClick={() => onDeleteBrand(brand)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    {/* Brand Name */}
                    <h3 className={`font-semibold ${textColor} mb-3 pr-20`}>
                      {brand.brand_display}
                    </h3>
                    
                    {/* Tubes Sold - Primary KPI */}
                    <div className="mb-3">
                      <p className="text-3xl font-bold">
                        {brand.tubes_sold.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">Tubes Sold</p>
                    </div>
                    
                    {/* Last Sold Date */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>Last: {formatLastSold(brand.last_sold_date)}</span>
                    </div>
                    
                    {/* Order Count & View Details */}
                    <div className="mt-2 pt-2 border-t border-border/30 flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {brand.order_count} order{brand.order_count !== 1 ? 's' : ''}
                      </p>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-xs px-2"
                        onClick={() => handleViewDetails(brand)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order History Drawer */}
      <MetricDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={selectedBrand?.brand_display || 'Brand Orders'}
        subtitle="Order History"
        icon={Package}
        iconColor={BRAND_TEXT_COLORS[selectedBrand?.brand || ''] || 'text-primary'}
        mainValue={selectedBrand?.tubes_sold.toLocaleString() || '0'}
        mainLabel="Total Tubes Sold"
        trend={selectedBrand && selectedBrand.tubes_sold > 0 ? 'up' : 'stable'}
        trendLabel={selectedBrand?.order_count ? `${selectedBrand.order_count} orders` : 'No orders'}
        items={brandOrders}
        emptyMessage="No orders found for this brand"
      />
    </>
  );
}
