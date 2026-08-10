import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  DollarSign, TrendingUp, TrendingDown, Target, Shield, 
  Zap, BarChart3, Calculator, Brain, AlertTriangle 
} from 'lucide-react';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════════
// BET SIZING ENGINE
// ═══════════════════════════════════════════════════════════

interface BetSizing {
  units: number;
  dollarAmount: number;
  tier: 'conservative' | 'standard' | 'aggressive' | 'max';
  reason: string;
}

function calculateBetSize(
  confidence: number, 
  edge: number, 
  unitSize: number,
  kellyFraction: number = 0.25
): BetSizing {
  // Quarter-Kelly sizing
  const impliedEdge = Math.max(edge, 0) / 100;
  const kellyPct = impliedEdge > 0 ? (impliedEdge * kellyFraction) : 0;
  
  let units: number;
  let tier: BetSizing['tier'];
  let reason: string;

  if (confidence >= 85 && edge >= 3) {
    units = 5;
    tier = 'max';
    reason = 'Elite confidence + strong edge → max exposure';
  } else if (confidence >= 75 && edge >= 2) {
    units = 4;
    tier = 'aggressive';
    reason = 'High confidence with solid edge';
  } else if (confidence >= 65 && edge >= 1) {
    units = 3;
    tier = 'standard';
    reason = 'Good confidence, positive edge';
  } else if (confidence >= 55) {
    units = 2;
    tier = 'standard';
    reason = 'Moderate confidence, worth playing';
  } else {
    units = 1;
    tier = 'conservative';
    reason = 'Low confidence — minimum exposure or skip';
  }

  // Kelly adjustment
  const kellyUnits = Math.max(1, Math.round(kellyPct * 100));
  units = Math.min(units, kellyUnits > 0 ? Math.max(units, kellyUnits) : units);

  return {
    units,
    dollarAmount: units * unitSize,
    tier,
    reason,
  };
}

// ═══════════════════════════════════════════════════════════
// DAILY PLAN GENERATOR  
// ═══════════════════════════════════════════════════════════

