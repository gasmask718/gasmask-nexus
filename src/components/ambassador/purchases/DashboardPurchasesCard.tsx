/**
 * Dashboard Purchases Card for Ambassador Portal
 * Shows lifetime spend, purchase count, recent purchases, CTA
 */
import { useNavigate } from 'react-router-dom';
import { DollarSign, ShoppingBag, ArrowRight, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyPurchases, useAmbassadorPurchaseSummary } from '@/hooks/useAmbassadorPurchases';
import { useAuth } from '@/contexts/AuthContext';
import { format, formatDistanceToNow } from 'date-fns';

export function DashboardPurchasesCard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: purchases = [], isLoading } = useMyPurchases();
  const { data: summary, isLoading: summaryLoading } = useAmbassadorPurchaseSummary(user?.id);

  const summaryData = summary as any;
  const recentPurchases = purchases.slice(0, 5);

  if (isLoading || summaryLoading) {
    return <Skeleton className="h-[380px]" />;
  }

  const lifetimeSpend = Number(summaryData?.lifetime_spend || 0);
  const purchaseCount = Number(summaryData?.purchase_count || 0);
  const lastPurchaseAt = summaryData?.last_purchase_at;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              My Purchases
            </CardTitle>
            <CardDescription>Your orders from our company</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/ambassador/purchases')}>
            View All
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Mini KPIs */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground">Lifetime Spend</p>
            <p className="text-lg font-bold text-primary">${lifetimeSpend.toFixed(2)}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground">Orders</p>
            <p className="text-lg font-bold">{purchaseCount}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground">Last Order</p>
            <p className="text-sm font-medium">
              {lastPurchaseAt
                ? formatDistanceToNow(new Date(lastPurchaseAt), { addSuffix: true })
                : 'Never'}
            </p>
          </div>
        </div>

        {/* Recent Purchases */}
        <ScrollArea className="h-[200px] pr-4">
          {recentPurchases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No purchases yet</p>
              <p className="text-sm mt-1">Your order history will appear here</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
                onClick={() => navigate('/ambassador/purchases')}
              >
                Contact admin to place order
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentPurchases.map((purchase) => (
                <div
                  key={purchase.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate('/ambassador/purchases')}
                >
                  <div>
                    <p className="font-mono text-sm">{purchase.order_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(purchase.created_at), 'MMM d, yyyy')} · {purchase.items.length} items
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">${Number(purchase.total).toFixed(2)}</p>
                    <Badge variant={purchase.status === 'paid' ? 'default' : 'secondary'} className="text-xs">
                      {purchase.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
