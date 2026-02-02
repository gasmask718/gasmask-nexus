import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Eye,
  CheckCircle,
  XCircle,
  Edit,
  Brain,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { useInstinctLogs, useSubmitInstinctFeedback } from '@/hooks/useFloor9';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';

const Floor9InstinctLog = () => {
  const { data: logs, isLoading } = useInstinctLogs({ limit: 50 });
  const submitFeedback = useSubmitInstinctFeedback();
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');

  const handleFeedback = (logId: string, status: 'accepted' | 'rejected' | 'modified') => {
    submitFeedback.mutate({ logId, feedback, status });
    setSelectedLog(null);
    setFeedback('');
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.85) return 'text-green-500';
    if (score >= 0.7) return 'text-yellow-500';
    return 'text-red-500';
  };

  const pendingCount = logs?.filter(l => l.feedback_status === 'pending').length || 0;
  const acceptedCount = logs?.filter(l => l.feedback_status === 'accepted').length || 0;
  const rejectedCount = logs?.filter(l => l.feedback_status === 'rejected').length || 0;

  return (
    <GrabbaLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Eye className="h-8 w-8 text-primary" />
            Instinct Log
          </h1>
          <p className="text-muted-foreground mt-1">
            Immutable record of AI decisions — Memory & Learning
          </p>
        </div>

        {/* Governance Notice */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 flex items-start gap-3">
            <Brain className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">AI Earns Autonomy Through Feedback</p>
              <p className="text-sm text-muted-foreground">
                Every AI action is logged with its reasoning and confidence. Human feedback (accept/reject/modify)
                trains the system over time. This is how AI builds trust and eventually earns more autonomy.
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
                  <p className="text-sm text-muted-foreground">Total Logs</p>
                  <p className="text-3xl font-bold">{logs?.length || 0}</p>
                </div>
                <Eye className="h-10 w-10 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                  <p className="text-3xl font-bold text-yellow-500">{pendingCount}</p>
                </div>
                <MessageSquare className="h-10 w-10 text-yellow-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Accepted</p>
                  <p className="text-3xl font-bold text-green-500">{acceptedCount}</p>
                </div>
                <ThumbsUp className="h-10 w-10 text-green-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Rejected</p>
                  <p className="text-3xl font-bold text-red-500">{rejectedCount}</p>
                </div>
                <ThumbsDown className="h-10 w-10 text-red-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Decision Log</CardTitle>
            <CardDescription>AI reasoning and human feedback history</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full" />)}
              </div>
            ) : logs && logs.length > 0 ? (
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {logs.map((log) => (
                    <Card key={log.id} className={`border ${
                      log.feedback_status === 'accepted' ? 'border-green-500/30 bg-green-500/5' :
                      log.feedback_status === 'rejected' ? 'border-red-500/30 bg-red-500/5' :
                      log.feedback_status === 'modified' ? 'border-yellow-500/30 bg-yellow-500/5' :
                      'border-border'
                    }`}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{log.action_type}</Badge>
                            {log.worker && (
                              <Badge variant="secondary">{log.worker.worker_name}</Badge>
                            )}
                            <Badge variant={
                              log.feedback_status === 'accepted' ? 'default' :
                              log.feedback_status === 'rejected' ? 'destructive' :
                              log.feedback_status === 'modified' ? 'secondary' : 'outline'
                            }>
                              {log.feedback_status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`font-mono text-sm ${getConfidenceColor(log.confidence_score)}`}>
                              {Math.round(log.confidence_score * 100)}%
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <div className="p-3 bg-muted rounded-lg mb-3">
                          <p className="text-sm font-medium mb-1">Reasoning:</p>
                          <p className="text-sm text-muted-foreground">{log.reasoning}</p>
                        </div>

                        {log.decision_path && log.decision_path.length > 0 && (
                          <div className="p-3 bg-muted/50 rounded-lg mb-3">
                            <p className="text-sm font-medium mb-2">Decision Path:</p>
                            <div className="space-y-1">
                              {log.decision_path.map((step, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs">
                                  <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                                    {step.step}
                                  </span>
                                  <span>{step.action}</span>
                                  <span className="text-muted-foreground">({Math.round(step.confidence * 100)}%)</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {log.human_feedback && (
                          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg mb-3">
                            <p className="text-sm font-medium mb-1">Human Feedback:</p>
                            <p className="text-sm">{log.human_feedback}</p>
                          </div>
                        )}

                        {log.feedback_status === 'pending' && (
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleFeedback(log.id, 'rejected')}
                              disabled={submitFeedback.isPending}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline">
                                  <Edit className="h-4 w-4 mr-1" />
                                  Feedback
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Provide Feedback</DialogTitle>
                                </DialogHeader>
                                <Textarea
                                  placeholder="Enter your feedback on this AI decision..."
                                  value={feedback}
                                  onChange={(e) => setFeedback(e.target.value)}
                                  rows={4}
                                />
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => handleFeedback(log.id, 'modified')}>
                                    Submit Modified
                                  </Button>
                                  <Button onClick={() => handleFeedback(log.id, 'accepted')}>
                                    Accept with Feedback
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            <Button
                              size="sm"
                              onClick={() => handleFeedback(log.id, 'accepted')}
                              disabled={submitFeedback.isPending}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Accept
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-12">
                <Eye className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-medium">No Logs Yet</h3>
                <p className="text-muted-foreground text-sm">AI decisions will appear here as they occur</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </GrabbaLayout>
  );
};

export default Floor9InstinctLog;
