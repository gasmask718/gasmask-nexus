// ═══════════════════════════════════════════════════════════════════════════════
// CADENCE QUICK STATS — Clickable cards that filter the cadence board
// ═══════════════════════════════════════════════════════════════════════════════

import { Card, CardContent } from '@/components/ui/card';
import { 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  MapPin, 
  UserX,
  Users
} from 'lucide-react';
import { useContactCadenceStats } from '@/hooks/useContactCadence';
import type { CadenceFilter } from '@/hooks/useContactCadence';

interface CadenceQuickStatsProps {
  onFilterChange: (filter: CadenceFilter) => void;
  activeFilter: CadenceFilter;
}

export function CadenceQuickStats({ onFilterChange, activeFilter }: CadenceQuickStatsProps) {
  const { data: stats, isLoading } = useContactCadenceStats();

  const cards = [
    {
      filter: 'within_window' as CadenceFilter,
      label: 'On Track',
      value: stats?.withinWindow || 0,
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      description: 'Contacted within 7 days',
    },
    {
      filter: 'due_soon' as CadenceFilter,
      label: 'Due Soon',
      value: stats?.dueSoon || 0,
      icon: Clock,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      description: '7-10 days since contact',
    },
    {
      filter: 'overdue_7_days' as CadenceFilter,
      label: 'Overdue 7d',
      value: stats?.overdue7Days || 0,
      icon: AlertTriangle,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      description: '10-14 days overdue',
    },
    {
      filter: 'overdue_14_days' as CadenceFilter,
      label: 'Overdue 14d+',
      value: stats?.overdue14Days || 0,
      icon: AlertTriangle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      description: 'Critical - 14+ days',
    },
    {
      filter: 'escalation' as CadenceFilter,
      label: 'Needs Visit',
      value: stats?.escalationRequired || 0,
      icon: MapPin,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      description: 'Physical visit required',
    },
    {
      filter: 'all' as CadenceFilter,
      label: 'Unresponsive',
      value: stats?.unresponsive || 0,
      icon: UserX,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
      description: 'No response to outreach',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-8 bg-muted rounded w-12 mb-2" />
              <div className="h-4 bg-muted rounded w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const isActive = activeFilter === card.filter;
        
        return (
          <Card 
            key={card.filter}
            className={`cursor-pointer transition-all hover:shadow-md ${
              isActive ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => onFilterChange(card.filter)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${card.bgColor}`}>
                  <Icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <div>
                  <div className={`text-2xl font-bold ${card.color}`}>
                    {card.value}
                  </div>
                  <div className="text-sm font-medium">{card.label}</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {card.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
