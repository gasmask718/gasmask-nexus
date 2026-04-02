import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ClipboardList, Plus, TrendingUp, CheckCircle2, XCircle, Loader2, Sparkles } from 'lucide-react';

const STATUSES = ['Preparing', 'Applied', 'Under Review', 'Approved', 'Denied', 'Counter Offer'] as const;
const PRODUCT_TYPES = ['personal loan', 'business loan', 'credit line', 'credit card', 'auto loan', 'SBA loan', 'equipment financing'];

export default function ApplicationsPage() {
  const queryClient = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({ client_id: '', lender_name: '', product_type: '', requested_amount: '' });
  const [editingApp, setEditingApp] = useState<any>(null);
  const [remediating, setRemediating] = useState<string | null>(null);

  const { data: clients = [] } = useQuery({
    queryKey: ['funding-clients-list'],
    queryFn: async () => {
      const { data } = await supabase.from('funding_clients').select('id, first_name, last_name');
      return data || [];
    },
  });

  const { data: applications = [] } = useQuery({
    queryKey: ['funding-applications'],
    queryFn: async () => {
      const { data } = await supabase.from('funding_applications').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const createApp = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('funding_applications').insert({
        client_id: form.client_id,
        lender_name: form.lender_name,
        product_type: form.product_type,
        requested_amount: parseFloat(form.requested_amount) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funding-applications'] });
      setNewOpen(false);
      setForm({ client_id: '', lender_name: '', product_type: '', requested_amount: '' });
      toast.success('Application created');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateApp = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase.from('funding_applications').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funding-applications'] });
      toast.success('Application updated');
    },
  });

  const runRemediation = async (app: any) => {
    setRemediating(app.id);
    try {
      const { data: scores } = await supabase.from('funding_dfs_scores').select('*').eq('client_id', app.client_id).order('scored_at', { ascending: false }).limit(1);
      const { data, error } = await supabase.functions.invoke('funding-ai-agent', {
        body: {
          action: 'generate_denial_remediation',
          lender_name: app.lender_name,
          product_type: app.product_type,
          denial_reason: app.denial_reason,
          scores: scores?.[0] || {},
        },
      });
      if (error) throw error;
      await supabase.from('funding_applications').update({ remediation_plan: data.remediation || data.raw || '' }).eq('id', app.id);
      queryClient.invalidateQueries({ queryKey: ['funding-applications'] });
      toast.success('Remediation plan generated');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRemediating(null);
    }
  };

  const getClientName = (id: string) => {
    const c = clients.find((c: any) => c.id === id);
    return c ? `${c.first_name} ${c.last_name}` : 'Unknown';
  };

  const approvedTotal = applications.filter(a => a.status === 'Approved').reduce((s, a) => s + (Number(a.approved_amount) || 0), 0);
  const approvalRate = applications.length > 0 ? Math.round((applications.filter(a => a.status === 'Approved').length / applications.length) * 100) : 0;
  const avgDays = (() => {
    const decided = applications.filter(a => a.decision_date && a.application_date);
    if (!decided.length) return 0;
    return Math.round(decided.reduce((s, a) => s + Math.abs(new Date(a.decision_date!).getTime() - new Date(a.application_date).getTime()) / 86400000, 0) / decided.length);
  })();

  return (
    <div className="p-6 space-y-6 max-w-[1800px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-amber-400 flex items-center gap-2">
            <ClipboardList className="h-8 w-8" /> Applications Pipeline
          </h1>
          <p className="text-muted-foreground">Track lending applications from preparation to funding</p>
        </div>
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild>
            <Button className="bg-amber-600 hover:bg-amber-700"><Plus className="h-4 w-4 mr-2" /> New Application</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Application</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Lender Name" value={form.lender_name} onChange={e => setForm(f => ({ ...f, lender_name: e.target.value }))} />
              <Select value={form.product_type} onValueChange={v => setForm(f => ({ ...f, product_type: v }))}>
                <SelectTrigger><SelectValue placeholder="Product Type" /></SelectTrigger>
                <SelectContent>{PRODUCT_TYPES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Requested Amount" type="number" value={form.requested_amount} onChange={e => setForm(f => ({ ...f, requested_amount: e.target.value }))} />
              <Button onClick={() => createApp.mutate()} disabled={!form.client_id || !form.lender_name} className="w-full bg-amber-600 hover:bg-amber-700">Create Application</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-amber-500/20"><CardContent className="p-4 text-center"><div className="text-xs text-muted-foreground">Total Applications</div><div className="text-3xl font-black text-amber-400">{applications.length}</div></CardContent></Card>
        <Card className="border-emerald-500/20"><CardContent className="p-4 text-center"><div className="text-xs text-muted-foreground">Total Approved</div><div className="text-3xl font-black text-emerald-400">${approvedTotal.toLocaleString()}</div></CardContent></Card>
        <Card className="border-blue-500/20"><CardContent className="p-4 text-center"><div className="text-xs text-muted-foreground">Approval Rate</div><div className="text-3xl font-black text-blue-400">{approvalRate}%</div></CardContent></Card>
        <Card className="border-purple-500/20"><CardContent className="p-4 text-center"><div className="text-xs text-muted-foreground">Avg Days to Decision</div><div className="text-3xl font-black text-purple-400">{avgDays}</div></CardContent></Card>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUSES.map(status => {
          const cards = applications.filter(a => a.status === status);
          return (
            <div key={status} className="min-w-[280px] flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm">{status}</h3>
                <Badge variant="outline" className="text-xs">{cards.length}</Badge>
              </div>
              <div className="space-y-3">
                {cards.map(app => {
                  const daysSince = Math.round((Date.now() - new Date(app.application_date).getTime()) / 86400000);
                  return (
                    <Card key={app.id} className="border-border hover:border-amber-500/50 transition-all">
                      <CardContent className="p-3 space-y-2">
                        <div className="font-bold text-sm">{app.lender_name}</div>
                        <div className="text-xs text-muted-foreground">{getClientName(app.client_id)}</div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">{app.product_type}</Badge>
                          <span className="text-xs text-muted-foreground">{daysSince}d</span>
                        </div>
                        <div className="text-sm font-semibold">${Number(app.requested_amount).toLocaleString()}</div>

                        {status === 'Approved' && app.approved_amount && (
                          <div className="text-sm text-emerald-400 font-bold">
                            Approved: ${Number(app.approved_amount).toLocaleString()}
                            {app.apr && <span className="text-xs text-muted-foreground ml-1">@ {app.apr}%</span>}
                          </div>
                        )}
                        {status === 'Denied' && app.denial_reason && (
                          <div className="text-xs text-red-400 truncate">{app.denial_reason}</div>
                        )}
                        {status === 'Counter Offer' && app.approved_amount && (
                          <div className="text-xs">
                            <span className="text-amber-400">${Number(app.approved_amount).toLocaleString()}</span>
                            <span className="text-muted-foreground"> vs </span>
                            <span>${Number(app.requested_amount).toLocaleString()}</span>
                          </div>
                        )}

                        {/* Status changer */}
                        <Select value={app.status} onValueChange={v => {
                          const updates: any = { status: v };
                          if (v === 'Approved' || v === 'Denied' || v === 'Counter Offer') {
                            updates.decision_date = new Date().toISOString().split('T')[0];
                          }
                          if (v === 'Approved' || v === 'Denied' || v === 'Counter Offer') {
                            setEditingApp({ ...app, ...updates });
                          } else {
                            updateApp.mutate({ id: app.id, updates });
                          }
                        }}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>

                        {status === 'Denied' && (
                          <Button size="sm" variant="outline" className="w-full text-xs border-amber-500/30 text-amber-400"
                            disabled={remediating === app.id}
                            onClick={() => runRemediation(app)}>
                            {remediating === app.id ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Generating...</> : <><Sparkles className="h-3 w-3 mr-1" /> AI Remediation</>}
                          </Button>
                        )}

                        {app.remediation_plan && (
                          <div className="text-xs p-2 rounded bg-amber-500/10 border border-amber-500/20 whitespace-pre-wrap max-h-32 overflow-y-auto">
                            {app.remediation_plan}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Modal for status changes requiring extra fields */}
      {editingApp && (
        <Dialog open={!!editingApp} onOpenChange={() => setEditingApp(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Update — {editingApp.lender_name}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {(editingApp.status === 'Approved' || editingApp.status === 'Counter Offer') && (
                <>
                  <Input placeholder="Approved Amount" type="number" value={editingApp.approved_amount || ''} onChange={e => setEditingApp((a: any) => ({ ...a, approved_amount: e.target.value }))} />
                  <Input placeholder="APR %" type="number" step="0.01" value={editingApp.apr || ''} onChange={e => setEditingApp((a: any) => ({ ...a, apr: e.target.value }))} />
                  <Input placeholder="Monthly Payment" type="number" value={editingApp.monthly_payment || ''} onChange={e => setEditingApp((a: any) => ({ ...a, monthly_payment: e.target.value }))} />
                  <Input placeholder="Term (months)" type="number" value={editingApp.term_months || ''} onChange={e => setEditingApp((a: any) => ({ ...a, term_months: e.target.value }))} />
                </>
              )}
              {editingApp.status === 'Denied' && (
                <Textarea placeholder="Denial Reason" value={editingApp.denial_reason || ''} onChange={e => setEditingApp((a: any) => ({ ...a, denial_reason: e.target.value }))} />
              )}
              <Button className="w-full bg-amber-600 hover:bg-amber-700" onClick={() => {
                const { id, ...updates } = editingApp;
                delete updates.created_at;
                updateApp.mutate({ id, updates });
                setEditingApp(null);
              }}>Save Changes</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
