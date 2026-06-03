import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useDCBusinesses } from '@/hooks/useDCBusinesses';

export function NewAgentDialog() {
  const qc = useQueryClient();
  const { data: businesses = [] } = useDCBusinesses();
  const [open, setOpen] = useState(false);
  const [business, setBusiness] = useState('');
  const [agentType, setAgentType] = useState('outbound');
  const [agentId, setAgentId] = useState('');
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);

  const reset = () => { setBusiness(''); setAgentType('outbound'); setAgentId(''); setName(''); setIsActive(true); };

  const mut = useMutation({
    mutationFn: async () => {
      if (!business || !agentId.trim() || !name.trim()) throw new Error('Business, Bland Agent ID, and Name are required');
      const { error } = await (supabase as any).from('dc_agents').insert({
        business, agent_type: agentType, agent_id: agentId.trim(), name: name.trim(), is_active: isActive,
      });
      if (error) {
        if (error.code === '23505' || /duplicate|unique/i.test(error.message))
          throw new Error('That Bland Agent ID already exists in dc_agents.');
        throw error;
      }
    },
    onSuccess: () => {
      toast.success(`Agent added → ${business}/${agentType}`);
      qc.invalidateQueries({ queryKey: ['dc-agents-roster'] });
      qc.invalidateQueries({ queryKey: ['dc-agents-all'] });
      qc.invalidateQueries({ queryKey: ['dc-agents-phones'] });
      reset(); setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Agent</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Bland AI Agent</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Business</Label>
            <Select value={business} onValueChange={setBusiness}>
              <SelectTrigger><SelectValue placeholder="Select business" /></SelectTrigger>
              <SelectContent>
                {businesses.map((b) => <SelectItem key={b.business_key} value={b.business_key}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Agent Type</Label>
            <Input value={agentType} onChange={(e) => setAgentType(e.target.value)} placeholder="sales / outbound / inbound / reactivation..." />
          </div>
          <div>
            <Label>Bland Agent ID</Label>
            <Input value={agentId} onChange={(e) => setAgentId(e.target.value)} placeholder="agent_xxxx... or UUID" />
            <p className="text-xs text-muted-foreground mt-1">Paste from your Bland dashboard. Must be unique.</p>
          </div>
          <div>
            <Label>Display Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. GasMask Reactivation" />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Active</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending ? 'Saving…' : 'Add Agent'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ICON_OPTIONS = ['Building2', 'Sparkles', 'Shield', 'Wrench', 'Zap', 'Music', 'Brain', 'Phone', 'Rocket', 'Star'];
const COLOR_OPTIONS = [
  'bg-green-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500',
  'bg-rose-500', 'bg-indigo-500', 'bg-cyan-500', 'bg-pink-500',
  'bg-slate-500', 'bg-orange-500', 'bg-teal-500',
];

export function NewBusinessDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('Building2');
  const [color, setColor] = useState('bg-slate-500');
  const [isLive, setIsLive] = useState(false);
  const [isInternal, setIsInternal] = useState(false);

  const reset = () => { setKey(''); setName(''); setIcon('Building2'); setColor('bg-slate-500'); setIsLive(false); setIsInternal(false); };

  const mut = useMutation({
    mutationFn: async () => {
      const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
      if (!cleanKey || !name.trim()) throw new Error('Key and Name required');
      const { error } = await (supabase as any).from('dc_businesses').insert({
        business_key: cleanKey, name: name.trim(), icon, color, is_live: isLive, is_internal: isInternal, sort_order: 200,
      });
      if (error) {
        if (error.code === '23505') throw new Error('That business_key already exists.');
        throw error;
      }
    },
    onSuccess: () => {
      toast.success(`Business added — appears across DC surfaces.`);
      qc.invalidateQueries({ queryKey: ['dc-businesses'] });
      reset(); setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> New Business</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Business</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Business Key (lowercase, no spaces)</Label>
            <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. acme_co" />
          </div>
          <div>
            <Label>Display Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Co" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Icon</Label>
              <Select value={icon} onValueChange={setIcon}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ICON_OPTIONS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Color</Label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COLOR_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    <span className="flex items-center gap-2"><span className={`inline-block h-3 w-3 rounded ${c}`} />{c}</span>
                  </SelectItem>
                ))}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Live</Label>
            <Switch checked={isLive} onCheckedChange={setIsLive} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label>Internal only</Label>
            <Switch checked={isInternal} onCheckedChange={setIsInternal} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending ? 'Saving…' : 'Add Business'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
