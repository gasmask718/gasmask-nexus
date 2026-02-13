import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Route as RouteIcon, ArrowRightLeft, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { RouteReassignDialog } from './RouteReassignDialog';

interface ActiveRouteStatusProps {
  workerId: string;
  workerName: string;
  workerType: 'driver' | 'biker';
  /** user_id from profiles (the FK target for routes.assigned_to) */
  workerUserId?: string | null;
}

const statusColors: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  active: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export const ActiveRouteStatus: React.FC<ActiveRouteStatusProps> = ({
  workerId,
  workerName,
  workerType,
  workerUserId,
}) => {
  const queryClient = useQueryClient();
  const [reassignRouteId, setReassignRouteId] = useState<string | null>(null);
  const [reassignDate, setReassignDate] = useState('');

  // Look up routes by the user_id that routes.assigned_to references
  const lookupId = workerUserId || workerId;

  const { data: activeRoutes = [] } = useQuery({
    queryKey: ['active-routes-status', lookupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes')
        .select('id, date, status, territory, type')
        .eq('assigned_to', lookupId)
        .in('status', ['pending', 'active', 'in_progress', 'paused'])
        .order('date', { ascending: true })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!lookupId,
  });

  // Fetch stop counts for active routes
  const routeIds = activeRoutes.map((r) => r.id);
  const { data: stopCounts = {} } = useQuery({
    queryKey: ['route-stop-counts', routeIds],
    queryFn: async () => {
      if (routeIds.length === 0) return {};
      const { data, error } = await supabase
        .from('route_stops')
        .select('route_id, status')
        .in('route_id', routeIds);
      if (error) throw error;

      const counts: Record<string, { total: number; completed: number }> = {};
      for (const stop of data || []) {
        if (!stop.route_id) continue;
        if (!counts[stop.route_id]) counts[stop.route_id] = { total: 0, completed: 0 };
        counts[stop.route_id].total++;
        if (stop.status === 'completed') counts[stop.route_id].completed++;
      }
      return counts;
    },
    enabled: routeIds.length > 0,
  });

  if (activeRoutes.length === 0) return null;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <RouteIcon className="h-5 w-5 text-primary" />
            Active Routes
            <Badge variant="outline" className="ml-auto">{activeRoutes.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeRoutes.map((route) => {
            const sc = stopCounts[route.id] || { total: 0, completed: 0 };
            const progress = sc.total > 0 ? Math.round((sc.completed / sc.total) * 100) : 0;

            return (
              <div key={route.id} className="p-3 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[route.status || 'pending']}>
                      {route.status}
                    </Badge>
                    <span className="text-sm font-medium">{format(new Date(route.date), 'MMM d, yyyy')}</span>
                    {route.territory && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {route.territory}
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      setReassignRouteId(route.id);
                      setReassignDate(route.date);
                    }}
                  >
                    <ArrowRightLeft className="h-3 w-3" /> Reassign
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={progress} className="h-2 flex-1" />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {sc.completed} / {sc.total} stops
                  </span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {reassignRouteId && (
        <RouteReassignDialog
          open={!!reassignRouteId}
          onOpenChange={(open) => { if (!open) setReassignRouteId(null); }}
          routeId={reassignRouteId}
          routeDate={reassignDate}
          currentAssigneeName={workerName}
          workerType={workerType}
          onReassigned={() => {
            queryClient.invalidateQueries({ queryKey: ['active-routes-status', lookupId] });
            queryClient.invalidateQueries({ queryKey: ['routes'] });
          }}
        />
      )}
    </>
  );
};

export default ActiveRouteStatus;
