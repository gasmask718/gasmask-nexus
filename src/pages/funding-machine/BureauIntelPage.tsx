import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CreditCard, ExternalLink, Zap, Loader2, CheckCircle2 } from 'lucide-react';
import HardInquiryTracker from '@/components/funding-machine/HardInquiryTracker';

interface FundingClient {
  id: string;
  first_name: string;
  last_name: string;
}

interface DfsScores {
  personal_credit_tu: number | null;
  personal_credit_eq: number | null;
  personal_credit_ex: number | null;
}

interface CardEntry {
  name: string;
  issuer: string;
  tier: number;
  limitRange: string;
  aprZero?: string;
  preQual: boolean;
  preQualUrl?: string;
}

const TU_CARDS: CardEntry[] = [
  { name: 'Capital One Venture X', issuer: 'Capital One', tier: 1, limitRange: '$10K–$30K', preQual: true, preQualUrl: 'https://www.capitalone.com/credit-cards/preapprove/' },
  { name: 'Capital One Quicksilver', issuer: 'Capital One', tier: 3, limitRange: '$500–$5K', preQual: true, preQualUrl: 'https://www.capitalone.com/credit-cards/preapprove/' },
  { name: 'Apple Card', issuer: 'Apple / Goldman Sachs', tier: 3, limitRange: '$500–$5K', preQual: true, preQualUrl: 'https://card.apple.com' },
  { name: 'Barclays Aviator', issuer: 'Barclays', tier: 2, limitRange: '$5K–$15K', preQual: false },
  { name: 'Synchrony Premier', issuer: 'Synchrony', tier: 2, limitRange: '$3K–$10K', preQual: false },
];

const EQ_CARDS: CardEntry[] = [
  { name: 'Amex Blue Business Cash', issuer: 'American Express', tier: 2, limitRange: '$5K–$15K', preQual: true, preQualUrl: 'https://www.americanexpress.com/us/credit-cards/check-for-offers/' },
  { name: 'Amex Gold', issuer: 'American Express', tier: 1, limitRange: '$10K–$25K', preQual: true, preQualUrl: 'https://www.americanexpress.com/us/credit-cards/check-for-offers/' },
  { name: 'BofA Business Advantage', issuer: 'Bank of America', tier: 2, limitRange: '$5K–$15K', preQual: true, preQualUrl: 'https://www.bankofamerica.com/credit-cards/prequalified-credit-card-offers/' },
  { name: 'US Bank Business Platinum', issuer: 'US Bank', tier: 2, limitRange: '$5K–$20K', preQual: false },
  { name: 'PenFed Power Cash', issuer: 'PenFed', tier: 2, limitRange: '$5K–$15K', preQual: true, preQualUrl: 'https://www.penfed.org' },
];

const EX_CARDS: CardEntry[] = [
  { name: 'Chase Ink Business Cash', issuer: 'Chase', tier: 2, limitRange: '$5K–$25K', preQual: true, preQualUrl: 'https://www.chase.com/prequalified' },
  { name: 'Chase Freedom Unlimited', issuer: 'Chase', tier: 2, limitRange: '$3K–$15K', preQual: true, preQualUrl: 'https://www.chase.com/prequalified' },
  { name: 'Citi Double Cash', issuer: 'Citi', tier: 2, limitRange: '$3K–$15K', preQual: true, preQualUrl: 'https://www.citi.com/credit-cards/prequalify' },
  { name: 'Discover It Business', issuer: 'Discover', tier: 2, limitRange: '$3K–$10K', preQual: true, preQualUrl: 'https://www.discover.com/credit-cards/preapproval.html' },
  { name: 'Navy Federal Business', issuer: 'Navy Federal', tier: 2, limitRange: '$5K–$25K', preQual: false },
];

const CU_CARDS: CardEntry[] = [
  { name: 'Navy Federal More Rewards', issuer: 'Navy Federal', tier: 2, limitRange: '$5K–$20K', preQual: false, preQualUrl: 'https://www.navyfederal.org' },
  { name: 'DCU Visa Platinum', issuer: 'DCU', tier: 2, limitRange: '$3K–$15K', preQual: false, preQualUrl: 'https://www.dcu.org' },
  { name: 'Alliant Signature', issuer: 'Alliant', tier: 1, limitRange: '$10K–$20K', preQual: false, preQualUrl: 'https://www.alliantcreditunion.org' },
  { name: 'PenFed Platinum Rewards', issuer: 'PenFed', tier: 2, limitRange: '$5K–$15K', preQual: false, preQualUrl: 'https://www.penfed.org' },
  { name: 'Consumers CU Rewards', issuer: 'Consumers CU', tier: 2, limitRange: '$3K–$10K', preQual: false, preQualUrl: 'https://www.consumerscu.org' },
];

