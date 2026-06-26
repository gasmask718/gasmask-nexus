import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FileText, Save, Send } from 'lucide-react';

const SF_ACCENT = '#BA7517';

const DEFAULT_PCT: Record<string, number> = { FL: 30, TX: 33, GA: 30, NJ: 35, NY: 35 };
const STATES = ['FL', 'TX', 'GA', 'NJ', 'NY'] as const;

const STATUS_TONE: Record<string, string> = {
  draft: 'bg-gray-500/15 text-gray-300 border-gray-500/40',
  sent: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
  viewed: 'bg-purple-500/15 text-purple-300 border-purple-500/40',
  signed: 'bg-green-500/15 text-green-300 border-green-500/40',
  expired: 'bg-red-500/15 text-red-300 border-red-500/40',
  cancelled: 'bg-slate-500/15 text-slate-300 border-slate-500/40',
};

interface ContractForm {
  lead_id: string;
  claimant_name: string;
  state: string;
  county: string;
  surplus_amount: number;
  our_percentage: number;
  claimant_email: string;
}

function renderContract(c: ContractForm) {
  return (
    `CONTINGENCY FEE AGREEMENT\n\n` +
    `This agreement is between Dynasty Recovery Group LLC ('Company') and ${c.claimant_name} ('Claimant').\n\n` +
    `The Company agrees to assist Claimant in recovering surplus funds of approximately $${Number(c.surplus_amount).toLocaleString()} from ${c.county} County, ${c.state}.\n\n` +
    `In consideration for these services, Claimant agrees to pay Company ${c.our_percentage}% of any funds recovered.\n\n` +
    `There is NO upfront cost to Claimant. Company is only paid upon successful recovery.\n\n` +
    `Signed this day: ___________\n\nClaimant: ___________\n\nDynasty Recovery Group LLC: ___________`
  );
}

