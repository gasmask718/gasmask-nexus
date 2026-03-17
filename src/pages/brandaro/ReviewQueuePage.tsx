import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  CheckCircle, XCircle, RefreshCw, Eye, AlertTriangle,
  Shield, ArrowUpRight, Clock, Zap
} from 'lucide-react';

export default function ReviewQueuePage() {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const { data: queue, isLoading } = useQuery({
    queryKey: ['brandaro-review-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brandaro_review_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ['brandaro-clients-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brandaro_clients')
        .select('id, business_name');
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((c: any) => { map[c.id] = c.business_name; });
      return map;
    },
  });

  const { data: buildJobs } = useQuery({
    queryKey: ['brandaro-build-jobs-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brandaro_build_jobs')
        .select('id, deployed_url, build_status, quality_score');
      if (error) throw error;
      const map: Record<string, any> = {};
      (data || []).forEach((j: any) => { map[j.id] = j; });
      return map;
    },
  });

  const approveItem = useMutation({
    mutationFn: async ({ id, buildJobId }: { id: string; buildJobId: string }) => {
      // Approve in review queue
      await supabase.from('brandaro_review_queue').update({
        status: 'approved',
        reviewer_notes: reviewNotes[id] || null,
        reviewed_at: new Date().toISOString(),
      }).eq('id', id);

      // If build wasn't deployed yet, trigger deployment
      const job = buildJobs?.[buildJobId];
      if (job?.build_status === 'needs_review') {
        await supabase.from('brandaro_build_jobs').update({
          build_status: 'completed',
          deployment_decision: 'human_approved',
        }).eq('id', buildJobId);
      }
    },
    onSuccess: () => {
      toast.success('Build approved');
      queryClient.invalidateQueries({ queryKey: ['brandaro-review-queue'] });
    },
  });

  const rejectItem = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      await supabase.from('brandaro_review_queue').update({
        status: 'rejected',
        reviewer_notes: reviewNotes[id] || 'Quality insufficient',
        reviewed_at: new Date().toISOString(),
      }).eq('id', id);
    },
    onSuccess: () => {
      toast.success('Build rejected');
      queryClient.invalidateQueries({ queryKey: ['brandaro-review-queue'] });
    },
  });

  const requestRebuild = useMutation({
    mutationFn: async ({ id, buildJobId, clientId, projectId }: any) => {
      await supabase.from('brandaro_review_queue').update({
        status: 'rebuild_requested',
        reviewer_notes: reviewNotes[id] || 'Rebuild requested',
        reviewed_at: new Date().toISOString(),
      }).eq('id', id);

      // Trigger rebuild
      await supabase.functions.invoke('brandaro-auto-build', {
        body: {
          client_id: clientId,
          project_id: projectId,
          rebuild: true,
          improvement_hints: [reviewNotes[id] || 'General quality improvement needed'],
        },
      });
    },
    onSuccess: () => {
      toast.success('Rebuild triggered');
      queryClient.invalidateQueries({ queryKey: ['brandaro-review-queue'] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const pendingCount = queue?.filter(q => q.status === 'pending_review').length || 0;
  const approvedCount = queue?.filter(q => q.status === 'approved').length || 0;
  const rejectedCount = queue?.filter(q => q.status === 'rejected').length || 0;

  const statusColor = (s: string) => {
    switch (s) {
      case 'approved': return 'default';
      case 'rejected': return 'destructive';
      case 'rebuild_requested': return 'secondary';
      default: return 'outline';
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return 'text-hud-green';
    if (score >= 60) return 'text-hud-amber';
    return 'text-destructive';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Quality Review Queue</h1>
        <p className="text-sm text-muted-foreground">Human oversight for builds that need attention</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto mb-1 text-hud-amber" />
            <p className="text-2xl font-bold">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Pending Review</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-5 w-5 mx-auto mb-1 text-hud-green" />
            <p className="text-2xl font-bold">{approvedCount}</p>
            <p className="text-xs text-muted-foreground">Approved</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4 text-center">
            <XCircle className="h-5 w-5 mx-auto mb-1 text-destructive" />
            <p className="text-2xl font-bold">{rejectedCount}</p>
            <p className="text-xs text-muted-foreground">Rejected</p>
          </CardContent>
        </Card>
      </div>

      {/* Queue Items */}
      <div className="space-y-4">
        {queue?.map(item => {
          const clientName = clients?.[item.client_id] || 'Unknown Client';
          const job = buildJobs?.[item.build_job_id];
          const breakdown = item.quality_breakdown || {};

          return (
            <Card key={item.id} className="bg-card/50 border-border/50">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{clientName}</h3>
                      <Badge variant={statusColor(item.status)}>{item.status?.replace(/_/g, ' ')}</Badge>
                      <Badge variant={item.priority === 'high' ? 'destructive' : 'secondary'}>{item.priority}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Auto-retries: {item.auto_retry_count || 0} • 
                      {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-bold ${scoreColor(item.quality_score || 0)}`}>
                      {item.quality_score || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Quality Score</p>
                  </div>
                </div>

                {/* Quality Breakdown */}
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {Object.entries(breakdown).map(([key, value]) => (
                    <div key={key} className="text-center p-2 rounded bg-muted/30">
                      <p className="text-sm font-bold">{value as number}</p>
                      <p className="text-[10px] text-muted-foreground">{key.replace(/_/g, ' ')}</p>
                    </div>
                  ))}
                </div>

                {/* Issues */}
                {item.issue_reasons && item.issue_reasons.length > 0 && (
                  <div className="mb-4 p-3 rounded bg-destructive/5 border border-destructive/20">
                    <p className="text-xs font-medium text-destructive mb-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Issues Detected
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {item.issue_reasons.map((r: string, i: number) => (
                        <li key={i}>• {r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Actions for pending items */}
                {item.status === 'pending_review' && (
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Review notes (optional)..."
                      value={reviewNotes[item.id] || ''}
                      onChange={(e) => setReviewNotes(p => ({ ...p, [item.id]: e.target.value }))}
                      className="text-sm"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      {job?.deployed_url && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={job.deployed_url} target="_blank">
                            <Eye className="h-3 w-3 mr-1" /> Preview
                          </a>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => approveItem.mutate({ id: item.id, buildJobId: item.build_job_id })}
                        disabled={approveItem.isPending}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => requestRebuild.mutate({
                          id: item.id,
                          buildJobId: item.build_job_id,
                          clientId: item.client_id,
                          projectId: item.project_id,
                        })}
                        disabled={requestRebuild.isPending}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" /> Rebuild
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => rejectItem.mutate({ id: item.id })}
                        disabled={rejectItem.isPending}
                      >
                        <XCircle className="h-3 w-3 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {(!queue || queue.length === 0) && !isLoading && (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-8 text-center">
              <Shield className="h-8 w-8 mx-auto mb-2 text-hud-green" />
              <p className="font-medium text-hud-green">All Clear</p>
              <p className="text-sm text-muted-foreground">No builds waiting for review</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
