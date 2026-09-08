/**
 * ICW — My Jobs (worker-facing)
 *
 * Shows jobs currently offered to the signed-in worker
 * (icw_jobs.status = 'awaiting_worker_response' AND assigned_worker_id = their worker id)
 * plus their confirmed/active work.
 *
 * Accept / Decline go through the SECURITY DEFINER RPC icw_worker_respond, which
 * re-verifies ownership server-side and raises on any failure — so there is no
 * silent zero-row write to guard against here.
 */
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { mutationErrorMessage } from '@/lib/verifiedMutation';
import { AlertTriangle, Calendar, Check, Clock, MapPin, X } from 'lucide-react';

interface Job {
  id: string;
  category: string;
  sub_service: string | null;
  address: string | null;
  state: string | null;
  scheduled_at: string | null;
  price: number | null;
  status: string;
  customer_name: string | null;
  awaiting_response_since: string | null;
}

const RESPONSE_WINDOW_MIN = 30;

function minutesLeft(since: string | null): number | null {
  if (!since) return null;
  const elapsed = (Date.now() - new Date(since).getTime()) / 60000;
  return Math.max(0, Math.round(RESPONSE_WINDOW_MIN - elapsed));
}

export default function ICWMyJobs() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const workerQuery = useQuery({
    queryKey: ['icw-my-worker', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('icw_workers')
        .select('id, full_name, approved, state, category_groups')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const worker = workerQuery.data;

  const jobsQuery = useQuery({
    queryKey: ['icw-my-jobs', worker?.id],
    queryFn: async (): Promise<Job[]> => {
      const { data, error } = await supabase
        .from('icw_jobs')
        .select('id, category, sub_service, address, state, scheduled_at, price, status, customer_name, awaiting_response_since')
        .eq('assigned_worker_id', worker!.id)
        .in('status', ['awaiting_worker_response', 'matched', 'in_progress'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Job[];
    },
    enabled: !!worker?.id,
    refetchInterval: 60_000,
  });

  const respond = useMutation({
    mutationFn: async ({ jobId, accept }: { jobId: string; accept: boolean }) => {
      const { data, error } = await supabase.rpc('icw_worker_respond', {
        _job_id: jobId,
        _accept: accept,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['icw-my-jobs', worker?.id] });
      qc.invalidateQueries({ queryKey: ['icw-command-metrics'] });
      toast.success(vars.accept ? 'Job accepted' : 'Job declined — sent back for re-dispatch');
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });

  const jobs = jobsQuery.data ?? [];
  const offers = jobs.filter((j) => j.status === 'awaiting_worker_response');
  const active = jobs.filter((j) => j.status !== 'awaiting_worker_response');

  if (!user) {
    return <div className="p-6 text-muted-foreground">Sign in to see your jobs.</div>;
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-[#4FC3E8] to-[#B4D334] bg-clip-text text-transparent">
          My ICW Jobs
        </h1>
        <p className="text-muted-foreground mt-1">
          {worker ? worker.full_name : 'Jobs offered to you, and the work you have confirmed'}
        </p>
      </div>

      {workerQuery.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !worker ? (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="p-4 text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
            <span>
              This login isn’t linked to an ICW worker record yet, so there are no jobs to show.
              An ICW manager needs to connect your worker profile to this account.
            </span>
          </CardContent>
        </Card>
      ) : !worker.approved ? (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="p-4 text-sm">
            Your worker profile is still awaiting approval. Jobs will start arriving once it’s approved.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-[#4FC3E8]" />
                Waiting on your answer
                <Badge variant="outline" className="ml-2">{offers.length}</Badge>
              </CardTitle>
              <CardDescription>
                Respond within {RESPONSE_WINDOW_MIN} minutes — after that the job is offered to someone else.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {jobsQuery.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : offers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nothing waiting on you right now.</p>
              ) : (
                offers.map((j) => {
                  const left = minutesLeft(j.awaiting_response_since);
                  return (
                    <div key={j.id} className="p-4 rounded-lg border border-[#4FC3E8]/30 bg-[#4FC3E8]/5 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">
                            {j.category}{j.sub_service ? ` · ${j.sub_service}` : ''}
                          </p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {j.address || 'No address provided'}{j.state ? `, ${j.state}` : ''}
                          </p>
                          {j.scheduled_at && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(j.scheduled_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          {j.price != null && <p className="font-semibold">${Number(j.price).toFixed(2)}</p>}
                          {left != null && (
                            <p className="text-xs text-muted-foreground">
                              {left > 0 ? `~${left} min left to respond` : 'expiring now'}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => respond.mutate({ jobId: j.id, accept: true })}
                          disabled={respond.isPending}
                        >
                          <Check className="h-4 w-4 mr-1" /> Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => respond.mutate({ jobId: j.id, accept: false })}
                          disabled={respond.isPending}
                        >
                          <X className="h-4 w-4 mr-1" /> Decline
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Confirmed & in progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {active.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No confirmed jobs yet.</p>
              ) : (
                active.map((j) => (
                  <div key={j.id} className="p-3 rounded-lg border flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{j.category}{j.sub_service ? ` · ${j.sub_service}` : ''}</p>
                      <p className="text-sm text-muted-foreground">
                        {j.address || 'No address provided'}
                        {j.scheduled_at ? ` · ${new Date(j.scheduled_at).toLocaleString()}` : ''}
                      </p>
                    </div>
                    <Badge variant="outline">{j.status === 'matched' ? 'Confirmed' : 'In progress'}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}

      {jobsQuery.error && (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="p-4 text-sm text-destructive">{(jobsQuery.error as Error).message}</CardContent>
        </Card>
      )}
    </div>
  );
}
