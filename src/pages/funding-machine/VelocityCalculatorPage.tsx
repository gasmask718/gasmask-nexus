import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TrendingUp, Loader2, ArrowRight, CheckCircle2, Building2, Link2, RefreshCw, AlertTriangle, Calculator } from 'lucide-react';
import FundingQualificationCalculator from './FundingQualificationCalculator';

interface FundingClient {
  id: string;
  first_name: string;
  last_name: string;
  monthly_revenue: number | null;
  time_in_business_months: number | null;
}

interface VelocityRow {
  id: string;
  month_number: number;
  target_avg_daily_balance: number | null;
  target_monthly_deposits: number | null;
  target_transaction_count: number | null;
  actual_avg_daily_balance: number | null;
  actual_monthly_deposits: number | null;
  actual_transaction_count: number | null;
  is_on_track: boolean | null;
  notes: string | null;
}

interface Institution {
  name: string;
  initials: string;
  products: Product[];
}

interface Product {
  label: string;
  key: string;
  adb: number;
  monthlyDeposits: number;
  transactions: number;
  accountAgeMonths: number;
  notes?: string;
}

const INSTITUTIONS: Institution[] = [
  {
    name: 'Chase Business', initials: 'CH',
    products: [
      { label: 'Business Line $25K', key: 'chase_25k', adb: 2500, monthlyDeposits: 5000, transactions: 15, accountAgeMonths: 3 },
      { label: 'Business Line $50K', key: 'chase_50k', adb: 5000, monthlyDeposits: 10000, transactions: 20, accountAgeMonths: 6 },
      { label: 'Business Line $100K', key: 'chase_100k', adb: 10000, monthlyDeposits: 25000, transactions: 30, accountAgeMonths: 12 },
    ],
  },
  {
    name: 'Bank of America', initials: 'BA',
    products: [
      { label: 'Business Line $25K', key: 'boa_25k', adb: 2000, monthlyDeposits: 4000, transactions: 12, accountAgeMonths: 3 },
    ],
  },
  {
    name: 'Wells Fargo Business', initials: 'WF',
    products: [
      { label: 'Business Line $25K', key: 'wf_25k', adb: 3000, monthlyDeposits: 5000, transactions: 15, accountAgeMonths: 6 },
    ],
  },
  {
    name: 'Amex Business', initials: 'AX',
    products: [
      { label: 'Business Line', key: 'amex_biz', adb: 1000, monthlyDeposits: 3000, transactions: 10, accountAgeMonths: 6, notes: 'Spend $3K+ on existing Amex card monthly' },
    ],
  },
  {
    name: 'Navy Federal', initials: 'NF',
    products: [
      { label: 'Business Loan $50K', key: 'nfcu_50k', adb: 1500, monthlyDeposits: 3000, transactions: 10, accountAgeMonths: 3, notes: 'Member 90 days, direct deposit required' },
    ],
  },
  {
    name: 'Mercury', initials: 'ME',
    products: [
      { label: 'Mercury → Bluevine $150K', key: 'mercury_bv', adb: 5000, monthlyDeposits: 15000, transactions: 15, accountAgeMonths: 3, notes: '90 days activity qualifies for Bluevine LOC' },
    ],
  },
  {
    name: 'Relay', initials: 'RE',
    products: [
      { label: 'Relay → Fundbox $100K', key: 'relay_fb', adb: 3000, monthlyDeposits: 10000, transactions: 10, accountAgeMonths: 3 },
    ],
  },
  {
    name: 'Bluevine', initials: 'BV',
    products: [
      { label: 'Line of Credit $150K', key: 'bv_150k', adb: 5000, monthlyDeposits: 15000, transactions: 15, accountAgeMonths: 3 },
    ],
  },
  {
    name: 'Fundbox', initials: 'FB',
    products: [
      { label: 'Line of Credit $150K', key: 'fb_150k', adb: 3000, monthlyDeposits: 10000, transactions: 10, accountAgeMonths: 3 },
    ],
  },
];

const COMPOUNDING_CHAINS = [
  { steps: ['Mercury', 'Bluevine $150K LOC', 'Chase $50K Line'], label: 'Fintech → LOC → Bank Line' },
  { steps: ['Relay', 'Fundbox $150K', 'BofA $25K Line'], label: 'Fintech → LOC → National Bank' },
  { steps: ['Navy Federal (member)', 'Navy Federal $50K Loan', 'SBA Express $500K'], label: 'CU → Loan → SBA' },
];

