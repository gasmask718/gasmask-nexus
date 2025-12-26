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
  values?: {
    activeStaff?: number;
    assignedToday?: number;
    upcomingAssignments?: number;
    staffingGaps?: number;
  };
}

/**
 * Staff Overview Widget - Read-only summary that links to OS pages
 * Displays key staff metrics without duplicating OS logic
 */
export function StaffOverviewWidget({ businessSlug, isSimulationMode = false, values }: StaffOverviewWidgetProps) {
  const navigate = useNavigate();

  // EXPLICIT BUSINESS SLUG MATCHING
  if (businessSlug !== 'unforgettable_times_usa') {
    return null;
  }

  const activeStaff = isSimulationMode ? 47 : (values?.activeStaff ?? 0);
  const assignedToday = isSimulationMode ? 12 : (values?.assignedToday ?? 0);
  const upcomingAssignments = isSimulationMode ? 28 : (values?.upcomingAssignments ?? 0);
  const staffingGaps = isSimulationMode ? 3 : (values?.staffingGaps ?? 0);

  // Simulated or provided data with CORRECT routes
  const metrics: StaffMetric[] = [
    {
      label: 'Total Active Staff',
      value: activeStaff,
      icon: Users,
      link: '/os/unforgettable/staff',
      linkLabel: 'View All Staff',
      variant: 'default',
    },
    {
      label: 'Assigned Today',
      value: assignedToday,
      icon: Calendar,
      link: '/os/unforgettable/scheduling/today',
      linkLabel: 'View Schedule',
      variant: 'default',
    },
    {
      label: 'Upcoming Assignments',
      value: upcomingAssignments,
      icon: Clock,
      link: '/os/unforgettable/scheduling/upcoming',
      linkLabel: 'View Upcoming',
      variant: 'default',
    },
    {
      label: 'Staffing Gaps',
      value: staffingGaps,
      icon: AlertTriangle,
      link: '/os/unforgettable/scheduling/gaps',
      linkLabel: 'Resolve Gaps',
      variant: staffingGaps > 0 ? 'warning' : 'default',
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
