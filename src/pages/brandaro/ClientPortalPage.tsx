import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Users, DollarSign, Rocket, Loader2, Plus, ChevronRight,
  ChevronLeft, Save, CheckCircle2, Circle,
} from 'lucide-react';
import { BuilderAssignControl } from '@/components/brandaro/BuilderAssignControl';

/* ------------------------------------------------------------------ */
/* Types — mirrors real brandaro_clients columns (Path A, no invents) */
/* ------------------------------------------------------------------ */
interface Client {
  id: string;
  business_name: string;
  owner_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  website_package: string | null;
  website_package_price: number | null;
  package_chosen: string | null;
  monthly_recurring: number | null;
  addon_services: any | null;
  client_status: string | null;
  onboarding_status: string | null;
  maintenance_status: string | null;
  assigned_builder: string | null;
  project_deadline: string | null;
  launched_at: string | null;
  portal_access_enabled: boolean | null;
  onboarding_checklist: any | null;
  qualified_lead_id: string | null;
  proposal_id: string | null;
  created_at: string;
}

interface QualifiedLead {
  id: string;
  business_name: string | null;
  pipeline_stage: string | null;
  lead_status: string | null;
}

const PACKAGE_OPTIONS = ['Starter', 'Professional', 'E-Commerce', 'Custom'];
const STATUS_TONE: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  onboarding: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  paused: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  cancelled: 'bg-red-500/15 text-red-500 border-red-500/30',
};

const statusBadge = (s: string | null | undefined) => {
  const key = (s || 'unknown').toLowerCase();
  return STATUS_TONE[key] || 'bg-muted text-muted-foreground border-border';
};