export default function SFDocuments() {
  const [stats, setStats] = useState({ sent: 0, viewed: 0, signed: 0, conversion: 0, avgDays: 0 });
  const [ready, setReady] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState<ContractForm | null>(null);
  const [saving, setSaving] = useState(false);

  const loadStats = async () => {
    const { data } = await supabase.from('surplus_funds_contracts').select('status, created_at, signed_at');
    const rows = data ?? [];
    const sent = rows.filter(r => r.status === 'sent').length;
    const viewed = rows.filter(r => r.status === 'viewed').length;
    const signed = rows.filter(r => r.status === 'signed').length;
    const sentLike = rows.filter(r => ['sent', 'viewed', 'signed'].includes(r.status as string)).length;
    const conversion = sentLike > 0 ? Math.round((signed / sentLike) * 100) : 0;
    const signedRows = rows.filter(r => r.signed_at && r.created_at);
    const avg = signedRows.length
      ? Math.round(signedRows.reduce((acc, r) => acc + (new Date(r.signed_at as string).getTime() - new Date(r.created_at as string).getTime()) / 86400000, 0) / signedRows.length)
      : 0;
    setStats({ sent, viewed, signed, conversion, avgDays: avg });
  };

  const loadReady = async () => {
    const { data: contracted } = await supabase.from('surplus_funds_contracts').select('lead_id').in('status', ['sent', 'signed']);
    const excluded = new Set((contracted ?? []).map(c => c.lead_id).filter(Boolean));
    let q = supabase.from('surplus_funds_leads').select('*').or('interest_level.eq.high,recommended_action.eq.send_contract').order('interest_score', { ascending: false, nullsFirst: false }).limit(20);
    const { data } = await q;
    setReady((data ?? []).filter(l => !excluded.has(l.id)));
  };

  const loadContracts = async () => {
    let q = supabase.from('surplus_funds_contracts').select('*, surplus_funds_leads(first_name, last_name)').order('created_at', { ascending: false });
    if (filter !== 'all') q = q.eq('status', filter);
    const { data } = await q;
    setContracts(data ?? []);
  };

  useEffect(() => { loadStats(); loadReady(); }, []);
  useEffect(() => { loadContracts(); }, [filter]);

  const openCreate = (lead: any) => {
    const state = (lead.state ?? 'FL') as string;
    setEditing({
      lead_id: lead.id,
      claimant_name: `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim() || 'Unknown',
      state,
      county: lead.county ?? '',
      surplus_amount: Number(lead.surplus_amount ?? 0),
      our_percentage: DEFAULT_PCT[state] ?? 30,
      claimant_email: lead.email ?? '',
    });
  };

  const save = async (status: 'draft' | 'sent') => {
    if (!editing) return;
    if (status === 'sent' && !editing.claimant_email) { toast.error('Email required to send.'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('surplus_funds_contracts').insert({
        lead_id: editing.lead_id,
        claimant_name: editing.claimant_name,
        claimant_email: editing.claimant_email || null,
        state: editing.state,
        surplus_amount: editing.surplus_amount,
        our_percentage: editing.our_percentage,
        status,
      });
      if (error) throw error;
      toast.success(status === 'draft' ? 'Contract saved as draft' : `Contract sent to ${editing.claimant_email}. Follow up in 24 hours.`);
      setEditing(null);
      loadStats(); loadReady(); loadContracts();
    } catch (e: any) {
      toast.error(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const markSigned = async (id: string) => {
    const { error } = await supabase.from('surplus_funds_contracts').update({ status: 'signed', signed_at: new Date().toISOString() }).eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Marked signed.'); loadContracts(); loadStats(); }
  };

  const contractPreview = useMemo(() => (editing ? renderContract(editing) : ''), [editing]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: SF_ACCENT }}>📄 Contracts</h1>
        <p className="text-sm text-muted-foreground">Track client agreements and signatures</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { l: 'Sent', v: stats.sent }, { l: 'Viewed', v: stats.viewed }, { l: 'Signed', v: stats.signed },
          { l: 'Conversion', v: `${stats.conversion}%` }, { l: 'Avg Days to Sign', v: stats.avgDays },
        ].map(s => (
          <Card key={s.l}><CardContent className="pt-4"><div className="text-2xl font-bold">{s.v}</div><div className="text-xs text-muted-foreground">{s.l}</div></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>🔥 Ready to Contract</CardTitle></CardHeader>
        <CardContent>
          {ready.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No hot leads ready for contract yet.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {ready.map(l => (
                <Card key={l.id}>
                  <CardContent className="pt-4 space-y-1 text-sm">
                    <div className="font-semibold">{l.first_name} {l.last_name}</div>
                    <div className="text-xs text-muted-foreground">{l.county} County, {l.state}</div>
                    <div>Surplus: <b>${Number(l.surplus_amount ?? 0).toLocaleString()}</b></div>
                    <div className="text-xs">Score: {l.interest_score ?? '—'} · {l.recommended_action ?? ''}</div>
                    <Button size="sm" className="mt-2" onClick={() => openCreate(l)}><FileText className="h-3 w-3 mr-1" />Create Contract</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>📋 All Contracts</CardTitle></CardHeader>
        <CardContent>
          <Tabs value={filter} onValueChange={setFilter} className="mb-3">
            <TabsList>
              {['all', 'draft', 'sent', 'viewed', 'signed', 'expired'].map(f => <TabsTrigger key={f} value={f}>{f}</TabsTrigger>)}
            </TabsList>
          </Tabs>
          {contracts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No contracts here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr><th className="text-left p-2">Claimant</th><th className="text-left p-2">State</th><th className="text-left p-2">Amount</th><th className="text-left p-2">Our %</th><th className="text-left p-2">Status</th><th className="text-left p-2">Created</th><th className="text-left p-2">Action</th></tr>
                </thead>
                <tbody>
                  {contracts.map(c => (
                    <tr key={c.id} className="border-b border-border/50">
                      <td className="p-2">{c.claimant_name}</td>
                      <td className="p-2">{c.state}</td>
                      <td className="p-2">${Number(c.surplus_amount ?? 0).toLocaleString()}</td>
                      <td className="p-2">{c.our_percentage}%</td>
                      <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded border ${STATUS_TONE[c.status] ?? ''}`}>{c.status}</span></td>
                      <td className="p-2 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                      <td className="p-2">
                        {c.status === 'sent' && <Button size="sm" variant="outline" onClick={() => markSigned(c.id)}>Mark Signed</Button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Create & Send Contract</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Claimant Name</Label><Input value={editing.claimant_name} onChange={e => setEditing({ ...editing, claimant_name: e.target.value })} /></div>
                <div><Label>Claimant Email</Label><Input type="email" value={editing.claimant_email} onChange={e => setEditing({ ...editing, claimant_email: e.target.value })} /></div>
                <div><Label>State</Label><Input value={editing.state} onChange={e => setEditing({ ...editing, state: e.target.value })} /></div>
                <div><Label>County</Label><Input value={editing.county} onChange={e => setEditing({ ...editing, county: e.target.value })} /></div>
                <div><Label>Surplus Amount</Label><Input type="number" value={editing.surplus_amount} onChange={e => setEditing({ ...editing, surplus_amount: Number(e.target.value) })} /></div>
                <div><Label>Our Percentage</Label><Input type="number" min={20} max={40} value={editing.our_percentage} onChange={e => setEditing({ ...editing, our_percentage: Number(e.target.value) })} /></div>
              </div>
              <Textarea readOnly value={contractPreview} className="font-mono text-xs h-64" />
              <div className="flex justify-end gap-2">
                <Button variant="outline" disabled={saving} onClick={() => save('draft')}><Save className="h-3 w-3 mr-1" />Save Draft</Button>
                <Button disabled={saving} onClick={() => save('sent')} style={{ backgroundColor: SF_ACCENT }}><Send className="h-3 w-3 mr-1" />Send for Signature</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
