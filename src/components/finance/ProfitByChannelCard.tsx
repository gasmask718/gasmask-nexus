import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useProfitByChannel } from '@/hooks/useProfitByChannel';
import { DollarSign, TrendingUp, Store, Users, User } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';

interface ChannelRowProps {
  label: string;
  icon: React.ReactNode;
  revenue: number;
  profit: number;
  margin: number;
  orders: number;
  color: string;
  totalRevenue: number;
}

function ChannelRow({ label, icon, revenue, profit, margin, orders, color, totalRevenue }: ChannelRowProps) {
  const revenuePercent = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded ${color}`}>
            {icon}
          </div>
          <div>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{orders} orders</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold font-mono">${profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className={`text-xs font-medium ${margin >= 20 ? 'text-green-600' : margin >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
            {margin.toFixed(1)}% margin
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Progress value={revenuePercent} className="h-1.5 flex-1" />
        <span className="text-xs text-muted-foreground w-20 text-right">
          ${revenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </span>
      </div>
    </div>
  );
}

/**
 * Profit by Channel Card - INTERNAL/FINANCE USE ONLY
 * 
 * This component displays profit analytics by sales channel.
 * It must NEVER be exposed to customer-facing views, invoices, or portals.
 */
export function ProfitByChannelCard() {
  const { data, isLoading, error } = useProfitByChannel();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profit by Channel</CardTitle>
          <CardDescription>Revenue and profit breakdown</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profit by Channel</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Unable to load profit data</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Profit by Channel
            </CardTitle>
            <CardDescription>Internal analytics - not for customer view</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold font-mono text-green-600">
              ${data.total.profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground">
              Total Profit ({data.total.margin.toFixed(1)}% avg margin)
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ChannelRow
          label="Retail"
          icon={<Store className="h-4 w-4 text-blue-600" />}
          revenue={data.retail.revenue}
          profit={data.retail.profit}
          margin={data.retail.margin}
          orders={data.retail.orders}
          color="bg-blue-100 dark:bg-blue-900/30"
          totalRevenue={data.total.revenue}
        />
        
        <ChannelRow
          label="Wholesale"
          icon={<Users className="h-4 w-4 text-purple-600" />}
          revenue={data.wholesale.revenue}
          profit={data.wholesale.profit}
          margin={data.wholesale.margin}
          orders={data.wholesale.orders}
          color="bg-purple-100 dark:bg-purple-900/30"
          totalRevenue={data.total.revenue}
        />
        
        <ChannelRow
          label="Street / Personal"
          icon={<User className="h-4 w-4 text-green-600" />}
          revenue={data.street.revenue}
          profit={data.street.profit}
          margin={data.street.margin}
          orders={data.street.orders}
          color="bg-green-100 dark:bg-green-900/30"
          totalRevenue={data.total.revenue}
        />

        {/* Street Premium Indicator */}
        {data.street.margin > data.retail.margin && data.street.profit > 0 && (
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2 text-xs text-green-600">
              <DollarSign className="h-3 w-3" />
              <span>
                Street sales earning +{(data.street.margin - data.retail.margin).toFixed(1)}% more margin than retail
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
