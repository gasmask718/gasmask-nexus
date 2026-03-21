import { Card, CardContent } from '@/components/ui/card';
import { Phone, Gauge, ListOrdered, PhoneCall, ThumbsUp, Zap } from 'lucide-react';

interface CallCenterStatsBarProps {
  activeCalls: number;
  maxCapacity: number;
  queueCount: number;
  callsToday: number;
  answered: number;
  interested: number;
}

export function CallCenterStatsBar({
  activeCalls, maxCapacity, queueCount, callsToday, answered, interested,
}: CallCenterStatsBarProps) {
  const stats = [
    { label: 'Active Calls', value: activeCalls, icon: Phone, pulse: activeCalls > 0, color: 'text-green-600' },
    { label: 'Capacity', value: `${activeCalls}/${maxCapacity}`, icon: Gauge, pulse: false, color: 'text-blue-600' },
    { label: 'Queue', value: queueCount, icon: ListOrdered, pulse: false, color: 'text-foreground' },
    { label: 'Calls Today', value: callsToday, icon: PhoneCall, pulse: false, color: 'text-foreground' },
    { label: 'Answered', value: answered, icon: Zap, pulse: false, color: 'text-amber-600' },
    { label: 'Interested', value: interested, icon: ThumbsUp, pulse: false, color: 'text-green-600' },
  ];

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
      {stats.map(stat => (
        <Card key={stat.label}>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              {stat.pulse && (
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              )}
              <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
            </div>
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-[10px] text-muted-foreground">{stat.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
