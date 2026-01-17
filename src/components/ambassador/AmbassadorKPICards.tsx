import { Card, CardContent } from "@/components/ui/card";
import { 
  DollarSign, TrendingUp, Store, Users, Package, 
  ShoppingCart, Clock, CheckCircle2, Target
} from "lucide-react";
import type { AmbassadorMetrics } from "@/hooks/useAmbassadorIntelligence";

interface AmbassadorKPICardsProps {
  metrics: AmbassadorMetrics;
  onMetricClick?: (metric: string) => void;
}

export function AmbassadorKPICards({ metrics, onMetricClick }: AmbassadorKPICardsProps) {
  const kpiData = [
    {
      key: 'totalEarnings',
      label: 'Total Earnings',
      value: `$${metrics.totalEarnings.toLocaleString()}`,
      icon: DollarSign,
      color: 'green',
      subtext: `$${metrics.pendingEarnings.toLocaleString()} pending`,
    },
    {
      key: 'storesAcquired',
      label: 'Stores Acquired',
      value: metrics.storesAcquired,
      icon: Store,
      color: 'cyan',
      subtext: `${metrics.storesActive} active, ${metrics.storesDormant} dormant`,
    },
    {
      key: 'wholesalersAcquired',
      label: 'Wholesalers',
      value: metrics.wholesalersAcquired,
      icon: Package,
      color: 'rose',
      subtext: 'Linked accounts',
    },
    {
      key: 'totalRevenue',
      label: 'Revenue Generated',
      value: `$${metrics.totalRevenue.toLocaleString()}`,
      icon: TrendingUp,
      color: 'amber',
      subtext: `${metrics.totalOrders} total orders`,
    },
    {
      key: 'onlineSales',
      label: 'Online Sales',
      value: metrics.onlineSalesCount,
      icon: ShoppingCart,
      color: 'purple',
      subtext: `$${metrics.onlineSalesRevenue.toLocaleString()} revenue`,
    },
    {
      key: 'avgOrderValue',
      label: 'Avg Order Value',
      value: `$${metrics.avgOrderValue.toFixed(2)}`,
      icon: Target,
      color: 'blue',
      subtext: `${metrics.conversionRate.toFixed(1)}% conversion`,
    },
  ];

  const getColorClasses = (color: string) => ({
    card: `bg-gradient-to-br from-${color}-500/10 to-${color}-900/5 border-${color}-500/20`,
    icon: `text-${color}-400`,
    value: `text-${color}-400`,
  });

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {kpiData.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <Card
            key={kpi.key}
            className={`cursor-pointer hover:scale-[1.02] transition-transform bg-gradient-to-br from-${kpi.color}-500/10 to-${kpi.color}-900/5 border-${kpi.color}-500/20`}
            onClick={() => onMetricClick?.(kpi.key)}
          >
            <CardContent className="p-4">
              <div className={`flex items-center gap-2 text-${kpi.color}-400`}>
                <Icon className="h-5 w-5" />
                <span className="text-sm">{kpi.label}</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-2">
                {kpi.value}
              </div>
              <div className="text-xs text-muted-foreground">{kpi.subtext}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// Compact version for profile headers
export function AmbassadorQuickStats({ metrics }: { metrics: AmbassadorMetrics }) {
  return (
    <div className="flex flex-wrap gap-4 text-sm">
      <div className="flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-green-400" />
        <span className="text-muted-foreground">Earned:</span>
        <span className="font-semibold text-green-400">${metrics.totalEarnings.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-2">
        <Store className="h-4 w-4 text-cyan-400" />
        <span className="text-muted-foreground">Stores:</span>
        <span className="font-semibold">{metrics.storesAcquired}</span>
      </div>
      <div className="flex items-center gap-2">
        <ShoppingCart className="h-4 w-4 text-purple-400" />
        <span className="text-muted-foreground">Online Sales:</span>
        <span className="font-semibold">{metrics.onlineSalesCount}</span>
      </div>
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-amber-400" />
        <span className="text-muted-foreground">Revenue:</span>
        <span className="font-semibold text-amber-400">${metrics.totalRevenue.toLocaleString()}</span>
      </div>
    </div>
  );
}
