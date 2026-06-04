import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, X, Mail, Phone, MapPin, Loader2, Store, CheckSquare, Square, Sparkles, Globe, FileBadge } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { DDAlertBar } from '@/components/dynasty-direct/DDAlertBar';
import { DDBulkBar } from '@/components/dynasty-direct/DDBulkBar';
import { AI_OPS } from '@/lib/dynastyDirect/aiOps';

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
  website: string | null;
  notes: string | null;
  status: Status;
  rejection_reason: string | null;
  invite_id: string | null;
  created_at: string;
  reviewed_at: string | null;
  triage_score: number | null;
  triage_summary: string | null;
  triage_signals: any;
  triage_model: string | null;
  triaged_at: string | null;
}

const STATUS_STYLES: Record<Status, string> = {
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  approved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  invited: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
};

function triageBadgeClass(score: number | null) {
  if (score == null) return 'bg-muted text-muted-foreground border-border';
  if (score >= AI_OPS.triage.legitGreen) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (score >= AI_OPS.triage.legitAmber) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  return 'bg-red-500/15 text-red-400 border-red-500/30';
}

export default function DynastyDirectStoreApplications() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Status | 'all'>('pending');
  const [rejecting, setRejecting] = useState<Application | null>(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkReason, setBulkReason] = useState('');

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ['dd-store-applications', tab],
    queryFn: async () => {
      let q = supabase
        .from('store_applications' as any)
        .select('*');
      if (tab !== 'all') q = q.eq('status', tab);
      // Pending: highest score first, then newest. Other tabs: newest first.
      if (tab === 'pending') {
        q = q.order('triage_score', { ascending: false, nullsFirst: false })
             .order('created_at', { ascending: false });
      } else {
        q = q.order('created_at', { ascending: false });
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Application[];
    },
  });

  // Auto-triage any pending application with no score yet.
  const [triagingId, setTriagingId] = useState<string | null>(null);
  useEffect(() => {
    if (!AI_OPS.triage.autoTriageOnLoad) return;
    const ungraded = apps.filter((a) => a.status === 'pending' && a.triage_score == null);
    if (ungraded.length === 0) return;
    (async () => {
      for (const a of ungraded.slice(0, 5)) {  // cap per render
        try {
          setTriagingId(a.id);
          await supabase.functions.invoke('dd-application-triage', { body: { application_id: a.id } });
        } catch (e) { console.warn('[auto-triage]', a.id, e); }
      }
      setTriagingId(null);
      qc.invalidateQueries({ queryKey: ['dd-store-applications', tab] });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apps.map((a) => a.id).join(','), tab]);

  async function triageOne(id: string) {
    setTriagingId(id);
    try {
      const { error } = await supabase.functions.invoke('dd-application-triage', { body: { application_id: id } });
      if (error) throw error;
      toast.success('Triaged');
      qc.invalidateQueries({ queryKey: ['dd-store-applications', tab] });
    } catch (e: any) {
      toast.error(e.message || 'Triage failed');
    } finally {
      setTriagingId(null);
    }
  }

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

  // ── Bulk operations ────────────────────────────────────────────────
  const pendingApps = useMemo(() => apps.filter((a) => a.status === 'pending'), [apps]);
  const selectedApps = useMemo(
    () => pendingApps.filter((a) => selectedIds.has(a.id)),
    [pendingApps, selectedIds],
  );
  const allSelected =
    pendingApps.length > 0 && pendingApps.every((a) => selectedIds.has(a.id));

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(pendingApps.map((a) => a.id)));
  }

  async function bulkApprove() {
    if (selectedApps.length === 0) return;
    setBulkBusy('approve');
    let ok = 0, failed = 0;
    for (const app of selectedApps) {
      try {
        const { data, error } = await supabase.rpc('approve_store_application' as any, {
          p_application_id: app.id,
        });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        const token = row?.invite_token;
        await supabase.functions.invoke('send-invite', {
          body: {
            token, role: 'store',
            channel: app.phone ? 'both' : 'email',
            to_email: app.email, to_phone: app.phone,
            name: app.contact_name || app.business_name,
          },
        });
        ok++;
      } catch (e) { console.error('[bulkApprove]', app.id, e); failed++; }
    }
    toast.success(`Bulk approved: ${ok} ok, ${failed} failed`);
    setSelectedIds(new Set());
    setBulkBusy(null);
    qc.invalidateQueries({ queryKey: ['dd-store-applications'] });
    qc.invalidateQueries({ queryKey: ['dd-store-applications-counts'] });
  }

  async function bulkReject() {
    if (selectedApps.length === 0) return;
    setBulkBusy('reject');
    let ok = 0, failed = 0;
    for (const app of selectedApps) {
      try {
        const { error } = await supabase.rpc('reject_store_application' as any, {
          p_application_id: app.id,
          p_reason: bulkReason || 'Bulk rejection',
        });
        if (error) throw error;
        ok++;
      } catch (e) { console.error('[bulkReject]', app.id, e); failed++; }
    }
    toast.success(`Bulk rejected: ${ok} ok, ${failed} failed`);
    setSelectedIds(new Set());
    setBulkReason('');
    setBulkRejectOpen(false);
    setBulkBusy(null);
    qc.invalidateQueries({ queryKey: ['dd-store-applications'] });
    qc.invalidateQueries({ queryKey: ['dd-store-applications-counts'] });
  }



  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <DDAlertBar />
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
            {tab === 'pending' && pendingApps.length > 0 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <button
                  onClick={toggleAll}
                  className="inline-flex items-center gap-1.5 hover:text-foreground"
                >
                  {allSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                  {allSelected ? 'Clear selection' : `Select all ${pendingApps.length}`}
                </button>
                <DDBulkBar
                  count={selectedIds.size}
                  total={pendingApps.length}
                  onClear={() => setSelectedIds(new Set())}
                  busy={bulkBusy}
                  actions={[
                    { key: 'approve', label: 'Approve + invite', icon: Check, variant: 'default', onRun: bulkApprove },
                    { key: 'reject',  label: 'Reject…',          icon: X,     variant: 'destructive', onRun: () => setBulkRejectOpen(true) },
                  ]}
                />
              </div>
            )}
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
            {apps.map((app) => {
              const isSelected = selectedIds.has(app.id);
              return (
              <Card key={app.id} className={isSelected ? 'ring-2 ring-primary' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      {app.status === 'pending' && (
                        <button
                          onClick={() => toggleOne(app.id)}
                          className="mt-1 text-muted-foreground hover:text-foreground"
                          aria-label={isSelected ? 'Deselect' : 'Select'}
                        >
                          {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                        </button>
                      )}
                      <div>
                        <CardTitle className="text-lg">{app.business_name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {app.contact_name || '—'} · {format(new Date(app.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {app.triage_score != null && (
                        <Badge variant="outline" className={triageBadgeClass(app.triage_score)}>
                          <Sparkles className="h-3 w-3 mr-1" />
                          {app.triage_score}
                        </Badge>
                      )}
                      <Badge variant="outline" className={STATUS_STYLES[app.status]}>
                        {app.status}
                      </Badge>
                    </div>
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
                  {app.ein && <div className="text-xs text-muted-foreground flex items-center gap-1"><FileBadge className="h-3 w-3" /> EIN: {app.ein}</div>}
                  </div>
                  {app.website && (
                    <div className="text-xs flex items-center gap-1.5">
                      <Globe className="h-3 w-3 text-muted-foreground" />
                      <a href={app.website.startsWith('http') ? app.website : `https://${app.website}`} target="_blank" rel="noreferrer" className="hover:underline text-primary">{app.website}</a>
                    </div>
                  )}

                  {(app.triage_summary || app.status === 'pending') && (
                    <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Sparkles className="h-3 w-3 text-primary" /> AI triage
                          {app.triage_model && <span className="text-muted-foreground font-normal">· {app.triage_model.split('/').pop()}</span>}
                        </span>
                        {app.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[11px]"
                            disabled={triagingId === app.id}
                            onClick={() => triageOne(app.id)}
                          >
                            {triagingId === app.id ? <Loader2 className="h-3 w-3 animate-spin" /> : app.triage_score == null ? 'Triage now' : 'Re-triage'}
                          </Button>
                        )}
                      </div>
                      {app.triage_summary && <p className="text-muted-foreground">{app.triage_summary}</p>}
                      {Array.isArray(app.triage_signals?.ai_flags) && app.triage_signals.ai_flags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {app.triage_signals.ai_flags.map((f: string, i: number) => (
                            <span key={i} className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 text-[10px]">⚠ {f}</span>
                          ))}
                        </div>
                      )}
                      {Array.isArray(app.triage_signals?.ai_positive) && app.triage_signals.ai_positive.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {app.triage_signals.ai_positive.map((f: string, i: number) => (
                            <span key={i} className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px]">✓ {f}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

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
              );
            })}
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

        <Dialog open={bulkRejectOpen} onOpenChange={setBulkRejectOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject {selectedApps.length} application{selectedApps.length === 1 ? '' : 's'}</DialogTitle>
            </DialogHeader>
            <Textarea
              placeholder="Shared reason for this batch (applied to every selected application)"
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setBulkRejectOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={bulkReject} disabled={bulkBusy === 'reject'}>
                {bulkBusy === 'reject' && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Reject {selectedApps.length}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

