import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Phone, PhoneOff, PhoneCall, CheckCircle2, Clock, Package, Plus } from 'lucide-react';
import { toast } from 'sonner';

// Outbound caller-ID options. Numbers are placeholders — update in one place.
const CALLER_IDS = [
  { id: 'biztext', label: 'BizText Line', number: '+19298225712' },
  { id: 'ooma', label: 'Ooma Line', number: '+19293891587' },
];

type Lead = {
  id: string;
  store_name: string;
  phone: string | null;
  inventory_status: string;
  notes: string | null;
  last_called: string | null;
};

const STATUS_META: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  updated: { label: 'Inventory Updated', variant: 'default' },
  no_answer: { label: 'No Answer', variant: 'outline' },
  callback: { label: 'Call Back Later', variant: 'destructive' },
};

export default function GasMaskInventoryOps() {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [callerId, setCallerId] = useState(CALLER_IDS[0].id);
  const [notes, setNotes] = useState('');
  const [newStoreName, setNewStoreName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['store-inventory-leads'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('store_inventory_leads')
        .select('*')
        .order('inventory_status', { ascending: true })
        .order('last_called', { ascending: true, nullsFirst: true });
      if (error) throw error;
      return (data ?? []) as Lead[];
    },
  });

  const active = useMemo(
    () => leads.find((l) => l.id === activeId) ?? null,
    [leads, activeId],
  );

  const selectLead = (lead: Lead) => {
    setActiveId(lead.id);
    setNotes(lead.notes ?? '');
  };

  const disposition = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any)
        .from('store_inventory_leads')
        .update({
          inventory_status: status,
          notes: notes || null,
          last_called: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(`Marked as ${STATUS_META[v.status]?.label ?? v.status}`);
      qc.invalidateQueries({ queryKey: ['store-inventory-leads'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Update failed'),
  });

  const addLead = useMutation({
    mutationFn: async () => {
      if (!newStoreName.trim()) throw new Error('Store name required');
      const { error } = await (supabase as any)
        .from('store_inventory_leads')
        .insert({
          store_name: newStoreName.trim(),
          phone: newPhone.trim() || null,
          inventory_status: 'pending',
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Lead added');
      setNewStoreName('');
      setNewPhone('');
      qc.invalidateQueries({ queryKey: ['store-inventory-leads'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Insert failed'),
  });

  const callerNumber = CALLER_IDS.find((c) => c.id === callerId)?.number;

  const initiateCall = () => {
    if (!active?.phone) {
      toast.error('No phone number on this lead');
      return;
    }
    // Simple tel: dial-out via chosen caller ID (label surfaced for the agent).
    toast.info(`Calling ${active.store_name} from ${CALLER_IDS.find(c => c.id === callerId)?.label}`);
    window.location.href = `tel:${active.phone}`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            GasMask Inventory Operations
          </h1>
          <p className="text-sm text-muted-foreground">
            Call queue for daily inventory checks. Select a store, dial out, and log the outcome.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Queue */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Call Queue ({leads.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
            {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!isLoading && leads.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Queue is empty. Add a lead below to get started.
              </p>
            )}
            {leads.map((lead) => {
              const meta = STATUS_META[lead.inventory_status] ?? { label: lead.inventory_status, variant: 'outline' as const };
              return (
                <button
                  key={lead.id}
                  onClick={() => selectLead(lead)}
                  className={`w-full text-left rounded-md border p-3 transition hover:bg-muted ${
                    activeId === lead.id ? 'border-primary bg-muted' : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{lead.store_name}</div>
                      <div className="text-xs text-muted-foreground">{lead.phone ?? 'No phone'}</div>
                    </div>
                    <Badge variant={meta.variant} className="shrink-0">{meta.label}</Badge>
                  </div>
                  {lead.last_called && (
                    <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(lead.last_called).toLocaleString()}
                    </div>
                  )}
                </button>
              );
            })}

            <div className="pt-4 border-t space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Add lead</div>
              <Input
                placeholder="Store name"
                value={newStoreName}
                onChange={(e) => setNewStoreName(e.target.value)}
              />
              <Input
                placeholder="Phone (E.164)"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
              <Button
                size="sm"
                className="w-full"
                onClick={() => addLead.mutate()}
                disabled={addLead.isPending}
              >
                <Plus className="h-4 w-4 mr-1" /> Add to queue
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Call Panel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              {active ? active.store_name : 'Select a store from the queue'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!active && (
              <p className="text-sm text-muted-foreground">
                Pick a store on the left to open the call panel.
              </p>
            )}

            {active && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Phone</div>
                    <div className="font-mono">{active.phone ?? '—'}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Last called</div>
                    <div>{active.last_called ? new Date(active.last_called).toLocaleString() : 'Never'}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Outbound caller ID</div>
                  <Select value={callerId} onValueChange={setCallerId}>
                    <SelectTrigger className="w-full md:w-72">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CALLER_IDS.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="flex items-center gap-2">
                            <Phone className="h-3 w-3" />
                            {c.label}
                            <span className="text-xs text-muted-foreground">{c.number}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Notes</div>
                  <Textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="What did the store say?"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={initiateCall} disabled={!active.phone}>
                    <PhoneCall className="h-4 w-4 mr-1" /> Call now
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => disposition.mutate({ id: active.id, status: 'updated' })}
                    disabled={disposition.isPending}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Inventory Updated
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => disposition.mutate({ id: active.id, status: 'no_answer' })}
                    disabled={disposition.isPending}
                  >
                    <PhoneOff className="h-4 w-4 mr-1" /> No Answer
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => disposition.mutate({ id: active.id, status: 'callback' })}
                    disabled={disposition.isPending}
                  >
                    <Clock className="h-4 w-4 mr-1" /> Call Back Later
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
