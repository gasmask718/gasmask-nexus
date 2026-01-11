import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, TrendingUp, RefreshCw, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TubeCounterCardProps {
  storeId: string;
}

interface TubeData {
  brand: string;
  product_name: string;
  sale_date: string;
  payment_status: string;
  total_tubes: number;
  total_units: number;
  total_revenue: number;
  invoice_count: number;
}

const brandColors: Record<string, string> = {
  grabba: 'bg-orange-500',
  gasmask: 'bg-purple-500',
  fronto: 'bg-green-500',
  hotscolatti: 'bg-amber-500',
  hotmama: 'bg-pink-500',
  gasmasktubes: 'bg-purple-600',
};

type TimeRange = '7d' | '30d' | 'month' | 'all';

export function TubeCounterCard({ storeId }: TubeCounterCardProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [showPaidOnly, setShowPaidOnly] = useState(false);

  const getDateRange = () => {
    const now = new Date();
    switch (timeRange) {
      case '7d':
        return { start: subDays(now, 7), end: now };
      case '30d':
        return { start: subDays(now, 30), end: now };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'all':
        return { start: new Date('2020-01-01'), end: now };
    }
  };

  const { data: tubeData = [], isLoading, refetch } = useQuery({
    queryKey: ['tube-counter', storeId, timeRange, showPaidOnly],
    queryFn: async () => {
      const { start, end } = getDateRange();
      
      // Query the tube_counter view
      let query = supabase
        .from('tube_counter')
        .select('*')
        .eq('store_id', storeId)
        .gte('sale_date', format(start, 'yyyy-MM-dd'))
        .lte('sale_date', format(end, 'yyyy-MM-dd'));

      if (showPaidOnly) {
        query = query.eq('payment_status', 'paid');
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as TubeData[];
    },
    enabled: !!storeId,
  });

  // Aggregate by brand
  const brandTotals = tubeData.reduce((acc, row) => {
    const brand = row.brand || 'Unknown';
    if (!acc[brand]) {
      acc[brand] = { tubes: 0, revenue: 0, invoices: 0 };
    }
    acc[brand].tubes += Number(row.total_tubes) || 0;
    acc[brand].revenue += Number(row.total_revenue) || 0;
    acc[brand].invoices += Number(row.invoice_count) || 0;
    return acc;
  }, {} as Record<string, { tubes: number; revenue: number; invoices: number }>);

  const totalTubes = Object.values(brandTotals).reduce((sum, b) => sum + b.tubes, 0);
  const totalRevenue = Object.values(brandTotals).reduce((sum, b) => sum + b.revenue, 0);
  const totalInvoices = Object.values(brandTotals).reduce((sum, b) => sum + b.invoices, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Tube Counter
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
              <SelectTrigger className="h-7 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 days</SelectItem>
                <SelectItem value="30d">30 days</SelectItem>
                <SelectItem value="month">This month</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => refetch()}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : totalTubes === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No tube sales recorded</p>
            <p className="text-xs mt-1">Tube counts are derived from invoice line items</p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-xs text-muted-foreground">Total Tubes</p>
                <p className="text-lg font-bold text-primary">{totalTubes.toLocaleString()}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-secondary/50">
                <p className="text-xs text-muted-foreground">Revenue</p>
                <p className="text-lg font-bold">${totalRevenue.toLocaleString()}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-secondary/50">
                <p className="text-xs text-muted-foreground">Invoices</p>
                <p className="text-lg font-bold">{totalInvoices}</p>
              </div>
            </div>

            {/* Paid/All Toggle */}
            <div className="flex gap-2">
              <Button
                variant={showPaidOnly ? 'outline' : 'default'}
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={() => setShowPaidOnly(false)}
              >
                All Sales
              </Button>
              <Button
                variant={showPaidOnly ? 'default' : 'outline'}
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={() => setShowPaidOnly(true)}
              >
                Paid Only
              </Button>
            </div>

            {/* Brand Breakdown */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">By Brand</p>
              {Object.entries(brandTotals)
                .sort(([, a], [, b]) => b.tubes - a.tubes)
                .map(([brand, data]) => (
                  <div
                    key={brand}
                    className="flex items-center justify-between p-2 rounded-lg bg-secondary/30"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2.5 w-2.5 rounded-full ${
                          brandColors[brand.toLowerCase()] || 'bg-muted-foreground'
                        }`}
                      />
                      <span className="text-sm capitalize">{brand}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        ${data.revenue.toLocaleString()}
                      </span>
                      <Badge
                        variant={data.tubes > 100 ? 'default' : 'secondary'}
                        className="font-mono"
                      >
                        {data.tubes.toLocaleString()} tubes
                      </Badge>
                    </div>
                  </div>
                ))}
            </div>

            {/* Info */}
            <p className="text-xs text-muted-foreground text-center pt-2 border-t">
              <Calendar className="h-3 w-3 inline mr-1" />
              Derived from invoice line items
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
