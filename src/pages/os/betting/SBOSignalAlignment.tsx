import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, Wallet, Users, Shield, Crown, Flame, AlertTriangle, Filter, Clock, DollarSign } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

// === WEIGHTING CONFIG ===
const WEIGHTS = { ai: 0.4, wallet: 0.4, capper: 0.2 };
const CONFLICT_PENALTY = 10;

// === UPGRADE #2: WALLET TIER WEIGHTING ===
const WALLET_TIER_POINTS: Record<string, number> = {
  elite: 25,
  strong: 15,
  normal: 5,
};

// === UPGRADE #3: CAPPER TIER WEIGHTING ===
function getCapperTier(winRate: number): 'elite' | 'strong' | 'weak' {
  if (winRate >= 0.70) return 'elite';
  if (winRate >= 0.60) return 'strong';
  return 'weak';
}
const CAPPER_TIER_POINTS: Record<string, number> = {
  elite: 20,
  strong: 10,
  weak: 3,
};

// === PART 1: DIRECTION NORMALIZATION ENGINE ===
const DIRECTION_MAP: Record<string, 'positive' | 'negative'> = {
  over: 'positive', yes: 'positive', more: 'positive', up: 'positive', high: 'positive',
  under: 'negative', no: 'negative', less: 'negative', down: 'negative', low: 'negative',
};

function normalizeDirection(input: string | null | undefined): 'positive' | 'negative' | 'unknown' {
  if (!input) return 'unknown';
  const key = input.trim().toLowerCase();
  return DIRECTION_MAP[key] || 'unknown';
}

// === UPGRADE #5: TIME DECAY ===
function getTimeDecay(eventTime: string | null): number {
  if (!eventTime) return 0.4;
  const hoursAgo = (Date.now() - new Date(eventTime).getTime()) / 3_600_000;
  if (hoursAgo < 1) return 1.0;
  if (hoursAgo < 3) return 0.8;
  if (hoursAgo < 6) return 0.6;
  return 0.4;
}

// === PART 2: BET SIZING ENGINE ===
interface BetRecommendation {
  units: number;
  amount: number;
  riskLevel: 'Low' | 'Medium' | 'Medium-High' | 'High';
  kellyFraction: number;
}

function getRecommendedBet(
  pickTier: string,
  finalScore: number,
  aiConfidence: number,
  bankrollAmount: number,
  unitSize: number,
): BetRecommendation {
  let units = 0;
  let kellyFraction = 0;
  let riskLevel: BetRecommendation['riskLevel'] = 'Low';

  if (pickTier === 'grandmaster') {
    units = finalScore >= 95 ? 5 : 4;
    kellyFraction = 0.75;
    riskLevel = 'High';
  } else if (pickTier === 'elite') {
    units = finalScore >= 80 ? 3 : 2;
    kellyFraction = 0.5;
    riskLevel = 'Medium-High';
  } else if (pickTier === 'solid') {
    units = finalScore >= 60 ? 2 : 1;
    kellyFraction = 0.25;
    riskLevel = 'Medium';
  } else {
    // low — skip or minimal
    units = 0;
    kellyFraction = 0;
    riskLevel = 'Low';
  }

  // Kelly-based sizing: kellyFraction * edge * bankroll
  const edge = (aiConfidence - 50) / 100; // simplified edge
  const kellyAmount = kellyFraction * Math.max(edge, 0) * bankrollAmount;
  const unitAmount = units * unitSize;

  // Use the more conservative of the two
  const amount = Math.min(kellyAmount || unitAmount, unitAmount);
  // Cap at 5% of bankroll per bet
  const maxBet = bankrollAmount * 0.05;
  const cappedAmount = Math.min(amount, maxBet);

  return {
    units,
    amount: Math.round(cappedAmount * 100) / 100,
    riskLevel,
    kellyFraction,
  };
}