function PlaidConnectionSection({ clientId }: { clientId: string }) {
  const [connection, setConnection] = useState<any>(null);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [noCredentials, setNoCredentials] = useState(false);

  useEffect(() => {
    supabase.from('funding_plaid_connections').select('*').eq('client_id', clientId).eq('is_active', true).limit(1).single()
      .then(({ data }) => { if (data) setConnection(data); });
  }, [clientId]);

  const connectBank = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('funding-plaid', {
        body: { action: 'create_link_token', client_id: clientId },
      });
      if (error) throw error;
      if (data?.error?.code === 'NO_PLAID_CREDENTIALS') {
        setNoCredentials(true);
        return;
      }
      // In production, load Plaid Link SDK here. For now show the link token was created.
      toast.success('Plaid Link token created. Plaid Link SDK integration ready.');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setConnecting(false);
    }
  };

  const syncTransactions = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('funding-plaid', {
        body: { action: 'sync_transactions', client_id: clientId },
      });
      if (error) throw error;
      toast.success(`Synced ${data.transactions_synced} transactions`);
      // Reload connection
      const { data: conn } = await supabase.from('funding_plaid_connections').select('*').eq('client_id', clientId).eq('is_active', true).limit(1).single();
      if (conn) setConnection(conn);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card className="border-amber-500/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4 text-amber-500" /> Banking Connection
          <Badge variant="outline" className="border-amber-500/40 text-amber-400">Plaid Sandbox</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400 mb-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          This connection uses Plaid&apos;s <strong>sandbox</strong> environment. Balances and transactions shown here are test data, not live banking data.
        </div>

        {noCredentials && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm text-amber-400 mb-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            Plaid integration requires API credentials — add PLAID_CLIENT_ID and PLAID_SECRET in your edge function secrets to enable automatic velocity tracking.
          </div>
        )}
        {connection ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <div>
                <div className="font-semibold">{connection.institution_name}</div>
                <div className="text-xs text-muted-foreground">
                  Connected {new Date(connection.created_at).toLocaleDateString()}
                  {connection.last_synced_at && <> • Last synced {new Date(connection.last_synced_at).toLocaleDateString()}</>}
                </div>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={syncTransactions} disabled={syncing} className="border-amber-500/30 text-amber-400">
              {syncing ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Syncing...</> : <><RefreshCw className="h-3 w-3 mr-1" /> Sync Now</>}
            </Button>
          </div>
        ) : (
          <Button onClick={connectBank} disabled={connecting} variant="outline" className="border-amber-500/30 text-amber-400">
            {connecting ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Connecting...</> : <><Link2 className="h-3 w-3 mr-1" /> Connect Bank Account</>}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function VelocityCalculatorPage() {
  const [clients, setClients] = useState<FundingClient[]>([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [client, setClient] = useState<FundingClient | null>(null);
  const [selectedInst, setSelectedInst] = useState<Institution | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [velocityRows, setVelocityRows] = useState<VelocityRow[]>([]);
  const [generating, setGenerating] = useState(false);
  const [aiPlan, setAiPlan] = useState('');
  const [completedActions, setCompletedActions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    supabase.from('funding_clients').select('id, first_name, last_name, monthly_revenue, time_in_business_months').then(({ data }) => {
      if (data) setClients(data);
    });
  }, []);

  useEffect(() => {
    if (!selectedClient) return;
    setClient(clients.find(c => c.id === selectedClient) || null);
  }, [selectedClient, clients]);

  // Load existing velocity rows when client + institution selected
  useEffect(() => {
    if (!selectedClient || !selectedInst) return;
    supabase.from('funding_banking_velocity')
      .select('id, month_number, target_avg_daily_balance, target_monthly_deposits, target_transaction_count, actual_avg_daily_balance, actual_monthly_deposits, actual_transaction_count, is_on_track, notes')
      .eq('client_id', selectedClient)
      .eq('institution', selectedInst.name)
      .order('month_number')
      .then(({ data }) => setVelocityRows(data || []));
  }, [selectedClient, selectedInst]);

  const saveVelocityPlan = async (product: Product) => {
    if (!selectedClient || !selectedInst) return;
    const rows = [1, 2, 3].map(m => ({
      client_id: selectedClient,
      institution: selectedInst.name,
      target_product: product.label,
      month_number: m,
      target_avg_daily_balance: product.adb,
      target_monthly_deposits: product.monthlyDeposits,
      target_transaction_count: product.transactions,
    }));
    const { error } = await supabase.from('funding_banking_velocity').upsert(rows, { onConflict: 'client_id,institution,month_number', ignoreDuplicates: false });
    if (error) toast.error('Failed to save plan');
    else {
      toast.success('Velocity plan saved');
      // Reload
      const { data } = await supabase.from('funding_banking_velocity')
        .select('id, month_number, target_avg_daily_balance, target_monthly_deposits, target_transaction_count, actual_avg_daily_balance, actual_monthly_deposits, actual_transaction_count, is_on_track, notes')
        .eq('client_id', selectedClient).eq('institution', selectedInst.name).order('month_number');
      setVelocityRows(data || []);
    }
  };

  const generateAIPlan = async () => {
    if (!client || !selectedInst || !selectedProduct) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('funding-ai-agent', {
        body: {
          action: 'generate_velocity_plan',
          institution: selectedInst.name,
          product: selectedProduct.label,
          requirements: { adb: selectedProduct.adb, deposits: selectedProduct.monthlyDeposits, transactions: selectedProduct.transactions, months: selectedProduct.accountAgeMonths },
          client: { first_name: client.first_name, last_name: client.last_name, monthly_revenue: client.monthly_revenue, time_in_business_months: client.time_in_business_months },
        },
      });
      if (error) throw error;
      setAiPlan(data.plan || data.raw || 'No result');
      toast.success('AI velocity plan generated');
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    } finally {
      setGenerating(false);
    }
  };

  const fmt = (n: number) => `$${n.toLocaleString()}`;

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-amber-400 flex items-center gap-2"><TrendingUp className="h-8 w-8" /> Velocity Calculator</h1>
          <p className="text-muted-foreground">Banking activity requirements & funding qualification</p>
        </div>
      </div>

      <Tabs defaultValue="banking" className="space-y-4">
        <TabsList>
          <TabsTrigger value="banking" className="gap-2">
            <TrendingUp className="h-4 w-4" /> Banking Velocity
          </TabsTrigger>
          <TabsTrigger value="qualification" className="gap-2">
            <Calculator className="h-4 w-4" /> Funding Estimator
          </TabsTrigger>
        </TabsList>

        <TabsContent value="qualification">
          <FundingQualificationCalculator />
        </TabsContent>

        <TabsContent value="banking" className="space-y-6">
          <div className="flex items-center justify-end">
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Select client…" /></SelectTrigger>
              <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

      {!selectedClient ? (
        <Card className="border-dashed"><CardContent className="py-16 text-center text-muted-foreground">Select a client to calculate velocity requirements</CardContent></Card>
      ) : (
        <>
          {/* Plaid Banking Connection */}
          <PlaidConnectionSection clientId={selectedClient} />

          {/* Section 1 — Institution Grid */}
          <div>
            <h2 className="text-lg font-bold mb-3">Select Institution</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
              {INSTITUTIONS.map(inst => (
                <Card key={inst.name}
                  className={`cursor-pointer transition-all ${selectedInst?.name === inst.name ? 'border-amber-500 bg-amber-500/10' : 'border-border hover:border-amber-500/50'}`}
                  onClick={() => { setSelectedInst(inst); setSelectedProduct(null); setAiPlan(''); }}>
                  <CardContent className="p-4 text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-amber-600/20 flex items-center justify-center mx-auto text-amber-400 font-black text-lg">{inst.initials}</div>
                    <div className="text-sm font-semibold">{inst.name}</div>
                    <div className="text-[10px] text-muted-foreground">{inst.products.length} product{inst.products.length > 1 ? 's' : ''}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Section 2 — Product Selector */}
          {selectedInst && (
            <div>
              <h2 className="text-lg font-bold mb-3">Select Target Product — {selectedInst.name}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {selectedInst.products.map(prod => (
                  <Card key={prod.key}
                    className={`cursor-pointer transition-all ${selectedProduct?.key === prod.key ? 'border-amber-500 bg-amber-500/10' : 'border-border hover:border-amber-500/50'}`}
                    onClick={() => { setSelectedProduct(prod); setAiPlan(''); }}>
                    <CardContent className="p-4">
                      <div className="font-semibold">{prod.label}</div>
                      <div className="text-xs text-muted-foreground mt-1">{prod.accountAgeMonths} months account age required</div>
                      {prod.notes && <div className="text-xs text-amber-400 mt-1">{prod.notes}</div>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Section 3 — Velocity Requirements */}
          {selectedProduct && (
            <Card className="border-amber-500/30">
              <CardHeader><CardTitle className="text-amber-400">Velocity Requirements — {selectedProduct.label}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="p-4 rounded-lg bg-card border"><div className="text-xs text-muted-foreground">Avg Daily Balance</div><div className="text-2xl font-black text-amber-400">{fmt(selectedProduct.adb)}</div></div>
                  <div className="p-4 rounded-lg bg-card border"><div className="text-xs text-muted-foreground">Monthly Deposits</div><div className="text-2xl font-black text-amber-400">{fmt(selectedProduct.monthlyDeposits)}</div></div>
                  <div className="p-4 rounded-lg bg-card border"><div className="text-xs text-muted-foreground">Monthly Transactions</div><div className="text-2xl font-black text-amber-400">{selectedProduct.transactions}</div></div>
                  <div className="p-4 rounded-lg bg-card border"><div className="text-xs text-muted-foreground">Account Age</div><div className="text-2xl font-black text-amber-400">{selectedProduct.accountAgeMonths}mo</div></div>
                </div>
                {selectedProduct.notes && <div className="mt-3 text-sm text-amber-400/80 text-center">{selectedProduct.notes}</div>}
                <div className="flex gap-2 mt-4">
                  <Button onClick={() => saveVelocityPlan(selectedProduct)} variant="outline">Save Plan to Client</Button>
                  <Button onClick={generateAIPlan} disabled={generating} className="bg-amber-600 hover:bg-amber-700">
                    {generating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating…</> : <><TrendingUp className="h-4 w-4 mr-2" /> AI Generate Velocity Plan</>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Section 4 — Month-by-Month Plan */}
          {selectedProduct && (
            <div>
              <h2 className="text-lg font-bold mb-3">Month-by-Month Activity Plan</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map(month => {
                  const row = velocityRows.find(r => r.month_number === month);
                  const actions = [
                    { key: `${month}_deposit`, label: `Deposit ${fmt(selectedProduct.monthlyDeposits)} total this month` },
                    { key: `${month}_txns`, label: `Complete ${selectedProduct.transactions}+ transactions` },
                    { key: `${month}_balance`, label: `Maintain ${fmt(selectedProduct.adb)} average daily balance` },
                    ...(month === 1 ? [{ key: `${month}_dd`, label: 'Set up direct deposit / recurring transfers' }] : []),
                    ...(month === selectedProduct.accountAgeMonths ? [{ key: `${month}_apply`, label: '🎯 APPLY for target product' }] : []),
                  ];
                  return (
                    <Card key={month} className={row?.is_on_track ? 'border-green-500/30' : 'border-border'}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center justify-between">
                          Month {month}
                          {row?.is_on_track && <Badge className="bg-green-600/20 text-green-400">On Track</Badge>}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {actions.map(a => (
                          <div key={a.key} className="flex items-center gap-2">
                            <Checkbox checked={completedActions[a.key] || false} onCheckedChange={v => setCompletedActions(prev => ({ ...prev, [a.key]: !!v }))} />
                            <span className={`text-sm ${completedActions[a.key] ? 'line-through text-muted-foreground' : ''}`}>{a.label}</span>
                          </div>
                        ))}
                        {row && (
                          <div className="mt-2 pt-2 border-t text-xs space-y-2">
                            {[
                              { label: 'Avg Daily Balance', target: row.target_avg_daily_balance, actual: row.actual_avg_daily_balance },
                              { label: 'Monthly Deposits', target: row.target_monthly_deposits, actual: row.actual_monthly_deposits },
                              { label: 'Transactions', target: row.target_transaction_count, actual: row.actual_transaction_count },
                            ].map(metric => {
                              const pct = metric.target && metric.actual ? Math.min((metric.actual / metric.target) * 100, 100) : 0;
                              const color = pct >= 100 ? 'bg-emerald-500' : pct >= 80 ? 'bg-amber-500' : 'bg-red-500';
                              return (
                                <div key={metric.label}>
                                  <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                                    <span>{metric.label}</span>
                                    <span>
                                      <span className="text-foreground font-medium">{metric.actual != null ? (metric.label === 'Transactions' ? metric.actual : fmt(metric.actual)) : '—'}</span>
                                      {' / '}
                                      {metric.target != null ? (metric.label === 'Transactions' ? metric.target : fmt(metric.target)) : '—'}
                                    </span>
                                  </div>
                                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI Plan Result */}
          {aiPlan && (
            <Card className="border-amber-500/20">
              <CardHeader><CardTitle className="text-sm text-amber-400">AI Velocity Plan</CardTitle></CardHeader>
              <CardContent><div className="text-sm whitespace-pre-wrap">{aiPlan}</div></CardContent>
            </Card>
          )}

          {/* Section 5 — Compounding Effect */}
          <Card className="border-amber-500/30">
            <CardHeader><CardTitle className="text-amber-400 flex items-center gap-2"><Building2 className="h-5 w-5" /> Compounding Effect</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Completing velocity at one institution unlocks the next tier of funding products.</p>
              {COMPOUNDING_CHAINS.map((chain, ci) => (
                <div key={ci} className="p-3 rounded-lg border bg-card">
                  <div className="text-xs font-bold text-amber-400 mb-2">{chain.label}</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {chain.steps.map((step, si) => (
                      <div key={si} className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{step}</Badge>
                        {si < chain.steps.length - 1 && <ArrowRight className="h-3 w-3 text-amber-400" />}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
