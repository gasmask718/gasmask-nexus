import { useContactVerification } from '@/components/store/ContactVerificationFlow';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquare, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { readFunctionError } from '@/lib/storePortal';

const fmt = (v?: string | null) => (v ? format(new Date(v), 'MMM d, h:mma') : '—');

/** "Portal" panel on the store profile: invite status, last sign-in, last inventory update + Text portal link. */
export function StorePortalStaffPanel({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const verification = useContactVerification(storeId);
  const verifiedContact = verification.data?.contacts.find(c => c.status === 'confirmed' && c.confirmed_at && !c.opted_out);
  const { data, isLoading, error } = useQuery({
    queryKey: ['store-portal-admin-panel', storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('store_portal_admin_panel', { p_store_id: storeId });
      if (error) throw error;
      return data as any;
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('text-store-portal-invite', { body: { store_id: storeId, contact_id: verifiedContact?.id } });
      if (error) throw new Error(await readFunctionError(error));
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success('Portal link texted to the store');
      qc.invalidateQueries({ queryKey: ['store-portal-admin-panel', storeId] });
    },
    onError: (e: any) => toast.error(e.message || String(e)),
  });

  if (isLoading) return <Card><CardContent className="pt-6"><Loader2 className="h-4 w-4 animate-spin" /></CardContent></Card>;
  if (error) return <Card><CardContent className="pt-6 text-sm text-destructive">{(error as any).message}</CardContent></Card>;

  const locked = !data.portal_live && !data.is_portal_test;

  return (
    <Card className="glass-card border-border/50">
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Store portal</div>
          {data.is_portal_test && <Badge variant="outline">Test store</Badge>}
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div><div className="text-muted-foreground">Invite</div><div className="capitalize">{data.invite_status ?? 'Never sent'}</div><div className="text-xs text-muted-foreground">{data.invite_sent_at ? `sent ${fmt(data.invite_sent_at)}` : ''}</div></div>
          <div><div className="text-muted-foreground">Last portal sign-in</div><div>{fmt(data.last_sign_in_at)}</div></div>
          <div><div className="text-muted-foreground">Last inventory update</div><div>{fmt(data.last_inventory_update_at)}</div></div>
          <div><div className="text-muted-foreground">Open delivery requests</div><div>{data.open_requests}</div></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => send.mutate()} disabled={locked || !verifiedContact || send.isPending}>
            {send.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
            {locked ? 'Portal not live yet' : !verifiedContact ? 'Verify contact first' : 'Text portal link'}
          </Button>
          <Button variant="outline" asChild>
            <Link to="/dispatch/pending-stops"><Truck className="mr-2 h-4 w-4" />Delivery Requests</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