// === UPGRADE #1: STRUCTURED MATCHING ===
function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function structuredMatchScore(
  pred: { player_name?: string; home_team?: string; away_team?: string; prop_type?: string },
  target: { text: string; player?: string }
): number {
  const predPlayer = normalizePlayerName(pred.player_name || '');
  if (!predPlayer) return 0;

  // Try structured player field first (exact match)
  if (target.player) {
    const targetPlayer = normalizePlayerName(target.player);
    if (predPlayer === targetPlayer) return 100;
    // Last name match
    const predLast = predPlayer.split(' ').pop() || '';
    const targetLast = targetPlayer.split(' ').pop() || '';
    if (predLast.length >= 3 && predLast === targetLast) return 80;
  }

  // Fallback: text search with full name
  const textLower = (target.text || '').toLowerCase();
  if (predPlayer.length >= 4 && textLower.includes(predPlayer)) return 90;

  // Last name in text
  const predLast = predPlayer.split(' ').pop() || '';
  if (predLast.length >= 4 && textLower.includes(predLast)) return 60;

  return 0;
}

const MATCH_THRESHOLD = 60; // minimum match score to count

function calcWalletScoreTiered(wallets: { tier: string; decay: number }[]): number {
  let score = 0;
  for (const w of wallets) {
    const tierPts = WALLET_TIER_POINTS[w.tier] || WALLET_TIER_POINTS.normal;
    score += tierPts * w.decay;
  }
  return Math.min(100, Math.round(score));
}

function calcCapperScoreTiered(cappers: { tier: string; decay: number }[]): number {
  let score = 0;
  for (const c of cappers) {
    const tierPts = CAPPER_TIER_POINTS[c.tier] || CAPPER_TIER_POINTS.weak;
    score += tierPts * c.decay;
  }
  return Math.min(100, Math.round(score));
}

interface WeightedPick {
  key: string;
  playerOrMarket: string;
  propType?: string;
  direction?: string;
  aiConfidence: number;
  walletAlignCount: number;
  eliteWalletCount: number;
  capperAlignCount: number;
  topCapperCount: number;
  conflictCount: number;
  walletTier?: string;
  capperName?: string;
  sources: string[];
  walletScore: number;
  capperScore: number;
  sboComponent: number;
  walletComponent: number;
  capperComponent: number;
  penalty: number;
  finalScore: number;
  pickTier: string;
  isGrandmaster: boolean;
  reasoning: string;
  matchQuality: string;
  // BET EXECUTION FIELDS
  betUnits: number;
  betAmount: number;
  riskLevel: string;
  predictionId: string;
}

function getTier(score: number): string {
  if (score >= 85) return 'grandmaster';
  if (score >= 70) return 'elite';
  if (score >= 50) return 'solid';
  return 'low';
}

// === UPGRADE #4: STRICT GRANDMASTER ===
function isGrandmaster(score: number, eliteWallets: number, aiConf: number, conflicts: number): boolean {
  return score >= 85 && eliteWallets >= 1 && aiConf >= 75 && conflicts === 0;
}

function buildReasoning(p: Omit<WeightedPick, 'reasoning'>): string {
  const parts: string[] = [];
  parts.push(`SBO AI ${p.aiConfidence}% (×${WEIGHTS.ai} = ${p.sboComponent.toFixed(1)})`);
  if (p.walletAlignCount > 0) parts.push(`${p.walletAlignCount} wallet${p.walletAlignCount > 1 ? 's' : ''}${p.eliteWalletCount > 0 ? ` (${p.eliteWalletCount} elite)` : ''} → ${p.walletScore} (×${WEIGHTS.wallet} = ${p.walletComponent.toFixed(1)})`);
  if (p.capperAlignCount > 0) parts.push(`${p.capperAlignCount} capper${p.capperAlignCount > 1 ? 's' : ''}${p.topCapperCount > 0 ? ` (${p.topCapperCount} top)` : ''} → ${p.capperScore} (×${WEIGHTS.capper} = ${p.capperComponent.toFixed(1)})`);
  if (p.conflictCount > 0) parts.push(`${p.conflictCount} conflict${p.conflictCount > 1 ? 's' : ''} → -${p.penalty}`);
  parts.push(`Match: ${p.matchQuality}`);
  if (p.isGrandmaster) parts.push('→ 👑 GRANDMASTER (SUPER CHOICE)');
  else if (p.pickTier === 'elite') parts.push('→ 🔥 ELITE');
  else if (p.pickTier === 'solid') parts.push('→ ⚠️ SOLID');
  return parts.join(' · ');
}

