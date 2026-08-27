import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, UserCheck, UserX, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { verifiedUpdate, mutationErrorMessage } from '@/lib/verifiedMutation';

interface ICWWorker {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  state: string | null;
  category_groups: string[] | null;
  license_status: string;
  availability: string | null;
  approved: boolean;
}

export default function ICWWorkerRoster() {
  const qc = useQueryClient();

  const { data: workers, isLoading, error } = useQuery({
    queryKey: ['icw-workers'],
    queryFn: async (): Promise<ICWWorker[]> => {
      const { data, error } = await supabase
        .from('icw_workers')
        .select('id, full_name, email, phone, state, category_groups, license_status, availability, approved')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ICWWorker[];
    },
  });

  const setApproval = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      await verifiedUpdate(approved ? 'approve ICW worker' : 'reject ICW worker', () =>
        supabase.from('icw_workers').update({ approved }).eq('id', id),
      );
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['icw-workers'] });
      qc.invalidateQueries({ queryKey: ['icw-command-metrics'] });
      toast.success(vars.approved ? 'Worker approved' : 'Worker set to pending / rejected');
    },
    onError: (err) => toast.error(mutationErrorMessage(err)),
  });

  const pendingCount = (workers ?? []).filter((w) => !w.approved).length;

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[#4FC3E8] to-[#B4D334] bg-clip-text text-transparent">
            ICW Worker Roster
          </h1>
          <p className="text-muted-foreground mt-1">
            Reading directly from icw_workers · public-site applicant sync not wired yet
          </p>
        </div>
        <Badge variant="outline" className="border-amber-500/30 text-amber-500 bg-amber-500/10">
          {pendingCount} pending review
        </Badge>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="p-4 text-sm text-destructive">{(error as Error).message}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#4FC3E8]" />
            Workers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground p-6">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading roster…
            </div>
          ) : (workers ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">
              No workers yet. Applicants will appear here once the public-site sync is built.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    {['Name', 'Contact', 'State', 'Categories', 'License', 'Availability', 'Status', 'Action'].map((h) => (
                      <th key={h} className="text-left p-3 text-sm font-medium text-muted-foreground whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(workers ?? []).map((w) => (
                    <tr key={w.id} className="border-b border-border/30 hover:bg-muted/30">
                      <td className="p-3 font-medium">{w.full_name}</td>
                      <td className="p-3 text-sm text-muted-foreground">
                        <div>{w.email || '—'}</div>
                        <div>{w.phone || ''}</div>
                      </td>
                      <td className="p-3 text-sm">{w.state || '—'}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {(w.category_groups ?? []).length === 0 ? (
                            <span className="text-sm text-muted-foreground">—</span>
                          ) : (
                            (w.category_groups ?? []).map((c) => (
                              <Badge key={c} variant="outline" className="bg-[#4FC3E8]/10 text-[#4FC3E8] border-[#4FC3E8]/20">
                                {c}
                              </Badge>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-sm">{w.license_status}</td>
                      <td className="p-3 text-sm">{w.availability || '—'}</td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={
                            w.approved
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          }
                        >
                          {w.approved ? 'Approved' : 'Pending'}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Button
                          size="sm"
                          variant={w.approved ? 'outline' : 'default'}
                          disabled={setApproval.isPending}
                          onClick={() => setApproval.mutate({ id: w.id, approved: !w.approved })}
                        >
                          {setApproval.isPending && setApproval.variables?.id === w.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : w.approved ? (
                            <>
                              <UserX className="h-4 w-4 mr-1" /> Revoke
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-4 w-4 mr-1" /> Approve
                            </>
                          )}
                        </Button>
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
