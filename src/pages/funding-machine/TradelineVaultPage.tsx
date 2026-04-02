import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FileText, Plus, Loader2, Search, DollarSign, Calendar } from 'lucide-react';

interface FundingClient {
  id: string;
  first_name: string;
  last_name: string;
}

interface VaultCard {
  id: string;
  cardholder_name: string | null;
  cardholder_contact: string | null;
  issuer: string;
  account_age_months: number | null;
  credit_limit: number | null;
  current_utilization: number | null;
  reporting_bureaus: string[] | null;
  available_au_slots: number | null;
  occupied_slots: number | null;
  price_per_slot: number | null;
  statement_close_date: number | null;
  is_active: boolean | null;
}

interface VaultTxn {
  id: string;
  vault_card_id: string;
  buyer_client_id: string | null;
  buyer_name: string | null;
  price: number | null;
  status: string;
  au_added_date: string | null;
  expected_reporting_date: string | null;
  actual_reporting_date: string | null;
  payout_status: string | null;
  cardholder_payout: number | null;
}

function calcSlotPrice(ageMonths: number, limit: number): number {
  let price = 100;
  if (ageMonths >= 84) price = 350;
  else if (ageMonths >= 48) price = 250;
  else if (ageMonths >= 24) price = 175;
  if (limit > 25000) price += 75;
  else if (limit > 10000) price += 50;
  return price;
}

const BUREAU_OPTIONS = ['D&B', 'Experian Business', 'TransUnion', 'Equifax', 'Experian'];

