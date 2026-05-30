import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, Calendar, Eye, Pencil, Trash2, MoreVertical, Clock, TrendingUp } from 'lucide-react';
import { format, differenceInDays, formatDistanceToNow, isPast } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MetricDetailDrawer } from '@/components/wholesaler/drilldown/MetricDetailDrawer';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { BrandTubesSold } from '@/hooks/useWholesalerProfileAPI';

interface WholesalerTubesSoldKPIProps {
  wholesalerId: string;
  tubesSoldByBrand: BrandTubesSold[];
  onEditBrand?: (brand: BrandTubesSold) => void;
  onDeleteBrand?: (brand: BrandTubesSold) => void;
}

// Brand colors for visual distinction
const BRAND_COLORS: Record<string, string> = {
  grabba: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
  'hot grabba': 'from-red-500/20 to-red-600/10 border-red-500/30',
  'dark grabba': 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
  'grabba leaf': 'from-green-500/20 to-green-600/10 border-green-500/30',
};

const BRAND_TEXT_COLORS: Record<string, string> = {
  grabba: 'text-amber-400',
  'hot grabba': 'text-red-400',
  'dark grabba': 'text-purple-400',
  'grabba leaf': 'text-green-400',
};

export function WholesalerTubesSoldKPI({ 
  wholesalerId,
  tubesSoldByBrand,
  onEditBrand,
  onDeleteBrand,
}: WholesalerTubesSoldKPIProps) {
  const [selectedBrand, setSelectedBrand] = useState<BrandTubesSold | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Fetch order history for selected brand
  const { data: brandOrders = [] } = useQuery({
    queryKey: ['wholesaler-brand-orders-kpi', wholesalerId, selectedBrand?.brandKey],
    queryFn: async () => {
      if (!selectedBrand) return [];
      
      const { data, error } = await supabase
        .from('wholesale_orders')
        .select('id, created_at, status, brand, tubes_total')
        .eq('wholesaler_id', wholesalerId)
        .ilike('brand', selectedBrand.brandKey)
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
        status: statusMap[order.status || ''] || 'neutral' as 'positive' | 'negative' | 'neutral',
      }));
    },
    enabled: !!selectedBrand && drawerOpen,
  });

  const getActivityStatus = (lastSoldAt: string | null) => {
    if (!lastSoldAt) {
      return { status: 'never', color: 'text-muted-foreground', bgColor: 'bg-muted/50', label: 'Never' };
    }
    
    const daysSince = differenceInDays(new Date(), new Date(lastSoldAt));
    
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

  const getETAStatus = (brand: BrandTubesSold) => {
    if (!brand.etaConfidence || brand.etaConfidence === 'no_history') {
      return { label: 'No history', color: 'text-muted-foreground', dot: '⚪' };
    }
    if (brand.etaConfidence === 'learning') {
      return { label: 'Learning', color: 'text-muted-foreground', dot: '⚪' };
    }
    if (brand.etaConfidence === 'weak') {
      return { label: 'Weak signal', color: 'text-amber-400', dot: '🟡' };
    }
    return { label: 'Predictable', color: 'text-green-400', dot: '🟢' };
  };

  const formatETA = (brand: BrandTubesSold) => {
    if (!brand.etaNextOrder) return null;
    
    const etaDate = new Date(brand.etaNextOrder);
    const isOverdue = isPast(etaDate);
    const daysUntil = differenceInDays(etaDate, new Date());
    
    if (isOverdue) {
      const daysOverdue = Math.abs(daysUntil);
      return { 
        text: `Overdue by ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}`,
        isOverdue: true,
        date: format(etaDate, 'MMM d, yyyy')
      };
    }
    
    if (daysUntil <= 7) {
      return { 
        text: `~${daysUntil} day${daysUntil !== 1 ? 's' : ''}`,
        isOverdue: false,
        date: format(etaDate, 'MMM d, yyyy')
      };
    }
    
    if (daysUntil <= 14) {
      return { 
        text: '~2 weeks',
        isOverdue: false,
        date: format(etaDate, 'MMM d, yyyy')
      };
    }
    
    return { 
      text: formatDistanceToNow(etaDate, { addSuffix: false }),
      isOverdue: false,
      date: format(etaDate, 'MMM d, yyyy')
    };
  };

  const renderETA = (brand: BrandTubesSold) => {
    const status = getETAStatus(brand);
    const eta = formatETA(brand);
    
    if (!eta) {
      return (
        <div className="flex items-center gap-1.5 text-xs">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">ETA: {status.label}</span>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs">
          <Clock className={`h-3 w-3 ${eta.isOverdue ? 'text-red-400' : 'text-primary'}`} />
          <span className={eta.isOverdue ? 'text-red-400 font-medium' : 'text-foreground'}>
            ETA: {eta.text}
          </span>
          <span className="text-muted-foreground">({eta.date})</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span>{status.dot}</span>
          <span className={status.color}>{status.label}</span>
          {brand.avgDaysBetweenOrders && (
            <span className="text-muted-foreground ml-1">
              (avg: {brand.avgDaysBetweenOrders}d)
            </span>
          )}
        </div>
      </div>
    );
  };

  const handleViewDetails = (brand: BrandTubesSold) => {
    setSelectedBrand(brand);
    setDrawerOpen(true);
  };

  // Sort by tubes sold (highest first)
  const sortedBrands = [...tubesSoldByBrand].sort((a, b) => {
    if (a.tubesSold === 0 && b.tubesSold === 0) return 0;
    if (a.tubesSold === 0) return 1;
    if (b.tubesSold === 0) return -1;
    return b.tubesSold - a.tubesSold;
  });

  const totalTubes = tubesSoldByBrand.reduce((sum, b) => sum + b.tubesSold, 0);
  const activeBrands = tubesSoldByBrand.filter(b => b.tubesSold > 0).length;

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
                {activeBrands}/{tubesSoldByBrand.length} Active
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Always show all 4 brand cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {sortedBrands.map((brand) => {
              const activity = getActivityStatus(brand.lastSoldAt);
              const brandColor = BRAND_COLORS[brand.brandKey] || 'from-gray-500/20 to-gray-600/10 border-gray-500/30';
              const textColor = BRAND_TEXT_COLORS[brand.brandKey] || 'text-gray-400';
              
              return (
                <div
                  key={brand.brandKey}
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
                    {brand.brandName}
                  </h3>
                  
                  {/* Tubes Sold - Primary KPI */}
                  <div className="mb-3">
                    <p className="text-3xl font-bold">
                      {brand.tubesSold.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">Tubes Sold</p>
                  </div>
                  
                  {/* Last Sold Date */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>Last: {formatLastSold(brand.lastSoldAt)}</span>
                  </div>
                  
                  {/* ETA to Next Order */}
                  <div className="mt-2 pt-2 border-t border-border/30">
                    {renderETA(brand)}
                  </div>
                  
                  {/* Order Count & View Details */}
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {brand.orderCount} order{brand.orderCount !== 1 ? 's' : ''}
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
        </CardContent>
      </Card>

      {/* Order History Drawer */}
      <MetricDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={selectedBrand?.brandName || 'Brand Orders'}
        subtitle="Order History"
        icon={Package}
        iconColor={BRAND_TEXT_COLORS[selectedBrand?.brandKey || ''] || 'text-primary'}
        mainValue={selectedBrand?.tubesSold.toLocaleString() || '0'}
        mainLabel="Total Tubes Sold"
        trend={selectedBrand && selectedBrand.tubesSold > 0 ? 'up' : 'stable'}
        trendLabel={selectedBrand?.orderCount ? `${selectedBrand.orderCount} orders` : 'No orders'}
        items={brandOrders}
        emptyMessage="No orders found for this brand"
      />
    </>
  );
}
