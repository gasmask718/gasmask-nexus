/**
 * BrandaroLeadProfile — Individual Brandaro client/lead profile with:
 * - Overview
 * - Active Services & Products + Monthly Obligations
 * - Upsell Pipeline
 * - Invoices (with detail modal)
 * - AI Maintenance Coach actions
 */
import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import CRMLayout from '../CRMLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Loader2, Sparkles, Package, FileText, Target, Wrench,
  Plus, CheckCircle2, AlertTriangle,
} from 'lucide-react';

type Lead = any;
type Product = any;
type ClientProduct = any;
type Invoice = any;
type Upsell = any;
type Task = any;

const fmt = (n?: number | null) => `$${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_BADGE: Record<string, string> = {
  paid: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  sent: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  draft: 'bg-muted text-muted-foreground',
  overdue: 'bg-red-500/10 text-red-600 border-red-500/30',
  void: 'bg-zinc-500/10 text-zinc-600',
  refunded: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
};

export default function BrandaroLeadProfile() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [invoiceDetail, setInvoiceDetail] = useState<Invoice | null>(null);
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [coachLoading, setCoachLoading] = useState(false);

  const { data: lead, isLoading: leadLoading } = useQuery({
    queryKey: ['brandaro-lead', leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brandaro_leads_master')
        .select('*')
        .eq('id', leadId!)
        .maybeSingle();
      if (error) throw error;
      return data as Lead;
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ['brandaro-products-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brandaro_products')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: clientProducts = [] } = useQuery({
    queryKey: ['brandaro-client-products', leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brandaro_client_products')
        .select('*, product:brandaro_products(*)')
        .eq('lead_id', leadId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ClientProduct[];
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['brandaro-invoices', leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brandaro_client_invoices')
        .select('*')
        .eq('lead_id', leadId!)
        .order('issued_at', { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
  });

  const { data: invoiceItems = [] } = useQuery({
    queryKey: ['brandaro-invoice-items', invoiceDetail?.id],
    enabled: !!invoiceDetail?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brandaro_client_invoice_items')
        .select('*')
        .eq('invoice_id', invoiceDetail!.id);
      if (error) throw error;
      return data;
    },
  });

  const { data: upsells = [] } = useQuery({
    queryKey: ['brandaro-upsells', leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brandaro_upsell_opportunities')
        .select('*, product:brandaro_products(*)')
        .eq('lead_id', leadId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Upsell[];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['brandaro-tasks', leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brandaro_maintenance_tasks')
        .select('*')
        .eq('lead_id', leadId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Task[];
    },
  });

  const monthlyObligations = useMemo(() => {
    const out: { product: string; label: string; cadence: string }[] = [];
    for (const cp of clientProducts) {
      if (cp.status !== 'active') continue;
      const obligations = cp.product?.monthly_obligations ?? [];
      for (const o of obligations) {
        out.push({ product: cp.product?.name ?? 'Service', label: o.label, cadence: o.cadence });
      }
    }
    return out;
  }, [clientProducts]);

  const monthlyRecurring = useMemo(
    () =>
      clientProducts
        .filter((cp) => cp.status === 'active' && cp.product?.product_type === 'recurring')
        .reduce((sum, cp) => sum + Number(cp.price_override ?? cp.product?.price ?? 0), 0),
    [clientProducts]
  );

  const addService = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase.from('brandaro_client_products').insert({
        lead_id: leadId,
        product_id: productId,
        status: 'active',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brandaro-client-products', leadId] });
      setAddServiceOpen(false);
      setSelectedProductId('');
      toast({ title: 'Service added' });
    },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const updateUpsellStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { error } = await supabase
        .from('brandaro_upsell_opportunities')
        .update({ stage, responded_at: stage !== 'suggested' ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brandaro-upsells', leadId] }),
  });

  const completeTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('brandaro_maintenance_tasks')
        .update({ status: 'done', completed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brandaro-tasks', leadId] }),
  });

  const runAICoach = async () => {
    setCoachLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('brandaro-maintenance-coach', {
        body: { lead_id: leadId },
      });
      if (error) throw error;
      toast({
        title: 'AI Coach finished',
        description: `${data.tasks_created} tasks · ${data.upsells_created} upsells`,
      });
      queryClient.invalidateQueries({ queryKey: ['brandaro-tasks', leadId] });
      queryClient.invalidateQueries({ queryKey: ['brandaro-upsells', leadId] });
    } catch (e: any) {
      toast({ title: 'AI Coach failed', description: e.message, variant: 'destructive' });
    } finally {
      setCoachLoading(false);
    }
  };

  if (leadLoading) {
    return (
      <CRMLayout title="Loading...">
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>
      </CRMLayout>
    );
  }

  if (!lead) {
    return (
      <CRMLayout title="Not found">
        <Card><CardContent className="py-12 text-center text-muted-foreground">Client not found</CardContent></Card>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout title={lead.business_name}>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/crm/brandaro')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {lead.business_name}
                {lead.status && <Badge variant="outline">{lead.status}</Badge>}
              </h1>
              <p className="text-sm text-muted-foreground">
                {[lead.industry, lead.location, lead.phone, lead.email].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <Button onClick={runAICoach} disabled={coachLoading}>
            {coachLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Run AI Maintenance Coach
          </Button>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi label="Active Services" value={clientProducts.filter((c) => c.status === 'active').length} icon={Package} />
          <Kpi label="MRR" value={fmt(monthlyRecurring)} icon={Target} />
          <Kpi label="Open Tasks" value={tasks.filter((t) => t.status !== 'done' && t.status !== 'dismissed').length} icon={Wrench} />
          <Kpi label="Open Upsells" value={upsells.filter((u) => u.stage === 'suggested' || u.stage === 'offered').length} icon={Sparkles} />
        </div>

        <Tabs defaultValue="services">
          <TabsList>
            <TabsTrigger value="services">Active Services</TabsTrigger>
            <TabsTrigger value="upsells">Upsell Pipeline</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="tasks">AI Tasks</TabsTrigger>
          </TabsList>

          {/* === SERVICES === */}
          <TabsContent value="services" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Active Products & Services</h3>
              <Button size="sm" onClick={() => setAddServiceOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Service
              </Button>
            </div>
            {clientProducts.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No active services yet.</CardContent></Card>
            ) : (
              <div className="grid gap-3">
                {clientProducts.map((cp) => (
                  <Card key={cp.id}>
                    <CardContent className="p-4 flex items-start justify-between gap-4">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {cp.product?.name ?? 'Unknown'}
                          <Badge variant="outline">{cp.status}</Badge>
                          <Badge variant="secondary">{cp.product?.product_type}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{cp.product?.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{fmt(cp.price_override ?? cp.product?.price)}</div>
                        <div className="text-xs text-muted-foreground">
                          {cp.product?.billing_interval ?? 'one-time'}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Card>
              <CardHeader><CardTitle className="text-base">Monthly Obligations We Owe</CardTitle></CardHeader>
              <CardContent>
                {monthlyObligations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recurring deliverables.</p>
                ) : (
                  <ul className="space-y-2">
                    {monthlyObligations.map((o, i) => (
                      <li key={i} className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0">
                        <span><span className="text-muted-foreground">[{o.product}]</span> {o.label}</span>
                        <Badge variant="outline">{o.cadence}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === UPSELLS === */}
          <TabsContent value="upsells" className="mt-4">
            <div className="grid md:grid-cols-3 gap-4">
              {(['suggested', 'offered', 'declined'] as const).map((stage) => {
                const items = upsells.filter((u) => u.stage === stage);
                return (
                  <Card key={stage}>
                    <CardHeader><CardTitle className="text-sm capitalize">{stage} ({items.length})</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {items.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nothing here yet.</p>
                      ) : items.map((u) => (
                        <div key={u.id} className="border border-border/60 rounded p-2 space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="font-medium text-sm">{u.product?.name ?? 'Service'}</div>
                            {u.estimated_value && <span className="text-xs">{fmt(u.estimated_value)}</span>}
                          </div>
                          {u.reasoning && <p className="text-xs text-muted-foreground line-clamp-3">{u.reasoning}</p>}
                          {u.ai_generated && <Badge variant="outline" className="text-[10px]">AI</Badge>}
                          <div className="flex gap-1 pt-1">
                            {stage === 'suggested' && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateUpsellStage.mutate({ id: u.id, stage: 'offered' })}>Mark Offered</Button>
                            )}
                            {stage === 'offered' && (
                              <>
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateUpsellStage.mutate({ id: u.id, stage: 'accepted' })}>Won</Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateUpsellStage.mutate({ id: u.id, stage: 'declined' })}>Declined</Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* === INVOICES === */}
          <TabsContent value="invoices" className="mt-4">
            {invoices.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No invoices yet.</CardContent></Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr className="text-left">
                        <th className="p-3">Invoice #</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Issued</th>
                        <th className="p-3">Due</th>
                        <th className="p-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="border-t border-border hover:bg-accent/40 cursor-pointer" onClick={() => setInvoiceDetail(inv)}>
                          <td className="p-3 font-mono text-xs">{inv.invoice_number}</td>
                          <td className="p-3"><Badge variant="outline" className={STATUS_BADGE[inv.status]}>{inv.status}</Badge></td>
                          <td className="p-3 text-muted-foreground">{new Date(inv.issued_at).toLocaleDateString()}</td>
                          <td className="p-3 text-muted-foreground">{inv.due_at ? new Date(inv.due_at).toLocaleDateString() : '—'}</td>
                          <td className="p-3 text-right font-semibold">{fmt(inv.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* === TASKS === */}
          <TabsContent value="tasks" className="mt-4 space-y-2">
            {tasks.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No tasks. Run the AI Coach to generate some.</CardContent></Card>
            ) : tasks.map((t) => (
              <Card key={t.id}>
                <CardContent className="p-4 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{t.title}</span>
                      <Badge variant="outline">{t.task_type}</Badge>
                      <Badge variant="outline" className={t.priority === 'urgent' ? 'border-red-500/40 text-red-600' : ''}>{t.priority}</Badge>
                      {t.ai_generated && <Badge variant="secondary">AI</Badge>}
                    </div>
                    {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                    {t.ai_reasoning && <p className="text-xs text-muted-foreground mt-1 italic">Reason: {t.ai_reasoning}</p>}
                  </div>
                  <div className="text-right space-y-1">
                    <Badge variant="outline">{t.status}</Badge>
                    {t.status !== 'done' && (
                      <Button size="sm" variant="outline" onClick={() => completeTask.mutate(t.id)}>
                        <CheckCircle2 className="h-3 w-3 mr-1" />Done
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      {/* Invoice detail modal */}
      <Dialog open={!!invoiceDetail} onOpenChange={(o) => !o && setInvoiceDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <FileText className="h-5 w-5" />
              {invoiceDetail?.invoice_number}
              {invoiceDetail && <Badge variant="outline" className={STATUS_BADGE[invoiceDetail.status]}>{invoiceDetail.status}</Badge>}
            </DialogTitle>
          </DialogHeader>
          {invoiceDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Issued:</span> {new Date(invoiceDetail.issued_at).toLocaleDateString()}</div>
                <div><span className="text-muted-foreground">Due:</span> {invoiceDetail.due_at ? new Date(invoiceDetail.due_at).toLocaleDateString() : '—'}</div>
                <div><span className="text-muted-foreground">Paid:</span> {invoiceDetail.paid_at ? new Date(invoiceDetail.paid_at).toLocaleDateString() : '—'}</div>
                <div><span className="text-muted-foreground">Currency:</span> {invoiceDetail.currency}</div>
              </div>
              <div className="border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr><th className="p-2">Description</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Unit</th><th className="p-2 text-right">Amount</th></tr>
                  </thead>
                  <tbody>
                    {invoiceItems.length === 0 ? (
                      <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">No line items.</td></tr>
                    ) : invoiceItems.map((it: any) => (
                      <tr key={it.id} className="border-t">
                        <td className="p-2">{it.description}</td>
                        <td className="p-2 text-right">{it.quantity}</td>
                        <td className="p-2 text-right">{fmt(it.unit_price)}</td>
                        <td className="p-2 text-right font-medium">{fmt(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end space-y-1 text-sm">
                <div className="text-right space-y-1">
                  <div><span className="text-muted-foreground mr-4">Subtotal:</span>{fmt(invoiceDetail.subtotal)}</div>
                  <div><span className="text-muted-foreground mr-4">Tax:</span>{fmt(invoiceDetail.tax)}</div>
                  <div className="text-base font-bold"><span className="mr-4">Total:</span>{fmt(invoiceDetail.total)}</div>
                  <div><span className="text-muted-foreground mr-4">Paid:</span>{fmt(invoiceDetail.amount_paid)}</div>
                </div>
              </div>
              {invoiceDetail.notes && <p className="text-sm text-muted-foreground border-t pt-2">{invoiceDetail.notes}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add service modal */}
      <Dialog open={addServiceOpen} onOpenChange={setAddServiceOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Service</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger><SelectValue placeholder="Choose a product..." /></SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {fmt(p.price)} {p.product_type === 'recurring' ? `/${p.billing_interval}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setAddServiceOpen(false)}>Cancel</Button>
              <Button disabled={!selectedProductId || addService.isPending} onClick={() => addService.mutate(selectedProductId)}>
                {addService.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Add
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Or browse the full catalogue on the <Link to="/products" className="underline">Products page</Link>.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </CRMLayout>
  );
}

function Kpi({ label, value, icon: Icon }: { label: string; value: any; icon: any }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-xl font-bold">{value}</div>
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}
