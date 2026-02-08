// ═══════════════════════════════════════════════════════════════
// Actions Needed Card — Shows pending follow-up actions
// Rule-based, no outbound. Tasks, flags, reminders only.
// ═══════════════════════════════════════════════════════════════

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useFollowUpActions } from '@/hooks/useVisitSummary';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { AlertTriangle, CheckCircle2, Clock, Zap, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ActionsNeededCardProps {
  storeId: string;
}

const PRIORITY_CONFIG = {
  urgent: { icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10 border-red-500/20', label: 'Urgent' },
  high: { icon: Zap, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', label: 'High' },
  normal: { icon: Clock, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', label: 'Normal' },
  low: { icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted/30 border-muted', label: 'Low' },
};

export function ActionsNeededCard({ storeId }: ActionsNeededCardProps) {
  const { data: actions, isLoading } = useFollowUpActions(storeId);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const pendingActions = (actions || []).filter((a: any) => a.status === 'pending' || a.status === 'in_progress');
  const completedActions = (actions || []).filter((a: any) => a.status === 'completed' || a.status === 'dismissed');

  const handleResolve = async (actionId: string, status: 'completed' | 'dismissed') => {
    const { error } = await (supabase
      .from('delivery_followup_actions' as any)
      .update({ 
        status, 
        resolved_at: new Date().toISOString(), 
        resolved_by: user?.id 
      })
      .eq('id', actionId) as any);

    if (error) {
      toast.error('Failed to update action');
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['followup-actions', storeId] });
    toast.success(status === 'completed' ? 'Action completed' : 'Action dismissed');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-5 bg-muted rounded w-1/3" />
            <div className="h-12 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pendingActions.length === 0 && completedActions.length === 0) {
    return null; // Don't show card if no actions exist
  }

  return (
    <Card className={pendingActions.length > 0 ? 'border-amber-500/30' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Actions Needed
          </CardTitle>
          {pendingActions.length > 0 && (
            <Badge variant="outline" className="bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400">
              {pendingActions.length} pending
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Pending Actions */}
        {pendingActions.map((action: any) => {
          const priority = PRIORITY_CONFIG[action.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.normal;
          const PriorityIcon = priority.icon;

          return (
            <div
              key={action.id}
              className={cn('flex items-start gap-3 p-3 rounded-lg border', priority.bg)}
            >
              <PriorityIcon className={cn('h-4 w-4 mt-0.5 shrink-0', priority.color)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{action.action_label}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {action.assigned_role}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {action.description}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Rule: {action.rule_trigger} • {new Date(action.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700"
                  onClick={() => handleResolve(action.id, 'completed')}
                  title="Mark complete"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => handleResolve(action.id, 'dismissed')}
                  title="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}

        {/* Completed summary */}
        {completedActions.length > 0 && pendingActions.length === 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-sm text-muted-foreground">
              All actions resolved ({completedActions.length} completed)
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
