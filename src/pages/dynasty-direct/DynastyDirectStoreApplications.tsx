import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, X, Mail, Phone, MapPin, Loader2, Store } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

type Status = 'pending' | 'approved' | 'invited' | 'rejected';
interface Application {
  id: string;
  business_name: string;
  contact_name: string | null;
  email: string;
  phone: string | null;
  store_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  ein: string | null;
  notes: string | null;
  status: Status;
  rejection_reason: string | null;
  invite_id: string | null;
  created_at: string;
  reviewed_at: string | null;
}

const STATUS_STYLES: Record<Status, string> = {
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  approved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  invited: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
};

export default function DynastyDirectStoreApplications() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Status | 'all'>('pending');
  const [rejecting, setRejecting] = useState<Application | null>(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ['dd-store-applications', tab],
    queryFn: async () => {
      let q = supabase
        .from('store_applications' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (tab !== 'all') q = q.eq('status', tab);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Application[];
    },
  });

  const counts = useQuery({
    queryKey: ['dd-store-applications-counts'],
    queryFn: async () => {
      const { data } = await supabase.from('store_applications' as any).select('status');
      const rows = ((data ?? []) as unknown) as Array<{ status: Status }>;
      return {
        pending: rows.filter((r) => r.status === 'pending').length,
        invited: rows.filter((r) => r.status === 'invited' || r.status === 'approved').length,
        rejected: rows.filter((r) => r.status === 'rejected').length,
        all: rows.length,
      };
    },
  });

  async function approve(app: Application) {
    setBusyId(app.id);
    try {
      const { data, error } = await supabase.rpc('approve_store_application' as any, {
        p_application_id: app.id,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const token = row?.invite_token;

      // Fire the universal send-invite (SMS + email) — same pattern as InviteButton.
      const { error: sendErr } = await supabase.functions.invoke('send-invite', {
        body: {
          token,
          role: 'store',
          channel: app.phone ? 'both' : 'email',
          to_email: app.email,
          to_phone: app.phone,
          name: app.contact_name || app.business_name,
        },
      });
      if (sendErr) console.warn('send-invite warning', sendErr);

      toast.success(`${app.business_name} approved · invite sent`);
      qc.invalidateQueries({ queryKey: ['dd-store-applications'] });
      qc.invalidateQueries({ queryKey: ['dd-store-applications-counts'] });
    } catch (e: any) {
      toast.error(e.message || 'Approval failed');
    } finally {
      setBusyId(null);
    }
  }

  async function reject() {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    try {
      const { error } = await supabase.rpc('reject_store_application' as any, {
        p_application_id: rejecting.id,
        p_reason: reason || 'No reason provided',
      });
      if (error) throw error;
      toast.success('Application rejected');
      setRejecting(null);
      setReason('');
      qc.invalidateQueries({ queryKey: ['dd-store-applications'] });
      qc.invalidateQueries({ queryKey: ['dd-store-applications-counts'] });
    } catch (e: any) {
      toast.error(e.message || 'Rejection failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dynasty-direct')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Hub
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Store className="h-6 w-6" /> Apply-as-Store · Approval Queue
            </h1>
            <p className="text-sm text-muted-foreground">
              Review applications, approve to grant the store role and fire a signup invite.
            </p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="pending">
              Pending {counts.data ? `(${counts.data.pending})` : ''}
            </TabsTrigger>
            <TabsTrigger value="invited">
              Approved {counts.data ? `(${counts.data.invited})` : ''}
            </TabsTrigger>
            <TabsTrigger value="rejected">
              Rejected {counts.data ? `(${counts.data.rejected})` : ''}
            </TabsTrigger>
            <TabsTrigger value="all">All {counts.data ? `(${counts.data.all})` : ''}</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4 space-y-3">
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {!isLoading && apps.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No applications in this view.
                </CardContent>
              </Card>
            )}
            {apps.map((app) => (
              <Card key={app.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg">{app.business_name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {app.contact_name || '—'} · {format(new Date(app.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <Badge variant="outline" className={STATUS_STYLES[app.status]}>
                      {app.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {app.email}
                    </div>
                    {app.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {app.phone}
                      </div>
                    )}
                    {(app.store_address || app.city) && (
                      <div className="flex items-center gap-2 md:col-span-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {[app.store_address, app.city, app.state, app.zip].filter(Boolean).join(', ')}
                      </div>
                    )}
                    {app.ein && <div className="text-muted-foreground">EIN: {app.ein}</div>}
                  </div>
                  {app.notes && (
                    <p className="text-sm bg-muted/40 rounded p-3">{app.notes}</p>
                  )}
                  {app.rejection_reason && (
                    <p className="text-sm text-red-400">Rejected: {app.rejection_reason}</p>
                  )}

                  {app.status === 'pending' && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => approve(app)}
                        disabled={busyId === app.id}
                      >
                        {busyId === app.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Check className="h-4 w-4 mr-1" />
                        )}
                        Approve & Send Invite
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRejecting(app)}
                        disabled={busyId === app.id}
                      >
                        <X className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                  {app.status === 'rejected' && (
                    <Button size="sm" variant="outline" onClick={() => approve(app)} disabled={busyId === app.id}>
                      Reconsider & Approve
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>

        <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject {rejecting?.business_name}</DialogTitle>
            </DialogHeader>
            <Textarea
              placeholder="Reason (shared internally; visible to applicant if surfaced)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRejecting(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={reject} disabled={busyId === rejecting?.id}>
                {busyId === rejecting?.id && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Confirm Reject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
