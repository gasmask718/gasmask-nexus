import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Building2, ArrowLeft, RefreshCw, Brain, Lock, ExternalLink, TrendingUp
} from "lucide-react";

const TIER1_VENDORS = [
  { name: 'Uline', bureaus: ['D&B', 'Experian Business'], minOrder: '$50', terms: 'Net 30', url: 'https://www.uline.com' },
  { name: 'Quill', bureaus: ['D&B'], minOrder: '$50', terms: 'Net 30', url: 'https://www.quill.com' },
  { name: 'Grainger', bureaus: ['D&B'], minOrder: '$100', terms: 'Net 30', url: 'https://www.grainger.com' },
  { name: 'Crown Office Supplies', bureaus: ['D&B', 'Experian Business'], minOrder: '$50', terms: 'Net 30', url: 'https://www.crownofficesupplies.com' },
  { name: 'Wise Business Plans', bureaus: ['D&B'], minOrder: '$199', terms: 'Net 30', url: 'https://www.wisebusinessplans.com' },
  { name: 'CEO Creative', bureaus: ['D&B', 'Experian Business'], minOrder: '$50', terms: 'Net 30', url: 'https://www.ceocreative.com' },
  { name: 'Shirtsy', bureaus: ['D&B'], minOrder: '$40', terms: 'Net 30', url: 'https://www.shirtsy.com' },
  { name: 'Nav', bureaus: ['D&B', 'Experian Business'], minOrder: 'Free', terms: 'Monitoring', url: 'https://www.nav.com' },
];

const TIER2_CARDS = [
  { name: 'Staples Business', min: '4 Tier 1 accounts, 60+ days' },
  { name: 'Home Depot Commercial', min: '4 Tier 1 accounts, Paydex 50+' },
  { name: 'Amazon Business', min: '4 Tier 1 accounts, D&B file' },
  { name: 'Walmart Business', min: '4 Tier 1 accounts, Paydex 60+' },
];

const TIER3_CARDS = [
  { name: 'Chase Ink Business', min: 'Paydex 70+, 6+ Tier 2 accounts' },
  { name: 'Amex Business Gold', min: 'Paydex 70+, $10K+ revenue' },
  { name: 'Capital One Spark', min: 'Paydex 65+, 12+ months' },
  { name: 'Fleet Cards (WEX, Fuelman)', min: 'Paydex 60+, established D&B' },
];

