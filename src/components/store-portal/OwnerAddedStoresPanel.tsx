import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/** Owner-only: stores that portal owners added (or asked to link) waiting for approval. */
export function OwnerAddedStoresPanel() {
  const qc = useQueryClient();
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['store-portal-owner-pending-stores'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('store_portal_owner_pending_stores');
      if (error) throw error;
      return data as any[];
    },
  });
  const review = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = await (supabase as any).rpc('store_portal_owner_review_store', { p_store_id: id, p_approve: approve, p_note: null });
      if (error) throw error;
      return approve;
    },
    onSuccess: (approve) => {
      toast.success(approve ? 'Approved — the owner can order for it now' : 'Rejected (record kept)');
      qc.invalidateQueries({ queryKey: ['store-portal-owner-pending-stores'] });
    },
    onError: (e: any) => toast.error(e.message || String(e)),
  });
  if (!isLoading && !error && data.length === 0) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Stores added by owners — waiting for your OK ({data.length})</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
        {error && <p className="text-sm text-destructive">{(error as any).message}</p>}
        {data.map((s) => (
          <div key={s.store_id} className="space-y-2 rounded-xl border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/stores/${s.store_id}`} className="font-semibold underline-offset-2 hover:underline">{s.store_name}</Link>
              <Badge variant="secondary">{s.kind === 'new_store' ? 'New store' : 'Existing store — link to owner'}</Badge>
              {s.is_portal_test && <Badge variant="outline">TEST</Badge>}
            </div>
            <div className="text-sm text-muted-foreground">{[s.address, s.city, s.state, s.zip].filter(Boolean).join(', ')}{s.phone ? ` · ${s.phone}` : ''}</div>
            <div className="text-xs text-muted-foreground">From owner of {s.requested_by_store ?? 'a portal store'} · {s.requested_at ? format(new Date(s.requested_at), 'MMM d, h:mma') : ''}</div>
            <div className="grid grid-cols-2 gap-2">
              <Button className="h-11" disabled={review.isPending} onClick={() => review.mutate({ id: s.store_id, approve: true })}>Approve</Button>
              <Button className="h-11" variant="outline" disabled={review.isPending} onClick={() => review.mutate({ id: s.store_id, approve: false })}>Reject</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
