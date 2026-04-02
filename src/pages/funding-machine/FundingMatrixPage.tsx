import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Landmark, ExternalLink, Loader2, Target, TrendingUp, Clock, CheckCircle2 } from 'lucide-react';

interface FundingClient {
  id: string;
  first_name: string;
  last_name: string;
  monthly_revenue: number | null;
  time_in_business_months: number | null;
  funding_goal: string | null;
  target_funding_amount: number | null;
}

interface DfsScores {
  total_score: number | null;
  personal_credit_tu: number | null;
  personal_credit_eq: number | null;
  personal_credit_ex: number | null;
}

interface LenderProduct {
  name: string;
  maxAmount: number;
  minScore: number;
  fundingSpeed: string;
  preQual: boolean;
  url?: string;
  category: 'personal' | 'business' | 'credit_line' | 'auto' | 'alternative';
  memberRequired?: boolean;
  minRevenue?: number;
  minMonths?: number;
}

const LENDERS: LenderProduct[] = [
  // Personal
  { name: 'LightStream', maxAmount: 100000, minScore: 680, fundingSpeed: 'Same day', preQual: true, url: 'https://www.lightstream.com', category: 'personal' },
  { name: 'SoFi', maxAmount: 100000, minScore: 680, fundingSpeed: '1–3 days', preQual: true, url: 'https://www.sofi.com', category: 'personal' },
  { name: 'Marcus by Goldman Sachs', maxAmount: 40000, minScore: 660, fundingSpeed: '1–4 days', preQual: true, url: 'https://www.marcus.com', category: 'personal' },
  { name: 'Discover Personal', maxAmount: 35000, minScore: 660, fundingSpeed: 'Next day', preQual: true, category: 'personal' },
  { name: 'Upstart', maxAmount: 50000, minScore: 580, fundingSpeed: '1 day', preQual: true, url: 'https://www.upstart.com', category: 'personal' },
  { name: 'Best Egg', maxAmount: 50000, minScore: 600, fundingSpeed: '1–3 days', preQual: true, category: 'personal' },
  { name: 'Avant', maxAmount: 35000, minScore: 580, fundingSpeed: 'Next day', preQual: true, category: 'personal' },
  { name: 'Navy Federal Personal', maxAmount: 50000, minScore: 650, fundingSpeed: 'Same day', preQual: false, memberRequired: true, category: 'personal' },
  // Business
  { name: 'Bluevine Line of Credit', maxAmount: 250000, minScore: 625, fundingSpeed: '24 hours', preQual: true, url: 'https://www.bluevine.com', category: 'business', minMonths: 6 },
  { name: 'Fundbox', maxAmount: 150000, minScore: 600, fundingSpeed: 'Next day', preQual: true, category: 'business', minMonths: 3 },
  { name: 'OnDeck Term Loan', maxAmount: 250000, minScore: 625, fundingSpeed: 'Same day', preQual: true, category: 'business' },
  { name: 'Credibly', maxAmount: 400000, minScore: 500, fundingSpeed: '24 hours', preQual: false, category: 'business' },
  { name: 'SBA 7(a)', maxAmount: 5000000, minScore: 680, fundingSpeed: '60–90 days', preQual: false, category: 'business' },
  { name: 'SBA Express', maxAmount: 500000, minScore: 650, fundingSpeed: '36 hours SBA', preQual: false, category: 'business' },
  { name: 'SBA Microloan', maxAmount: 50000, minScore: 575, fundingSpeed: '30–90 days', preQual: false, category: 'business' },
  // Credit Lines
  { name: 'Bluevine LOC', maxAmount: 250000, minScore: 625, fundingSpeed: '24 hours', preQual: true, url: 'https://www.bluevine.com', category: 'credit_line', minMonths: 6 },
  { name: 'Fundbox LOC', maxAmount: 150000, minScore: 600, fundingSpeed: 'Next day', preQual: true, category: 'credit_line', minMonths: 3 },
  // Auto
  { name: 'LightStream Auto', maxAmount: 100000, minScore: 670, fundingSpeed: 'Same day', preQual: true, url: 'https://www.lightstream.com/auto-loans', category: 'auto' },
  { name: 'PenFed Auto', maxAmount: 100000, minScore: 650, fundingSpeed: '1–3 days', preQual: false, url: 'https://www.penfed.org', category: 'auto' },
  { name: 'DCU Auto', maxAmount: 75000, minScore: 640, fundingSpeed: '1–3 days', preQual: false, url: 'https://www.dcu.org', category: 'auto' },
  { name: 'Navy Federal Auto', maxAmount: 100000, minScore: 640, fundingSpeed: '1–3 days', preQual: false, memberRequired: true, url: 'https://www.navyfederal.org', category: 'auto' },
  { name: 'Consumers CU Auto', maxAmount: 75000, minScore: 640, fundingSpeed: '1–3 days', preQual: false, category: 'auto' },
  // Alternative
  { name: 'CDFI Lenders', maxAmount: 250000, minScore: 550, fundingSpeed: '30–60 days', preQual: false, category: 'alternative' },
  { name: 'State Small Business Programs', maxAmount: 100000, minScore: 550, fundingSpeed: '30–90 days', preQual: false, category: 'alternative' },
  { name: 'Crest Capital (Equipment)', maxAmount: 500000, minScore: 600, fundingSpeed: '2–5 days', preQual: false, category: 'alternative' },
];

