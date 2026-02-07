/**
 * Purchase Summary KPI Cards
 * Displays lifetime spend, purchase count, last purchase, avg order value
 */
import { DollarSign, ShoppingBag, Calendar, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import type { PurchaseSummary } from '@/hooks/useAmbassadorPurchases';

interface PurchaseSummaryKPIsProps {
  summary: PurchaseSummary | null | undefined;
  isLoading?: boolean;
}

export function PurchaseSummaryKPIs({ summary, isLoading }: PurchaseSummaryKPIsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  const lifetimeSpend = Number(summary?.lifetime_spend || 0);
  const purchaseCount = Number(summary?.purchase_count || 0);
  const avgOrderValue = Number(summary?.avg_order_value || 0);
  const lastPurchaseAt = summary?.last_purchase_at;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/20">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-green-500/10">
              <DollarSign className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Lifetime Spend</p>
              <p className="text-2xl font-bold text-green-500">${lifetimeSpend.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border-blue-500/20">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-500/10">
              <ShoppingBag className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Orders</p>
              <p className="text-2xl font-bold text-blue-500">{purchaseCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-purple-500/10 to-fuchsia-500/5 border-purple-500/20">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-purple-500/10">
              <TrendingUp className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Order Value</p>
              <p className="text-2xl font-bold text-purple-500">${avgOrderValue.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-500/20">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-amber-500/10">
              <Calendar className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Purchase</p>
              <p className="text-lg font-bold text-amber-500">
                {lastPurchaseAt
                  ? formatDistanceToNow(new Date(lastPurchaseAt), { addSuffix: true })
                  : 'Never'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
