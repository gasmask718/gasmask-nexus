/**
 * InboundHumansFirstTab — per-company "humans first, AI as the save" admin.
 *
 * Edits inbound_policy (ring strategy, seconds, hours, greeting, toggles)
 * and manages inbound_ring_targets (browser / mobile / desk with reorder).
 * The inbound webhook (dc-inbound-call) reads exactly these rows.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { PhoneIncoming, Plus, Trash2, ArrowUp, ArrowDown, Monitor, Smartphone, Phone, Loader2 } from 'lucide-react';

interface VACompany { id: string; slug: string; name: string }

interface Policy {
  va_company_id: string;
  ring_humans_first: boolean;
  ring_strategy: 'simultaneous' | 'sequential';
  ring_seconds: number;
  ai_fallback: boolean;
  ai_agent_id: string | null;
  ai_greeting: string | null;
  after_hours_ai_only: boolean;
  business_hours_start: string;
  business_hours_end: string;
}

interface RingTarget {
  id: string;
  va_company_id: string;
  label: string;
  target_type: 'browser' | 'mobile' | 'desk';
  phone_e164: string | null;
  user_id: string | null;
  ring_order: number;
  active: boolean;
  only_business_hours: boolean;
}

const TYPE_ICON = { browser: Monitor, mobile: Smartphone, desk: Phone } as const;

export function InboundHumansFirstTab() {
  const queryClient = useQueryClient();
  const [companyId, setCompanyId] = useState<string>('');

  const { data: companies = [] } = useQuery({
    queryKey: ['va-companies-for-inbound'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('va_companies')
        .select('id, slug, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []) as VACompany[];
    },
  });

  const activeCompanyId = companyId || companies[0]?.id || '';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground flex-1 min-w-[240px]">
          Inbound calls ring humans first — VA browser softphones and forwarded phones —
          then fall back to the AI concierge if nobody answers.
        </p>
        <Select value={activeCompanyId} onValueChange={setCompanyId}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Select company" />
          </SelectTrigger>
          <SelectContent>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {activeCompanyId && (
        <>
          <PolicyCard companyId={activeCompanyId} queryClient={queryClient} />
          <RingTargetsCard companyId={activeCompanyId} queryClient={queryClient} />
        </>
      )}
    </div>
  );
}

// ==========================================
// POLICY CARD
// ==========================================
function PolicyCard({ companyId, queryClient }: { companyId: string; queryClient: any }) {
  const { data: policy, isLoading } = useQuery({
    queryKey: ['inbound-policy', companyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('inbound_policy')
        .select('*')
        .eq('va_company_id', companyId)
        .maybeSingle();
      if (error) throw error;
      return data as Policy | null;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (patch: Partial<Policy>) => {
      const { error } = await (supabase as any)
        .from('inbound_policy')
        .upsert({ va_company_id: companyId, ...patch, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbound-policy', companyId] });
      toast.success('Inbound policy saved');
    },
    onError: (err: any) => toast.error(`Save failed: ${err.message}`),
  });

  if (isLoading) return <Card><CardContent className="p-8 text-center text-muted-foreground">Loading policy…</CardContent></Card>;
  if (!policy) return <Card><CardContent className="p-8 text-center text-muted-foreground">No policy row for this company.</CardContent></Card>;

  const set = (patch: Partial<Policy>) => saveMutation.mutate(patch);
  const saving = saveMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PhoneIncoming className="h-4 w-4" /> Answering Policy
          {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </CardTitle>
        <CardDescription>Who rings, for how long, and what happens when nobody answers.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Ring humans first</Label>
            <Switch checked={policy.ring_humans_first} onCheckedChange={(v) => set({ ring_humans_first: v })} disabled={saving} />
          </div>
          <div className="flex items-center justify-between">
            <Label>After hours → AI only</Label>
            <Switch checked={policy.after_hours_ai_only} onCheckedChange={(v) => set({ after_hours_ai_only: v })} disabled={saving} />
          </div>
          <div className="flex items-center justify-between">
            <Label>AI fallback when nobody answers</Label>
            <Switch checked={policy.ai_fallback} onCheckedChange={(v) => set({ ai_fallback: v })} disabled={saving} />
          </div>
          <div className="space-y-2">
            <Label>Ring strategy</Label>
            <Select value={policy.ring_strategy} onValueChange={(v) => set({ ring_strategy: v as Policy['ring_strategy'] })} disabled={saving}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="simultaneous">Simultaneous — everyone rings at once</SelectItem>
                <SelectItem value="sequential">Sequential — ring_order stages, one after another</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Ring seconds per stage (10–30; past 30 callers hang up)</Label>
            <Input
              type="number" min={10} max={30}
              defaultValue={policy.ring_seconds}
              onBlur={(e) => {
                const v = Math.min(30, Math.max(10, parseInt(e.target.value, 10) || 20));
                if (v !== policy.ring_seconds) set({ ring_seconds: v });
              }}
              disabled={saving}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Business hours start (ET)</Label>
              <Input
                type="time"
                defaultValue={(policy.business_hours_start || '09:00:00').slice(0, 5)}
                onBlur={(e) => { if (e.target.value) set({ business_hours_start: `${e.target.value}:00` }); }}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Business hours end (ET)</Label>
              <Input
                type="time"
                defaultValue={(policy.business_hours_end || '21:00:00').slice(0, 5)}
                onBlur={(e) => { if (e.target.value) set({ business_hours_end: `${e.target.value}:00` }); }}
                disabled={saving}
              />
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>AI greeting (what the concierge opens with)</Label>
            <Textarea
              rows={4}
              defaultValue={policy.ai_greeting || ''}
              onBlur={(e) => { if (e.target.value !== (policy.ai_greeting || '')) set({ ai_greeting: e.target.value }); }}
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              Spoken by the AI concierge when it takes the call. It identifies the caller,
              takes messages, books callbacks and records reorders — it is not a voicemail.
            </p>
          </div>
          <div className="space-y-2">
            <Label>AI agent override (optional phone DID)</Label>
            <Input
              placeholder="Leave empty to use the built-in concierge"
              defaultValue={policy.ai_agent_id || ''}
              onBlur={(e) => { if (e.target.value !== (policy.ai_agent_id || '')) set({ ai_agent_id: e.target.value || null }); }}
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              If set, unanswered calls bridge to this external AI number instead of the built-in concierge.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ==========================================
// RING TARGETS CARD
// ==========================================
function RingTargetsCard({ companyId, queryClient }: { companyId: string; queryClient: any }) {
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ label: '', target_type: 'mobile', phone_e164: '', ring_order: 10, only_business_hours: false });

  const { data: targets = [], isLoading } = useQuery({
    queryKey: ['inbound-ring-targets', companyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('inbound_ring_targets')
        .select('*')
        .eq('va_company_id', companyId)
        .order('ring_order', { ascending: true });
      if (error) throw error;
      return (data || []) as RingTarget[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['inbound-ring-targets', companyId] });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!form.label.trim()) throw new Error('Label is required');
      if (form.target_type !== 'browser') {
        if (!/^\+[1-9]\d{7,14}$/.test(form.phone_e164.trim())) throw new Error('Phone must be E.164 (e.g. +17185551234)');
      }
      const { error } = await (supabase as any).from('inbound_ring_targets').insert({
        va_company_id: companyId,
        label: form.label.trim(),
        target_type: form.target_type,
        phone_e164: form.target_type === 'browser' ? null : form.phone_e164.trim(),
        ring_order: form.ring_order,
        only_business_hours: form.only_business_hours,
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setAddOpen(false);
      setForm({ label: '', target_type: 'mobile', phone_e164: '', ring_order: 10, only_business_hours: false });
      toast.success('Ring target added');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to add target'),
  });

  const patchMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<RingTarget> }) => {
      const { error } = await (supabase as any).from('inbound_ring_targets').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (err: any) => toast.error(`Update failed: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('inbound_ring_targets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Ring target removed'); },
    onError: (err: any) => toast.error(`Delete failed: ${err.message}`),
  });

  const move = (t: RingTarget, dir: -1 | 1) => {
    const idx = targets.findIndex((x) => x.id === t.id);
    const swapWith = targets[idx + dir];
    if (!swapWith) return;
    patchMutation.mutate({ id: t.id, patch: { ring_order: swapWith.ring_order } });
    patchMutation.mutate({ id: swapWith.id, patch: { ring_order: t.ring_order } });
  };

  const busy = addMutation.isPending || patchMutation.isPending || deleteMutation.isPending;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Ring Targets</CardTitle>
          <CardDescription>
            Browser targets ring only while that VA is on shift in the portal. Sequential strategy rings stages in ring_order.
          </CardDescription>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Target</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Ring Target</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Label *</Label>
                <Input placeholder="Owner cell, Front desk, Jane (VA)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.target_type} onValueChange={(v) => setForm({ ...form, target_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mobile">Mobile — forwarded cell</SelectItem>
                    <SelectItem value="desk">Desk — landline</SelectItem>
                    <SelectItem value="browser">Browser — VA softphone (rings while on shift)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.target_type !== 'browser' && (
                <div className="space-y-2">
                  <Label>Phone (E.164) *</Label>
                  <Input placeholder="+17185551234" value={form.phone_e164} onChange={(e) => setForm({ ...form, phone_e164: e.target.value })} />
                </div>
              )}
              {form.target_type === 'browser' && (
                <p className="text-xs text-muted-foreground">
                  Browser targets are registered by the VA from their portal ("ring my mobile / softphone").
                  Add mobiles and desks here; browser rows appear automatically when VAs opt in.
                </p>
              )}
              <div className="space-y-2">
                <Label>Ring order (sequential stages; lower rings first)</Label>
                <Input type="number" value={form.ring_order} onChange={(e) => setForm({ ...form, ring_order: parseInt(e.target.value, 10) || 10 })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Business hours only</Label>
                <Switch checked={form.only_business_hours} onCheckedChange={(v) => setForm({ ...form, only_business_hours: v })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending || form.target_type === 'browser'}>
                {addMutation.isPending ? 'Adding…' : 'Add Target'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading targets…</div>
        ) : targets.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No ring targets — inbound calls go straight to the AI concierge. Add at least one human.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Order</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Rings</TableHead>
                <TableHead>Hours only</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {targets.map((t, idx) => {
                const Icon = TYPE_ICON[t.target_type] || Phone;
                return (
                  <TableRow key={t.id} className={t.active ? '' : 'opacity-50'}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs w-6">{t.ring_order}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === 0 || busy} onClick={() => move(t, -1)}>
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === targets.length - 1 || busy} onClick={() => move(t, 1)}>
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{t.label}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1 capitalize">
                        <Icon className="h-3 w-3" /> {t.target_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {t.target_type === 'browser' ? 'VA softphone (on shift)' : t.phone_e164}
                    </TableCell>
                    <TableCell>{t.only_business_hours ? <Badge variant="secondary">Hours only</Badge> : '—'}</TableCell>
                    <TableCell>
                      <Switch
                        checked={t.active}
                        onCheckedChange={(v) => patchMutation.mutate({ id: t.id, patch: { active: v } })}
                        disabled={busy}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="text-destructive" disabled={busy} onClick={() => deleteMutation.mutate(t.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
