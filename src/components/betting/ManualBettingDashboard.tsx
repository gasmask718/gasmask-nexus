import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Flame, TrendingUp, Target, AlertTriangle, Snowflake, CheckCircle, XCircle, Users, BarChart3, ShieldAlert, Eye } from 'lucide-react';
import { useConsensusIntelligence, ConsensusPick, CapperKPI } from '@/hooks/useConsensusIntelligence';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

// ── Confidence Score Calculation ──
function calcConfidence(pick: ConsensusPick): number {
  const consensusWeight = Math.min(pick.capperCount / 5, 1) * 40;
  const roiWeight = Math.min(Math.max(pick.avgCapperROI + 20, 0) / 40, 1) * 40;
  const wrWeight = Math.min(pick.avgCapperWinRate / 100, 1) * 20;
  return Math.round(consensusWeight + roiWeight + wrWeight);
}

function getConfidenceLevel(score: number): { label: string; icon: React.ReactNode; color: string } {
  if (score >= 65) return { label: 'High', icon: <Flame className="h-3.5 w-3.5" />, color: 'text-amber-400 border-amber-400/30 bg-amber-400/10' };
  if (score >= 40) return { label: 'Medium', icon: <AlertTriangle className="h-3.5 w-3.5" />, color: 'text-blue-400 border-blue-400/30 bg-blue-400/10' };
  return { label: 'Low', icon: <Snowflake className="h-3.5 w-3.5" />, color: 'text-muted-foreground border-border bg-muted/30' };
}

const sportColors: Record<string, string> = {
  NBA: 'text-orange-500 border-orange-500/30 bg-orange-500/10',
  NFL: 'text-green-500 border-green-500/30 bg-green-500/10',
  MLB: 'text-red-500 border-red-500/30 bg-red-500/10',
  NHL: 'text-blue-500 border-blue-500/30 bg-blue-500/10',
};