/* ------------------------------------------------------------------ */
/* Main page                                                          */
/* ------------------------------------------------------------------ */
export default function ClientPortalPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Client | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const fetchClients = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('brandaro_clients')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error(`Failed to load clients: ${error.message}`);
      setClients([]);
    } else {
      setClients((data as Client[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchClients(); }, []);

  const stats = useMemo(() => {
    const active = clients.filter(c => c.client_status === 'active');
    const mrr = active.reduce((s, c) => s + Number(c.monthly_recurring || 0), 0);
    const launched = clients.filter(c => !!c.launched_at).length;
    return {
      total: clients.length,
      active: active.length,
      mrr,
      launched,
    };
  }, [clients]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Client Portal</h1>
          <p className="text-sm text-muted-foreground">
            Manage active clients, packages, and recurring revenue
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add New Client
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Clients" value={stats.total} icon={Users} />
        <StatCard label="Active" value={stats.active} icon={CheckCircle2} />
        <StatCard label="MRR" value={`$${stats.mrr.toLocaleString()}`} icon={DollarSign} />
        <StatCard label="Launched" value={stats.launched} icon={Rocket} />
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : clients.length === 0 ? (
        <EmptyState onAdd={() => setAddOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clients.map(c => (
            <ClientCard key={c.id} client={c} onManage={() => setSelected(c)} onChanged={fetchClients} />
          ))}
        </div>
      )}

      {/* Slide-over */}
      {selected && (
        <ClientDetailSheet
          client={selected}
          open={!!selected}
          onOpenChange={(o) => !o && setSelected(null)}
          onSaved={() => { fetchClients(); setSelected(null); }}
        />
      )}

      {/* Add modal */}
      <AddClientDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => { setAddOpen(false); fetchClients(); }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                     */
/* ------------------------------------------------------------------ */
function StatCard({ label, value, icon: Icon }: { label: string; value: any; icon: any }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <Card>
      <CardContent className="py-16 text-center">
        <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-40" />
        <p className="text-foreground font-medium">No clients yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Clients appear here when leads convert to paid.
        </p>
        <Button onClick={onAdd} className="mt-4 gap-2">
          <Plus className="h-4 w-4" /> Add First Client
        </Button>
      </CardContent>
    </Card>
  );
}

function ClientCard({
  client, onManage, onChanged,
}: {
  client: Client;
  onManage: () => void;
  onChanged: () => void;
}) {
  const plan = client.package_chosen || client.website_package || '—';
  const showSecondary =
    client.onboarding_status &&
    client.onboarding_status !== client.client_status;

  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground truncate">{client.business_name}</h3>
            {client.owner_name && (
              <p className="text-sm text-muted-foreground truncate">{client.owner_name}</p>
            )}
          </div>
          <Badge variant="outline" className="shrink-0">{plan}</Badge>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className={statusBadge(client.client_status)}>
            {client.client_status || 'unknown'}
          </Badge>
          {showSecondary && (
            <Badge variant="outline" className="text-[10px] opacity-75">
              onboarding: {client.onboarding_status}
            </Badge>
          )}
          {client.maintenance_status && (
            <Badge variant="outline" className="text-[10px]">
              maint: {client.maintenance_status}
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px]">
            portal: {client.portal_access_enabled ? 'ON' : 'OFF'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="text-muted-foreground">Monthly</div>
            <div className="font-semibold text-foreground">
              ${Number(client.monthly_recurring || 0).toLocaleString()}/mo
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Launched</div>
            <div className="font-semibold text-foreground">
              {client.launched_at
                ? new Date(client.launched_at).toLocaleDateString()
                : '—'}
            </div>
          </div>
          <div className="col-span-2">
            <div className="text-muted-foreground mb-1">Assigned builder</div>
            <div onClick={(e) => e.stopPropagation()}>
              <BuilderAssignControl
                rowId={client.id}
                rowLabel={client.business_name}
                table="brandaro_clients"
                currentAssignedBuilder={client.assigned_builder}
                onChanged={onChanged}
              />
            </div>
          </div>
        </div>

        <Button variant="outline" size="sm" className="w-full" onClick={onManage}>
          Manage
        </Button>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Detail slide-over                                                  */
/* ------------------------------------------------------------------ */
function ClientDetailSheet({
  client, open, onOpenChange, onSaved,
}: {
  client: Client;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    assigned_builder: client.assigned_builder || '',
    project_deadline: client.project_deadline || '',
    maintenance_status: client.maintenance_status || '',
    portal_access_enabled: !!client.portal_access_enabled,
    client_status: client.client_status || 'onboarding',
  });
  const [checklist, setChecklist] = useState<Array<{ label: string; done: boolean }>>(() => {
    const raw = client.onboarding_checklist;
    if (Array.isArray(raw)) {
      return raw.map((r: any) =>
        typeof r === 'string'
          ? { label: r, done: false }
          : { label: r?.label ?? String(r), done: !!r?.done }
      );
    }
    return [];
  });
  const [newTask, setNewTask] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleTask = (i: number) =>
    setChecklist(cl => cl.map((t, idx) => (idx === i ? { ...t, done: !t.done } : t)));
  const addTask = () => {
    if (!newTask.trim()) return;
    setChecklist(cl => [...cl, { label: newTask.trim(), done: false }]);
    setNewTask('');
  };
  const removeTask = (i: number) =>
    setChecklist(cl => cl.filter((_, idx) => idx !== i));

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from('brandaro_clients')
      .update({
        assigned_builder: form.assigned_builder || null,
        project_deadline: form.project_deadline || null,
        maintenance_status: form.maintenance_status || null,
        portal_access_enabled: form.portal_access_enabled,
        client_status: form.client_status,
        onboarding_checklist: checklist,
        updated_at: new Date().toISOString(),
      })
      .eq('id', client.id);
    setSaving(false);
    if (error) return toast.error(`Save failed: ${error.message}`);
    toast.success('Client updated');
    onSaved();
  };

  const readOnly = [
    ['Business', client.business_name],
    ['Owner', client.owner_name],
    ['Email', client.email],
    ['Phone', client.phone],
    ['Address', client.address],
    ['Website package', client.website_package],
    ['Package chosen', client.package_chosen],
    ['Package price', client.website_package_price != null ? `$${client.website_package_price}` : null],
    ['Monthly recurring', client.monthly_recurring != null ? `$${client.monthly_recurring}/mo` : null],
    ['Launched at', client.launched_at ? new Date(client.launched_at).toLocaleString() : null],
    ['Created at', new Date(client.created_at).toLocaleString()],
    ['Qualified lead id', client.qualified_lead_id],
    ['Proposal id', client.proposal_id],
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{client.business_name}</SheetTitle>
          <SheetDescription>Manage client details and onboarding</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Read-only summary */}
          <section className="space-y-2">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground">Details</h4>
            <div className="rounded-md border border-border divide-y divide-border">
              {readOnly.map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-4 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="text-foreground text-right break-all">
                    {v || <span className="text-muted-foreground/60">—</span>}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Editable */}
          <section className="space-y-3">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground">Edit</h4>

            <div className="space-y-1.5">
              <Label>Client status</Label>
              <Select
                value={form.client_status}
                onValueChange={(v) => setForm(f => ({ ...f, client_status: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['onboarding', 'active', 'paused', 'cancelled'].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Assigned builder</Label>
              <Input
                value={form.assigned_builder}
                placeholder="Builder user id (uuid)"
                onChange={(e) => setForm(f => ({ ...f, assigned_builder: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Project deadline</Label>
              <Input
                type="date"
                value={form.project_deadline}
                onChange={(e) => setForm(f => ({ ...f, project_deadline: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Maintenance status</Label>
              <Select
                value={form.maintenance_status || 'none'}
                onValueChange={(v) => setForm(f => ({ ...f, maintenance_status: v === 'none' ? '' : v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['none', 'active', 'paused', 'cancelled'].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <div className="text-sm font-medium">Portal access</div>
                <div className="text-xs text-muted-foreground">Allow client to log into portal</div>
              </div>
              <Switch
                checked={form.portal_access_enabled}
                onCheckedChange={(v) => setForm(f => ({ ...f, portal_access_enabled: !!v }))}
              />
            </div>
          </section>

          {/* Checklist */}
          <section className="space-y-2">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground">
              Onboarding checklist
            </h4>
            <div className="rounded-md border border-border divide-y divide-border">
              {checklist.length === 0 && (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                  No checklist items yet
                </div>
              )}
              {checklist.map((t, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggleTask(i)}
                    className="shrink-0"
                    aria-label={t.done ? 'Mark not done' : 'Mark done'}
                  >
                    {t.done
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      : <Circle className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  <span className={`flex-1 text-sm ${t.done ? 'line-through text-muted-foreground' : ''}`}>
                    {t.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeTask(i)}
                    className="text-xs text-muted-foreground hover:text-red-500"
                  >
                    remove
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newTask}
                placeholder="Add task…"
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTask())}
              />
              <Button type="button" variant="outline" onClick={addTask}>Add</Button>
            </div>
          </section>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Add-client modal (3 steps)                                         */
/* ------------------------------------------------------------------ */
type NewClient = {
  business_name: string;
  owner_name: string;
  email: string;
  phone: string;
  address: string;
  logo_url: string;
  website_package: string;
  website_package_price: string;
  monthly_recurring: string;
  addon_services: string;
  project_deadline: string;
  assigned_builder: string;
  qualified_lead_id: string;
  proposal_id: string;
  portal_access_enabled: boolean;
};

const EMPTY: NewClient = {
  business_name: '', owner_name: '', email: '', phone: '', address: '', logo_url: '',
  website_package: '', website_package_price: '', monthly_recurring: '', addon_services: '',
  project_deadline: '', assigned_builder: '',
  qualified_lead_id: '', proposal_id: '', portal_access_enabled: false,
};

function AddClientDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<NewClient>(EMPTY);
  const [leads, setLeads] = useState<QualifiedLead[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setForm(EMPTY);
    (async () => {
      const { data, error } = await (supabase as any)
        .from('brandaro_qualified_leads')
        .select('id, business_name, pipeline_stage, lead_status')
        .or('pipeline_stage.eq.closed_won,lead_status.in.(paid,client)')
        .order('business_name', { ascending: true })
        .limit(200);
      if (error) {
        console.warn('Lead lookup failed:', error.message);
        setLeads([]);
      } else {
        setLeads((data as QualifiedLead[]) || []);
      }
    })();
  }, [open]);

  const update = <K extends keyof NewClient>(k: K, v: NewClient[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const canNext =
    step === 1
      ? !!(form.business_name.trim() && form.owner_name.trim() && form.email.trim())
      : true;

  const submit = async () => {
    setSaving(true);
    const payload: Record<string, any> = {
      business_name: form.business_name.trim(),
      owner_name: form.owner_name.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      logo_url: form.logo_url.trim() || null,
      website_package: form.website_package || null,
      package_chosen: form.website_package || null,
      website_package_price: form.website_package_price ? Number(form.website_package_price) : null,
      monthly_recurring: form.monthly_recurring ? Number(form.monthly_recurring) : null,
      addon_services: form.addon_services.trim() ? { notes: form.addon_services.trim() } : null,
      project_deadline: form.project_deadline || null,
      assigned_builder: form.assigned_builder.trim() || null,
      qualified_lead_id: form.qualified_lead_id || null,
      proposal_id: form.proposal_id.trim() || null,
      portal_access_enabled: form.portal_access_enabled,
      client_status: 'onboarding',
      onboarding_status: 'new',
    };
    const { error } = await (supabase as any).from('brandaro_clients').insert(payload);
    setSaving(false);
    if (error) return toast.error(`Create failed: ${error.message}`);
    toast.success('Client created');
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add new client — Step {step} of 3</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            <Field label="Business name *">
              <Input value={form.business_name} onChange={(e) => update('business_name', e.target.value)} />
            </Field>
            <Field label="Owner name *">
              <Input value={form.owner_name} onChange={(e) => update('owner_name', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email *">
                <Input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
              </Field>
              <Field label="Phone">
                <Input value={form.phone} onChange={(e) => update('phone', e.target.value)} />
              </Field>
            </div>
            <Field label="Address">
              <Input value={form.address} onChange={(e) => update('address', e.target.value)} />
            </Field>
            <Field label="Logo URL">
              <Input value={form.logo_url} onChange={(e) => update('logo_url', e.target.value)} placeholder="https://…" />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <Field label="Website package">
              <Select
                value={form.website_package || undefined}
                onValueChange={(v) => update('website_package', v)}
              >
                <SelectTrigger><SelectValue placeholder="Choose package" /></SelectTrigger>
                <SelectContent>
                  {PACKAGE_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Package price ($)">
                <Input
                  type="number" inputMode="decimal"
                  value={form.website_package_price}
                  onChange={(e) => update('website_package_price', e.target.value)}
                />
              </Field>
              <Field label="Monthly recurring ($)">
                <Input
                  type="number" inputMode="decimal"
                  value={form.monthly_recurring}
                  onChange={(e) => update('monthly_recurring', e.target.value)}
                />
              </Field>
            </div>
            <Field label="Add-on services">
              <Textarea
                value={form.addon_services}
                rows={2}
                onChange={(e) => update('addon_services', e.target.value)}
                placeholder="Notes — comma-separated add-ons or free-form"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Project deadline">
                <Input
                  type="date"
                  value={form.project_deadline}
                  onChange={(e) => update('project_deadline', e.target.value)}
                />
              </Field>
              <Field label="Assigned builder">
                <Input
                  value={form.assigned_builder}
                  placeholder="Builder uuid"
                  onChange={(e) => update('assigned_builder', e.target.value)}
                />
              </Field>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Field label="Link to qualified lead">
              <Select
                value={form.qualified_lead_id || 'none'}
                onValueChange={(v) => update('qualified_lead_id', v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No lead selected" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {leads.map(l => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.business_name || l.id.slice(0, 8)}
                      {l.pipeline_stage ? ` · ${l.pipeline_stage}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {leads.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  No qualified leads with pipeline_stage=closed_won or lead_status in (paid, client)
                </p>
              )}
            </Field>
            <Field label="Proposal id">
              <Input value={form.proposal_id} onChange={(e) => update('proposal_id', e.target.value)} />
            </Field>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <div className="text-sm font-medium">Portal access</div>
                <div className="text-xs text-muted-foreground">Enable client login (default off)</div>
              </div>
              <Switch
                checked={form.portal_access_enabled}
                onCheckedChange={(v) => update('portal_access_enabled', !!v)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Client will be created with status <span className="font-mono">onboarding</span>.
            </p>
          </div>
        )}

        <DialogFooter className="flex sm:justify-between gap-2">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            {step < 3 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={!canNext}
                className="gap-1"
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={submit} disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Create client
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
