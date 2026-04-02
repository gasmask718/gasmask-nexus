import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Sunrise, Loader2, Users, DollarSign, AlertTriangle, CheckCircle2, Clock, ArrowUp, ArrowDown, Minus, ChevronRight, CreditCard } from 'lucide-react';

interface ClientSummary {
  id: string;
  first_name: string;
  last_name: string;
  target_funding_amount: number | null;
  status: string | null;
}

interface DfsRow {
  client_id: string;
  total_score: number;
  scored_at: string;
}

interface TaskRow {
  client_id: string;
  status: string;
  deadline: string | null;
  title: string;
  completed_at: string | null;
}

interface VaultCard {
  available_au_slots: number | null;
  occupied_slots: number | null;
  price_per_slot: number | null;
  cardholder_name: string | null;
}

interface VaultTxn {
  status: string;
  price: number | null;
  expected_reporting_date: string | null;
  payout_status: string | null;
  cardholder_payout: number | null;
  vault_card_id: string;
}

interface DisputeRow {
  client_id: string;
  response_deadline: string | null;
  status: string | null;
}

export default function MorningBriefingPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [dfsScores, setDfsScores] = useState<DfsRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [vaultCards, setVaultCards] = useState<VaultCard[]>([]);
  const [vaultTxns, setVaultTxns] = useState<VaultTxn[]>([]);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [generating, setGenerating] = useState(false);
  const [aiBrief, setAiBrief] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [c, d, t, vc, vt, dr] = await Promise.all([
      supabase.from('funding_clients').select('id, first_name, last_name, target_funding_amount, status'),
      supabase.from('funding_dfs_scores').select('client_id, total_score, scored_at').order('scored_at', { ascending: false }),
      supabase.from('funding_task_cards').select('client_id, status, deadline, title, completed_at'),
      supabase.from('funding_tradeline_vault_cards').select('available_au_slots, occupied_slots, price_per_slot, cardholder_name'),
      supabase.from('funding_tradeline_vault_transactions').select('status, price, expected_reporting_date, payout_status, cardholder_payout, vault_card_id'),
      supabase.from('funding_dispute_rounds').select('client_id, response_deadline, status'),
    ]);
    if (c.data) setClients(c.data);
    if (d.data) setDfsScores(d.data);
    if (t.data) setTasks(t.data as TaskRow[]);
    if (vc.data) setVaultCards(vc.data);
    if (vt.data) setVaultTxns(vt.data);
    if (dr.data) setDisputes(dr.data);
  };

  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  // Section 1 — Daily Score
  const totalPipeline = clients.reduce((s, c) => s + (c.target_funding_amount ?? 0), 0);
  const completedYesterday = tasks.filter(t => t.completed_at && new Date(t.completed_at).toDateString() === yesterday).length;
  const dueToday = tasks.filter(t => t.status === 'pending' && t.deadline && new Date(t.deadline).toDateString() === today).length;

  // Section 2 — Client status
  const getLatestDfs = (clientId: string): { score: number; trend: 'up' | 'down' | 'flat' } => {
    const scores = dfsScores.filter(d => d.client_id === clientId);
    if (scores.length === 0) return { score: 0, trend: 'flat' };
    const latest = scores[0].total_score;
    const prev = scores.length > 1 ? scores[1].total_score : latest;
    return { score: latest, trend: latest > prev ? 'up' : latest < prev ? 'down' : 'flat' };
  };

  const getPhase = (clientId: string): string => {
    const clientTasks = tasks.filter(t => t.client_id === clientId);
    const pending = clientTasks.filter(t => t.status === 'pending');
    if (pending.length === 0 && clientTasks.length > 0) return 'Complete';
    const titles = pending.map(t => t.title.toLowerCase()).join(' ');
    if (titles.includes('credit') || titles.includes('dispute')) return 'Credit Repair';
    if (titles.includes('business') || titles.includes('vendor') || titles.includes('llc')) return 'Business Building';
    if (titles.includes('card') || titles.includes('stack')) return 'Card Stacking';
    if (titles.includes('loan') || titles.includes('apply') || titles.includes('fund')) return 'Loan Applications';
    return 'Onboarding';
  };

  // Section 3 — Alerts
  const now = Date.now();
  const redAlerts: string[] = [];
  const amberWarnings: string[] = [];
  const greenUpdates: string[] = [];

  disputes.forEach(d => {
    if (!d.response_deadline) return;
    const diff = (new Date(d.response_deadline).getTime() - now) / 86400000;
    if (diff <= 1 && diff >= 0 && d.status !== 'responded') redAlerts.push(`Dispute expiring in <24hrs (client ${d.client_id.slice(0, 8)}…)`);
    else if (diff <= 7 && diff > 1 && d.status !== 'responded') amberWarnings.push(`Dispute expiring in ${Math.ceil(diff)}d`);
    if (d.status === 'responded') greenUpdates.push('Dispute response received');
  });

  vaultTxns.forEach(t => {
    if (t.status === 'active' && t.expected_reporting_date) {
      const diff = (new Date(t.expected_reporting_date).getTime() - now) / 86400000;
      if (diff <= 0) redAlerts.push('Tradeline past expected report date');
    }
    if (t.status === 'reported') greenUpdates.push('Tradeline reported successfully');
  });

  tasks.filter(t => t.status === 'pending' && t.deadline).forEach(t => {
    const diff = (new Date(t.deadline!).getTime() - now) / 86400000;
    if (diff < 0) amberWarnings.push(`Task overdue: ${t.title}`);
  });

  // Section 4 — Vault
  const vaultRevenue = vaultTxns.filter(t => t.status === 'active').reduce((s, t) => s + (t.price ?? 0), 0);
  const totalSlots = vaultCards.reduce((s, c) => s + (c.available_au_slots ?? 0), 0);
  const occupiedSlots = vaultCards.reduce((s, c) => s + (c.occupied_slots ?? 0), 0);
  const pendingPayouts = vaultTxns.filter(t => t.payout_status === 'ready').reduce((s, t) => s + (t.cardholder_payout ?? 0), 0);

  const generateBrief = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('funding-ai-agent', {
        body: {
          action: 'generate_morning_brief',
          clients: clients.map(c => ({ name: `${c.first_name} ${c.last_name}`, dfs: getLatestDfs(c.id).score, phase: getPhase(c.id), pending_tasks: tasks.filter(t => t.client_id === c.id && t.status === 'pending').length })),
          red_alerts: redAlerts,
          amber_warnings: amberWarnings,
          green_updates: greenUpdates,
          vault: { revenue: vaultRevenue, occupied: occupiedSlots, total: totalSlots, pending_payouts: pendingPayouts },
          tasks_due_today: dueToday,
          total_pipeline: totalPipeline,
        },
      });
      if (error) throw error;
      setAiBrief(data.brief || data.raw || 'No brief generated');

      // Save to morning briefings table
      await supabase.from('funding_morning_briefings').insert({
        briefing_date: new Date().toISOString().split('T')[0],
        total_active_clients: clients.length,
        alerts: { red: redAlerts, amber: amberWarnings, green: greenUpdates } as any,
        clients_summary: clients.map(c => ({ name: `${c.first_name} ${c.last_name}`, dfs: getLatestDfs(c.id).score })) as any,
        operator_actions: { brief: data.brief || data.raw } as any,
      });
      toast.success("Morning brief generated");
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    } finally {
      setGenerating(false);
    }
  };

  const TrendIcon = ({ trend }: { trend: string }) =>
    trend === 'up' ? <ArrowUp className="h-3 w-3 text-green-400" /> :
    trend === 'down' ? <ArrowDown className="h-3 w-3 text-red-400" /> :
    <Minus className="h-3 w-3 text-muted-foreground" />;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-amber-400 flex items-center gap-2"><Sunrise className="h-8 w-8" /> Morning Briefing</h1>
          <p className="text-muted-foreground">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <Button onClick={generateBrief} disabled={generating} className="bg-amber-600 hover:bg-amber-700">
          {generating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating…</> : <><Sunrise className="h-4 w-4 mr-2" /> Generate Today's Brief</>}
        </Button>
      </div>

      {/* Section 1 — Daily Score */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4 text-center"><div className="text-xs text-muted-foreground">Active Clients</div><div className="text-2xl font-black text-amber-400">{clients.length}</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-xs text-muted-foreground">Pipeline Value</div><div className="text-2xl font-black text-amber-400">${(totalPipeline / 1000).toFixed(0)}K</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-xs text-muted-foreground">Completed Yesterday</div><div className="text-2xl font-black text-green-400">{completedYesterday}</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-xs text-muted-foreground">Due Today</div><div className="text-2xl font-black text-red-400">{dueToday}</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-xs text-muted-foreground">Vault Revenue</div><div className="text-2xl font-black text-amber-400">${vaultRevenue.toLocaleString()}</div></CardContent></Card>
      </div>

      {/* Section 2 — Client Status Board */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-amber-400" /> Client Status Board</CardTitle></CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No active clients</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b text-muted-foreground text-xs">
                <th className="text-left p-2">Client</th><th className="p-2">DFS</th><th className="p-2">Phase</th>
                <th className="p-2">Pending</th><th className="p-2">Next Action</th><th className="p-2"></th>
              </tr></thead>
              <tbody>
                {clients.map(c => {
                  const { score, trend } = getLatestDfs(c.id);
                  const phase = getPhase(c.id);
                  const clientPending = tasks.filter(t => t.client_id === c.id && t.status === 'pending');
                  const nextDue = clientPending.filter(t => t.deadline && new Date(t.deadline).toDateString() === today);
                  return (
                    <tr key={c.id} className="border-b hover:bg-muted/30">
                      <td className="p-2 font-medium">{c.first_name} {c.last_name}</td>
                      <td className="p-2 text-center"><span className="flex items-center justify-center gap-1">{score}<TrendIcon trend={trend} /></span></td>
                      <td className="p-2 text-center"><Badge variant="outline" className="text-[10px]">{phase}</Badge></td>
                      <td className="p-2 text-center">{clientPending.length}</td>
                      <td className="p-2 text-center text-xs">{nextDue.length > 0 ? nextDue[0].title : <span className="text-muted-foreground">—</span>}</td>
                      <td className="p-2 text-center">
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/funding-machine/client/${c.id}`)}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Section 3 — Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={redAlerts.length > 0 ? 'border-red-500/50' : ''}>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-red-400"><AlertTriangle className="h-4 w-4" /> Red Alerts ({redAlerts.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {redAlerts.length === 0 ? <p className="text-xs text-muted-foreground">No critical alerts</p> : redAlerts.map((a, i) => <div key={i} className="text-xs text-red-400">• {a}</div>)}
          </CardContent>
        </Card>
        <Card className={amberWarnings.length > 0 ? 'border-amber-500/50' : ''}>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-amber-400"><Clock className="h-4 w-4" /> Warnings ({amberWarnings.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {amberWarnings.length === 0 ? <p className="text-xs text-muted-foreground">No warnings</p> : amberWarnings.map((a, i) => <div key={i} className="text-xs text-amber-400">• {a}</div>)}
          </CardContent>
        </Card>
        <Card className={greenUpdates.length > 0 ? 'border-green-500/50' : ''}>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-green-400"><CheckCircle2 className="h-4 w-4" /> Updates ({greenUpdates.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {greenUpdates.length === 0 ? <p className="text-xs text-muted-foreground">No updates</p> : greenUpdates.map((a, i) => <div key={i} className="text-xs text-green-400">• {a}</div>)}
          </CardContent>
        </Card>
      </div>

      {/* Section 4 — Vault Revenue */}
      <Card className="border-amber-500/30">
        <CardHeader><CardTitle className="flex items-center gap-2 text-amber-400"><CreditCard className="h-5 w-5" /> Vault Revenue Snapshot</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div><div className="text-xs text-muted-foreground">Monthly Revenue</div><div className="text-xl font-black text-amber-400">${vaultRevenue.toLocaleString()}</div></div>
            <div><div className="text-xs text-muted-foreground">Slots Occupied</div><div className="text-xl font-black">{occupiedSlots}/{totalSlots}</div></div>
            <div><div className="text-xs text-muted-foreground">Payouts Ready</div><div className="text-xl font-black text-green-400">${pendingPayouts.toLocaleString()}</div></div>
            <div><div className="text-xs text-muted-foreground">Cards Enrolled</div><div className="text-xl font-black">{vaultCards.length}</div></div>
          </div>
        </CardContent>
      </Card>

      {/* Section 5 — AI Brief */}
      {aiBrief && (
        <Card className="border-amber-500/30">
          <CardHeader>
            <CardTitle className="text-amber-400 flex items-center gap-2"><Sunrise className="h-5 w-5" /> Dynasty Funding Machine — Today's Brief</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm whitespace-pre-wrap">{aiBrief}</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