function calcMatchScore(lender: LenderProduct, bestScore: number, months: number | null): number {
  let score = 5;
  const scoreDiff = bestScore - lender.minScore;
  if (scoreDiff >= 100) score += 3;
  else if (scoreDiff >= 50) score += 2;
  else if (scoreDiff >= 0) score += 1;
  else if (scoreDiff >= -30) score -= 1;
  else score -= 3;
  if (lender.preQual) score += 1;
  if (lender.memberRequired) score -= 1;
  if (lender.minMonths && months !== null && months < lender.minMonths) score -= 2;
  return Math.max(1, Math.min(10, score));
}

const CATEGORY_LABELS: Record<string, string> = {
  personal: 'Personal Loans',
  business: 'Business Loans',
  credit_line: 'Credit Lines',
  auto: 'Auto Loans',
  alternative: 'Alternative',
};

export default function FundingMatrixPage() {
  const [clients, setClients] = useState<FundingClient[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [client, setClient] = useState<FundingClient | null>(null);
  const [dfs, setDfs] = useState<DfsScores | null>(null);
  const [generating, setGenerating] = useState(false);
  const [roadmapResult, setRoadmapResult] = useState('');

  useEffect(() => {
    supabase.from('funding_clients').select('id, first_name, last_name, monthly_revenue, time_in_business_months, funding_goal, target_funding_amount').then(({ data }) => {
      if (data) setClients(data);
    });
  }, []);

  useEffect(() => {
    if (!selectedClient) return;
    setRoadmapResult('');
    const c = clients.find(x => x.id === selectedClient);
    setClient(c || null);

    supabase.from('funding_dfs_scores').select('total_score, personal_credit_tu, personal_credit_eq, personal_credit_ex')
      .eq('client_id', selectedClient).order('scored_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setDfs(data));
  }, [selectedClient, clients]);

  const bestScore = Math.max(dfs?.personal_credit_tu ?? 0, dfs?.personal_credit_eq ?? 0, dfs?.personal_credit_ex ?? 0);

  const scored = useMemo(() =>
    LENDERS.map(l => ({ ...l, matchScore: calcMatchScore(l, bestScore, client?.time_in_business_months ?? null) }))
      .sort((a, b) => b.matchScore - a.matchScore),
    [bestScore, client]
  );

  const generateRoadmap = async () => {
    if (!client || !dfs) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('funding-ai-agent', {
        body: {
          action: 'generate_funding_roadmap',
          client: { first_name: client.first_name, last_name: client.last_name, monthly_revenue: client.monthly_revenue, time_in_business_months: client.time_in_business_months, funding_goal: client.funding_goal, target_funding_amount: client.target_funding_amount },
          scores: { overall: dfs.total_score, tu: dfs.personal_credit_tu, eq: dfs.personal_credit_eq, ex: dfs.personal_credit_ex },
          available_now: scored.filter(l => l.matchScore >= 7).map(l => l.name),
          available_90d: scored.filter(l => l.matchScore >= 4 && l.matchScore < 7).map(l => l.name),
        },
      });
      if (error) throw error;
      setRoadmapResult(data.roadmap || data.raw || 'No result');
      toast.success('Roadmap generated');
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate roadmap');
    } finally {
      setGenerating(false);
    }
  };

  const matchBorder = (ms: number) => ms >= 8 ? 'border-green-500/50' : ms >= 4 ? 'border-amber-500/50' : 'border-border opacity-60';
  const matchBadgeColor = (ms: number) => ms >= 8 ? 'bg-green-600/20 text-green-400' : ms >= 4 ? 'bg-amber-600/20 text-amber-400' : 'bg-muted text-muted-foreground';

  const fmt = (n: number) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`;

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-amber-400 flex items-center gap-2"><Landmark className="h-8 w-8" /> Funding Matrix</h1>
          <p className="text-muted-foreground">Matched funding products + AI-powered roadmap</p>
        </div>
        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Select client…" /></SelectTrigger>
          <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {!selectedClient ? (
        <Card className="border-dashed"><CardContent className="py-16 text-center text-muted-foreground">Select a client to view funding options</CardContent></Card>
      ) : (
        <>
          {/* Section 1 — Profile Summary */}
          <Card className="border-amber-500/30">
            <CardHeader><CardTitle className="text-amber-400 flex items-center gap-2"><Target className="h-5 w-5" /> Funding Profile</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
                <div><div className="text-xs text-muted-foreground">DFS Score</div><div className="text-2xl font-black text-amber-400">{dfs?.total_score ?? '—'}</div></div>
                <div><div className="text-xs text-muted-foreground">TU</div><div className="text-xl font-bold">{dfs?.personal_credit_tu ?? '—'}</div></div>
                <div><div className="text-xs text-muted-foreground">EQ</div><div className="text-xl font-bold">{dfs?.personal_credit_eq ?? '—'}</div></div>
                <div><div className="text-xs text-muted-foreground">EX</div><div className="text-xl font-bold">{dfs?.personal_credit_ex ?? '—'}</div></div>
                <div><div className="text-xs text-muted-foreground">Monthly Rev</div><div className="text-xl font-bold">{client?.monthly_revenue ? `$${client.monthly_revenue.toLocaleString()}` : '—'}</div></div>
                <div><div className="text-xs text-muted-foreground">Time in Biz</div><div className="text-xl font-bold">{client?.time_in_business_months ? `${client.time_in_business_months}mo` : '—'}</div></div>
              </div>
              {client?.funding_goal && <div className="mt-3 text-sm text-center text-muted-foreground">Goal: {client.funding_goal} — Target: {client.target_funding_amount ? `$${client.target_funding_amount.toLocaleString()}` : 'Not set'}</div>}
            </CardContent>
          </Card>

          {/* Section 2 — Product Menu */}
          <Tabs defaultValue="personal">
            <TabsList className="bg-card border">
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <TabsTrigger key={k} value={k}>{v}</TabsTrigger>)}
            </TabsList>
            {Object.keys(CATEGORY_LABELS).map(cat => (
              <TabsContent key={cat} value={cat}>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {scored.filter(l => l.category === cat).map(lender => (
                    <Card key={lender.name} className={`border ${matchBorder(lender.matchScore)}`}>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{lender.name}</span>
                          <Badge className={matchBadgeColor(lender.matchScore)}>{lender.matchScore}/10</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div><span className="text-muted-foreground">Max:</span> {fmt(lender.maxAmount)}</div>
                          <div><span className="text-muted-foreground">Min Score:</span> {lender.minScore}</div>
                          <div><span className="text-muted-foreground">Speed:</span> {lender.fundingSpeed}</div>
                          <div>{lender.preQual ? <Badge className="bg-green-600/20 text-green-400 border-green-600/40 text-[10px]">Pre-Qual ✓</Badge> : <span className="text-muted-foreground">No Pre-Qual</span>}</div>
                        </div>
                        {lender.memberRequired && <Badge variant="outline" className="text-[10px]">Membership Required</Badge>}
                        {lender.url && (
                          <a href={lender.url} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-400 hover:underline flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" /> Apply / Pre-Qualify
                          </a>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>

          {/* Section 3 — Funding Roadmap */}
          <Card className="border-amber-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-400"><TrendingUp className="h-5 w-5" /> Funding Roadmap</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'Available Now', items: scored.filter(l => l.matchScore >= 8), icon: CheckCircle2, color: 'text-green-400' },
                  { label: '90 Days', items: scored.filter(l => l.matchScore >= 4 && l.matchScore < 8), icon: Clock, color: 'text-amber-400' },
                  { label: '12 Months', items: scored.filter(l => l.matchScore < 4), icon: Target, color: 'text-blue-400' },
                ].map(milestone => (
                  <Card key={milestone.label} className="border-border">
                    <CardContent className="p-4 space-y-2">
                      <div className={`text-sm font-bold ${milestone.color} flex items-center gap-1`}><milestone.icon className="h-4 w-4" /> {milestone.label}</div>
                      <div className="text-2xl font-black">{fmt(milestone.items.reduce((s, l) => s + l.maxAmount, 0))}</div>
                      <div className="text-xs text-muted-foreground">{milestone.items.length} products</div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {milestone.items.slice(0, 5).map(l => <div key={l.name} className="text-xs">{l.name} — {fmt(l.maxAmount)}</div>)}
                        {milestone.items.length > 5 && <div className="text-xs text-muted-foreground">+{milestone.items.length - 5} more</div>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Button onClick={generateRoadmap} disabled={generating} className="bg-amber-600 hover:bg-amber-700">
                {generating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating…</> : <><TrendingUp className="h-4 w-4 mr-2" /> AI Generate Full Roadmap</>}
              </Button>

              {roadmapResult && (
                <div className="p-4 rounded-lg bg-card border border-amber-500/20">
                  <h4 className="text-sm font-bold text-amber-400 mb-2">AI Funding Roadmap</h4>
                  <div className="text-sm whitespace-pre-wrap">{roadmapResult}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