function getTier(score: number | null): number {
  if (!score) return 4;
  if (score >= 750) return 1;
  if (score >= 700) return 2;
  if (score >= 650) return 3;
  return 4;
}

function tierLabel(t: number) {
  return t === 1 ? 'Tier 1 (750+)' : t === 2 ? 'Tier 2 (700–749)' : t === 3 ? 'Tier 3 (650–699)' : 'Tier 4 (<650)';
}

function tierColor(t: number) {
  return t === 1 ? 'text-green-400' : t === 2 ? 'text-amber-400' : t === 3 ? 'text-orange-400' : 'text-red-400';
}

export default function BureauIntelPage() {
  const [clients, setClients] = useState<FundingClient[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [dfs, setDfs] = useState<DfsScores | null>(null);
  const [inquiryCounts, setInquiryCounts] = useState<{ tu: number; eq: number; ex: number }>({ tu: 0, eq: 0, ex: 0 });
  const [selectedCards, setSelectedCards] = useState<(CardEntry & { bureau: string })[]>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizedResult, setOptimizedResult] = useState<string>('');

  useEffect(() => {
    supabase.from('funding_clients').select('id, first_name, last_name').then(({ data }) => {
      if (data) setClients(data);
    });
  }, []);

  useEffect(() => {
    if (!selectedClient) return;
    setSelectedCards([]);
    setOptimizedResult('');

    supabase.from('funding_dfs_scores').select('personal_credit_tu, personal_credit_eq, personal_credit_ex')
      .eq('client_id', selectedClient).order('scored_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setDfs(data));

    // NOTE: stored values are human-readable Title Case ("Hard Inquiry", "TransUnion"),
    // not snake_case. Match case-insensitively so these counts are never silently zero.
    supabase.from('funding_credit_items').select('bureau, item_type').eq('client_id', selectedClient)
      .then(({ data }) => {
        const counts = { tu: 0, eq: 0, ex: 0 };
        data?.filter(i => (i.item_type ?? '').toLowerCase() === 'hard inquiry')
          .forEach(i => {
            const b = (i.bureau ?? '').toLowerCase();
            if (b === 'transunion') counts.tu++;
            else if (b === 'equifax') counts.eq++;
            else if (b === 'experian') counts.ex++;
          });
        setInquiryCounts(counts);
      });
  }, [selectedClient]);

  const toggleCard = (card: CardEntry, bureau: string) => {
    setSelectedCards(prev => {
      const exists = prev.find(c => c.name === card.name && c.bureau === bureau);
      if (exists) return prev.filter(c => !(c.name === card.name && c.bureau === bureau));
      return [...prev, { ...card, bureau }];
    });
  };

  const isSelected = (name: string, bureau: string) => selectedCards.some(c => c.name === name && c.bureau === bureau);

  const optimizeStack = async () => {
    if (selectedCards.length < 2) { toast.error('Select at least 2 cards to optimize'); return; }
    setOptimizing(true);
    try {
      const { data, error } = await supabase.functions.invoke('funding-ai-agent', {
        body: {
          action: 'optimize_card_stack',
          cards: selectedCards.map(c => ({ name: c.name, issuer: c.issuer, bureau: c.bureau, tier: c.tier, limitRange: c.limitRange })),
          scores: { tu: dfs?.personal_credit_tu, eq: dfs?.personal_credit_eq, ex: dfs?.personal_credit_ex },
        },
      });
      if (error) throw error;
      setOptimizedResult(data.strategy || data.raw || 'No result');
      toast.success('Stack optimized');
    } catch (e: any) {
      toast.error(e.message || 'Optimization failed');
    } finally {
      setOptimizing(false);
    }
  };

  const renderBureauColumn = (title: string, score: number | null, inquiries: number, cards: CardEntry[], bureauKey: string) => {
    const tier = getTier(score);
    const eligible = cards.filter(c => c.tier >= tier);
    return (
      <div className="space-y-3">
        <div className="text-center space-y-2">
          <h3 className="text-lg font-bold text-amber-400">{title}</h3>
          <div className={`text-4xl font-black ${tierColor(tier)}`}>{score ?? '—'}</div>
          <Badge variant="outline" className="text-xs">{tierLabel(tier)}</Badge>
          <div className="text-xs text-muted-foreground">Hard Inquiries: <span className={inquiries > 4 ? 'text-red-400' : 'text-foreground'}>{inquiries}</span></div>
        </div>
        <div className="space-y-2">
          {eligible.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No eligible cards at current score</p>}
          {eligible.map(card => (
            <Card key={card.name} className={`cursor-pointer transition-all border ${isSelected(card.name, bureauKey) ? 'border-amber-500 bg-amber-500/10' : 'border-border hover:border-amber-500/50'}`}
              onClick={() => toggleCard(card, bureauKey)}>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{card.name}</span>
                  {isSelected(card.name, bureauKey) && <CheckCircle2 className="h-4 w-4 text-amber-400" />}
                </div>
                <div className="text-xs text-muted-foreground">{card.issuer}</div>
                <div className="flex gap-1 flex-wrap">
                  <Badge variant="secondary" className="text-[10px]">{card.limitRange}</Badge>
                  {card.preQual && <Badge className="text-[10px] bg-green-600/20 text-green-400 border-green-600/40">Soft Pull Pre-Qual</Badge>}
                </div>
                {card.preQualUrl && (
                  <a href={card.preQualUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                    className="text-[10px] text-amber-400 hover:underline flex items-center gap-1 mt-1">
                    <ExternalLink className="h-3 w-3" /> Pre-Approval Link
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-amber-400 flex items-center gap-2"><CreditCard className="h-8 w-8" /> Bureau Intelligence</h1>
          <p className="text-muted-foreground">Card recommendations by bureau pull + stack sequencing</p>
        </div>
        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Select client…" /></SelectTrigger>
          <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {!selectedClient ? (
        <Card className="border-dashed"><CardContent className="py-16 text-center text-muted-foreground">Select a client to view bureau intelligence</CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card><CardContent className="pt-6">{renderBureauColumn('TransUnion', dfs?.personal_credit_tu ?? null, inquiryCounts.tu, TU_CARDS, 'transunion')}</CardContent></Card>
            <Card><CardContent className="pt-6">{renderBureauColumn('Equifax', dfs?.personal_credit_eq ?? null, inquiryCounts.eq, EQ_CARDS, 'equifax')}</CardContent></Card>
            <Card><CardContent className="pt-6">{renderBureauColumn('Experian', dfs?.personal_credit_ex ?? null, inquiryCounts.ex, EX_CARDS, 'experian')}</CardContent></Card>
            <Card><CardContent className="pt-6">{renderBureauColumn('Credit Unions', Math.max(dfs?.personal_credit_tu ?? 0, dfs?.personal_credit_eq ?? 0, dfs?.personal_credit_ex ?? 0) || null, 0, CU_CARDS, 'credit_union')}</CardContent></Card>
          </div>

          {/* Hard Inquiry Tracker */}
          <HardInquiryTracker clientId={selectedClient} />

          {/* Card Stack Sequencer */}
          <Card className="border-amber-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-400"><Zap className="h-5 w-5" /> Card Stack Sequencer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedCards.length === 0 ? (
                <p className="text-sm text-muted-foreground">Click cards above to add them to your application stack</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {selectedCards.map((c, i) => (
                      <Badge key={i} className="bg-amber-600/20 text-amber-300 border-amber-500/40 cursor-pointer" onClick={() => toggleCard(c, c.bureau)}>
                        {c.name} ({c.bureau.slice(0, 2).toUpperCase()}) ✕
                      </Badge>
                    ))}
                  </div>
                  <div className="text-sm text-muted-foreground">{selectedCards.length} cards selected • Projected stack limit: {selectedCards.length * 8}K–{selectedCards.length * 20}K</div>
                  <Button onClick={optimizeStack} disabled={optimizing} className="bg-amber-600 hover:bg-amber-700">
                    {optimizing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Optimizing…</> : <><Zap className="h-4 w-4 mr-2" /> AI Optimize Stack</>}
                  </Button>
                </div>
              )}
              {optimizedResult && (
                <div className="mt-4 p-4 rounded-lg bg-card border border-amber-500/20">
                  <h4 className="text-sm font-bold text-amber-400 mb-2">Optimized Application Sequence</h4>
                  <div className="text-sm whitespace-pre-wrap">{optimizedResult}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
