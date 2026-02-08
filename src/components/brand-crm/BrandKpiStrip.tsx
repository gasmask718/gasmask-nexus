import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Store, AlertTriangle, Package, DollarSign, TrendingUp, Clock } from 'lucide-react';
import type { BrandCRMKPIs } from '@/hooks/useBrandCRMAnalytics';

interface BrandKpiStripProps {
  kpis: BrandCRMKPIs;
  isLoading: boolean;
  brandColor: string;
}

const kpiCards: Array<{ key: keyof BrandCRMKPIs; label: string; icon: any; format: string; highlight?: boolean }> = [
  { key: 'totalStores', label: 'Total Stores', icon: Store, format: 'number' },
  { key: 'activeStores', label: 'Active', icon: TrendingUp, format: 'number' },
  { key: 'overdueStores', label: 'Overdue Reorders', icon: AlertTriangle, format: 'number', highlight: true },
  { key: 'totalOrders', label: 'Total Orders', icon: Package, format: 'number' },
  { key: 'totalRevenue', label: 'Total Revenue', icon: DollarSign, format: 'currency' },
  { key: 'avgReorderGap', label: 'Avg Reorder Gap', icon: Clock, format: 'days' },
];

function formatValue(value: number, format: string): string {
  if (format === 'currency') return `$${value.toLocaleString()}`;
  if (format === 'days') return value > 0 ? `${value}d` : '—';
  return value.toLocaleString();
}

export function BrandKpiStrip({ kpis, isLoading, brandColor }: BrandKpiStripProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpiCards.map(({ key, label, icon: Icon, format, highlight }) => (
        <Card
          key={key}
          className={`border-t-2 ${highlight && kpis[key] > 0 ? 'border-destructive bg-destructive/5' : ''}`}
          style={!highlight || kpis[key] === 0 ? { borderTopColor: brandColor } : undefined}
        >
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground truncate">{label}</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <div className={`text-xl font-bold ${highlight && kpis[key] > 0 ? 'text-destructive' : ''}`}>
                {formatValue(kpis[key], format)}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