function DailyPlanSection({ bankroll, predictions }: { bankroll: any; predictions: any[] }) {
  const unitSize = bankroll?.unit_size || 10;
  const maxDailyExposure = (bankroll?.current_bankroll || 500) * 0.15; // 15% max

  const plan = useMemo(() => {
    if (!predictions?.length) return null;

    const scored = predictions
      .filter((p: any) => p.final_confidence >= 55)
      .map((p: any) => {
        const edge = p.edge_vs_line || (p.final_confidence - 50) / 10;
        const sizing = calculateBetSize(p.final_confidence, edge, unitSize, bankroll?.kelly_fraction || 0.25);
        return { ...p, sizing, edge };
      })
      .sort((a: any, b: any) => b.final_confidence - a.final_confidence);

    const topPlays = scored.slice(0, 5);
    const safePlays = scored.filter((p: any) => p.sizing.tier === 'conservative' || p.sizing.tier === 'standard').slice(0, 3);
    const aggressivePlays = scored.filter((p: any) => p.sizing.tier === 'aggressive' || p.sizing.tier === 'max').slice(0, 3);

    const totalExposure = topPlays.reduce((s: number, p: any) => s + p.sizing.dollarAmount, 0);
    const projectedProfit = topPlays.reduce((s: number, p: any) => {
      const winProb = p.final_confidence / 100;
      return s + (p.sizing.dollarAmount * winProb * 0.9 - p.sizing.dollarAmount * (1 - winProb));
    }, 0);

    return { topPlays, safePlays, aggressivePlays, totalExposure, projectedProfit, overExposed: totalExposure > maxDailyExposure };
  }, [predictions, unitSize, maxDailyExposure, bankroll?.kelly_fraction]);

  if (!plan || !plan.topPlays.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <Brain className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No predictions above 55% confidence today.</p>
          <p className="text-xs text-muted-foreground mt-1">Run AI predictions first to generate a profit plan.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Plan Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-primary">{plan.topPlays.length}</p>
            <p className="text-[10px] text-muted-foreground">Top Plays</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className={`text-lg font-bold ${plan.overExposed ? 'text-destructive' : 'text-foreground'}`}>
              ${plan.totalExposure.toFixed(0)}
            </p>
            <p className="text-[10px] text-muted-foreground">Total Exposure</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className={`text-lg font-bold ${plan.projectedProfit >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
              {plan.projectedProfit >= 0 ? '+' : ''}${plan.projectedProfit.toFixed(0)}
            </p>
            <p className="text-[10px] text-muted-foreground">Projected EV</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-foreground">${maxDailyExposure.toFixed(0)}</p>
            <p className="text-[10px] text-muted-foreground">Max Allowed</p>
          </CardContent>
        </Card>
      </div>

      {plan.overExposed && (
        <div className="flex items-center gap-2 p-2 rounded bg-destructive/10 text-destructive text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Total exposure exceeds 15% daily limit. Consider reducing stakes.</span>
        </div>
      )}

      {/* Top Plays */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" /> Top 5 Plays
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {plan.topPlays.map((p: any, i: number) => (
            <PickCard key={p.id || i} pick={p} rank={i + 1} />
          ))}
        </CardContent>
      </Card>

      {/* Safe vs Aggressive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-500" /> Safe Plays
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {plan.safePlays.length ? plan.safePlays.map((p: any, i: number) => (
              <MiniPickCard key={p.id || i} pick={p} />
            )) : <p className="text-xs text-muted-foreground">None today</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-500" /> Aggressive Plays
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {plan.aggressivePlays.length ? plan.aggressivePlays.map((p: any, i: number) => (
              <MiniPickCard key={p.id || i} pick={p} />
            )) : <p className="text-xs text-muted-foreground">None today</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PickCard({ pick, rank }: { pick: any; rank: number }) {
  const tierColors: Record<string, string> = {
    max: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
    aggressive: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
    standard: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
    conservative: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
      <span className="text-lg font-bold text-muted-foreground w-6 text-center">#{rank}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">
            {pick.player_name || pick.home_team || 'Unknown'}
          </span>
          <Badge variant="outline" className="text-[10px]">
            {pick.prop_type || pick.prediction_type || pick.market_type || '—'}
          </Badge>
          {pick.pick_direction && (
            <Badge variant="outline" className="text-[10px]">
              {pick.pick_direction}
            </Badge>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">{pick.sizing?.reason}</p>
      </div>
      <div className="text-right shrink-0 space-y-1">
        <div className="flex items-center gap-1.5 justify-end">
          <Badge className="text-[10px]">{pick.final_confidence}%</Badge>
          {pick.edge > 0 && (
            <Badge variant="outline" className="text-[10px] text-emerald-500">+{pick.edge.toFixed(1)}</Badge>
          )}
        </div>
        <Badge variant="outline" className={`text-[10px] ${tierColors[pick.sizing?.tier] || ''}`}>
          {pick.sizing?.units}u · ${pick.sizing?.dollarAmount}
        </Badge>
      </div>
    </div>
  );
}

function MiniPickCard({ pick }: { pick: any }) {
  return (
    <div className="flex items-center justify-between text-xs p-2 rounded bg-muted/30">
      <span className="truncate font-medium">{pick.player_name || pick.home_team}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        <Badge variant="outline" className="text-[9px]">{pick.final_confidence}%</Badge>
        <span className="text-muted-foreground">{pick.sizing?.units}u</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PERFORMANCE TRACKER
// ═══════════════════════════════════════════════════════════

function PerformanceSection({ bankroll, betHistory }: { bankroll: any; betHistory: any[] }) {
  const stats = useMemo(() => {
    if (!betHistory?.length) return null;
    const wins = betHistory.filter((b: any) => b.outcome === 'won');
    const losses = betHistory.filter((b: any) => b.outcome === 'lost');
    const totalStaked = betHistory.reduce((s: number, b: any) => s + (b.stake_usd || 0), 0);
    const totalProfit = betHistory.reduce((s: number, b: any) => s + (b.profit_loss || 0), 0);
    const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;

    // Last 7 days P&L
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const recentBets = betHistory.filter((b: any) => new Date(b.bet_date || b.created_at) >= weekAgo);
    const weekProfit = recentBets.reduce((s: number, b: any) => s + (b.profit_loss || 0), 0);

    return {
      totalBets: betHistory.length,
      wins: wins.length,
      losses: losses.length,
      winRate: betHistory.length > 0 ? (wins.length / betHistory.length) * 100 : 0,
      totalStaked,
      totalProfit,
      roi,
      weekProfit,
      streak: bankroll?.current_streak || 0,
      streakType: bankroll?.streak_type || 'none',
    };
  }, [betHistory, bankroll]);

  if (!stats) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <BarChart3 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No bet history yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Total Bets', value: stats.totalBets, icon: Target },
          { label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, icon: TrendingUp, color: stats.winRate >= 55 ? 'text-emerald-500' : stats.winRate >= 50 ? 'text-foreground' : 'text-destructive' },
          { label: 'Total P&L', value: `${stats.totalProfit >= 0 ? '+' : ''}$${stats.totalProfit.toFixed(2)}`, icon: DollarSign, color: stats.totalProfit >= 0 ? 'text-emerald-500' : 'text-destructive' },
          { label: 'ROI', value: `${stats.roi >= 0 ? '+' : ''}${stats.roi.toFixed(1)}%`, icon: BarChart3, color: stats.roi >= 0 ? 'text-emerald-500' : 'text-destructive' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <s.icon className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">{s.label}</span>
              </div>
              <p className={`text-lg font-bold ${(s as any).color || 'text-foreground'}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card><CardContent className="p-3 text-center"><p className="text-sm font-bold text-foreground">{stats.wins}W - {stats.losses}L</p><p className="text-[10px] text-muted-foreground">Record</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className={`text-sm font-bold ${stats.weekProfit >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>{stats.weekProfit >= 0 ? '+' : ''}${stats.weekProfit.toFixed(2)}</p><p className="text-[10px] text-muted-foreground">7-Day P&L</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-sm font-bold text-foreground">${stats.totalStaked.toFixed(0)}</p><p className="text-[10px] text-muted-foreground">Total Staked</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className={`text-sm font-bold ${stats.streakType === 'win' ? 'text-emerald-500' : stats.streakType === 'loss' ? 'text-destructive' : 'text-foreground'}`}>{stats.streak} {stats.streakType}</p><p className="text-[10px] text-muted-foreground">Streak</p></CardContent></Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// BANKROLL CONFIG
// ═══════════════════════════════════════════════════════════

function BankrollConfig({ bankroll, onSave }: { bankroll: any; onSave: () => void }) {
  const [currentBankroll, setCurrentBankroll] = useState(String(bankroll?.current_bankroll || 500));
  const [unitPct, setUnitPct] = useState(String(bankroll?.unit_size ? ((bankroll.unit_size / (bankroll.current_bankroll || 500)) * 100).toFixed(1) : '2'));
  const [saving, setSaving] = useState(false);

  const unitSize = (parseFloat(currentBankroll) || 500) * (parseFloat(unitPct) || 2) / 100;

  const handleSave = async () => {
    setSaving(true);
    const today = new Date().toISOString().split('T')[0];
    const { error } = await (supabase as any)
      .from('sbo_bankroll')
      .upsert({
        snapshot_date: today,
        current_bankroll: parseFloat(currentBankroll) || 500,
        starting_bankroll: bankroll?.starting_bankroll || parseFloat(currentBankroll) || 500,
        unit_size: unitSize,
        kelly_fraction: 0.25,
        peak_bankroll: Math.max(bankroll?.peak_bankroll || 0, parseFloat(currentBankroll) || 500),
      }, { onConflict: 'snapshot_date' });

    setSaving(false);
    if (error) {
      toast.error('Failed to save bankroll config');
    } else {
      toast.success('Bankroll updated');
      onSave();
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calculator className="h-4 w-4" /> Bankroll Config
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Current Bankroll ($)</Label>
            <Input type="number" value={currentBankroll} onChange={e => setCurrentBankroll(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Unit Size (%)</Label>
            <Input type="number" value={unitPct} onChange={e => setUnitPct(e.target.value)} step="0.5" className="h-8 text-sm" />
          </div>
        </div>
        <div className="flex items-center justify-between text-xs bg-muted/50 p-2 rounded">
          <span className="text-muted-foreground">1 unit =</span>
          <span className="font-bold">${unitSize.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-xs bg-muted/50 p-2 rounded">
          <span className="text-muted-foreground">Max daily exposure (15%)</span>
          <span className="font-bold">${((parseFloat(currentBankroll) || 500) * 0.15).toFixed(0)}</span>
        </div>
        <Button size="sm" className="w-full" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Config'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════

export default function SBOProfitCenter() {
  const today = new Date().toISOString().split('T')[0];

  const { data: bankroll, refetch: refetchBankroll } = useQuery({
    queryKey: ['profit-bankroll'],
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

  const { data: predictions } = useQuery({
    queryKey: ['profit-predictions', today],
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

  const { data: betHistory } = useQuery({
    queryKey: ['profit-bet-history'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('sbo_actual_bets')
        .select('*')
        .not('outcome', 'eq', 'pending')
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <DollarSign className="h-6 w-6 text-emerald-500" />
        <div>
          <h1 className="text-xl font-bold">SBO Profit Center</h1>
          <p className="text-xs text-muted-foreground">Bankroll management · Bet sizing · Performance tracking</p>
        </div>
        {bankroll && (
          <Badge variant="outline" className="ml-auto text-emerald-500 border-emerald-500/30">
            Bankroll: ${bankroll.current_bankroll?.toFixed(0) || '—'}
          </Badge>
        )}
      </div>

      <Tabs defaultValue="plan">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="plan" className="text-xs">📋 Daily Plan</TabsTrigger>
          <TabsTrigger value="performance" className="text-xs">📊 Performance</TabsTrigger>
          <TabsTrigger value="config" className="text-xs">⚙️ Config</TabsTrigger>
        </TabsList>

        <TabsContent value="plan" className="mt-3">
          <DailyPlanSection bankroll={bankroll} predictions={predictions || []} />
        </TabsContent>

        <TabsContent value="performance" className="mt-3">
          <PerformanceSection bankroll={bankroll} betHistory={betHistory || []} />
        </TabsContent>

        <TabsContent value="config" className="mt-3">
          <BankrollConfig bankroll={bankroll} onSave={() => refetchBankroll()} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
