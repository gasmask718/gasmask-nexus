import { useMemo, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UserPlus, Users, History } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { verifiedUpdate, mutationErrorMessage } from '@/lib/verifiedMutation';
import type { ICWCandidateLead } from '@/lib/icw/candidateIngestion';
import type { ICWIngestionRun } from '@/lib/icw/ingestionRuns';

const STATUS_FLOW = ['candidate', 'reviewing', 'qualified', 'rejected'] as const;

const statusClass = (s: string) =>
  s === 'converted'
    ? 'bg-[#3C9F40]/10 text-[#3C9F40] border-[#3C9F40]/20'
    : s === 'qualified'
      ? 'bg-[#B4D334]/10 text-[#B4D334] border-[#B4D334]/20'
      : s === 'rejected'
        ? 'bg-destructive/10 text-destructive border-destructive/20'
        : 'bg-[#4FC3E8]/10 text-[#4FC3E8] border-[#4FC3E8]/20';

export default function ICWCandidateQueue() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  const { data: candidates, isLoading, error } = useQuery({
    queryKey: ['icw-candidate-leads'],
    queryFn: async (): Promise<ICWCandidateLead[]> => {
      const { data, error } = await supabase
        .from('icw_candidate_leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ICWCandidateLead[];
    },
  });

  const { data: runs } = useQuery({
    queryKey: ['icw-ingestion-runs'],
    queryFn: async (): Promise<ICWIngestionRun[]> => {
      const { data, error } = await supabase
        .from('icw_ingestion_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as unknown as ICWIngestionRun[];
    },
  });

  const setStatusMut = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: string }) => {
      await verifiedUpdate('update ICW candidate status', () =>
        supabase
          .from('icw_candidate_leads')
          .update({ status: next, updated_at: new Date().toISOString() } as never)
          .eq('id', id),
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['icw-candidate-leads'] });
      toast.success('Status updated');
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });

  const promote = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('icw_promote_to_worker', {
        _source: 'candidate',
        _record_id: id,
      });
      if (error) throw error;
      return data as { worker_id: string; action: string };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['icw-candidate-leads'] });
      qc.invalidateQueries({ queryKey: ['icw-workers'] });
      qc.invalidateQueries({ queryKey: ['icw-command-metrics'] });
      toast.success(
        res.action === 'worker_created'
          ? 'Worker record created'
          : res.action === 'linked_existing_worker'
            ? 'Linked to the existing worker with the same phone/email'
            : 'Already promoted — same worker',
      );
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (candidates ?? []).filter((c) => {
      if (status !== 'all' && c.status !== status) return false;
      if (
        q &&
        ![c.full_name, c.phone, c.email, c.city, c.state, c.region, c.country, c.source_platform, ...(c.category_groups ?? [])]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      )
        return false;
      return true;
    });
  }, [candidates, status, search]);

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-[#4FC3E8] to-[#B4D334] bg-clip-text text-transparent">
          ICW Applicants
        </h1>
        <p className="text-muted-foreground mt-1">
          Applicant → review → qualified → worker · one person, one worker record · no outreach
        </p>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="p-4 text-sm text-destructive">{(error as Error).message}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="gap-4">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#4FC3E8]" />
            Applicants
            <Badge variant="outline" className="ml-2">{filtered.length}</Badge>
          </CardTitle>
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Search name, phone, city…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64"
            />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {[...STATUS_FLOW, 'converted'].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground p-6">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading applicants…
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">No applicants match.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    {['Name', 'Contact', 'Location', 'Categories', 'Source', 'Status', 'Action'].map((h) => (
                      <th key={h} className="text-left p-3 text-sm font-medium text-muted-foreground whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-b border-border/30 hover:bg-muted/30">
                      <td className="p-3 font-medium">{c.full_name || '—'}</td>
                      <td className="p-3 text-sm text-muted-foreground">
                        <div>{c.phone || '—'}</div>
                        <div>{c.email || ''}</div>
                      </td>
                      <td className="p-3 text-sm">
                        <div>{[c.city, c.region || c.state].filter(Boolean).join(', ') || '—'}</div>
                        <div className="text-xs text-muted-foreground">{c.country || ''}</div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {(c.category_groups ?? []).map((g) => (
                            <Badge key={g} variant="outline" className="bg-[#4FC3E8]/10 text-[#4FC3E8] border-[#4FC3E8]/20">
                              {g}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-sm">{c.source_platform || '—'}</td>
                      <td className="p-3">
                        <Badge variant="outline" className={statusClass(c.status)}>{c.status}</Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Select
                            value={c.status}
                            onValueChange={(next) => setStatusMut.mutate({ id: c.id, next })}
                          >
                            <SelectTrigger className="w-32 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_FLOW.map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                              {c.status === 'converted' && <SelectItem value="converted">converted</SelectItem>}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              promote.isPending ||
                              Boolean(c.converted_worker_id) ||
                              c.status !== 'qualified'
                            }
                            onClick={() => promote.mutate(c.id)}
                            title={
                              c.converted_worker_id
                                ? 'Already a worker'
                                : c.status !== 'qualified'
                                  ? 'Mark qualified first'
                                  : 'Create the worker record'
                            }
                          >
                            {promote.isPending && promote.variables === c.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <UserPlus className="h-4 w-4 mr-1" /> Worker
                              </>
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-[#B4D334]" />
            Recent ingestion runs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(runs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center">
              No ingestion runs recorded yet. Runs appear here as soon as an ingest batch is executed.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    {['Started', 'Source', 'Query', 'Geography', 'Raw', 'New', 'Duplicates', 'Outcome'].map((h) => (
                      <th key={h} className="text-left p-3 text-sm font-medium text-muted-foreground whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(runs ?? []).map((r) => (
                    <tr key={r.id} className="border-b border-border/30">
                      <td className="p-3 text-sm">{r.started_at ? new Date(r.started_at).toLocaleString() : '—'}</td>
                      <td className="p-3 text-sm">{r.source || '—'}</td>
                      <td className="p-3 text-sm">{r.query_term || '—'}</td>
                      <td className="p-3 text-sm">{r.geography || '—'}</td>
                      <td className="p-3 text-sm">{r.raw_result_count}</td>
                      <td className="p-3 text-sm">{r.new_lead_count}</td>
                      <td className="p-3 text-sm">{r.duplicate_count}</td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={
                            r.outcome === 'failed'
                              ? 'bg-destructive/10 text-destructive border-destructive/20'
                              : r.outcome === 'success'
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          }
                        >
                          {r.outcome || '—'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
