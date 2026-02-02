// ═══════════════════════════════════════════════════════════════════════════════
// PLAYBOOK ACTIONS PANEL — Floor 4 Phase 3.5
// Displays actionable CTAs from the playbook engine
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  BookOpen,
  CheckCircle2,
  GraduationCap,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
  AlertTriangle,
  Users,
} from "lucide-react";
import { 
  useFloor4PendingActions, 
  useFloor4PlaybookActions, 
  useFloor4PlaybookStats,
  type Floor4PlaybookAction,
} from "@/hooks/useFloor4Playbook";
import { formatDistanceToNow } from "date-fns";

export function PlaybookActionsPanel() {
  const { data: actions, isLoading } = useFloor4PendingActions();
  const { data: stats } = useFloor4PlaybookStats();
  const { completeAction, dismissAction, startAction } = useFloor4PlaybookActions();
  
  const [selectedAction, setSelectedAction] = useState<Floor4PlaybookAction | null>(null);
  const [dismissDialogOpen, setDismissDialogOpen] = useState(false);
  const [dismissReason, setDismissReason] = useState("");
  
  const getRuleIcon = (rule: string) => {
    switch (rule) {
      case 'declining_performance':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'high_performer':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'sla_breach':
      case 'critical_exception':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default:
        return <BookOpen className="h-4 w-4" />;
    }
  };
  
  const getRuleBadgeColor = (rule: string) => {
    switch (rule) {
      case 'declining_performance':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'high_performer':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'sla_breach':
      case 'critical_exception':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      default:
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }
  };
  
  const getActionIcon = (type: string) => {
    switch (type) {
      case 'coaching':
        return <GraduationCap className="h-3 w-3" />;
      case 'promote_autonomy':
        return <Zap className="h-3 w-3" />;
      case 'reduce_load':
        return <Users className="h-3 w-3" />;
      default:
        return null;
    }
  };
  
  const handleComplete = async (actionId: string) => {
    await completeAction.mutateAsync(actionId);
  };
  
  const handleDismiss = async () => {
    if (!selectedAction || !dismissReason.trim()) return;
    await dismissAction.mutateAsync({
      actionId: selectedAction.id,
      reason: dismissReason.trim(),
    });
    setDismissDialogOpen(false);
    setSelectedAction(null);
    setDismissReason("");
  };
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Playbook Actions
          </CardTitle>
          
          {stats && stats.total > 0 && (
            <div className="flex items-center gap-2">
              {stats.byRule.declining_performance > 0 && (
                <Badge variant="outline" className="border-red-500 text-red-500">
                  {stats.byRule.declining_performance} Coaching
                </Badge>
              )}
              {stats.byRule.high_performer > 0 && (
                <Badge variant="outline" className="border-green-500 text-green-500">
                  {stats.byRule.high_performer} Promote
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading actions...
            </div>
          ) : actions?.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p className="text-muted-foreground">No pending actions</p>
            </div>
          ) : (
            <div className="space-y-3">
              {actions?.map((action) => (
                <Card key={action.id} className="border-l-4 border-l-primary">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={action.worker?.avatar_url} />
                          <AvatarFallback>
                            {action.worker?.name?.charAt(0) || 'W'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">
                            {action.worker?.name || 'Unknown Worker'}
                          </p>
                          <Badge className={getRuleBadgeColor(action.playbook_rule)}>
                            {getRuleIcon(action.playbook_rule)}
                            <span className="ml-1 capitalize">
                              {action.playbook_rule.replace(/_/g, ' ')}
                            </span>
                          </Badge>
                        </div>
                      </div>
                      
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(action.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getActionIcon(action.action_type)}
                        <span className="font-medium">{action.action_label}</span>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleComplete(action.id)}
                          disabled={completeAction.isPending}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Done
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedAction(action);
                            setDismissDialogOpen(true);
                          }}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Dismiss
                        </Button>
                      </div>
                    </div>
                    
                    {action.context && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {action.context.reliability_score !== undefined && (
                          <span>Reliability: {action.context.reliability_score}% • </span>
                        )}
                        {action.context.trust_score !== undefined && (
                          <span>Trust: {action.context.trust_score} • </span>
                        )}
                        {action.context.trend && (
                          <span>Trend: {action.context.trend}</span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
      
      {/* Dismiss Dialog */}
      <Dialog open={dismissDialogOpen} onOpenChange={setDismissDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dismiss Action</DialogTitle>
          </DialogHeader>
          
          {selectedAction && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <h4 className="font-medium">{selectedAction.action_label}</h4>
                <p className="text-sm text-muted-foreground">
                  Rule: {selectedAction.playbook_rule.replace(/_/g, ' ')}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Reason for dismissing (required)
                </label>
                <Textarea
                  placeholder="Why is this action not needed..."
                  value={dismissReason}
                  onChange={(e) => setDismissReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDismissDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDismiss}
              disabled={!dismissReason.trim() || dismissAction.isPending}
            >
              Dismiss Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
