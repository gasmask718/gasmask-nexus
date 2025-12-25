import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Route, MapPin, Eye, UserPlus, ChevronRight, Clock, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

interface StoreCheck {
  id: string;
  location_id: string | null;
  location_name?: string;
  location_address?: string;
  assigned_biker_id: string | null;
  biker_name?: string;
  check_type: string;
  scheduled_date: string;
  status: string;
}

interface TodaysRoutesTableProps {
  checks: StoreCheck[];
  isLoading?: boolean;
  onViewDetails?: (checkId: string) => void;
  onAssignBiker?: (checkId: string, locationName: string) => void;
}

export const TodaysRoutesTable: React.FC<TodaysRoutesTableProps> = ({
  checks,
  isLoading,
  onViewDetails,
  onAssignBiker
}) => {
  const navigate = useNavigate();

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { class: string; icon: React.ReactNode }> = {
      assigned: { class: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: <Clock className="h-3 w-3" /> },
      in_progress: { class: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: <Route className="h-3 w-3" /> },
      submitted: { class: 'bg-purple-500/10 text-purple-600 border-purple-500/20', icon: <CheckCircle2 className="h-3 w-3" /> },
      approved: { class: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: <CheckCircle2 className="h-3 w-3" /> },
      rejected: { class: 'bg-red-500/10 text-red-600 border-red-500/20', icon: <Clock className="h-3 w-3" /> },
    };
    return configs[status] || configs.assigned;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Loading routes...
        </CardContent>
      </Card>
    );
  }

  if (checks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="h-5 w-5 text-blue-500" />
            Today's Routes / Tasks
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground mb-4">No store checks scheduled for today</p>
          <Button onClick={() => navigate('/delivery/biker-tasks')}>
            Create Store Check
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Route className="h-5 w-5 text-blue-500" />
          Today's Routes / Tasks ({checks.length})
        </CardTitle>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => navigate('/delivery/biker-tasks')}
        >
          View All <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {checks.map((check) => {
            const statusConfig = getStatusBadge(check.status);
            return (
              <div 
                key={check.id}
                className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{check.location_name || 'Unknown Location'}</span>
                    <Badge variant="outline" className={statusConfig.class}>
                      <span className="flex items-center gap-1">
                        {statusConfig.icon}
                        {check.status.replace('_', ' ')}
                      </span>
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span>{check.location_address || 'No address'}</span>
                    <span>•</span>
                    <span className="capitalize">{check.check_type.replace('_', ' ')}</span>
                    {check.biker_name && (
                      <>
                        <span>•</span>
                        <span>Assigned to: {check.biker_name}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onViewDetails?.(check.id)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View Details
                  </Button>
                  {!check.assigned_biker_id && (
                    <Button 
                      size="sm"
                      onClick={() => onAssignBiker?.(check.id, check.location_name || 'Store')}
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Assign
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default TodaysRoutesTable;
