import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Calendar, AlertTriangle, ArrowRight, Clock } from 'lucide-react';

interface StaffMetric {
  label: string;
  value: number | string;
  trend?: 'up' | 'down' | 'neutral';
  link: string;
  linkLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'warning' | 'success';
}

interface StaffOverviewWidgetProps {
  businessSlug: string;
  isSimulationMode?: boolean;
}

/**
 * Staff Overview Widget - Read-only summary that links to OS pages
 * Displays key staff metrics without duplicating OS logic
 */
export function StaffOverviewWidget({ businessSlug, isSimulationMode = false }: StaffOverviewWidgetProps) {
  const navigate = useNavigate();

  // EXPLICIT BUSINESS SLUG MATCHING
  if (businessSlug !== 'unforgettable_times_usa') {
    return null;
  }

  // Simulated or real data (in production, fetch from hooks)
  const metrics: StaffMetric[] = [
    {
      label: 'Total Active Staff',
      value: isSimulationMode ? 47 : '—',
      icon: Users,
      link: '/os/unforgettable/staff',
      linkLabel: 'View All Staff',
      variant: 'default',
    },
    {
      label: 'Assigned Today',
      value: isSimulationMode ? 12 : '—',
      icon: Calendar,
      link: '/os/unforgettable/scheduling',
      linkLabel: 'View Schedule',
      variant: 'default',
    },
    {
      label: 'Upcoming Assignments',
      value: isSimulationMode ? 28 : '—',
      icon: Clock,
      link: '/os/unforgettable/scheduling',
      linkLabel: 'View Upcoming',
      variant: 'default',
    },
    {
      label: 'Staffing Gaps',
      value: isSimulationMode ? 3 : '—',
      icon: AlertTriangle,
      link: '/os/unforgettable/scheduling',
      linkLabel: 'Resolve Gaps',
      variant: isSimulationMode ? 'warning' : 'default',
    },
  ];

  return (
    <Card className="relative overflow-hidden">
      {isSimulationMode && (
        <Badge 
          variant="outline" 
          className="absolute top-2 right-2 text-xs bg-amber-500/10 text-amber-600 border-amber-500/30"
        >
          Simulated Data
        </Badge>
      )}
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-primary" />
          Staff Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {metrics.map((metric) => (
            <div 
              key={metric.label} 
              className={`
                p-3 rounded-lg border transition-all
                ${metric.variant === 'warning' 
                  ? 'bg-amber-500/10 border-amber-500/30' 
                  : 'bg-muted/50 border-border/50'
                }
              `}
            >
              <div className="flex items-center gap-2 mb-1">
                <metric.icon className={`h-4 w-4 ${
                  metric.variant === 'warning' ? 'text-amber-600' : 'text-muted-foreground'
                }`} />
                <span className="text-xs text-muted-foreground">{metric.label}</span>
              </div>
              <div className={`text-2xl font-bold mb-2 ${
                metric.variant === 'warning' ? 'text-amber-600' : 'text-foreground'
              }`}>
                {metric.value}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs text-primary hover:text-primary/80 hover:bg-transparent"
                onClick={() => navigate(metric.link)}
              >
                {metric.linkLabel}
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
