import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Shield,
  ThumbsUp,
  ThumbsDown,
  Edit,
  Eye,
  Ban,
} from 'lucide-react';
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { useActionQueue, useResolveActionItem } from '@/hooks/useFloor9';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { 
  ShadowModeBanner, 
  RecommendationOnlyBadge, 
  NoAutoAcceptWarning,
  RejectFeedbackRequired,
  ShadowModeGovernanceRules,
  ImmutableLogNotice,
} from '@/components/floor9';

const Floor9ActionQueue = () => {
  const { data: actionQueue, isLoading } = useActionQueue();
  const resolveAction = useResolveActionItem();
  const [notes, setNotes] = useState('');
  const [rejectingItemId, setRejectingItemId] = useState<string | null>(null);
  const [showRejectFeedbackFor, setShowRejectFeedbackFor] = useState<string | null>(null);
  const [modifyDialogOpen, setModifyDialogOpen] = useState<string | null>(null);

  const pendingItems = actionQueue?.filter(item => item.status === 'pending') || [];
  const resolvedItems = actionQueue?.filter(item => item.status !== 'pending') || [];

  // PHASE 9.1: Reject requires feedback - cannot reject without explanation
  const handleRejectAttempt = (itemId: string) => {
    if (!notes.trim()) {
      setShowRejectFeedbackFor(itemId);
      return;
    }
    handleResolve(itemId, 'rejected');
  };

  // PHASE 9.1: Modify requires justification
  const handleModifyAttempt = (itemId: string) => {
    if (!notes.trim() || notes.length < 10) {
      return; // Dialog validation will show error
    }
    handleResolve(itemId, 'modified');
  };

  const handleResolve = (itemId: string, decision: 'accepted' | 'rejected' | 'modified') => {
    resolveAction.mutate({ 
      itemId, 
      decision, 
      notes: notes || `${decision.toUpperCase()} via Floor 9 Action Queue at ${new Date().toISOString()}`,
    });
    setNotes('');
    setShowRejectFeedbackFor(null);
    setModifyDialogOpen(null);
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-500/10 border-red-500/30 text-red-500';
      case 'high': return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500';
      case 'medium': return 'bg-blue-500/10 border-blue-500/30 text-blue-500';
      default: return 'bg-muted/50 border-border text-muted-foreground';
    }
  };

  return (
    <GrabbaLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bell className="h-8 w-8 text-primary" />
            Action Queue
          </h1>
          <p className="text-muted-foreground mt-1">
            Human-AI handoff — Review and approve AI recommendations
          </p>
        </div>

        {/* PHASE 9.1: Shadow Mode Banner */}
        <ShadowModeBanner />

        {/* PHASE 9.1: Governance Notice - Hardened */}
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium">Trust Bridge — Human-in-the-Loop Required</p>
                <p className="text-sm text-muted-foreground mt-1">
                  These are AI <strong>recommendations only</strong>. Nothing executes without your explicit approval.
                  Each decision is logged permanently and used to improve AI accuracy.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <RecommendationOnlyBadge />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PHASE 9.1: Block Accept All */}
        {pendingItems.length > 1 && <NoAutoAcceptWarning />}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                  <p className="text-3xl font-bold text-yellow-500">{pendingItems.length}</p>
                </div>
                <Clock className="h-10 w-10 text-yellow-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Critical Risk</p>
                  <p className="text-3xl font-bold text-red-500">
                    {pendingItems.filter(i => i.risk_level === 'critical').length}
                  </p>
                </div>
                <AlertTriangle className="h-10 w-10 text-red-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Accepted Today</p>
                  <p className="text-3xl font-bold text-green-500">
                    {resolvedItems.filter(i => i.human_decision === 'accepted').length}
                  </p>
                </div>
                <CheckCircle className="h-10 w-10 text-green-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Rejected Today</p>
                  <p className="text-3xl font-bold text-red-500">
                    {resolvedItems.filter(i => i.human_decision === 'rejected').length}
                  </p>
                </div>
                <XCircle className="h-10 w-10 text-red-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Queue */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Pending Actions</span>
                  <Badge variant="outline" className="text-yellow-500 border-yellow-500">
                    <Eye className="h-3 w-3 mr-1" />
                    Shadow Mode
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Review each recommendation individually — bulk actions are disabled
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
                  </div>
                ) : pendingItems.length > 0 ? (
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-4">
                      {pendingItems.map((item) => (
                        <Card key={item.id} className={`border-2 ${getRiskColor(item.risk_level)}`}>
                          <CardContent className="pt-6">
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  {/* PHASE 9.1: Always show recommendation badge */}
                                  <RecommendationOnlyBadge />
                                  <Badge variant={
                                    item.risk_level === 'critical' ? 'destructive' :
                                    item.risk_level === 'high' ? 'secondary' : 'outline'
                                  }>
                                    {item.risk_level} risk
                                  </Badge>
                                  <Badge variant="outline">{item.action_type}</Badge>
                                  {item.sla_deadline && (
                                    <Badge variant="outline" className="text-yellow-500">
                                      <Clock className="h-3 w-3 mr-1" />
                                      SLA: {new Date(item.sla_deadline).toLocaleTimeString()}
                                    </Badge>
                                  )}
                                </div>
                                <h4 className="font-medium text-lg">{item.action_summary}</h4>
                              </div>
                              <span className="text-sm text-muted-foreground">
                                {new Date(item.created_at).toLocaleString()}
                              </span>
                            </div>

                            <div className="p-4 bg-muted rounded-lg mb-4">
                              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                                <Eye className="h-4 w-4" />
                                AI Recommendation (Not Executed):
                              </p>
                              <p className="text-sm">{item.ai_recommendation}</p>
                            </div>

                            {item.reasoning && Object.keys(item.reasoning).length > 0 && (
                              <div className="p-4 bg-muted/50 rounded-lg mb-4">
                                <p className="text-sm font-medium mb-2">Reasoning (Explainability):</p>
                                <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                                  {JSON.stringify(item.reasoning, null, 2)}
                                </pre>
                              </div>
                            )}

                            {/* PHASE 9.1: Reject feedback required warning */}
                            {showRejectFeedbackFor === item.id && (
                              <div className="mb-4">
                                <RejectFeedbackRequired onProvide={() => {
                                  setRejectingItemId(item.id);
                                  setShowRejectFeedbackFor(null);
                                }} />
                              </div>
                            )}

                            {/* Inline reject with feedback */}
                            {rejectingItemId === item.id && (
                              <div className="p-4 border border-red-500/30 rounded-lg mb-4 bg-red-500/5">
                                <p className="text-sm font-medium mb-2 text-red-500">
                                  Rejection Feedback Required (min 1 sentence)
                                </p>
                                <Textarea
                                  placeholder="Explain why you're rejecting this recommendation..."
                                  value={notes}
                                  onChange={(e) => setNotes(e.target.value)}
                                  rows={3}
                                  className="mb-3"
                                />
                                <div className="flex gap-2 justify-end">
                                  <Button variant="outline" size="sm" onClick={() => {
                                    setRejectingItemId(null);
                                    setNotes('');
                                  }}>
                                    Cancel
                                  </Button>
                                  <Button 
                                    variant="destructive" 
                                    size="sm"
                                    disabled={notes.trim().length < 10 || resolveAction.isPending}
                                    onClick={() => handleResolve(item.id, 'rejected')}
                                  >
                                    Submit Rejection
                                  </Button>
                                </div>
                              </div>
                            )}

                            <ImmutableLogNotice />

                            <div className="flex gap-2 justify-end mt-4">
                              <Button
                                variant="outline"
                                onClick={() => handleRejectAttempt(item.id)}
                                disabled={resolveAction.isPending || rejectingItemId === item.id}
                              >
                                <ThumbsDown className="h-4 w-4 mr-2" />
                                Reject
                              </Button>
                              
                              <Dialog open={modifyDialogOpen === item.id} onOpenChange={(open) => {
                                setModifyDialogOpen(open ? item.id : null);
                                if (!open) setNotes('');
                              }}>
                                <DialogTrigger asChild>
                                  <Button variant="outline">
                                    <Edit className="h-4 w-4 mr-2" />
                                    Modify
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Modify AI Recommendation</DialogTitle>
                                    <DialogDescription>
                                      Explain what changes you're making and why. This feedback trains the AI.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <Textarea
                                    placeholder="Enter your modifications and justification (required)..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={4}
                                  />
                                  {notes.length > 0 && notes.length < 10 && (
                                    <p className="text-xs text-red-500">
                                      Modification requires at least 10 characters of explanation
                                    </p>
                                  )}
                                  <DialogFooter>
                                    <Button 
                                      disabled={notes.trim().length < 10 || resolveAction.isPending}
                                      onClick={() => handleModifyAttempt(item.id)}
                                    >
                                      Submit Modified
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                              
                              <Button
                                onClick={() => handleResolve(item.id, 'accepted')}
                                disabled={resolveAction.isPending}
                              >
                                <ThumbsUp className="h-4 w-4 mr-2" />
                                Accept
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-12">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <h3 className="font-medium">Queue Clear</h3>
                    <p className="text-muted-foreground text-sm">No actions awaiting approval</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Governance Sidebar */}
          <div className="lg:col-span-1">
            <ShadowModeGovernanceRules />
          </div>
        </div>
      </div>
    </GrabbaLayout>
  );
};

export default Floor9ActionQueue;
