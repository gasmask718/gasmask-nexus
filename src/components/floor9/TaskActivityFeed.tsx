/**
 * TaskActivityFeed - Real-time append-only activity log for AI tasks
 * Shows chronological actions with results and reasons
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface TaskActivityEntry {
  id: string;
  task_id: string;
  action_type: string;
  action_description: string;
  result: 'success' | 'skipped' | 'blocked' | 'failed' | 'cancelled';
  reason: string | null;
  target_entity_type: string | null;
  target_entity_id: string | null;
  target_entity_name: string | null;
  created_at: string;
}

interface TaskActivityFeedProps {
  taskId: string;
  maxHeight?: string;
}

const resultConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  success: { 
    icon: <CheckCircle2 className="h-3 w-3" />, 
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    label: 'Success'
  },
  skipped: { 
    icon: <ArrowRight className="h-3 w-3" />, 
    color: 'bg-muted text-muted-foreground',
    label: 'Skipped'
  },
  blocked: { 
    icon: <AlertTriangle className="h-3 w-3" />, 
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    label: 'Blocked'
  },
  failed: { 
    icon: <XCircle className="h-3 w-3" />, 
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    label: 'Failed'
  },
  cancelled: { 
    icon: <XCircle className="h-3 w-3" />, 
    color: 'bg-muted text-muted-foreground',
    label: 'Cancelled'
  },
};

export function TaskActivityFeed({ taskId, maxHeight = '300px' }: TaskActivityFeedProps) {
  const [activities, setActivities] = useState<TaskActivityEntry[]>([]);

  // Fetch initial activities
  const { data: initialActivities, isLoading } = useQuery({
    queryKey: ['floor9', 'task-activity', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_task_activity_log')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return (data || []) as TaskActivityEntry[];
    },
  });

  // Set initial data
  useEffect(() => {
    if (initialActivities) {
      setActivities(initialActivities);
    }
  }, [initialActivities]);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`task-activity-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ai_task_activity_log',
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          setActivities(prev => [payload.new as TaskActivityEntry, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Activity Log ({activities.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No activity recorded yet
          </div>
        ) : (
          <ScrollArea style={{ maxHeight }} className="pr-4">
            <div className="space-y-2">
              {activities.map((activity) => {
                const config = resultConfig[activity.result] || resultConfig.success;
                
                return (
                  <div 
                    key={activity.id}
                    className={`p-3 rounded-lg border text-sm ${
                      activity.result === 'failed' || activity.result === 'blocked'
                        ? 'border-amber-200 dark:border-amber-800'
                        : 'border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={`${config.color} text-xs`}>
                            {config.icon}
                            <span className="ml-1">{config.label}</span>
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        
                        <p className="font-medium text-sm">
                          {activity.action_description}
                        </p>
                        
                        {activity.reason && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Reason: {activity.reason}
                          </p>
                        )}
                        
                        {activity.target_entity_name && (
                          <div className="flex items-center gap-1 text-xs text-primary mt-1">
                            <ExternalLink className="h-3 w-3" />
                            {activity.target_entity_type}: {activity.target_entity_name}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}