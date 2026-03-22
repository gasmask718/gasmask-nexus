import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calculator, Shield, TrendingUp, Loader2, AlertTriangle, DollarSign, Target, Zap, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════════════
// HEDGE MATH UTILITIES
// ═══════════════════════════════════════════════════════════════

function toDecimal(american: string): number {
  const n = parseInt(american);
  if (isNaN(n)) return 2;
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
}

function calcHedge(pregameStake: number, pregameOdds: string, hedgeOdds: string) {
  const pregDec = toDecimal(pregameOdds);
  const hedgeDec = toDecimal(hedgeOdds);
  const pregPayout = pregameStake * pregDec;
  const hedgeStake = pregPayout / hedgeDec;
  const hedgePayout = hedgeStake * hedgeDec;
  const profitIfPregameWins = pregPayout - pregameStake - hedgeStake;
  const profitIfHedgeWins = hedgePayout - pregameStake - hedgeStake;
  const guaranteed = Math.min(profitIfPregameWins, profitIfHedgeWins);
  const totalStaked = pregameStake + hedgeStake;
  const profitPct = totalStaked > 0 ? (guaranteed / totalStaked) * 100 : 0;

  return {
    hedgeStake: Math.round(hedgeStake * 100) / 100,
    pregamePayout: Math.round(pregPayout * 100) / 100,
    hedgePayout: Math.round(hedgePayout * 100) / 100,
    profitIfPregameWins: Math.round(profitIfPregameWins * 100) / 100,
    profitIfHedgeWins: Math.round(profitIfHedgeWins * 100) / 100,
    guaranteed: Math.round(guaranteed * 100) / 100,
    totalStaked: Math.round(totalStaked * 100) / 100,
    profitPct: Math.round(profitPct * 100) / 100,
  };
}

// ═══════════════════════════════════════════════════════════════
// SECTION 1 — DAILY PROFIT PLAN
// ═══════════════════════════════════════════════════════════════

