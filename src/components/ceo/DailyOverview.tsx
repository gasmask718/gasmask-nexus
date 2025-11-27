import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp,
  Package,
  Truck,
  Store,
  MessageSquare,
  Zap,
  DollarSign,
  Activity,
  Flower2,
  Filter,
  Box
} from 'lucide-react';

interface DailyOverviewProps {
  metrics: any;
  loading: boolean;
}

export function DailyOverview({ metrics, loading }: DailyOverviewProps) {
  const metricCards = [
    {
      title: 'Total Revenue Today',
      value: metrics?.metrics?.totalRevenue,
      format: 'currency',
      icon: DollarSign,
      color: 'text-green-500',
    },
    {
      title: 'Orders Today',
      value: metrics?.metrics?.ordersToday,
      format: 'number',
      icon: Package,
      color: 'text-blue-500',
    },
    {
      title: 'Tubes Sold',
      value: metrics?.metrics?.tubesSold,
      format: 'number',
      icon: Box,
      color: 'text-purple-500',
    },
    {
      title: 'Tubes In Stock',
      value: metrics?.metrics?.totalTubesInStock,
      format: 'number',
      icon: Box,
      color: 'text-cyan-500',
    },
    {
      title: 'Deliveries Completed',
      value: metrics?.metrics?.deliveriesCompleted,
      format: 'number',
      icon: Truck,
      color: 'text-indigo-500',
    },
    {
      title: 'Active Stores',
      value: metrics?.metrics?.activeStores,
      format: 'number',
      icon: Store,
      color: 'text-orange-500',
      subtitle: `${metrics?.metrics?.totalStores || 0} total`,
    },
    {
      title: 'RPA Stores',
      value: metrics?.metrics?.rpaStores,
      format: 'number',
      icon: Filter,
      color: 'text-blue-500',
    },
    {
      title: 'Flower Stores',
      value: metrics?.metrics?.flowerStores,
      format: 'number',
      icon: Flower2,
      color: 'text-pink-500',
    },
    {
      title: 'Prime Time Energy',
      value: metrics?.metrics?.primeTimeStores,
      format: 'number',
      icon: Zap,
      color: 'text-yellow-500',
    },
    {
      title: 'Communication Volume',
      value: metrics?.metrics?.communicationVolume?.total,
      format: 'number',
      icon: MessageSquare,
      color: 'text-cyan-500',
      subtitle: `${metrics?.metrics?.communicationVolume?.sms || 0} SMS, ${metrics?.metrics?.communicationVolume?.email || 0} Email`,
    },
    {
      title: 'Automations Triggered',
      value: metrics?.metrics?.automationsTriggered,
      format: 'number',
      icon: Activity,
      color: 'text-yellow-500',
    },
    {
      title: 'New Stores',
      value: metrics?.metrics?.newStores,
      format: 'number',
      icon: TrendingUp,
      color: 'text-green-500',
    },
  ];

  const formatValue = (value: number, format: string) => {
    if (value === undefined || value === null) return '—';
    if (format === 'currency') return `$${value.toLocaleString()}`;
    return value.toLocaleString();
  };

  // Payment stats
  const paymentStats = metrics?.paymentStats;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((card, index) => (
          <Card key={index} className="p-6">
            {loading ? (
              <>
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32 mb-1" />
                <Skeleton className="h-3 w-20" />
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <p className="text-3xl font-bold">{formatValue(card.value, card.format)}</p>
                {card.subtitle && (
                  <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
                )}
              </>
            )}
          </Card>
        ))}
      </div>

      {/* Payment Summary */}
      {paymentStats && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            Payment Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Owed</p>
              <p className="text-2xl font-bold text-red-500">${paymentStats.totalOwed?.toLocaleString() || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Paid</p>
              <p className="text-2xl font-bold text-green-500">${paymentStats.totalPaid?.toLocaleString() || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Unpaid Orders</p>
              <p className="text-2xl font-bold text-orange-500">{paymentStats.unpaidCount || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Paid Orders</p>
              <p className="text-2xl font-bold text-green-500">{paymentStats.paidCount || 0}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Orders by Brand */}
      {metrics?.ordersByBrand && Object.keys(metrics.ordersByBrand).length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-500" />
            Orders by Brand
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(metrics.ordersByBrand).map(([brand, data]: [string, any]) => (
              <div key={brand} className="p-4 border rounded-lg">
                <p className="text-sm font-medium capitalize">{brand.replace(/_/g, ' ')}</p>
                <p className="text-xl font-bold">{data.count} orders</p>
                <p className="text-sm text-muted-foreground">${data.revenue?.toLocaleString() || 0}</p>
                <p className="text-xs text-muted-foreground">{data.tubes} tubes</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Inventory by Brand */}
      {metrics?.inventoryByBrand && Object.keys(metrics.inventoryByBrand).length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Box className="h-5 w-5 text-purple-500" />
            Inventory by Brand
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(metrics.inventoryByBrand).map(([brand, tubes]: [string, any]) => (
              <div key={brand} className="p-4 border rounded-lg">
                <p className="text-sm font-medium capitalize">{brand.replace(/_/g, ' ')}</p>
                <p className="text-xl font-bold">{tubes?.toLocaleString() || 0}</p>
                <p className="text-xs text-muted-foreground">tubes in stock</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
