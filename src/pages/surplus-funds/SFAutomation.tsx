import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Rocket, Phone, FileText, AlertCircle } from 'lucide-react';
import { SFHumanQueue } from './SFHumanQueue';

const SF_ACCENT = '#BA7517';
const STATES = ['FL', 'TX', 'GA', 'NJ', 'NY'];
const AGENTS = [
  { value: 'initial_outreach', label: 'Initial Outreach' },
  { value: 'warm_followup', label: 'Warm Follow-Up' },
  { value: 'spanish', label: 'Spanish Language' },
];
const MAX_OPTIONS = [50, 100, 200, 500, 0] as const;

const TEMPLATES: Record<string, string> = {
  FL: 'https://docs.google.com/document/d/1FL-template/edit',
  TX: 'https://docs.google.com/document/d/1TX-template/edit',
  GA: 'https://docs.google.com/document/d/1GA-template/edit',
  NJ: 'https://docs.google.com/document/d/1NJ-template/edit',
  NY: 'https://docs.google.com/document/d/1NY-template/edit',
};

const STATUS_TONE: Record<string, string> = {
  new: 'bg-slate-500/15 text-slate-300 border-slate-500/40',
  queued: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
  in_campaign: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
  called: 'bg-purple-500/15 text-purple-300 border-purple-500/40',
  interested: 'bg-green-500/15 text-green-300 border-green-500/40',
  not_interested: 'bg-red-500/15 text-red-300 border-red-500/40',
  callback_requested: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/40',
  voicemail: 'bg-slate-500/15 text-slate-300 border-slate-500/40',
  signed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  wrong_number: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
};

function campaignNameFor(state: string) {
  return `SF_${state}_${new Date().toISOString().slice(0, 10)}`;
}