function DailyProfitPlanSection() {
  const [bankroll, setBankroll] = useState(500);
  const [targetProfit, setTargetProfit] = useState(50);
  const [building, setBuilding] = useState(false);
  const queryClient = useQueryClient();

  const { data: plan } = useQuery({
    queryKey: ['daily-profit-plan'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await (supabase as any)
        .from('sbo_daily_profit_plan')
        .select('*')
        .eq('plan_date', today)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const buildPlan = async () => {
    setBuilding(true);
    try {
      const { data, error } = await supabase.functions.invoke('sbo-daily-profit-plan', {
        body: { target_profit: targetProfit, bankroll },
      });
      if (error) throw error;
      toast.success('Daily profit plan built!');
      queryClient.invalidateQueries({ queryKey: ['daily-profit-plan'] });
    } catch (e: any) {
      toast.error(e.message || 'Failed to build plan');
    } finally {
      setBuilding(false);
    }
  };

  const bets = (plan?.bets || []) as any[];
  const hedges = (plan?.hedges || []) as any[];

  return (
    <div className="space-y-4">
      {/* Input controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-emerald-500" />
            Daily Profit Plan Builder
          </CardTitle>
          <CardDescription>Set your bankroll and profit target — AI builds the full game plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <Label className="text-xs text-muted-foreground">Bankroll ($)</Label>
              <Input type="number" value={bankroll} onChange={e => setBankroll(Number(e.target.value))} className="w-32 mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Target Profit ($)</Label>
              <Input type="number" value={targetProfit} onChange={e => setTargetProfit(Number(e.target.value))} className="w-32 mt-1" />
            </div>
            <Button onClick={buildPlan} disabled={building} className="bg-gradient-to-r from-emerald-600 to-teal-500">
              {building ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Building Plan...</> : <><Zap className="h-4 w-4 mr-2" /> Build Today's Plan</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Plan results */}
      {plan && (
        <>
          {/* Summary card */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-emerald-500/30">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-500">
                  ${plan.guaranteed_profit?.toFixed(2) || '0.00'}
                </p>
                <p className="text-xs text-muted-foreground">Guaranteed Floor</p>
              </CardContent>
            </Card>
            <Card className="border-blue-500/30">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-blue-500">
                  ${plan.projected_profit?.toFixed(2) || '0.00'}
                </p>
                <p className="text-xs text-muted-foreground">Upside Ceiling</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">
                  ${plan.total_capital_required?.toFixed(2) || '0.00'}
                </p>
                <p className="text-xs text-muted-foreground">Capital Required</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Badge variant={plan.status === 'complete' ? 'default' : 'secondary'} className="text-sm">
                  {(plan.status || 'planned').toUpperCase()}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">Plan Status</p>
              </CardContent>
            </Card>
          </div>

          {/* Pre-game bets */}
          {bets.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">📋 Pre-Game Bets</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {bets.map((bet: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{bet.pick}</p>
                      <p className="text-xs text-muted-foreground">{bet.book} · {bet.odds} · {bet.reason}</p>
                      {bet.hedge_setup && <p className="text-xs text-emerald-500 mt-1">🔄 Hedge: {bet.hedge_setup}</p>}
                    </div>
                    <Badge variant="outline" className="text-sm font-mono">${bet.stake}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Hedge triggers */}
          {hedges.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">🔄 Live Hedge Triggers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {hedges.map((h: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                    <p className="text-sm font-medium">{h.game}</p>
                    <p className="text-xs text-muted-foreground">When: {h.trigger_condition}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs">Hedge: {h.hedge_pick} on {h.hedge_book}</span>
                      <Badge variant="secondary" className="text-xs">${h.hedge_stake}</Badge>
                      <span className="text-xs text-emerald-500 font-medium">→ +${h.guaranteed_profit} guaranteed</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!plan && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Target className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground mt-3">Set your bankroll and target, then build today's plan</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SECTION 2 — LIVE HEDGE CALCULATOR
// ═══════════════════════════════════════════════════════════════

function LiveHedgeSection() {
  const [pregamePick, setPregamePick] = useState('');
  const [pregameOdds, setPregameOdds] = useState('');
  const [pregameStake, setPregameStake] = useState(100);
  const [hedgeOdds, setHedgeOdds] = useState('');
  const [result, setResult] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const quickCalc = () => {
    if (!pregameOdds || !hedgeOdds || !pregameStake) return;
    setResult(calcHedge(pregameStake, pregameOdds, hedgeOdds));
  };

  const getAiAnalysis = async () => {
    if (!pregamePick || !pregameOdds || !pregameStake) {
      toast.error('Fill in pre-game bet details first');
      return;
    }
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sbo-hedge-calculator', {
        body: {
          pregame_pick: pregamePick,
          pregame_odds: pregameOdds,
          pregame_stake: pregameStake,
          current_score_home: 0,
          current_score_away: 0,
          current_live_odds: hedgeOdds ? [{ name: 'Manual Entry', pick: 'Opponent', odds: hedgeOdds }] : [],
          quarter: null,
          clock: null,
        },
      });
      if (error) throw error;
      if (data?.best_hedge) {
        setResult({
          ...calcHedge(pregameStake, pregameOdds, hedgeOdds || data.best_hedge.hedge_odds),
          aiRecommendation: data.ai_recommendation,
        });
      }
      toast.success('Hedge analysis complete');
    } catch (e: any) {
      toast.error(e.message || 'AI analysis failed');
    } finally {
      setAiLoading(false);
    }
  };

  const saveHedge = async () => {
    if (!result) return;
    try {
      const { error } = await (supabase as any).from('sbo_hedge_engine').insert({
        pregame_pick: pregamePick,
        pregame_odds: pregameOdds,
        pregame_stake: pregameStake,
        pregame_potential_payout: result.pregamePayout,
        hedge_pick: 'Opponent',
        hedge_odds: hedgeOdds,
        hedge_stake: result.hedgeStake,
        hedge_potential_payout: result.hedgePayout,
        guaranteed_profit: result.guaranteed,
        guaranteed_profit_pct: result.profitPct,
        best_case_profit: Math.max(result.profitIfPregameWins, result.profitIfHedgeWins),
        worst_case_loss: 0,
        hedge_efficiency: Math.min(100, Math.max(0, result.profitPct * 4)),
        phase: 'live',
        result: 'pending',
      });
      if (error) throw error;
      toast.success('Hedge locked in!');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save hedge');
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        {/* Input */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calculator className="h-5 w-5 text-emerald-500" />
              Hedge Calculator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Pre-Game Pick</Label>
              <Input placeholder="Lakers ML" value={pregamePick} onChange={e => setPregamePick(e.target.value)} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Pre-Game Odds</Label>
                <Input placeholder="-150" value={pregameOdds} onChange={e => setPregameOdds(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Stake ($)</Label>
                <Input type="number" value={pregameStake} onChange={e => setPregameStake(Number(e.target.value))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Hedge/Live Odds (opponent)</Label>
              <Input placeholder="+400" value={hedgeOdds} onChange={e => setHedgeOdds(e.target.value)} className="mt-1" />
            </div>
            <div className="flex gap-2">
              <Button onClick={quickCalc} variant="outline" className="flex-1">
                <Calculator className="h-4 w-4 mr-2" /> Quick Calc
              </Button>
              <Button onClick={getAiAnalysis} disabled={aiLoading} className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-500">
                {aiLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                AI Analysis
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Hedge Results</CardTitle>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-center">
                  <p className="text-xs text-muted-foreground">GUARANTEED PROFIT</p>
                  <p className="text-3xl font-bold text-emerald-500">${result.guaranteed.toFixed(2)}</p>
                  <p className="text-xs text-emerald-500/70">{result.profitPct.toFixed(1)}% ROI</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 rounded bg-muted/30">
                    <p className="text-xs text-muted-foreground">Hedge Stake</p>
                    <p className="font-mono font-medium">${result.hedgeStake.toFixed(2)}</p>
                  </div>
                  <div className="p-2 rounded bg-muted/30">
                    <p className="text-xs text-muted-foreground">Total Staked</p>
                    <p className="font-mono font-medium">${result.totalStaked.toFixed(2)}</p>
                  </div>
                  <div className="p-2 rounded bg-muted/30">
                    <p className="text-xs text-muted-foreground">If Pre-Game Wins</p>
                    <p className="font-mono font-medium text-emerald-500">+${result.profitIfPregameWins.toFixed(2)}</p>
                  </div>
                  <div className="p-2 rounded bg-muted/30">
                    <p className="text-xs text-muted-foreground">If Hedge Wins</p>
                    <p className="font-mono font-medium text-emerald-500">+${result.profitIfHedgeWins.toFixed(2)}</p>
                  </div>
                </div>

                {result.aiRecommendation && (
                  <div className="p-3 rounded-lg border border-border/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={result.aiRecommendation.action === 'HEDGE_NOW' ? 'destructive' : result.aiRecommendation.action === 'WAIT' ? 'secondary' : 'default'}>
                        {result.aiRecommendation.urgent && '⚡ '}{result.aiRecommendation.action}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{result.aiRecommendation.reasoning}</p>
                    <p className="text-xs text-muted-foreground mt-1">⏱ {result.aiRecommendation.timing}</p>
                  </div>
                )}

                <Button onClick={saveHedge} className="w-full" variant="outline">
                  <Shield className="h-4 w-4 mr-2" /> Lock In Hedge
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <Shield className="h-10 w-10 mx-auto text-muted-foreground/30" />
                <p className="text-muted-foreground mt-3 text-sm">Enter bet details to calculate hedge</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* How it works — permanent example */}
      <Card className="border-emerald-500/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">💡 How Guaranteed Profit Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-2">
              <p className="font-medium text-foreground">Pre-game: Lakers ML -150 → $150 stake → $250 payout</p>
              <p className="text-muted-foreground">Game starts. Lakers go up 20 in Q3.</p>
              <p className="font-medium text-foreground">Live: Celtics ML +400 → $50 stake → $250 payout</p>
            </div>
            <div className="space-y-2 p-3 rounded bg-emerald-500/10 border border-emerald-500/20">
              <p className="font-medium text-emerald-600">✅ Lakers win: $250 - $150 - $50 = <strong>+$50</strong></p>
              <p className="font-medium text-emerald-600">✅ Celtics win: $250 - $150 - $50 = <strong>+$50</strong></p>
              <p className="text-emerald-500 font-bold mt-1">GUARANTEED $50 · 25% ROI · $200 total staked</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SECTION 3 — ARBITRAGE SCANNER
// ═══════════════════════════════════════════════════════════════

function ArbitrageScannerSection() {
  const [scanning, setScanning] = useState(false);
  const queryClient = useQueryClient();

  const { data: arbs } = useQuery({
    queryKey: ['sbo-arbitrage'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_arbitrage')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const scanForArb = async () => {
    setScanning(true);
    try {
      // Fetch odds across all books
      const { data: oddsData, error } = await supabase.functions.invoke('sbo-fetch-odds', {
        body: { sport: 'basketball_nba', markets: 'h2h' },
      });
      if (error) throw error;

      const games = oddsData?.games || oddsData || [];
      let arbCount = 0;

      for (const game of games) {
        const bookmakers = game.bookmakers || [];
        if (bookmakers.length < 2) continue;

        // Find best odds for each side across all books
        let bestHome = { odds: -Infinity, book: '' };
        let bestAway = { odds: -Infinity, book: '' };

        for (const bk of bookmakers) {
          const market = bk.markets?.find((m: any) => m.key === 'h2h');
          if (!market) continue;
          for (const outcome of market.outcomes || []) {
            const dec = outcome.price;
            if (outcome.name === game.home_team && dec > bestHome.odds) {
              bestHome = { odds: dec, book: bk.title };
            }
            if (outcome.name === game.away_team && dec > bestAway.odds) {
              bestAway = { odds: dec, book: bk.title };
            }
          }
        }

        if (bestHome.odds <= 0 || bestAway.odds <= 0) continue;

        // Arb check: 1/oddsA + 1/oddsB < 1
        const impliedTotal = 1 / bestHome.odds + 1 / bestAway.odds;
        if (impliedTotal < 1) {
          const totalStake = 100;
          const stakeA = (totalStake * (1 / bestHome.odds)) / impliedTotal;
          const stakeB = totalStake - stakeA;
          const payoutA = stakeA * bestHome.odds;
          const payoutB = stakeB * bestAway.odds;
          const profit = Math.min(payoutA, payoutB) - totalStake;
          const arbPct = ((1 - impliedTotal) * 100);

          await (supabase as any).from('sbo_arbitrage').insert({
            game_id: game.id,
            bet_type: 'h2h',
            side_a_pick: game.home_team,
            side_a_book: bestHome.book,
            side_a_odds: bestHome.odds.toFixed(2),
            side_a_stake: Math.round(stakeA * 100) / 100,
            side_a_payout: Math.round(payoutA * 100) / 100,
            side_b_pick: game.away_team,
            side_b_book: bestAway.book,
            side_b_odds: bestAway.odds.toFixed(2),
            side_b_stake: Math.round(stakeB * 100) / 100,
            side_b_payout: Math.round(payoutB * 100) / 100,
            total_stake: totalStake,
            guaranteed_profit: Math.round(profit * 100) / 100,
            arb_percentage: Math.round(arbPct * 100) / 100,
            window_open_at: new Date().toISOString(),
          });
          arbCount++;
        }
      }

      toast.success(arbCount > 0 ? `Found ${arbCount} arb opportunities!` : 'No arb opportunities right now — lines are tight');
      queryClient.invalidateQueries({ queryKey: ['sbo-arbitrage'] });
    } catch (e: any) {
      toast.error(e.message || 'Arb scan failed');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="h-5 w-5 text-amber-500" />
                Arbitrage Scanner
              </CardTitle>
              <CardDescription>Cross-book scanning for guaranteed profit — zero prediction needed</CardDescription>
            </div>
            <Button onClick={scanForArb} disabled={scanning}>
              {scanning ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Scanning...</> : <><RefreshCw className="h-4 w-4 mr-2" /> Scan for Arb</>}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!arbs?.length ? (
            <div className="text-center py-6">
              <DollarSign className="h-10 w-10 mx-auto text-muted-foreground/30" />
              <p className="text-muted-foreground mt-3 text-sm">Click Scan to check all books for arbitrage opportunities</p>
              <p className="text-xs text-muted-foreground mt-1">Arb windows close in minutes — scan often</p>
            </div>
          ) : (
            <div className="space-y-3">
              {arbs.map((arb: any) => (
                <div key={arb.id} className="p-4 rounded-lg border border-amber-500/20 bg-amber-500/5">
                  <div className="flex items-center justify-between mb-3">
                    <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">
                      {arb.arb_percentage?.toFixed(2)}% ARB
                    </Badge>
                    <span className="text-lg font-bold text-emerald-500">+${arb.guaranteed_profit?.toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2 rounded bg-muted/30">
                      <p className="text-xs text-muted-foreground">Side A — {arb.side_a_book}</p>
                      <p className="text-sm font-medium">{arb.side_a_pick}</p>
                      <p className="text-xs font-mono">{arb.side_a_odds} · ${arb.side_a_stake}</p>
                    </div>
                    <div className="p-2 rounded bg-muted/30">
                      <p className="text-xs text-muted-foreground">Side B — {arb.side_b_book}</p>
                      <p className="text-sm font-medium">{arb.side_b_pick}</p>
                      <p className="text-xs font-mono">{arb.side_b_odds} · ${arb.side_b_stake}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SECTION 4 — USER BOOKS MANAGER
// ═══════════════════════════════════════════════════════════════

function UserBooksSection() {
  const [bookName, setBookName] = useState('');
  const [balance, setBalance] = useState(0);
  const queryClient = useQueryClient();

  const { data: books } = useQuery({
    queryKey: ['user-books'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('sbo_user_books').select('*').eq('is_active', true).order('added_at', { ascending: false });
      return data || [];
    },
  });

  const POPULAR_BOOKS = ['DraftKings', 'FanDuel', 'BetMGM', 'Caesars', 'PointsBet', 'BetRivers', 'Hard Rock', 'ESPNBet'];

  const addBook = async (name: string) => {
    try {
      await (supabase as any).from('sbo_user_books').insert({ book_name: name, account_balance: balance || 0 });
      toast.success(`${name} added`);
      setBookName('');
      setBalance(0);
      queryClient.invalidateQueries({ queryKey: ['user-books'] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const removeBook = async (id: string) => {
    await (supabase as any).from('sbo_user_books').update({ is_active: false }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['user-books'] });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">📚 My Sportsbooks</CardTitle>
        <CardDescription className="text-xs">Add your active books — hedge and arb calculations route to these</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {POPULAR_BOOKS.filter(b => !books?.some((ub: any) => ub.book_name === b)).map(b => (
            <Button key={b} variant="outline" size="sm" className="text-xs" onClick={() => addBook(b)}>
              <Plus className="h-3 w-3 mr-1" /> {b}
            </Button>
          ))}
        </div>
        {books?.length > 0 && (
          <div className="space-y-2">
            {books.map((b: any) => (
              <div key={b.id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                <span className="text-sm font-medium">{b.book_name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">${b.account_balance || 0}</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeBook(b.id)}>
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// HEDGE CENTER — MAIN PAGE
// ═══════════════════════════════════════════════════════════════

export default function HedgeCenter() {
  return (
    <div className="min-h-screen p-6 space-y-6 bg-gradient-to-br from-background via-background to-emerald-950/10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-emerald-500" />
            Hedge & Guaranteed Profit Center
          </h1>
          <p className="text-sm text-muted-foreground">Pre-game bets → Live hedges → Guaranteed profit. Math, not luck.</p>
        </div>
      </div>

      <Tabs defaultValue="plan" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="plan" className="text-xs">📋 Daily Plan</TabsTrigger>
          <TabsTrigger value="hedge" className="text-xs">🔄 Hedge Calc</TabsTrigger>
          <TabsTrigger value="arb" className="text-xs">💰 Arb Scanner</TabsTrigger>
          <TabsTrigger value="books" className="text-xs">📚 My Books</TabsTrigger>
        </TabsList>

        <TabsContent value="plan" className="mt-4">
          <DailyProfitPlanSection />
        </TabsContent>

        <TabsContent value="hedge" className="mt-4">
          <LiveHedgeSection />
        </TabsContent>

        <TabsContent value="arb" className="mt-4">
          <ArbitrageScannerSection />
        </TabsContent>

        <TabsContent value="books" className="mt-4">
          <UserBooksSection />
        </TabsContent>
      </Tabs>

      <p className="text-xs text-center text-muted-foreground">
        For informational and entertainment purposes only. Not a sportsbook.
      </p>
    </div>
  );
}
