import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Phone, Plus, Edit2, Trash2, Star, CheckCircle2,
  MessageSquare, ToggleLeft, ToggleRight,
  Copy, Check, Loader2, AlertCircle, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle
} from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue
} from '@/components/ui/select';
import { toast } from 'sonner';

const PURPOSE_OPTIONS = [
  { value: 'general_outreach', label: 'General Outreach', desc: 'Cold outreach to new leads' },
  { value: 'follow_up', label: 'Follow-Up', desc: 'Following up warm leads' },
  { value: 'closing', label: 'Closing', desc: 'Hot leads and closing deals' },
  { value: 'support', label: 'Customer Support', desc: 'Existing customer questions' },
  { value: 'campaigns', label: 'Campaigns', desc: 'Blast campaigns and promos' },
  { value: 'ai_dialer', label: 'AI Dialer', desc: 'Dedicated to AI auto-dialer' },
  { value: 'inbound_only', label: 'Inbound Only', desc: 'Receives calls and texts only' },
];

const BRAND_OPTIONS = ['Brandaro', 'GasMask', 'Hot Mama Grabba', 'Grabba R Us', 'Hot Scalatti'];

interface PhoneForm {
  phone_number: string;
  friendly_name: string;
  description: string;
  purpose: string;
  brand: string;
  is_active: boolean;
  is_default: boolean;
  twilio_sid: string;
  monthly_cost: number;
  assigned_campaign: string;
  notes: string;
  capabilities: { sms: boolean; voice: boolean; mms: boolean };
}

const emptyForm: PhoneForm = {
  phone_number: '', friendly_name: '', description: '',
  purpose: 'general_outreach', brand: 'Brandaro',
  is_active: true, is_default: false, twilio_sid: '',
  monthly_cost: 1.15, assigned_campaign: '', notes: '',
  capabilities: { sms: true, voice: true, mms: false },
};