const TIER_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string; border: string }> = {
  grandmaster: { icon: <Crown className="h-3.5 w-3.5" />, label: '👑 GRANDMASTER', color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/40' },
  elite: { icon: <Flame className="h-3.5 w-3.5" />, label: '🔥 ELITE', color: 'text-orange-500', bg: 'bg-orange-500/15', border: 'border-orange-500/40' },
  solid: { icon: <Shield className="h-3.5 w-3.5" />, label: '⚠️ SOLID', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  low: { icon: <AlertTriangle className="h-3.5 w-3.5" />, label: '❌ LOW', color: 'text-muted-foreground', bg: 'bg-muted/30', border: 'border-border' },
};

export default function SBOSignalAlignment() {
  const today = new Date().toISOString().split('T')[0];
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [autoSuggest, setAutoSuggest] = useState(true);

  const { data: predictions = [] } = useQuery({
    queryKey: ['signal-predictions', today],
    queryFn: async () => {
      const { data } = await supabase
        .from('sbo_predictions')
        .select('*')
        .gte('created_at', `${today}T00:00:00`)
        // PHASE 3 / ITEM 8 — bounded read (today's predictions); table exceeds the 1k PostgREST default.
        .limit(500)
        .order('final_confidence', { ascending: false });
      return data || [];
    },
  });

  const { data: walletEvents = [] } = useQuery({
    queryKey: ['signal-wallet-events', today],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_pm_wallet_events')
        .select('*, sbo_pm_tracked_wallets(label, priority_level)')
        .gte('event_time', `${today}T00:00:00`);
      return data || [];
    },
  });

  const { data: capperPicks = [] } = useQuery({
    queryKey: ['signal-capper-picks', today],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_capper_picks')
        .select('*, sbo_cappers(name, win_rate)')
        .gte('created_at', `${today}T00:00:00`)
        .eq('result', 'pending');
      return data || [];
    },
  });

  // Bankroll for bet sizing
  const { data: bankroll } = useQuery({
    queryKey: ['signal-bankroll'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_bankroll')
        .select('*')
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const bankrollAmount = bankroll?.current_bankroll || 500;
  const unitSize = bankroll?.unit_size || bankrollAmount * 0.02;

  const weightedPicks = useMemo<WeightedPick[]>(() => {
    if (!predictions.length) return [];

    return predictions.map((pred: any) => {
      // === STRUCTURED WALLET MATCHING ===
      const matchedWallets: { tier: string; decay: number; matchScore: number }[] = [];
      for (const w of walletEvents) {
        const ms = structuredMatchScore(pred, { text: w.market_question || '', player: w.player_name });
        if (ms < MATCH_THRESHOLD) continue;
        const tier = (w as any).sbo_pm_tracked_wallets?.priority_level || 'normal';
        const decay = getTimeDecay(w.event_time);
        matchedWallets.push({ tier, decay, matchScore: ms });
      }

      // === STRUCTURED CAPPER MATCHING ===
      const matchedCappers: { tier: string; decay: number; matchScore: number; name?: string }[] = [];
      for (const c of capperPicks) {
        const ms = structuredMatchScore(pred, { text: c.pick_text || c.parsed_pick || '', player: c.player_name });
        if (ms < MATCH_THRESHOLD) continue;
        const winRate = (c as any).sbo_cappers?.win_rate ?? 0;
        const tier = getCapperTier(winRate);
        const decay = getTimeDecay(c.created_at);
        matchedCappers.push({ tier, decay, matchScore: ms, name: (c as any).sbo_cappers?.name });
      }

      const walletAlignCount = matchedWallets.length;
      const eliteWalletCount = matchedWallets.filter(w => w.tier === 'elite').length;
      const capperAlignCount = matchedCappers.length;
      const topCapperCount = matchedCappers.filter(c => c.tier === 'elite').length;

      // Conflict detection — NORMALIZED DIRECTION
      let conflictCount = 0;
      const predDir = normalizeDirection(pred.pick_direction);
      walletEvents.forEach((w: any) => {
        const ms = structuredMatchScore(pred, { text: w.market_question || '' });
        const walletDir = normalizeDirection(w.side);
        if (ms >= MATCH_THRESHOLD && walletDir !== 'unknown' && predDir !== 'unknown' && walletDir !== predDir) conflictCount++;
      });
      capperPicks.forEach((c: any) => {
        const ms = structuredMatchScore(pred, { text: c.pick_text || c.parsed_pick || '', player: c.player_name });
        const capperDir = normalizeDirection(c.direction || c.pick_direction);
        if (ms >= MATCH_THRESHOLD && capperDir !== 'unknown' && predDir !== 'unknown' && capperDir !== predDir) conflictCount++;
      });

      const aiConf = pred.final_confidence || 50;
      const walletScore = calcWalletScoreTiered(matchedWallets);
      const capperScore = calcCapperScoreTiered(matchedCappers);

      const sboComponent = aiConf * WEIGHTS.ai;
      const walletComponent = walletScore * WEIGHTS.wallet;
      const capperComponent = capperScore * WEIGHTS.capper;
      const penalty = conflictCount * CONFLICT_PENALTY;

      const rawScore = sboComponent + walletComponent + capperComponent - penalty;
      const finalScore = Math.round(Math.max(0, Math.min(100, rawScore)));

      const tier = getTier(finalScore);
      const gm = isGrandmaster(finalScore, eliteWalletCount, aiConf, conflictCount);
      const actualTier = gm ? 'grandmaster' : tier;

      // Best match quality label
      const allScores = [...matchedWallets.map(w => w.matchScore), ...matchedCappers.map(c => c.matchScore)];
      const bestMatch = allScores.length ? Math.max(...allScores) : 0;
      const matchQuality = bestMatch >= 90 ? 'Exact' : bestMatch >= 60 ? 'Partial' : 'AI Only';

      const sources: string[] = ['AI'];
      if (walletAlignCount > 0) sources.push('Wallet');
      if (capperAlignCount > 0) sources.push('Capper');

      // BET SIZING
      const bet = getRecommendedBet(actualTier, finalScore, aiConf, bankrollAmount, unitSize);

      const base: Omit<WeightedPick, 'reasoning'> = {
        key: pred.id,
        predictionId: pred.id,
        playerOrMarket: pred.player_name || `${pred.home_team} vs ${pred.away_team}`,
        propType: pred.prop_type || pred.market_type,
        direction: pred.pick_direction,
        aiConfidence: aiConf,
        walletAlignCount,
        eliteWalletCount,
        capperAlignCount,
        topCapperCount,
        conflictCount,
        walletTier: eliteWalletCount > 0 ? 'elite' : walletAlignCount > 0 ? 'active' : undefined,
        capperName: matchedCappers[0]?.name,
        sources,
        walletScore,
        capperScore,
        sboComponent,
        walletComponent,
        capperComponent,
        penalty,
        finalScore,
        pickTier: actualTier,
        isGrandmaster: gm,
        matchQuality,
        betUnits: bet.units,
        betAmount: bet.amount,
        riskLevel: bet.riskLevel,
      };

      return { ...base, reasoning: buildReasoning(base) };
    }).sort((a: WeightedPick, b: WeightedPick) => b.finalScore - a.finalScore);
  }, [predictions, walletEvents, capperPicks, bankrollAmount, unitSize]);

  const filtered = tierFilter === 'all'
    ? weightedPicks
    : weightedPicks.filter(p => p.pickTier === tierFilter);

  const grandmasterCount = weightedPicks.filter(p => p.isGrandmaster).length;
  const eliteCount = weightedPicks.filter(p => p.pickTier === 'elite').length;
  const solidCount = weightedPicks.filter(p => p.pickTier === 'solid').length;

  // CONFIRM BET → insert into sbo_actual_bets with full tracking
  const handleConfirmBet = async (pick: WeightedPick) => {
    const { error } = await (supabase as any).from('sbo_actual_bets').insert({
      prediction_id: pick.predictionId,
      pick_tier: pick.isGrandmaster ? 'grandmaster' : pick.pickTier,
      signal_score: pick.finalScore,
      stake_usd: pick.betAmount,
      description: `${pick.playerOrMarket} — ${pick.direction} (${pick.pickTier})`,
      bet_type: pick.isGrandmaster ? 'grandmaster' : pick.pickTier,
      outcome: 'pending',
    });
    if (error) {
      toast.error('Failed to log bet: ' + error.message);
    } else {
      toast.success(`Bet confirmed: $${pick.betAmount.toFixed(0)} (${pick.betUnits}u) on ${pick.playerOrMarket}`);
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Crown className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Signal Weighting Engine v2</h1>
            <p className="text-xs text-muted-foreground">AI {(WEIGHTS.ai * 100)}% · Wallet {(WEIGHTS.wallet * 100)}% · Capper {(WEIGHTS.capper * 100)}% · Bankroll ${bankrollAmount}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">Auto-Suggest</span>
            <Switch checked={autoSuggest} onCheckedChange={setAutoSuggest} />
          </div>
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Picks</SelectItem>
              <SelectItem value="grandmaster">👑 Grandmaster</SelectItem>
              <SelectItem value="elite">🔥 Elite</SelectItem>
              <SelectItem value="solid">⚠️ Solid</SelectItem>
              <SelectItem value="low">❌ Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold">{weightedPicks.length}</p><p className="text-[10px] text-muted-foreground">Total Picks</p></CardContent></Card>
        <Card className="border-amber-500/30"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-amber-400">{grandmasterCount}</p><p className="text-[10px] text-muted-foreground">👑 Grandmaster</p></CardContent></Card>
        <Card className="border-orange-500/30"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-orange-500">{eliteCount}</p><p className="text-[10px] text-muted-foreground">🔥 Elite</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-amber-500">{solidCount}</p><p className="text-[10px] text-muted-foreground">⚠️ Solid</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-muted-foreground">{weightedPicks.filter(p => p.pickTier === 'low').length}</p><p className="text-[10px] text-muted-foreground">❌ Low</p></CardContent></Card>
      </div>

      {/* Grandmaster Alert */}
      {grandmasterCount > 0 && tierFilter === 'all' && (
        <Card className="border-amber-500/40 bg-gradient-to-r from-amber-500/10 to-orange-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-400">
              <Crown className="h-4 w-4" />
              👑 GRANDMASTER PICKS — SUPER CHOICE ({grandmasterCount})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {weightedPicks.filter(p => p.isGrandmaster).map(p => (
              <WeightedPickCard key={p.key} pick={p} onConfirmBet={handleConfirmBet} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="ranked">
        <TabsList className="h-8">
          <TabsTrigger value="ranked" className="text-xs">Ranked Picks</TabsTrigger>
          <TabsTrigger value="breakdown" className="text-xs">Score Breakdown</TabsTrigger>
        </TabsList>

        <TabsContent value="ranked" className="space-y-2 mt-3">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No picks found. Run AI predictions to generate weighted scores.</p>
          ) : filtered.map(p => (
            <WeightedPickCard key={p.key} pick={p} onConfirmBet={handleConfirmBet} />
          ))}
        </TabsContent>

        <TabsContent value="breakdown" className="space-y-2 mt-3">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No data to break down.</p>
          ) : filtered.map(p => (
            <BreakdownCard key={p.key} pick={p} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function WeightedPickCard({ pick, onConfirmBet }: { pick: WeightedPick; onConfirmBet?: (pick: WeightedPick) => void }) {
  const tier = TIER_CONFIG[pick.pickTier] || TIER_CONFIG.low;

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${tier.border} ${tier.bg}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{pick.playerOrMarket}</span>
          {pick.propType && <Badge variant="outline" className="text-[10px] h-4">{pick.propType}</Badge>}
          {pick.direction && <Badge variant="outline" className="text-[10px] h-4">{pick.direction}</Badge>}
          <Badge variant="outline" className="text-[10px] h-4 gap-0.5">
            <Clock className="h-2.5 w-2.5" /> {pick.matchQuality}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="flex items-center gap-0.5 text-[10px] text-blue-500"><Brain className="h-3 w-3" /> AI {pick.aiConfidence}%</span>
          {pick.walletAlignCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-emerald-500">
              <Wallet className="h-3 w-3" /> {pick.walletAlignCount} wallet{pick.walletAlignCount > 1 ? 's' : ''}
              {pick.eliteWalletCount > 0 && <span className="text-amber-400 ml-0.5">({pick.eliteWalletCount} elite)</span>}
            </span>
          )}
          {pick.capperAlignCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-purple-500">
              <Users className="h-3 w-3" /> {pick.capperAlignCount} capper{pick.capperAlignCount > 1 ? 's' : ''}
              {pick.topCapperCount > 0 && <span className="text-amber-400 ml-0.5">({pick.topCapperCount} elite)</span>}
            </span>
          )}
          {pick.conflictCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-destructive">
              <AlertTriangle className="h-3 w-3" /> {pick.conflictCount} conflict{pick.conflictCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {/* BET SIZING ROW */}
        {pick.betUnits > 0 && (
          <div className="flex items-center gap-3 mt-1.5 pt-1.5 border-t border-border/50">
            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-400">
              <DollarSign className="h-3 w-3" /> ${pick.betAmount.toFixed(0)} ({pick.betUnits}u)
            </span>
            <Badge variant="outline" className={`text-[9px] h-3.5 ${
              pick.riskLevel === 'High' ? 'border-destructive/50 text-destructive' :
              pick.riskLevel === 'Medium-High' ? 'border-orange-500/50 text-orange-500' :
              'border-amber-500/50 text-amber-500'
            }`}>
              {pick.riskLevel}
            </Badge>
            {onConfirmBet && (
              <button
                onClick={() => onConfirmBet(pick)}
                className="text-[9px] px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
              >
                Confirm Bet
              </button>
            )}
          </div>
        )}
      </div>
      <div className="text-right shrink-0 space-y-0.5">
        <Badge className={`text-xs font-bold ${tier.color} ${tier.bg} ${tier.border}`}>
          {tier.label}
        </Badge>
        <p className={`text-lg font-black ${pick.finalScore >= 85 ? 'text-amber-400' : pick.finalScore >= 70 ? 'text-orange-500' : pick.finalScore >= 50 ? 'text-amber-500' : 'text-muted-foreground'}`}>
          {pick.finalScore}
        </p>
      </div>
    </div>
  );
}

function BreakdownCard({ pick }: { pick: WeightedPick }) {
  const tier = TIER_CONFIG[pick.pickTier] || TIER_CONFIG.low;
  const barMax = 50;

  return (
    <div className={`p-3 rounded-lg border ${tier.border} ${tier.bg} space-y-2`}>
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm">{pick.playerOrMarket}</span>
        <Badge className={`text-xs ${tier.color} ${tier.bg}`}>{pick.finalScore} — {tier.label}</Badge>
      </div>

      <div className="space-y-1.5">
        <ComponentBar label="🧠 AI" value={pick.sboComponent} max={barMax} color="bg-blue-500" />
        <ComponentBar label="💰 Wallet" value={pick.walletComponent} max={barMax} color="bg-emerald-500" />
        <ComponentBar label="🎯 Capper" value={pick.capperComponent} max={barMax} color="bg-purple-500" />
        {pick.penalty > 0 && (
          <ComponentBar label="⚠️ Conflict" value={-pick.penalty} max={barMax} color="bg-destructive" />
        )}
      </div>

      <p className="text-[10px] text-muted-foreground leading-tight">{pick.reasoning}</p>
    </div>
  );
}

function ComponentBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const width = Math.min(100, Math.abs(value) / max * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] w-16 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
      </div>
      <span className="text-[10px] w-8 text-right font-mono">{value > 0 ? '+' : ''}{value.toFixed(0)}</span>
    </div>
  );
}