export default function BusinessBuilderPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const clientId = searchParams.get('client');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [paymentStrategy, setPaymentStrategy] = useState<string | null>(null);
  const [vendorInstructions, setVendorInstructions] = useState<Record<string, string>>({});
  const [loadingVendor, setLoadingVendor] = useState<string | null>(null);

  const { data: clients = [] } = useQuery({
    queryKey: ['funding-clients-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('funding_clients').select('id, first_name, last_name, business_name').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: client } = useQuery({
    queryKey: ['funding-client', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase.from('funding_clients').select('*').eq('id', clientId!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: tradelines = [], isLoading } = useQuery({
    queryKey: ['funding-tradelines', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase.from('funding_tradeline_accounts').select('*').eq('client_id', clientId!).order('tier', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const tier1Count = tradelines.filter(t => t.tier === 1 && t.is_active).length;
  const tier2Count = tradelines.filter(t => t.tier === 2 && t.is_active).length;
  const tier2Unlocked = tier1Count >= 4;
  const tier3Unlocked = tier2Count >= 4 && tier2Unlocked;

  // Calculate Paydex (simplified: avg of paydex_contribution across active accounts)
  const activeAccounts = tradelines.filter(t => t.is_active);
  const paydex = activeAccounts.length > 0
    ? Math.round(activeAccounts.reduce((s, t) => s + (t.paydex_contribution || 0), 0) / activeAccounts.length)
    : 0;

  const generatePaymentStrategy = async () => {
    if (tradelines.length === 0) { toast.error('No tradeline accounts to analyze'); return; }
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('funding-ai-agent', {
        body: {
          action: 'payment_strategy',
          accounts: tradelines,
          current_paydex: paydex,
          client: client ? { first_name: client.first_name, last_name: client.last_name, business_name: client.business_name } : null,
        },
      });
      if (error) throw error;
      if (data?.strategy) {
        setPaymentStrategy(data.strategy);
        toast.success('Payment strategy generated');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateVendorInstructions = async (vendorName: string) => {
    setLoadingVendor(vendorName);
    try {
      const { data, error } = await supabase.functions.invoke('funding-ai-agent', {
        body: {
          action: 'vendor_instructions',
          vendor_name: vendorName,
          client: client ? { first_name: client.first_name, last_name: client.last_name, business_name: client.business_name, ein: client.ein } : null,
        },
      });
      if (error) throw error;
      if (data?.instructions) {
        setVendorInstructions(prev => ({ ...prev, [vendorName]: data.instructions }));
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoadingVendor(null);
    }
  };

  if (!clientId) {
    return (
      <div className="min-h-screen p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/funding-machine')} size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">Business Credit Builder</h1>
        </div>
        <Card className="border-blue-500/20 max-w-lg mx-auto">
          <CardHeader><CardTitle>Select a Client</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {clients.map(c => (
              <Button key={c.id} variant="outline" className="w-full justify-start border-border/50 hover:border-blue-500/40"
                onClick={() => navigate(`/funding-machine/business-builder?client=${c.id}`)}>
                {c.first_name} {c.last_name} {c.business_name && `— ${c.business_name}`}
              </Button>
            ))}
            {clients.length === 0 && <p className="text-muted-foreground text-center py-4">No clients yet.</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  const getUtilColor = (pct: number | null) => {
    if (!pct) return 'text-muted-foreground';
    if (pct < 10) return 'text-emerald-400';
    if (pct < 30) return 'text-amber-400';
    return 'text-red-400';
  };

  const getUtilBg = (pct: number | null) => {
    if (!pct) return 'bg-muted';
    if (pct < 10) return 'bg-emerald-500/10 border-emerald-500/20';
    if (pct < 30) return 'bg-amber-500/10 border-amber-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/funding-machine')} size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">Business Credit Builder</h1>
          {client && <p className="text-muted-foreground">{client.first_name} {client.last_name} — {client.business_name || 'No entity'}</p>}
        </div>
      </div>

      {/* ═══ PAYDEX TRACKER ═══ */}
      <Card className="border-blue-500/20 bg-gradient-to-br from-background to-blue-500/5">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-blue-500" /> Paydex Score Tracker</span>
            <Button onClick={generatePaymentStrategy} disabled={isAnalyzing || tradelines.length === 0}
              className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white">
              {isAnalyzing ? <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Analyzing...</> : <><Brain className="h-4 w-4 mr-1" /> Generate Payment Strategy</>}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-8 mb-6">
            {/* Circular Gauge */}
            <div className="relative w-40 h-40 flex-shrink-0">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                <circle cx="60" cy="60" r="52" fill="none"
                  stroke={paydex >= 80 ? '#22c55e' : paydex >= 50 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${(paydex / 100) * 327} 327`} />
                {/* 80 threshold marker */}
                <circle cx="60" cy="60" r="52" fill="none"
                  stroke="#f59e0b" strokeWidth="2" strokeDasharray="3 324"
                  strokeDashoffset={`${-(80 / 100) * 327}`} opacity="0.5" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-bold ${paydex >= 80 ? 'text-emerald-400' : paydex >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{paydex}</span>
                <span className="text-xs text-muted-foreground">/ 100</span>
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-sm text-muted-foreground">Institutional Threshold: 80</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-muted/20">
                  <p className="text-xs text-muted-foreground">Active Accounts</p>
                  <p className="text-xl font-bold">{activeAccounts.length}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/20">
                  <p className="text-xs text-muted-foreground">Tier 1</p>
                  <p className="text-xl font-bold text-blue-400">{tier1Count}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/20">
                  <p className="text-xs text-muted-foreground">Tier 2</p>
                  <p className="text-xl font-bold text-purple-400">{tier2Count}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Active tradeline accounts table */}
          {isLoading ? (
            <div className="flex justify-center py-4"><RefreshCw className="h-6 w-6 animate-spin text-blue-500" /></div>
          ) : tradelines.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left p-2 text-xs font-medium text-muted-foreground">Account</th>
                    <th className="text-left p-2 text-xs font-medium text-muted-foreground">Limit</th>
                    <th className="text-left p-2 text-xs font-medium text-muted-foreground">Balance</th>
                    <th className="text-left p-2 text-xs font-medium text-muted-foreground">Util %</th>
                    <th className="text-left p-2 text-xs font-medium text-muted-foreground">Bureaus</th>
                    <th className="text-left p-2 text-xs font-medium text-muted-foreground">Due Date</th>
                    <th className="text-left p-2 text-xs font-medium text-muted-foreground">Optimal Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {tradelines.map(t => (
                    <tr key={t.id} className={`border-b border-border/20 ${getUtilBg(t.utilization_pct)}`}>
                      <td className="p-2 font-medium text-sm">{t.vendor_name}</td>
                      <td className="p-2 text-sm">${Number(t.credit_limit || 0).toLocaleString()}</td>
                      <td className="p-2 text-sm">${Number(t.current_balance || 0).toLocaleString()}</td>
                      <td className={`p-2 text-sm font-bold ${getUtilColor(t.utilization_pct)}`}>{t.utilization_pct || 0}%</td>
                      <td className="p-2">
                        <div className="flex gap-1 flex-wrap">
                          {(t.reporting_bureaus || []).map(b => (
                            <Badge key={b} variant="outline" className="text-xs">{b}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="p-2 text-sm text-muted-foreground">{t.payment_due_date ? new Date(t.payment_due_date).toLocaleDateString() : '—'}</td>
                      <td className="p-2 text-sm text-amber-400 font-medium">{t.optimal_pay_date ? new Date(t.optimal_pay_date).toLocaleDateString() : '5 days before close'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">No tradeline accounts yet. Add Tier 1 vendors below.</p>
          )}

          {paymentStrategy && (
            <Card className="mt-4 border-blue-500/20 bg-blue-500/5">
              <CardContent className="p-4">
                <h4 className="font-semibold text-blue-400 mb-2 flex items-center gap-2"><Brain className="h-4 w-4" /> AI Payment Strategy</h4>
                <pre className="whitespace-pre-wrap text-sm text-muted-foreground">{paymentStrategy}</pre>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* ═══ TIER SEQUENCER ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Tier 1 */}
        <Card className="border-blue-500/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Tier 1</Badge>
              Vendor Accounts ({tier1Count}/4 minimum)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {TIER1_VENDORS.map(vendor => {
              const existing = tradelines.find(t => t.vendor_name === vendor.name);
              const instructions = vendorInstructions[vendor.name];
              return (
                <div key={vendor.name} className={`p-3 rounded-lg border transition-all ${existing ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/30'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{vendor.name}</span>
                    {existing && <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">Active</Badge>}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {vendor.bureaus.map(b => <Badge key={b} variant="outline" className="text-xs">{b}</Badge>)}
                    <span className="text-xs text-muted-foreground">Min: {vendor.minOrder}</span>
                    <span className="text-xs text-muted-foreground">{vendor.terms}</span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <a href={vendor.url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="ghost" className="text-xs h-7"><ExternalLink className="h-3 w-3 mr-1" /> Visit</Button>
                    </a>
                    <Button size="sm" variant="ghost" className="text-xs h-7" disabled={loadingVendor === vendor.name}
                      onClick={() => generateVendorInstructions(vendor.name)}>
                      {loadingVendor === vendor.name ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Brain className="h-3 w-3 mr-1" />}
                      Step by Step
                    </Button>
                  </div>
                  {instructions && (
                    <div className="mt-2 p-2 rounded bg-muted/20 text-xs">
                      <pre className="whitespace-pre-wrap">{instructions}</pre>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Tier 2 */}
        <Card className={`border-purple-500/20 ${!tier2Unlocked ? 'opacity-60' : ''}`}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Tier 2</Badge>
              Store Business Cards
              {!tier2Unlocked && <Lock className="h-4 w-4 text-muted-foreground" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!tier2Unlocked ? (
              <div className="text-center py-8">
                <Lock className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Requires minimum 4 active Tier 1 accounts</p>
                <p className="text-xs text-muted-foreground mt-1">Currently: {tier1Count}/4</p>
                <div className="w-full bg-muted rounded-full h-2 mt-3">
                  <div className="bg-purple-500 rounded-full h-2 transition-all" style={{ width: `${Math.min((tier1Count / 4) * 100, 100)}%` }} />
                </div>
              </div>
            ) : TIER2_CARDS.map(card => (
              <div key={card.name} className="p-3 rounded-lg border border-border/30">
                <p className="font-medium text-sm">{card.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.min}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Tier 3 */}
        <Card className={`border-amber-500/20 ${!tier3Unlocked ? 'opacity-60' : ''}`}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Tier 3</Badge>
              National Bank Cards
              {!tier3Unlocked && <Lock className="h-4 w-4 text-muted-foreground" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!tier3Unlocked ? (
              <div className="text-center py-8">
                <Lock className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Requires Tier 2 unlocked + 4 Tier 2 accounts</p>
                <p className="text-xs text-muted-foreground mt-1">Tier 2: {tier2Count}/4 • Paydex: {paydex}/70</p>
                <div className="w-full bg-muted rounded-full h-2 mt-3">
                  <div className="bg-amber-500 rounded-full h-2 transition-all" style={{ width: `${Math.min((paydex / 70) * 100, 100)}%` }} />
                </div>
              </div>
            ) : TIER3_CARDS.map(card => (
              <div key={card.name} className="p-3 rounded-lg border border-border/30">
                <p className="font-medium text-sm">{card.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.min}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