export default function PhoneNumbersPage() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingNumber, setEditingNumber] = useState<any>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PhoneForm>(emptyForm);

  const { data: numbers = [], isLoading } = useQuery({
    queryKey: ['brandaro-phone-numbers'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('brandaro_phone_numbers')
        .select('*')
        .order('is_default', { ascending: false })
        .order('brand')
        .order('friendly_name');
      if (error) throw error;
      return data || [];
    },
  });

  const byBrand = (numbers as any[]).reduce((acc: Record<string, any[]>, n: any) => {
    if (!acc[n.brand]) acc[n.brand] = [];
    acc[n.brand].push(n);
    return acc;
  }, {});

  const activeCount = (numbers as any[]).filter((n: any) => n.is_active).length;
  const totalMessages = (numbers as any[]).reduce((s: number, n: any) => s + (n.messages_sent || 0), 0);
  const monthlyCost = (numbers as any[]).reduce((s: number, n: any) => s + (parseFloat(n.monthly_cost) || 0), 0);

  const copyNumber = async (num: string, id: string) => {
    await navigator.clipboard.writeText(num);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['brandaro-phone-numbers'] });

  const setDefault = async (id: string, brand: string) => {
    await (supabase as any).from('brandaro_phone_numbers').update({ is_default: false }).eq('brand', brand);
    await (supabase as any).from('brandaro_phone_numbers').update({ is_default: true }).eq('id', id);
    toast.success('Default number updated');
    invalidate();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await (supabase as any).from('brandaro_phone_numbers').update({ is_active: !current }).eq('id', id);
    toast.success(current ? 'Number paused' : 'Number activated');
    invalidate();
  };

  const deleteNumber = async (id: string) => {
    if (!confirm('Delete this number? This cannot be undone.')) return;
    await (supabase as any).from('brandaro_phone_numbers').delete().eq('id', id);
    toast.success('Number removed');
    invalidate();
  };

  const openEdit = (num: any) => {
    setForm({
      phone_number: num.phone_number,
      friendly_name: num.friendly_name,
      description: num.description || '',
      purpose: num.purpose || 'general_outreach',
      brand: num.brand || 'Brandaro',
      is_active: num.is_active,
      is_default: num.is_default,
      twilio_sid: num.twilio_sid || '',
      monthly_cost: num.monthly_cost || 1.15,
      assigned_campaign: num.assigned_campaign || '',
      notes: num.notes || '',
      capabilities: num.capabilities || { sms: true, voice: true, mms: false },
    });
    setEditingNumber(num);
    setShowAddForm(true);
  };

  const saveNumber = async () => {
    if (!form.phone_number || !form.friendly_name) {
      toast.error('Phone number and name required');
      return;
    }
    let phone = form.phone_number.replace(/\D/g, '');
    if (phone.length === 10) phone = '+1' + phone;
    else if (phone.length === 11 && phone.startsWith('1')) phone = '+' + phone;
    else if (!phone.startsWith('+')) phone = '+' + phone;

    setSaving(true);
    try {
      if (editingNumber) {
        const { error } = await (supabase as any)
          .from('brandaro_phone_numbers')
          .update({ ...form, phone_number: phone, updated_at: new Date().toISOString() })
          .eq('id', editingNumber.id);
        if (error) throw error;
        toast.success('Number updated');
      } else {
        if (form.is_default) {
          await (supabase as any).from('brandaro_phone_numbers').update({ is_default: false }).eq('brand', form.brand);
        }
        const { error } = await (supabase as any)
          .from('brandaro_phone_numbers')
          .insert({ ...form, phone_number: phone });
        if (error) throw error;
        toast.success('Number added!');
      }
      setShowAddForm(false);
      setEditingNumber(null);
      setForm(emptyForm);
      invalidate();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const statCards = [
    { label: 'Total Numbers', value: numbers.length, icon: Phone, color: 'text-foreground' },
    { label: 'Active', value: activeCount, icon: CheckCircle2, color: 'text-emerald-500' },
    { label: 'Messages Sent', value: totalMessages.toLocaleString(), icon: MessageSquare, color: 'text-blue-500' },
    { label: 'Monthly Cost', value: `$${monthlyCost.toFixed(2)}`, icon: Phone, color: 'text-amber-500' },
  ];

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Phone Number Library
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage all Twilio numbers across brands — assign purposes, set defaults, track usage
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs"
            onClick={() => toast.info('Add numbers manually using their phone number and SID from console.twilio.com')}>
            <Info className="h-3.5 w-3.5" /> Twilio Sync
          </Button>
          <Button size="sm" className="gap-1.5 text-xs"
            onClick={() => { setForm(emptyForm); setEditingNumber(null); setShowAddForm(true); }}>
            <Plus className="h-3.5 w-3.5" /> Add Number
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
              <div>
                <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-[10px] text-muted-foreground">{stat.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Webhook Info */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <div className="text-xs space-y-1">
            <p className="font-medium">Twilio Webhook Required for Inbound SMS</p>
            <p className="text-muted-foreground">For each number to receive replies, set this webhook in Twilio Console:</p>
            <code className="block bg-muted px-2 py-1 rounded text-[10px] font-mono break-all">
              {`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || 'your-project'}.supabase.co/functions/v1/sms-inbound-webhook`}
            </code>
            <p className="text-muted-foreground">Go to: console.twilio.com → Phone Numbers → Active Numbers → Click number → Messaging → Webhook URL above → Save</p>
          </div>
        </CardContent>
      </Card>

      {/* Numbers by Brand */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : numbers.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <Phone className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">No phone numbers yet</p>
            <p className="text-xs text-muted-foreground">Add your Twilio numbers to manage them from here</p>
            <Button size="sm" onClick={() => { setForm(emptyForm); setShowAddForm(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Add First Number
            </Button>
          </CardContent>
        </Card>
      ) : (
        Object.entries(byBrand).map(([brand, nums]) => (
          <div key={brand} className="space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              {brand} ({(nums as any[]).length})
            </h2>
            <div className="space-y-2">
              {(nums as any[]).map((num: any) => (
                <Card key={num.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{num.friendly_name}</span>
                          {num.is_default && <Badge variant="default" className="text-[9px] h-4 px-1.5">⭐ Default</Badge>}
                          {!num.is_active && <Badge variant="secondary" className="text-[9px] h-4 px-1.5">Paused</Badge>}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-xs font-mono text-muted-foreground">{num.phone_number}</span>
                          <button onClick={() => copyNumber(num.phone_number, num.id)} className="text-muted-foreground hover:text-foreground">
                            {copiedId === num.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {!num.is_default && num.is_active && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDefault(num.id, num.brand)}>
                            <Star className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleActive(num.id, num.is_active)}>
                          {num.is_active ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(num)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteNumber(num.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {num.description && <p className="text-xs text-muted-foreground">{num.description}</p>}
                    <div className="flex gap-2 flex-wrap">
                      {num.purpose && (
                        <Badge variant="outline" className="text-[9px]">
                          {PURPOSE_OPTIONS.find(p => p.value === num.purpose)?.label || num.purpose}
                        </Badge>
                      )}
                      {num.capabilities?.sms && <Badge variant="secondary" className="text-[9px]"><MessageSquare className="h-2.5 w-2.5 mr-0.5" />SMS</Badge>}
                      {num.capabilities?.voice && <Badge variant="secondary" className="text-[9px]"><Phone className="h-2.5 w-2.5 mr-0.5" />Voice</Badge>}
                    </div>
                    <div className="grid grid-cols-3 gap-3 pt-1">
                      <div><div className="text-sm font-bold">{num.messages_sent || 0}</div><div className="text-[10px] text-muted-foreground">Sent</div></div>
                      <div><div className="text-sm font-bold">{num.messages_received || 0}</div><div className="text-[10px] text-muted-foreground">Received</div></div>
                      <div><div className="text-sm font-bold">${parseFloat(num.monthly_cost || 0).toFixed(2)}/mo</div><div className="text-[10px] text-muted-foreground">Cost</div></div>
                    </div>
                    {num.assigned_campaign && (
                      <p className="text-[10px] text-muted-foreground">Campaign: <span className="font-medium text-foreground">{num.assigned_campaign}</span></p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Add/Edit Sheet */}
      <Sheet open={showAddForm} onOpenChange={(open) => { if (!open) { setShowAddForm(false); setEditingNumber(null); setForm(emptyForm); } }}>
        <SheetContent className="w-[420px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingNumber ? 'Edit Phone Number' : 'Add Phone Number'}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-xs font-medium block mb-1">Phone Number *</label>
              <Input value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))}
                placeholder="+1 (718) 555-0000" className="h-9 text-sm font-mono" disabled={!!editingNumber} />
              <p className="text-[10px] text-muted-foreground mt-1">Will be auto-formatted to +1XXXXXXXXXX</p>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Name / Label *</label>
              <Input value={form.friendly_name} onChange={e => setForm(f => ({ ...f, friendly_name: e.target.value }))}
                placeholder="e.g. Brandaro Brooklyn Outreach" className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What is this number used for?"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Purpose</label>
              <Select value={form.purpose} onValueChange={v => setForm(f => ({ ...f, purpose: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PURPOSE_OPTIONS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Brand</label>
              <Select value={form.brand} onValueChange={v => setForm(f => ({ ...f, brand: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BRAND_OPTIONS.map(b => (<SelectItem key={b} value={b}>{b}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Assigned Campaign (optional)</label>
              <Input value={form.assigned_campaign} onChange={e => setForm(f => ({ ...f, assigned_campaign: e.target.value }))}
                placeholder="e.g. Brooklyn Cold Outreach Q1" className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Twilio Phone SID (optional)</label>
              <Input value={form.twilio_sid} onChange={e => setForm(f => ({ ...f, twilio_sid: e.target.value }))}
                placeholder="PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" className="h-9 text-sm font-mono text-xs" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-2">Capabilities</label>
              <div className="flex gap-4">
                {(['sms', 'voice', 'mms'] as const).map(cap => (
                  <label key={cap} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.capabilities[cap]}
                      onChange={e => setForm(f => ({ ...f, capabilities: { ...f.capabilities, [cap]: e.target.checked } }))} />
                    {cap.toUpperCase()}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Monthly Cost ($)</label>
              <Input type="number" step="0.01" value={form.monthly_cost}
                onChange={e => setForm(f => ({ ...f, monthly_cost: parseFloat(e.target.value) || 0 }))}
                className="h-9 text-sm" />
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} />
                Set as Default for {form.brand}
              </label>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Internal Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any internal notes..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]" />
            </div>
            <Button className="w-full" onClick={saveNumber} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingNumber ? 'Save Changes' : 'Add Number'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
