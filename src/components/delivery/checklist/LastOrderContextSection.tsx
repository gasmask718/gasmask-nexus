import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CANONICAL_BRAND_IDS, getBrandIdentity } from '@/config/brands';
import { cn } from '@/lib/utils';
import { differenceInDays } from 'date-fns';

interface LastOrderContextSectionProps {
  storeId: string;
}

interface BrandOrderInfo {
  brandId: string;
  lastOrderDate: string | null;
  daysSince: number | null;
  frequencyClass: 'fast' | 'medium' | 'slow' | 'new' | 'never';
}

export function LastOrderContextSection({ storeId }: LastOrderContextSectionProps) {
  const [brandOrders, setBrandOrders] = useState<BrandOrderInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLastOrders() {
      // Fetch latest invoice per brand for this store
      const { data: invoices } = await supabase
        .from('invoices')
        .select('brand, created_at')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });

      const now = new Date();
      const ordersByBrand: Record<string, string> = {};

      // Get the most recent invoice per brand
      (invoices || []).forEach((inv) => {
        const rawBrand = (inv.brand || '').toLowerCase().trim();
        if (!ordersByBrand[rawBrand]) {
          ordersByBrand[rawBrand] = inv.created_at;
        }
      });

      const results: BrandOrderInfo[] = CANONICAL_BRAND_IDS.map((brandId) => {
        const brand = getBrandIdentity(brandId);
        // Check all aliases for matches
        let lastDate: string | null = null;
        for (const alias of brand.aliases) {
          if (ordersByBrand[alias]) {
            lastDate = ordersByBrand[alias];
            break;
          }
        }
        if (!lastDate && ordersByBrand[brandId]) {
          lastDate = ordersByBrand[brandId];
        }

        const daysSince = lastDate ? differenceInDays(now, new Date(lastDate)) : null;
        
        let frequencyClass: BrandOrderInfo['frequencyClass'] = 'never';
        if (daysSince === null) {
          frequencyClass = 'never';
        } else if (daysSince <= 14) {
          frequencyClass = 'fast';
        } else if (daysSince <= 30) {
          frequencyClass = 'medium';
        } else if (daysSince <= 60) {
          frequencyClass = 'slow';
        } else {
          frequencyClass = 'new';
        }

        return {
          brandId,
          lastOrderDate: lastDate,
          daysSince,
          frequencyClass,
        };
      });

      setBrandOrders(results);
      setLoading(false);
    }
    fetchLastOrders();
  }, [storeId]);

  const getFrequencyBadge = (freq: BrandOrderInfo['frequencyClass']) => {
    switch (freq) {
      case 'fast': return <Badge className="bg-green-500/20 text-green-600 text-xs">Fast</Badge>;
      case 'medium': return <Badge className="bg-yellow-500/20 text-yellow-600 text-xs">Medium</Badge>;
      case 'slow': return <Badge className="bg-orange-500/20 text-orange-600 text-xs">Slow</Badge>;
      case 'new': return <Badge className="bg-red-500/20 text-red-600 text-xs">Overdue</Badge>;
      case 'never': return <Badge variant="outline" className="text-xs">Never</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-8 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-semibold text-sm">Last Order Context</h4>
          <Badge variant="outline" className="text-xs">Read-only</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {brandOrders.map(({ brandId, lastOrderDate, daysSince, frequencyClass }) => {
            const brand = getBrandIdentity(brandId);
            return (
              <div key={brandId} className={cn('p-2 rounded-lg', brand.softBgClass)}>
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-xs">{brand.icon}</span>
                  <span className={cn('text-xs font-medium', brand.textClass)}>
                    {brand.shortName || brand.displayName}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {daysSince !== null ? `${daysSince}d ago` : 'No orders'}
                  </span>
                  {getFrequencyBadge(frequencyClass)}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
