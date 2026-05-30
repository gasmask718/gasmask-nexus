// ═══════════════════════════════════════════════════════════════════════════════
// OUTREACH QUEUE — Human-controlled approval queue for outreach plans
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Play, 
  MessageSquare,
  Phone,
  Store,
  Calendar,
  Users,
  AlertTriangle
} from 'lucide-react';
import { 
  useDraftOutreachPlans, 
  useActiveOutreachPlans,
  useOutreachPlans,
  useApprovePlan,
  useCancelPlan,
  type OutreachPlan
} from '@/hooks/useOutreachPlans';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';

interface OutreachQueueProps {
  className?: string;
}

export function OutreachQueue({ className }: OutreachQueueProps) {
  const [activeTab, setActiveTab] = useState('draft');
  
  const { data: draftPlans = [], isLoading: loadingDraft } = useDraftOutreachPlans();
  const { data: activePlans = [], isLoading: loadingActive } = useActiveOutreachPlans();
  const { data: completedPlans = [], isLoading: loadingCompleted } = useOutreachPlans(['completed', 'cancelled']);
  
  const approvePlan = useApprovePlan();
  const cancelPlan = useCancelPlan();

  const handleApprove = async (planId: string) => {
    await approvePlan.mutateAsync(planId);
  };

  const handleApproveAll = async () => {
    for (const plan of draftPlans) {
      await approvePlan.mutateAsync(plan.id);
    }
  };

  const handleCancel = async (planId: string) => {
    await cancelPlan.mutateAsync(planId);
  };

  return (
    <Card className={cn("glass-card border-border/50", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Outreach Queue
            </CardTitle>
            <CardDescription>
              Review and approve outreach plans before execution
            </CardDescription>
          </div>
          {draftPlans.length > 0 && (
            <Button 
              size="sm" 
              onClick={handleApproveAll}
              disabled={approvePlan.isPending}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Approve All ({draftPlans.length})
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="draft" className="relative">
              Draft
              {draftPlans.length > 0 && (
                <Badge 
                  variant="destructive" 
                  className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                >
                  {draftPlans.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="active">
              Active
              {activePlans.length > 0 && (
                <Badge 
                  variant="default" 
                  className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs bg-blue-500"
                >
                  {activePlans.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value="draft">
            <ScrollArea className="h-[400px]">
              {loadingDraft ? (
                <LoadingState />
              ) : draftPlans.length === 0 ? (
                <EmptyState message="No pending plans to approve" />
              ) : (
                <div className="space-y-3">
                  {draftPlans.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      onApprove={() => handleApprove(plan.id)}
                      onCancel={() => handleCancel(plan.id)}
                      isApproving={approvePlan.isPending}
                      isCancelling={cancelPlan.isPending}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="active">
            <ScrollArea className="h-[400px]">
              {loadingActive ? (
                <LoadingState />
              ) : activePlans.length === 0 ? (
                <EmptyState message="No plans currently running" />
              ) : (
                <div className="space-y-3">
                  {activePlans.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      showProgress
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="completed">
            <ScrollArea className="h-[400px]">
              {loadingCompleted ? (
                <LoadingState />
              ) : completedPlans.length === 0 ? (
                <EmptyState message="No completed plans yet" />
              ) : (
                <div className="space-y-3">
                  {completedPlans.slice(0, 20).map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      showResult
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

interface PlanCardProps {
  plan: OutreachPlan;
  onApprove?: () => void;
  onCancel?: () => void;
  isApproving?: boolean;
  isCancelling?: boolean;
  showProgress?: boolean;
  showResult?: boolean;
}

function PlanCard({ 
  plan, 
  onApprove, 
  onCancel, 
  isApproving, 
  isCancelling,
  showProgress,
  showResult
}: PlanCardProps) {
  const statusColors = {
    draft: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    approved: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    running: 'bg-green-500/10 text-green-500 border-green-500/20',
    completed: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    cancelled: 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-card/50">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{plan.store?.name || 'Unknown Store'}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {plan.store?.address}
          </p>
        </div>
        <Badge className={statusColors[plan.status]}>
          {plan.status}
        </Badge>
      </div>

      {/* Plan Details */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {format(new Date(plan.window_start), 'MMM d, yyyy')} - {format(new Date(plan.window_end), 'MMM d, yyyy')}
        </div>
        <div className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {plan.total_items} actions
        </div>
      </div>

      {/* Progress (for active plans) */}
      {showProgress && plan.total_items > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>Progress</span>
            <span>{plan.items_sent} / {plan.total_items} sent</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all"
              style={{ width: `${(plan.items_sent / plan.total_items) * 100}%` }}
            />
          </div>
          {plan.items_responded > 0 && (
            <p className="text-xs text-green-500">
              {plan.items_responded} responded
            </p>
          )}
        </div>
      )}

      {/* Result (for completed plans) */}
      {showResult && (
        <div className="flex items-center gap-2">
          {plan.escalated_to_visit ? (
            <Badge variant="outline" className="text-orange-500 border-orange-500/30">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Escalated to Visit
            </Badge>
          ) : plan.items_responded > 0 ? (
            <Badge variant="outline" className="text-green-500 border-green-500/30">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {plan.items_responded} responses
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              No responses
            </Badge>
          )}
        </div>
      )}

      {/* Actions (for draft plans) */}
      {onApprove && onCancel && (
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            onClick={onApprove}
            disabled={isApproving}
            className="flex-1"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onCancel}
            disabled={isCancelling}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Skip
          </Button>
        </div>
      )}

      {/* Timestamp */}
      <p className="text-xs text-muted-foreground">
        Created {formatDistanceToNow(new Date(plan.created_at), { addSuffix: true })}
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="border rounded-lg p-4 animate-pulse">
          <div className="h-4 bg-muted rounded w-1/2 mb-2" />
          <div className="h-3 bg-muted rounded w-1/3" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
      <Clock className="h-8 w-8 mb-2 opacity-50" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
