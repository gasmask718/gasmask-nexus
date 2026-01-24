import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Phone, User, Clock, AlertTriangle, CheckCircle, XCircle,
  Calendar, MessageSquare, Loader2, Timer, PhoneForwarded
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Escalation {
  id: string;
  escalation_reason: string;
  escalation_type: string;
  priority: string;
  context_snapshot: Record<string, unknown>;
  transcript_at_escalation: string | null;
  confidence_at_escalation: number | null;
  caller_phone: string | null;
  caller_name: string | null;
  escalated_at: string;
  sla_deadline: string | null;
  sla_breached: boolean;
  status: string;
  accepted_by: string | null;
  accepted_at: string | null;
  callback_scheduled_for: string | null;
}

export function HumanEscalationInbox() {
  const { currentBusiness } = useBusiness();
  const businessId = currentBusiness?.id;
  const queryClient = useQueryClient();
  
  const [selectedEscalation, setSelectedEscalation] = useState<Escalation | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [callbackDate, setCallbackDate] = useState('');
  const [callbackNotes, setCallbackNotes] = useState('');

  const { data: escalations, isLoading } = useQuery({
    queryKey: ['escalation-inbox', businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('human_escalation_inbox')
        .select('*')
        .eq('business_id', businessId)
        .order('escalated_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as Escalation[];
    },
    enabled: !!businessId,
    refetchInterval: 10000, // Poll every 10 seconds for new escalations
  });

  const acceptMutation = useMutation({
    mutationFn: async (escalationId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('human_escalation_inbox')
        .update({
          status: 'accepted',
          accepted_by: user?.id,
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', escalationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escalation-inbox'] });
      toast.success('Escalation accepted - you are now handling this call');
    },
    onError: (error: Error) => {
      toast.error(`Failed to accept: ${error.message}`);
    }
  });

  const declineMutation = useMutation({
    mutationFn: async ({ escalationId, reason }: { escalationId: string; reason: string }) => {
      const { error } = await supabase
        .from('human_escalation_inbox')
        .update({
          status: 'declined',
          declined_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', escalationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escalation-inbox'] });
      toast.success('Escalation declined');
    }
  });

  const scheduleMutation = useMutation({
    mutationFn: async ({ escalationId, scheduledFor, notes }: { 
      escalationId: string; 
      scheduledFor: string; 
      notes: string 
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('human_escalation_inbox')
        .update({
          status: 'scheduled',
          accepted_by: user?.id,
          accepted_at: new Date().toISOString(),
          callback_scheduled_for: scheduledFor,
          callback_notes: notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', escalationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escalation-inbox'] });
      toast.success('Callback scheduled');
      setScheduleDialogOpen(false);
      setSelectedEscalation(null);
    }
  });

  const pendingEscalations = escalations?.filter(e => e.status === 'pending') || [];
  const acceptedEscalations = escalations?.filter(e => e.status === 'accepted') || [];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-destructive text-destructive-foreground';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'pricing_request': return '💰';
      case 'contract_terms': return '📋';
      case 'legal_trust_authority': return '⚖️';
      case 'confidence_drop': return '📉';
      case 'human_request': return '👋';
      case 'opt_out': return '🚫';
      default: return '❓';
    }
  };

  const getSlaStatus = (escalation: Escalation) => {
    if (!escalation.sla_deadline) return null;
    
    const deadline = new Date(escalation.sla_deadline);
    const now = new Date();
    const remaining = deadline.getTime() - now.getTime();
    
    if (remaining < 0) {
      return { status: 'breached', text: 'SLA Breached', color: 'text-destructive' };
    } else if (remaining < 5 * 60 * 1000) { // 5 minutes
      return { status: 'critical', text: `${Math.ceil(remaining / 1000 / 60)}m left`, color: 'text-orange-500' };
    } else {
      return { status: 'ok', text: formatDistanceToNow(deadline, { addSuffix: true }), color: 'text-muted-foreground' };
    }
  };

  if (!businessId) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Please select a business</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingEscalations.length}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <PhoneForwarded className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{acceptedEscalations.length}</p>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <Timer className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {pendingEscalations.filter(e => e.sla_breached).length}
                </p>
                <p className="text-sm text-muted-foreground">SLA Breached</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {escalations?.filter(e => e.status === 'completed').length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Resolved Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Escalation Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Escalation Inbox
          </CardTitle>
          <CardDescription>
            AI has escalated these calls for human handling
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : pendingEscalations.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium">No pending escalations</p>
              <p className="text-sm text-muted-foreground">AI is handling calls successfully</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-4">
                {pendingEscalations.map((escalation) => {
                  const sla = getSlaStatus(escalation);
                  
                  return (
                    <Card key={escalation.id} className="border-l-4 border-l-orange-500">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={getPriorityColor(escalation.priority)}>
                                {escalation.priority.toUpperCase()}
                              </Badge>
                              <span className="text-lg">{getTypeIcon(escalation.escalation_type)}</span>
                              <span className="font-medium">{escalation.escalation_type.replace(/_/g, ' ')}</span>
                              {sla && (
                                <span className={`text-sm ${sla.color}`}>
                                  <Clock className="h-3 w-3 inline mr-1" />
                                  {sla.text}
                                </span>
                              )}
                            </div>
                            
                            <p className="text-sm">{escalation.escalation_reason}</p>
                            
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              {escalation.caller_phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {escalation.caller_phone}
                                </span>
                              )}
                              {escalation.caller_name && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {escalation.caller_name}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(escalation.escalated_at), { addSuffix: true })}
                              </span>
                            </div>
                            
                            {escalation.transcript_at_escalation && (
                              <div className="mt-2 p-2 bg-muted rounded text-xs font-mono">
                                <p className="text-muted-foreground mb-1">Last transcript:</p>
                                "{escalation.transcript_at_escalation}"
                              </div>
                            )}
                          </div>
                          
                          <div className="flex flex-col gap-2">
                            <Button
                              size="sm"
                              onClick={() => acceptMutation.mutate(escalation.id)}
                              disabled={acceptMutation.isPending}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedEscalation(escalation);
                                setScheduleDialogOpen(true);
                              }}
                            >
                              <Calendar className="h-4 w-4 mr-1" />
                              Schedule
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => declineMutation.mutate({ 
                                escalationId: escalation.id, 
                                reason: 'Declined by agent' 
                              })}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Decline
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Schedule Callback Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Callback</DialogTitle>
            <DialogDescription>
              Schedule a callback for {selectedEscalation?.caller_name || selectedEscalation?.caller_phone}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Callback Date & Time</label>
              <Input
                type="datetime-local"
                value={callbackDate}
                onChange={(e) => setCallbackDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={callbackNotes}
                onChange={(e) => setCallbackNotes(e.target.value)}
                placeholder="Add any notes for the callback..."
                className="mt-1"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedEscalation && callbackDate) {
                  scheduleMutation.mutate({
                    escalationId: selectedEscalation.id,
                    scheduledFor: new Date(callbackDate).toISOString(),
                    notes: callbackNotes
                  });
                }
              }}
              disabled={!callbackDate || scheduleMutation.isPending}
            >
              {scheduleMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Calendar className="h-4 w-4 mr-2" />
              )}
              Schedule Callback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