// ── Pre-Bet Checklist Dialog ──
function BetChecklist({ pick, confidence, cappers }: { pick: ConsensusPick; confidence: number; cappers: CapperKPI[] }) {
  const relevantCappers = cappers.filter(c => pick.capperNames.includes(c.name));
  const avgWR = relevantCappers.length > 0 ? relevantCappers.reduce((s, c) => s + c.winRate, 0) / relevantCappers.length : 0;
  const allPositiveROI = relevantCappers.every(c => c.roi > 0);
  const level = getConfidenceLevel(confidence);

  const checks = [
    { label: 'Consensus Level', pass: pick.capperCount >= 2, detail: `${pick.capperCount} cappers agree` },
    { label: 'Capper Strength', pass: avgWR >= 50, detail: `Avg win rate: ${avgWR.toFixed(1)}%` },
    { label: 'ROI Positive', pass: allPositiveROI, detail: allPositiveROI ? 'All backing cappers profitable' : 'Some cappers have negative ROI' },
    { label: 'Confidence Score', pass: confidence >= 50, detail: `Score: ${confidence}/100` },
    { label: 'High Consensus', pass: pick.capperCount >= 3, detail: pick.capperCount >= 3 ? '3+ cappers = strong signal' : 'Under 3 cappers' },
  ];
  const passCount = checks.filter(c => c.pass).length;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
          <Eye className="h-3 w-3" /> Checklist
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📋 Pre-Bet Checklist
            <Badge variant="outline" className={level.color}>{level.icon} {level.label}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-center p-3 rounded-lg bg-muted/30 border">
            <p className="font-bold text-lg">{pick.player_name}</p>
            <p className="text-sm text-muted-foreground">{pick.direction} {pick.line} {pick.prop_type}</p>
            <p className="text-xs text-muted-foreground mt-1">{pick.game_date} · {pick.sport}</p>
          </div>

          <div className="space-y-2">
            {checks.map((check, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded border">
                {check.pass ? <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" /> : <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                <div className="flex-1">
                  <p className="text-xs font-medium">{check.label}</p>
                  <p className="text-[10px] text-muted-foreground">{check.detail}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center p-3 rounded-lg border">
            <p className="text-xs text-muted-foreground mb-1">Overall Score</p>
            <p className={`text-2xl font-black ${passCount >= 4 ? 'text-emerald-400' : passCount >= 3 ? 'text-amber-400' : 'text-destructive'}`}>
              {passCount}/{checks.length}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {passCount >= 4 ? '✅ Strong bet — proceed with confidence' : passCount >= 3 ? '⚠️ Decent signal — consider smaller size' : '❄️ Weak signal — consider skipping'}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Dashboard ──
export function ManualBettingDashboard() {
  const { consensusPicks, consensusStats, capperKPIs, todayConsensusPicks, isLoading } = useConsensusIntelligence();
  const [riskFilter, setRiskFilter] = useState<'all' | 'high_only' | 'exclude_risky'>('all');

  // Score & sort today's picks
  const scoredPicks = useMemo(() => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const picks = todayConsensusPicks.length > 0 ? todayConsensusPicks : consensusPicks.filter(p => !p.result);
    return picks.map(p => ({ ...p, confidence: calcConfidence(p) }))
      .sort((a, b) => b.confidence - a.confidence);
  }, [todayConsensusPicks, consensusPicks]);

  // Filtered picks
  const filteredPicks = useMemo(() => {
    switch (riskFilter) {
      case 'high_only': return scoredPicks.filter(p => p.confidence >= 65);
      case 'exclude_risky': return scoredPicks.filter(p => p.confidence >= 40);
      default: return scoredPicks;
    }
  }, [scoredPicks, riskFilter]);

  // Market edge analysis
  const marketEdge = useMemo(() => {
    const resolvedConsensus = consensusPicks.filter(p => p.result === 'won' || p.result === 'lost');
    const byMarket = new Map<string, { wins: number; total: number; totalROI: number }>();
    for (const p of resolvedConsensus) {
      const key = p.prop_type || 'unknown';
      if (!byMarket.has(key)) byMarket.set(key, { wins: 0, total: 0, totalROI: 0 });
      const m = byMarket.get(key)!;
      m.total++;
      if (p.result === 'won') { m.wins++; m.totalROI += 0.909; } else { m.totalROI -= 1; }
    }
    return [...byMarket.entries()]
      .map(([market, stats]) => ({
        market,
        winRate: Math.round((stats.wins / stats.total) * 100),
        roi: Math.round((stats.totalROI / stats.total) * 10000) / 100,
        total: stats.total,
      }))
      .filter(m => m.total >= 2)
      .sort((a, b) => b.roi - a.roi);
  }, [consensusPicks]);

  // Risky cappers
  const riskyCappers = capperKPIs.filter(c => c.totalPicks >= 5 && c.winRate < 45);
  const eliteCappers = capperKPIs.filter(c => c.totalPicks >= 5 && c.roi > 5);

  if (isLoading) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground">Loading intelligence...</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      {/* Intelligence KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card className="border-amber-500/20"><CardContent className="p-3 text-center">
          <Flame className="h-4 w-4 mx-auto text-amber-400 mb-1" />
          <p className="text-xl font-black text-amber-400">{scoredPicks.filter(p => p.confidence >= 65).length}</p>
          <p className="text-[10px] text-muted-foreground">🔥 High Confidence</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <Target className="h-4 w-4 mx-auto text-emerald-400 mb-1" />
          <p className={`text-xl font-black ${consensusStats.consensusWinRate >= 55 ? 'text-emerald-400' : ''}`}>
            {consensusStats.consensusWinRate}%
          </p>
          <p className="text-[10px] text-muted-foreground">Consensus Win Rate</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <TrendingUp className="h-4 w-4 mx-auto text-blue-400 mb-1" />
          <p className={`text-xl font-black ${consensusStats.consensusROI > 0 ? 'text-emerald-400' : 'text-destructive'}`}>
            {consensusStats.consensusROI > 0 ? '+' : ''}{consensusStats.consensusROI}%
          </p>
          <p className="text-[10px] text-muted-foreground">Consensus ROI</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <Users className="h-4 w-4 mx-auto text-purple-400 mb-1" />
          <p className="text-xl font-black">{eliteCappers.length}</p>
          <p className="text-[10px] text-muted-foreground">💰 Profitable Cappers</p>
        </CardContent></Card>
      </div>

      {/* Risk Filter */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Flame className="h-4 w-4 text-amber-400" /> Best Picks Today
          <Badge variant="outline" className="text-[10px]">{filteredPicks.length} picks</Badge>
        </h3>
        <Select value={riskFilter} onValueChange={v => setRiskFilter(v as any)}>
          <SelectTrigger className="w-40 h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Signals</SelectItem>
            <SelectItem value="high_only">🔥 High Confidence Only</SelectItem>
            <SelectItem value="exclude_risky">⚠️ Exclude Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Top Picks with Confidence */}
      {filteredPicks.length === 0 ? (
        <Card className="border-dashed"><CardContent className="p-8 text-center">
          <Snowflake className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No consensus picks match this filter</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filteredPicks.slice(0, 10).map((pick, i) => {
            const level = getConfidenceLevel(pick.confidence);
            return (
              <Card key={i} className={`overflow-hidden ${
                pick.confidence >= 65 ? 'border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-transparent' :
                pick.confidence >= 40 ? 'border-blue-500/20' : 'border-border'
              }`}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold">{pick.player_name}</span>
                        <Badge className={`text-[9px] ${sportColors[pick.sport] || ''}`}>{pick.sport}</Badge>
                        <Badge variant="outline" className={`text-[9px] gap-0.5 ${level.color}`}>
                          {level.icon} {level.label}
                        </Badge>
                        {pick.capperCount >= 4 && (
                          <Badge variant="outline" className="text-[8px] text-amber-400 border-amber-400/30 bg-amber-400/10">
                            🔥 High Consensus
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] ${
                          pick.direction === 'OVER' ? 'text-emerald-500 border-emerald-500/30' : 'text-blue-500 border-blue-500/30'
                        }`}>{pick.direction}</Badge>
                        <Badge variant="outline" className="text-[10px]">{pick.prop_type}</Badge>
                        <span className="text-xs font-bold">{pick.line}</span>
                        {pick.team && <span className="text-[10px] text-muted-foreground">· {pick.team}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                        <span>👥 {pick.capperNames.join(', ')}</span>
                        <span>· Avg ROI: <span className={pick.avgCapperROI > 0 ? 'text-emerald-400' : 'text-destructive'}>{pick.avgCapperROI > 0 ? '+' : ''}{pick.avgCapperROI}%</span></span>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 shrink-0">
                      <div className="text-center">
                        <p className={`text-2xl font-black ${pick.confidence >= 65 ? 'text-amber-400' : pick.confidence >= 40 ? 'text-blue-400' : 'text-muted-foreground'}`}>
                          {pick.confidence}
                        </p>
                        <p className="text-[9px] text-muted-foreground">confidence</p>
                      </div>
                      <BetChecklist pick={pick} confidence={pick.confidence} cappers={capperKPIs} />
                    </div>
                  </div>
                  {/* Confidence bar */}
                  <Progress value={pick.confidence} className="h-1 mt-2" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Two-column: Market Edge + Capper Risk */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Market Edge Analysis */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-400" /> Market Edge Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {marketEdge.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Not enough resolved consensus data yet</p>
            ) : marketEdge.map((m, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded border text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{m.market}</Badge>
                  <span className="text-muted-foreground">{m.total} picks</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={m.winRate >= 55 ? 'text-emerald-400 font-bold' : ''}>{m.winRate}% WR</span>
                  <span className={`font-bold ${m.roi > 0 ? 'text-emerald-400' : 'text-destructive'}`}>
                    {m.roi > 0 ? '+' : ''}{m.roi}% ROI
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Risk Alerts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-400" /> Capper Risk Monitor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {riskyCappers.length === 0 && eliteCappers.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Need more resolved picks for risk analysis</p>
            ) : (
              <>
                {eliteCappers.slice(0, 3).map(c => (
                  <div key={c.id} className="flex items-center justify-between p-2 rounded border border-emerald-500/20 bg-emerald-500/5">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px] text-emerald-400 border-emerald-400/30">💰 Elite</Badge>
                      <span className="text-xs font-medium">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-emerald-400 font-bold">+{c.roi}% ROI</span>
                      <span>{c.winRate}% WR</span>
                      <span className="text-muted-foreground">{c.totalPicks}p</span>
                    </div>
                  </div>
                ))}
                {riskyCappers.slice(0, 3).map(c => (
                  <div key={c.id} className="flex items-center justify-between p-2 rounded border border-destructive/20 bg-destructive/5">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px] text-destructive border-destructive/30">⚠️ Risky</Badge>
                      <span className="text-xs font-medium">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-destructive font-bold">{c.roi}% ROI</span>
                      <span>{c.winRate}% WR</span>
                      <span className="text-muted-foreground">{c.totalPicks}p</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Capper Insight Cards */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-400" /> Capper Insights
          <Badge variant="outline" className="text-[10px]">{capperKPIs.length} tracked</Badge>
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {capperKPIs.filter(c => c.totalPicks >= 1).slice(0, 9).map(c => {
            const streakPicks = capperKPIs; // simplified - show KPIs
            return (
              <Card key={c.id} className={`overflow-hidden ${
                c.badge === 'high_roi' ? 'border-emerald-500/20' :
                c.badge === 'low_accuracy' ? 'border-destructive/20' : ''
              }`}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm">{c.name}</span>
                      {c.badge === 'high_roi' && <Badge variant="outline" className="text-[8px] text-emerald-400 border-emerald-400/30">💰</Badge>}
                      {c.badge === 'low_accuracy' && <Badge variant="outline" className="text-[8px] text-destructive border-destructive/30">⚠️</Badge>}
                    </div>
                    <Badge variant="outline" className="text-[9px]">{c.tier}</Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-center">
                    <div>
                      <p className={`text-sm font-bold ${c.roi > 0 ? 'text-emerald-400' : c.roi < 0 ? 'text-destructive' : ''}`}>
                        {c.roi > 0 ? '+' : ''}{c.roi}%
                      </p>
                      <p className="text-[8px] text-muted-foreground">ROI</p>
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${c.winRate >= 55 ? 'text-emerald-400' : ''}`}>{c.winRate}%</p>
                      <p className="text-[8px] text-muted-foreground">Win Rate</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold">{c.wins}W/{c.losses}L</p>
                      <p className="text-[8px] text-muted-foreground">Record</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold">{c.bestMarket}</p>
                      <p className="text-[8px] text-muted-foreground">Best Mkt</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
