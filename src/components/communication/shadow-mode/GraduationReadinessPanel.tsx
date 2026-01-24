import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { 
  GraduationCap, 
  CheckCircle, 
  XCircle,
  Clock,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Shield,
  RotateCcw,
  Loader2,
  AlertTriangle
} from "lucide-react";
import { 
  useGraduationEvents, 
  useGraduationThresholds,
  useRequestGraduationEvaluation,
  useApproveGraduation,
  useReverseGraduation
} from "@/hooks/useShadowMode";
import { useAICallAgentConfig } from "@/hooks/useAICallAgent";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface GraduationReadinessPanelProps {
  businessId: string | null;
}

const MODE_LABELS = {
  off: 'Off',
  shadow: 'Shadow',
  assisted: 'Assisted',
  canary: 'Canary',
  live: 'Live',
};

const MODE_COLORS = {
  off: 'bg-muted text-muted-foreground',
  shadow: 'bg-secondary text-secondary-foreground',
  assisted: 'bg-blue-500/20 text-blue-600',
  canary: 'bg-amber-500/20 text-amber-600',
  live: 'bg-green-500/20 text-green-600',
};

export function GraduationReadinessPanel({ businessId }: GraduationReadinessPanelProps) {
  const [approvalNotes, setApprovalNotes] = useState('');
  const [reversalReason, setReversalReason] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showReverseDialog, setShowReverseDialog] = useState(false);

  const { data: config, isLoading: configLoading } = useAICallAgentConfig(businessId);
  const { data: events, isLoading: eventsLoading } = useGraduationEvents(businessId);
  const { data: thresholds } = useGraduationThresholds(businessId);
  
  const evaluateMutation = useRequestGraduationEvaluation();
  const approveMutation = useApproveGraduation();
  const reverseMutation = useReverseGraduation();

  const currentMode = config?.mode || 'off';
  const pendingEvents = events?.filter(e => e.trigger_reason.startsWith('PENDING:')) || [];

  if (!businessId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Select a business to view Graduation Readiness
        </CardContent>
      </Card>
    );
  }

  const handleEvaluate = () => {
    if (!businessId) return;
    evaluateMutation.mutate({ businessId });
  };

  const handleApprove = () => {
    if (!businessId || !selectedEvent) return;
    approveMutation.mutate(
      { eventId: selectedEvent, businessId, approvalNotes },
      { onSuccess: () => { setShowApproveDialog(false); setApprovalNotes(''); } }
    );
  };

  const handleReverse = () => {
    if (!businessId || !selectedEvent) return;
    reverseMutation.mutate(
      { eventId: selectedEvent, businessId, reason: reversalReason },
      { onSuccess: () => { setShowReverseDialog(false); setReversalReason(''); } }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">Graduation Readiness</h2>
            <p className="text-sm text-muted-foreground">
              AI promotion and demotion management
            </p>
          </div>
        </div>
        <Button onClick={handleEvaluate} disabled={evaluateMutation.isPending}>
          {evaluateMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Shield className="h-4 w-4 mr-2" />
          )}
          Evaluate Readiness
        </Button>
      </div>

      {/* Current Mode */}
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-4">
            {['shadow', 'assisted', 'canary', 'live'].map((mode, index) => {
              const isActive = mode === currentMode;
              const isPast = ['shadow', 'assisted', 'canary', 'live'].indexOf(mode) < 
                           ['shadow', 'assisted', 'canary', 'live'].indexOf(currentMode);
              
              return (
                <div key={mode} className="flex items-center">
                  <div 
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-lg transition-all",
                      isActive ? MODE_COLORS[mode as keyof typeof MODE_COLORS] : 
                      isPast ? "bg-primary/10" : "bg-muted/50"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      isActive ? "bg-primary text-primary-foreground" :
                      isPast ? "bg-primary/50 text-primary-foreground" : "bg-muted"
                    )}>
                      {isPast ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : isActive ? (
                        <span className="font-bold">{index + 1}</span>
                      ) : (
                        <span className="text-muted-foreground">{index + 1}</span>
                      )}
                    </div>
                    <span className={cn(
                      "text-sm font-medium",
                      isActive || isPast ? "" : "text-muted-foreground"
                    )}>
                      {MODE_LABELS[mode as keyof typeof MODE_LABELS]}
                    </span>
                  </div>
                  {index < 3 && (
                    <ArrowRight className={cn(
                      "h-5 w-5 mx-2",
                      isPast ? "text-primary" : "text-muted-foreground"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Pending Approvals */}
      {pendingEvents.length > 0 && (
        <Card className="border-amber-500/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Pending Approvals
            </CardTitle>
            <CardDescription>
              These graduations require human approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingEvents.map((event) => (
                <div 
                  key={event.id}
                  className="p-4 rounded-lg border bg-amber-500/5 border-amber-500/20"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge className={MODE_COLORS[event.from_mode as keyof typeof MODE_COLORS]}>
                        {MODE_LABELS[event.from_mode as keyof typeof MODE_LABELS]}
                      </Badge>
                      <ArrowRight className="h-4 w-4" />
                      <Badge className={MODE_COLORS[event.to_mode as keyof typeof MODE_COLORS]}>
                        {MODE_LABELS[event.to_mode as keyof typeof MODE_LABELS]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setSelectedEvent(event.id);
                          setShowReverseDialog(true);
                        }}
                      >
                        Reject
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => {
                          setSelectedEvent(event.id);
                          setShowApproveDialog(true);
                        }}
                      >
                        Approve
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {event.trigger_reason.replace('PENDING: ', '')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Trust Score: {event.trust_score_at_event?.toFixed(1) || '—'}%
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Graduation History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Graduation History</CardTitle>
          <CardDescription>
            Record of all mode transitions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {eventsLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : events && events.length > 0 ? (
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {events.filter(e => !e.trigger_reason.startsWith('PENDING:')).map((event) => {
                  const isPromotion = ['shadow', 'assisted', 'canary', 'live'].indexOf(event.to_mode) > 
                                     ['shadow', 'assisted', 'canary', 'live'].indexOf(event.from_mode);
                  
                  return (
                    <div 
                      key={event.id}
                      className="p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isPromotion ? (
                            <ArrowUp className="h-5 w-5 text-green-500" />
                          ) : (
                            <ArrowDown className="h-5 w-5 text-destructive" />
                          )}
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {MODE_LABELS[event.from_mode as keyof typeof MODE_LABELS]}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <Badge className={MODE_COLORS[event.to_mode as keyof typeof MODE_COLORS]}>
                              {MODE_LABELS[event.to_mode as keyof typeof MODE_LABELS]}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {event.is_reversible && !event.reversed_at && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => {
                                setSelectedEvent(event.id);
                                setShowReverseDialog(true);
                              }}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mt-2">
                        {event.trigger_reason.replace('APPROVED: ', '')}
                      </p>
                      
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Trust: {event.trust_score_at_event?.toFixed(1) || '—'}%</span>
                        <span>Type: {event.event_type}</span>
                        {event.approved_by && <span>Approved by human</span>}
                      </div>

                      {event.reversed_at && (
                        <Badge variant="destructive" className="mt-2 text-xs">
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Reversed: {event.reversal_reason}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No graduation events yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Graduation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Approving this will change the AI mode. This action is logged and auditable.
            </p>
            <Textarea
              placeholder="Optional approval notes..."
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={approveMutation.isPending}>
              {approveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Approve Graduation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reversal Dialog */}
      <Dialog open={showReverseDialog} onOpenChange={setShowReverseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse Graduation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will revert the AI mode to its previous state. Please provide a reason.
            </p>
            <Textarea
              placeholder="Reason for reversal..."
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReverseDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReverse} 
              disabled={reverseMutation.isPending || !reversalReason.trim()}
            >
              {reverseMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reverse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