export default function SFAutomation() {
  const [state, setState] = useState('FL');
  const [campaignName, setCampaignName] = useState(campaignNameFor('FL'));
  const [agent, setAgent] = useState('initial_outreach');
  const [maxCalls, setMaxCalls] = useState<number>(100);
  const [availableLeads, setAvailableLeads] = useState<number>(0);
  const [launching, setLaunching] = useState(false);

  const [campaigns, setCampaigns] = useState<any[] | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, number>>({});
  const [callbacks, setCallbacks] = useState<any[]>([]);
  const [hotLeads, setHotLeads] = useState<any[]>([]);
  const [contractModal, setContractModal] = useState<string | null>(null);

  useEffect(() => {
    setCampaignName(campaignNameFor(state));
    supabase
      .from('surplus_funds_leads')
      .select('id', { count: 'exact', head: true })
      .eq('state', state)
      .eq('status', 'new')
      .not('phone', 'is', null)
      .then(({ count }) => setAvailableLeads(count ?? 0));
  }, [state]);

  const refreshAll = async () => {
    const [c, o, cb, hl] = await Promise.all([
      supabase.from('dc_campaigns').select('*').eq('business', 'surplus_funds').order('created_at', { ascending: false }).limit(20),
      supabase.from('surplus_funds_leads').select('status'),
      supabase.from('surplus_funds_leads').select('*').eq('status', 'callback_requested').order('updated_at', { ascending: true }).limit(50),
      supabase.from('surplus_funds_leads').select('*').or('interest_level.eq.high,recommended_action.eq.send_contract').order('interest_score', { ascending: false, nullsFirst: false }).limit(20),
    ]);
    setCampaigns(c.data ?? []);
    const agg: Record<string, number> = {};
    (o.data ?? []).forEach((r: any) => { agg[r.status ?? 'new'] = (agg[r.status ?? 'new'] ?? 0) + 1; });
    setOutcomes(agg);
    setCallbacks(cb.data ?? []);
    setHotLeads(hl.data ?? []);
  };

  useEffect(() => { refreshAll(); }, []);

  const launch = async () => {
    setLaunching(true);
    try {
      let query = supabase
        .from('surplus_funds_leads')
        .select('id')
        .eq('state', state)
        .eq('status', 'new')
        .not('phone', 'is', null);
      if (maxCalls > 0) query = query.limit(maxCalls);
      const { data: leadsRows, error: lerr } = await query;
      if (lerr) throw lerr;
      const ids = (leadsRows ?? []).map((r: any) => r.id);
      if (ids.length === 0) {
        toast.error('No callable leads available for this state.');
        return;
      }

      const { error } = await supabase.functions.invoke('sf-trigger-bland-campaign', {
        body: { lead_ids: ids, campaign_name: campaignName, state, agent_type: agent },
      });
      if (error) throw error;

      toast.success(`Campaign launched! ${ids.length} calls starting now.`);
      await refreshAll();
    } catch (e: any) {
      console.error(e);
      toast.error('Campaign failed to start. Check Bland API key in Vault.');
    } finally {
      setLaunching(false);
    }
  };

  const callOne = async (lead: any) => {
    try {
      const { error } = await supabase.functions.invoke('sf-trigger-bland-campaign', {
        body: {
          lead_ids: [lead.id],
          campaign_name: `SF_Callback_${String(lead.id).slice(0, 8)}`,
          state: lead.state,
        },
      });
      if (error) throw error;
      toast.success('Callback call started!');
      refreshAll();
    } catch (e: any) {
      toast.error(`Callback failed: ${e.message}`);
    }
  };

  const outcomeOrder = ['new', 'queued', 'in_campaign', 'called', 'interested', 'not_interested', 'callback_requested', 'voicemail', 'signed', 'wrong_number'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: SF_ACCENT }}>🤖 Floor 6 — AI & Automation</h1>
        <p className="text-sm text-muted-foreground">Launch and monitor live Bland AI campaigns</p>
      </div>

      {/* SECTION A: Campaign Launcher */}
      <Card className="border-amber-500/40">
        <CardHeader><CardTitle className="flex items-center gap-2"><Rocket className="h-4 w-4 text-amber-500" />🚀 Launch Calling Campaign</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Campaign Name</Label>
              <Input value={campaignName} onChange={e => setCampaignName(e.target.value)} />
            </div>
            <div>
              <Label>Target State</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Calling Agent</Label>
              <Select value={agent} onValueChange={setAgent}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{AGENTS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Max Calls This Session</Label>
              <div className="flex gap-2 flex-wrap">
                {MAX_OPTIONS.map(n => (
                  <Button key={n} type="button" size="sm" variant={maxCalls === n ? 'default' : 'outline'} onClick={() => setMaxCalls(n)}>
                    {n === 0 ? 'All' : n}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {availableLeads > 0 ? (
            <div className="text-sm text-emerald-400">📋 {availableLeads} leads ready to call in {state}</div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/40 text-amber-300 text-sm">
              <AlertCircle className="h-4 w-4" />No new leads in {state}. Upload leads first.
            </div>
          )}

          <div className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-md">
            ℹ️ Bland AI will call between 9am–8pm local time automatically. Do not call Sunday.
          </div>

          <Button onClick={launch} disabled={launching || availableLeads === 0} className="w-full" style={{ backgroundColor: SF_ACCENT }}>
            {launching ? 'Starting calls...' : '🚀 Launch Campaign'}
          </Button>
        </CardContent>
      </Card>

      {/* SECTION B: Active Campaigns */}
      <Card>
        <CardHeader><CardTitle>📊 Campaigns</CardTitle></CardHeader>
        <CardContent>
          {campaigns === null ? (
            <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No campaigns yet. Launch one above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr><th className="text-left p-2">Campaign</th><th className="text-left p-2">Leads</th><th className="text-left p-2">Status</th><th className="text-left p-2">Started</th><th className="text-left p-2">Calls</th></tr>
                </thead>
                <tbody>
                  {campaigns.map(c => (
                    <tr key={c.id} className="border-b border-border/50">
                      <td className="p-2 font-medium">{c.name}</td>
                      <td className="p-2">{c.total_leads ?? 0}</td>
                      <td className="p-2">
                        <span className="inline-flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${c.status === 'active' ? 'bg-green-500 animate-pulse' : c.status === 'paused' ? 'bg-yellow-500' : c.status === 'failed' ? 'bg-red-500' : 'bg-gray-500'}`} />
                          {c.status}
                        </span>
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</td>
                      <td className="p-2">{c.calls_made ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION C: Outcomes */}
      <Card>
        <CardHeader><CardTitle>📈 Lead Outcomes</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {outcomeOrder.filter(k => outcomes[k]).map(k => (
              <span key={k} className={`text-xs px-3 py-1.5 rounded-full border ${STATUS_TONE[k] ?? 'bg-muted'}`}>
                {k.replace(/_/g, ' ')}: <b>{outcomes[k]}</b>
              </span>
            ))}
            {Object.keys(outcomes).length === 0 && <span className="text-sm text-muted-foreground">No lead data yet.</span>}
          </div>
        </CardContent>
      </Card>

      {/* SECTION D: Human Callback Queue */}
      <SFHumanQueue />


      {/* SECTION E: Hot Leads */}
      <Card>
        <CardHeader><CardTitle>🔥 Hot Leads — Ready for Contract</CardTitle></CardHeader>
        <CardContent>
          {hotLeads.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No hot leads yet. Launch a campaign and interested leads will appear here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr><th className="text-left p-2">Name</th><th className="text-left p-2">County</th><th className="text-left p-2">State</th><th className="text-left p-2">Amount</th><th className="text-left p-2">AI Score</th><th className="text-left p-2">Recommendation</th><th className="text-left p-2">Action</th></tr>
                </thead>
                <tbody>
                  {hotLeads.map(l => (
                    <tr key={l.id} className="border-b border-border/50">
                      <td className="p-2">{l.first_name} {l.last_name}</td>
                      <td className="p-2">{l.county}</td>
                      <td className="p-2">{l.state}</td>
                      <td className="p-2">${Number(l.surplus_amount ?? 0).toLocaleString()}</td>
                      <td className="p-2">{l.interest_score ?? '—'}</td>
                      <td className="p-2 text-xs">{l.recommended_action ?? ''}</td>
                      <td className="p-2"><Button size="sm" variant="outline" onClick={() => setContractModal(l.state ?? 'FL')}><FileText className="h-3 w-3 mr-1" />Send Contract</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!contractModal} onOpenChange={o => !o && setContractModal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Contract Templates</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Contract system ready. DocuSign integration coming next. Download a contract template:</p>
          <div className="grid grid-cols-2 gap-2">
            {STATES.map(s => (
              <a key={s} href={TEMPLATES[s] ?? '#'} target="_blank" rel="noreferrer">
                <Button variant="outline" className="w-full">Download {s} Template</Button>
              </a>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
