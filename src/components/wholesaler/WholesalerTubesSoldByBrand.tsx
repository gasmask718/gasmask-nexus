import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

interface BrandTubeSales {
  brand: string;
  brand_display: string;
  tubes_sold: number;
  last_sold_date: string | null;
  order_count: number;
}

interface WholesalerTubesSoldByBrandProps {
  tubesByBrand: BrandTubeSales[];
  onBrandClick?: (brand: BrandTubeSales) => void;
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

export function WholesalerTubesSoldByBrand({ tubesByBrand, onBrandClick }: WholesalerTubesSoldByBrandProps) {
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
                  onClick={() => onBrandClick?.(brand)}
                  className={`relative p-4 rounded-lg border bg-gradient-to-br ${brandColor} cursor-pointer hover:scale-[1.02] transition-all group`}
                >
                  {/* Activity Indicator */}
                  <div className="absolute top-2 right-2">
                    <Badge className={`${activity.bgColor} ${activity.color} text-xs`}>
                      {activity.label}
                    </Badge>
                  </div>
                  
                  {/* Brand Name */}
                  <h3 className={`font-semibold ${textColor} mb-3 pr-16`}>
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
                  
                  {/* Order Count */}
                  {brand.order_count > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/30">
                      <p className="text-xs text-muted-foreground">
                        {brand.order_count} order{brand.order_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