export default function TradelineVaultPage() {
  const [clients, setClients] = useState<FundingClient[]>([]);
  const [cards, setCards] = useState<VaultCard[]>([]);
  const [txns, setTxns] = useState<VaultTxn[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [matching, setMatching] = useState(false);
  const [matchResult, setMatchResult] = useState('');
  const [matchClient, setMatchClient] = useState('');

  // Add card form state
  const [formName, setFormName] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formIssuer, setFormIssuer] = useState('');
  const [formOpenDate, setFormOpenDate] = useState('');
  const [formLimit, setFormLimit] = useState('');
  const [formBalance, setFormBalance] = useState('');
  const [formBureaus, setFormBureaus] = useState<string[]>([]);
  const [formSlots, setFormSlots] = useState('2');
  const [formStmtClose, setFormStmtClose] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [{ data: cl }, { data: ca }, { data: tx }] = await Promise.all([
      supabase.from('funding_clients').select('id, first_name, last_name'),
      supabase.from('funding_tradeline_vault_cards').select('*').order('created_at', { ascending: false }),
      supabase.from('funding_tradeline_vault_transactions').select('*').order('created_at', { ascending: false }),
    ]);
    if (cl) setClients(cl);
    if (ca) setCards(ca);
    if (tx) setTxns(tx);
  };

  const computedPrice = useMemo(() => {
    if (!formOpenDate || !formLimit) return 0;
    const ageMonths = Math.floor((Date.now() - new Date(formOpenDate).getTime()) / (30.44 * 24 * 60 * 60 * 1000));
    return calcSlotPrice(ageMonths, parseFloat(formLimit) || 0);
  }, [formOpenDate, formLimit]);

  const addCard = async () => {
    if (!formName || !formIssuer || !formOpenDate || !formLimit) { toast.error('Fill required fields'); return; }
    const ageMonths = Math.floor((Date.now() - new Date(formOpenDate).getTime()) / (30.44 * 24 * 60 * 60 * 1000));
    const limit = parseFloat(formLimit) || 0;
    const balance = parseFloat(formBalance) || 0;
    const utilization = limit > 0 ? Math.round((balance / limit) * 100) : 0;
    const price = calcSlotPrice(ageMonths, limit);

    const { error } = await supabase.from('funding_tradeline_vault_cards').insert({
      cardholder_user_id: 'operator',
      cardholder_name: formName,
      cardholder_contact: formContact,
      issuer: formIssuer,
      account_age_months: ageMonths,
      credit_limit: limit,
      current_utilization: utilization,
      reporting_bureaus: formBureaus,
      available_au_slots: parseInt(formSlots) || 2,
      occupied_slots: 0,
      price_per_slot: price,
      statement_close_date: parseInt(formStmtClose) || null,
      is_active: true,
    });
    if (error) { toast.error('Failed to add card'); return; }
    toast.success(`Card added — $${price}/slot`);
    setAddOpen(false);
    resetForm();
    loadData();
  };

  const resetForm = () => {
    setFormName(''); setFormContact(''); setFormIssuer(''); setFormOpenDate('');
    setFormLimit(''); setFormBalance(''); setFormBureaus([]); setFormSlots('2'); setFormStmtClose('');
  };

  const findMatches = async () => {
    if (!matchClient) { toast.error('Select a client'); return; }
    setMatching(true);
    try {
      const cl = clients.find(c => c.id === matchClient);
      const { data: dfs } = await supabase.from('funding_dfs_scores')
        .select('personal_credit_tu, personal_credit_eq, personal_credit_ex')
        .eq('client_id', matchClient).order('scored_at', { ascending: false }).limit(1).maybeSingle();

      const availableCards = cards.filter(c => c.is_active && (c.available_au_slots ?? 0) - (c.occupied_slots ?? 0) > 0);

      const { data, error } = await supabase.functions.invoke('funding-ai-agent', {
        body: {
          action: 'match_tradelines',
          client: { first_name: cl?.first_name, last_name: cl?.last_name },
          scores: { tu: dfs?.personal_credit_tu, eq: dfs?.personal_credit_eq, ex: dfs?.personal_credit_ex },
          available_cards: availableCards.map(c => ({
            id: c.id, issuer: c.issuer, age_months: c.account_age_months, limit: c.credit_limit,
            utilization: c.current_utilization, bureaus: c.reporting_bureaus, price: c.price_per_slot,
          })),
        },
      });
      if (error) throw error;
      setMatchResult(data.matches || data.raw || 'No result');
      toast.success('Matches found');
    } catch (e: any) {
      toast.error(e.message || 'Match failed');
    } finally {
      setMatching(false);
    }
  };

  const assignTradeline = async (card: VaultCard) => {
    if (!matchClient) return;
    const cl = clients.find(c => c.id === matchClient);
    const stmtDay = card.statement_close_date || 15;
    const now = new Date();
    let reportDate = new Date(now.getFullYear(), now.getMonth(), stmtDay + 7);
    if (reportDate <= now) reportDate = new Date(now.getFullYear(), now.getMonth() + 1, stmtDay + 7);

    const { error } = await supabase.from('funding_tradeline_vault_transactions').insert({
      vault_card_id: card.id,
      buyer_client_id: matchClient,
      buyer_name: cl ? `${cl.first_name} ${cl.last_name}` : 'Unknown',
      price: card.price_per_slot,
      status: 'active',
      au_added_date: new Date().toISOString().split('T')[0],
      expected_reporting_date: reportDate.toISOString().split('T')[0],
      payout_status: 'pending',
      cardholder_payout: (card.price_per_slot ?? 0) * 0.6,
    });
    if (error) { toast.error('Assignment failed'); return; }
    // Update occupied slots
    await supabase.from('funding_tradeline_vault_cards').update({ occupied_slots: (card.occupied_slots ?? 0) + 1 }).eq('id', card.id);
    toast.success('Tradeline assigned');
    loadData();
  };

  const markReported = async (txn: VaultTxn) => {
    await supabase.from('funding_tradeline_vault_transactions').update({
      actual_reporting_date: new Date().toISOString().split('T')[0],
      status: 'reported',
      payout_status: 'ready',
    }).eq('id', txn.id);
    toast.success('Marked as reported');
    loadData();
  };

  // Vault summary
  const totalCards = cards.length;
  const totalSlots = cards.reduce((s, c) => s + (c.available_au_slots ?? 0), 0);
  const occupiedSlots = cards.reduce((s, c) => s + (c.occupied_slots ?? 0), 0);
  const monthlyRevenue = txns.filter(t => t.status === 'active').reduce((s, t) => s + (t.price ?? 0), 0);
  const projectedRevenue = cards.reduce((s, c) => s + (c.available_au_slots ?? 0) * (c.price_per_slot ?? 0), 0);

  // Reporting calendar
  const calendarDays = useMemo(() => {
    const days: Record<number, number> = {};
    txns.filter(t => t.expected_reporting_date && t.status === 'active').forEach(t => {
      const day = new Date(t.expected_reporting_date!).getDate();
      days[day] = (days[day] || 0) + 1;
    });
    return days;
  }, [txns]);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-amber-400 flex items-center gap-2"><FileText className="h-8 w-8" /> Tradeline Vault</h1>
          <p className="text-muted-foreground">AU tradeline management — cardholders & buyers</p>
        </div>
      </div>

      <Tabs defaultValue="cardholders">
        <TabsList className="bg-card border">
          <TabsTrigger value="cardholders">Cardholders</TabsTrigger>
          <TabsTrigger value="buyers">Buyers</TabsTrigger>
        </TabsList>

        {/* === CARDHOLDERS TAB === */}
        <TabsContent value="cardholders" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button className="bg-amber-600 hover:bg-amber-700"><Plus className="h-4 w-4 mr-2" /> Add Cardholder</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Add Cardholder Card</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Full Name *</Label><Input value={formName} onChange={e => setFormName(e.target.value)} /></div>
                    <div><Label>Contact</Label><Input value={formContact} onChange={e => setFormContact(e.target.value)} placeholder="Phone/Email" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Card Issuer *</Label><Input value={formIssuer} onChange={e => setFormIssuer(e.target.value)} placeholder="Chase, Amex…" /></div>
                    <div><Label>Account Open Date *</Label><Input type="date" value={formOpenDate} onChange={e => setFormOpenDate(e.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Credit Limit *</Label><Input type="number" value={formLimit} onChange={e => setFormLimit(e.target.value)} /></div>
                    <div><Label>Current Balance</Label><Input type="number" value={formBalance} onChange={e => setFormBalance(e.target.value)} /></div>
                  </div>
                  <div>
                    <Label>Reporting Bureaus</Label>
                    <div className="flex flex-wrap gap-3 mt-1">
                      {BUREAU_OPTIONS.map(b => (
                        <div key={b} className="flex items-center gap-1">
                          <Checkbox checked={formBureaus.includes(b)} onCheckedChange={v => setFormBureaus(prev => v ? [...prev, b] : prev.filter(x => x !== b))} />
                          <span className="text-xs">{b}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>AU Slots Available</Label><Input type="number" value={formSlots} onChange={e => setFormSlots(e.target.value)} /></div>
                    <div><Label>Statement Close Day (1-31)</Label><Input type="number" value={formStmtClose} onChange={e => setFormStmtClose(e.target.value)} /></div>
                  </div>
                  {computedPrice > 0 && (
                    <div className="p-3 rounded-lg bg-amber-600/10 border border-amber-500/30 text-center">
                      <span className="text-sm text-muted-foreground">Calculated Price: </span>
                      <span className="text-xl font-black text-amber-400">${computedPrice}/slot</span>
                    </div>
                  )}
                  <Button onClick={addCard} className="w-full bg-amber-600 hover:bg-amber-700">Save Card</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Cards table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-muted-foreground text-xs">
                <th className="text-left p-2">Cardholder</th><th className="text-left p-2">Issuer</th><th className="p-2">Age</th>
                <th className="p-2">Limit</th><th className="p-2">Util%</th><th className="p-2">Bureaus</th>
                <th className="p-2">Slots</th><th className="p-2">Price</th><th className="p-2">Status</th>
              </tr></thead>
              <tbody>
                {cards.map(c => (
                  <tr key={c.id} className="border-b hover:bg-muted/30">
                    <td className="p-2 font-medium">{c.cardholder_name || 'Unknown'}</td>
                    <td className="p-2">{c.issuer}</td>
                    <td className="p-2 text-center">{c.account_age_months ? `${Math.floor(c.account_age_months / 12)}y ${c.account_age_months % 12}m` : '—'}</td>
                    <td className="p-2 text-center">{c.credit_limit ? `$${c.credit_limit.toLocaleString()}` : '—'}</td>
                    <td className="p-2 text-center">
                      <span className={(c.current_utilization ?? 0) > 30 ? 'text-red-400' : (c.current_utilization ?? 0) > 10 ? 'text-amber-400' : 'text-green-400'}>
                        {c.current_utilization ?? 0}%
                      </span>
                    </td>
                    <td className="p-2"><div className="flex gap-1 flex-wrap">{c.reporting_bureaus?.map(b => <Badge key={b} variant="outline" className="text-[10px]">{b}</Badge>)}</div></td>
                    <td className="p-2 text-center">{c.occupied_slots ?? 0}/{c.available_au_slots ?? 0}</td>
                    <td className="p-2 text-center text-amber-400 font-bold">${c.price_per_slot ?? 0}</td>
                    <td className="p-2 text-center"><Badge className={c.is_active ? 'bg-green-600/20 text-green-400' : 'bg-muted text-muted-foreground'}>{c.is_active ? 'Active' : 'Inactive'}</Badge></td>
                  </tr>
                ))}
                {cards.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No cards enrolled. Add your first cardholder above.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Vault Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Total Cards', value: totalCards },
              { label: 'Total Slots', value: totalSlots },
              { label: 'Occupied', value: occupiedSlots },
              { label: 'Monthly Revenue', value: `$${monthlyRevenue.toLocaleString()}` },
              { label: 'Projected (Full)', value: `$${projectedRevenue.toLocaleString()}` },
            ].map(s => (
              <Card key={s.label}><CardContent className="p-4 text-center"><div className="text-xs text-muted-foreground">{s.label}</div><div className="text-xl font-black text-amber-400">{s.value}</div></CardContent></Card>
            ))}
          </div>
        </TabsContent>

        {/* === BUYERS TAB === */}
        <TabsContent value="buyers" className="space-y-4">
          {/* Match Engine */}
          <Card className="border-amber-500/30">
            <CardHeader><CardTitle className="text-amber-400 flex items-center gap-2"><Search className="h-5 w-5" /> Tradeline Match Engine</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Label>Select Client</Label>
                  <Select value={matchClient} onValueChange={setMatchClient}>
                    <SelectTrigger><SelectValue placeholder="Choose client…" /></SelectTrigger>
                    <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button onClick={findMatches} disabled={matching} className="bg-amber-600 hover:bg-amber-700">
                  {matching ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Matching…</> : <><Search className="h-4 w-4 mr-2" /> Find Best Tradelines</>}
                </Button>
              </div>
              {matchResult && (
                <div className="p-4 rounded-lg bg-card border border-amber-500/20 space-y-3">
                  <h4 className="text-sm font-bold text-amber-400">AI Recommendations</h4>
                  <div className="text-sm whitespace-pre-wrap">{matchResult}</div>
                  {matchClient && cards.filter(c => c.is_active && (c.available_au_slots ?? 0) - (c.occupied_slots ?? 0) > 0).length > 0 && (
                    <div className="pt-3 border-t space-y-2">
                      <h5 className="text-xs font-bold">Quick Assign:</h5>
                      <div className="flex flex-wrap gap-2">
                        {cards.filter(c => c.is_active && (c.available_au_slots ?? 0) - (c.occupied_slots ?? 0) > 0).map(c => (
                          <Button key={c.id} size="sm" variant="outline" onClick={() => assignTradeline(c)}>
                            Assign {c.issuer} ({Math.floor((c.account_age_months ?? 0) / 12)}yr, ${c.price_per_slot})
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Assignments */}
          <Card>
            <CardHeader><CardTitle className="text-base">Active Assignments</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-muted-foreground text-xs">
                  <th className="text-left p-2">Client</th><th className="p-2">Card</th><th className="p-2">Assigned</th>
                  <th className="p-2">Expected Report</th><th className="p-2">Status</th><th className="p-2">Payout</th><th className="p-2">Action</th>
                </tr></thead>
                <tbody>
                  {txns.map(t => {
                    const card = cards.find(c => c.id === t.vault_card_id);
                    return (
                      <tr key={t.id} className="border-b">
                        <td className="p-2">{t.buyer_name || '—'}</td>
                        <td className="p-2">{card?.issuer || '—'} ({card?.cardholder_name || ''})</td>
                        <td className="p-2 text-center">{t.au_added_date || '—'}</td>
                        <td className="p-2 text-center">{t.expected_reporting_date || '—'}</td>
                        <td className="p-2 text-center"><Badge variant="outline">{t.status}</Badge></td>
                        <td className="p-2 text-center">{t.payout_status} — ${t.cardholder_payout ?? 0}</td>
                        <td className="p-2 text-center">
                          {t.status === 'active' && <Button size="sm" variant="outline" onClick={() => markReported(t)}>Mark Reported</Button>}
                        </td>
                      </tr>
                    );
                  })}
                  {txns.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No assignments yet</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Reporting Calendar */}
          <Card className="border-amber-500/30">
            <CardHeader><CardTitle className="text-amber-400 flex items-center gap-2"><Calendar className="h-5 w-5" /> Reporting Calendar</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                  <div key={day} className={`p-2 text-center rounded text-xs border ${calendarDays[day] ? 'border-amber-500/50 bg-amber-500/10' : 'border-border'}`}>
                    <div className="text-muted-foreground">{day}</div>
                    {calendarDays[day] && <div className="text-amber-400 font-bold">{calendarDays[day]}</div>}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Numbers show tradelines expected to report on each day of the month</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
