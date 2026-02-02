import React from 'react';
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
  ChevronRight,
  Shield,
  ThumbsUp,
  ThumbsDown,
  Edit,
} from 'lucide-react';
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { useActionQueue, useResolveActionItem } from '@/hooks/useFloor9';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useState } from 'react';

const Floor9ActionQueue = () => {
  const { data: actionQueue, isLoading } = useActionQueue();
  const resolveAction = useResolveActionItem();
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const pendingItems = actionQueue?.filter(item => item.status === 'pending') || [];
  const resolvedItems = actionQueue?.filter(item => item.status !== 'pending') || [];

  const handleResolve = (itemId: string, decision: 'accepted' | 'rejected' | 'modified') => {
    resolveAction.mutate({ itemId, decision, notes: notes || undefined });
    setSelectedItem(null);
    setNotes('');
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

        {/* Governance Notice */}
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="py-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-yellow-500 mt-0.5" />
            <div>
              <p className="font-medium">Trust Bridge</p>
              <p className="text-sm text-muted-foreground">
                These are AI recommendations awaiting human decision. Review each item carefully,
                then Accept, Reject, or Modify. All decisions are logged permanently.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
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

        {/* Pending Items */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Actions</CardTitle>
            <CardDescription>Review and decide on AI recommendations</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
              </div>
            ) : pendingItems.length > 0 ? (
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {pendingItems.map((item) => (
                    <Card key={item.id} className={`border-2 ${getRiskColor(item.risk_level)}`}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
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
                          <p className="text-sm font-medium mb-2">AI Recommendation:</p>
                          <p className="text-sm">{item.ai_recommendation}</p>
                        </div>

                        {item.reasoning && Object.keys(item.reasoning).length > 0 && (
                          <div className="p-4 bg-muted/50 rounded-lg mb-4">
                            <p className="text-sm font-medium mb-2">Reasoning:</p>
                            <pre className="text-xs overflow-x-auto">
                              {JSON.stringify(item.reasoning, null, 2)}
                            </pre>
                          </div>
                        )}

                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            onClick={() => handleResolve(item.id, 'rejected')}
                            disabled={resolveAction.isPending}
                          >
                            <ThumbsDown className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline">
                                <Edit className="h-4 w-4 mr-2" />
                                Modify
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Modify Action</DialogTitle>
                              </DialogHeader>
                              <Textarea
                                placeholder="Enter your modifications or notes..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={4}
                              />
                              <DialogFooter>
                                <Button onClick={() => handleResolve(item.id, 'modified')}>
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
    </GrabbaLayout>
  );
};

export default Floor9ActionQueue;
