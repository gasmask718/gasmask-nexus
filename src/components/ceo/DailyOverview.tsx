import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp,
  Package,
  Truck,
  Store,
  MessageSquare,
  Zap,
  UserPlus,
  DollarSign,
  Activity
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
      title: 'Deliveries Completed',
      value: metrics?.metrics?.deliveriesCompleted,
      format: 'number',
      icon: Truck,
      color: 'text-purple-500',
    },
    {
      title: 'New Stores',
      value: metrics?.metrics?.newStores,
      format: 'number',
      icon: Store,
      color: 'text-orange-500',
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
      icon: Zap,
      color: 'text-yellow-500',
    },
    {
      title: 'New Signups',
      value: metrics?.metrics?.newSignups,
      format: 'number',
      icon: UserPlus,
      color: 'text-pink-500',
    },
    {
      title: 'Driver/Biker Activity',
      value: metrics?.metrics?.driverActivity,
      format: 'number',
      icon: Activity,
      color: 'text-indigo-500',
    },
  ];

  const formatValue = (value: number, format: string) => {
    if (value === undefined || value === null) return '—';
    if (format === 'currency') return `$${value.toLocaleString()}`;
    return value.toLocaleString();
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Daily Empire Overview</h2>
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
    </div>
  );
}