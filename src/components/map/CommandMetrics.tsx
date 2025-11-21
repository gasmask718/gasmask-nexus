import { Package, AlertTriangle, Users, Bike, Star, Building2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CommandMetricsProps {
  activeStores: number;
  needsFollowUp: number;
  prospects: number;
  driversLive: number;
  bikersLive: number;
  ambassadorZones: number;
  wholesaleHubs: number;
  onMetricClick: (filter: string) => void;
}

export const CommandMetrics = ({
  activeStores,
  needsFollowUp,
  prospects,
  driversLive,
  bikersLive,
  ambassadorZones,
  wholesaleHubs,
  onMetricClick
}: CommandMetricsProps) => {
  const metrics = [
    { 
      label: 'Active Stores', 
      value: activeStores, 
      icon: Package, 
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      filter: 'active'
    },
    { 
      label: 'Needs Follow-Up', 
      value: needsFollowUp, 
      icon: AlertTriangle, 
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      filter: 'needsFollowUp'
    },
    { 
      label: 'Prospects', 
      value: prospects, 
      icon: Building2, 
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      filter: 'prospect'
    },
    { 
      label: 'Drivers Live', 
      value: driversLive, 
      icon: Users, 
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      filter: 'drivers'
    },
    { 
      label: 'Bikers Live', 
      value: bikersLive, 
      icon: Bike, 
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      filter: 'bikers'
    },
    { 
      label: 'Ambassador Zones', 
      value: ambassadorZones, 
      icon: Star, 
      color: 'text-pink-500',
      bgColor: 'bg-pink-500/10',
      filter: 'ambassadors'
    },
    { 
      label: 'Wholesale Hubs', 
      value: wholesaleHubs, 
      icon: Package, 
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      filter: 'wholesale'
    }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
      {metrics.map((metric) => (
        <Card
          key={metric.label}
          className={cn(
            "p-4 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg bg-card/95 backdrop-blur border-border/50",
            "hover:border-primary/50"
          )}
          onClick={() => onMetricClick(metric.filter)}
        >
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", metric.bgColor)}>
              <metric.icon className={cn("h-5 w-5", metric.color)} />
            </div>
            <div>
              <p className="text-2xl font-bold">{metric.value}</p>
              <p className="text-xs text-muted-foreground">{metric.label}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
