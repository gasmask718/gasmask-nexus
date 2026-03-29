import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Brain, TrendingUp, RefreshCw, Loader2, BarChart3, Zap, Shield,
  ArrowUp, ArrowDown, Minus, Clock, CheckCircle, AlertTriangle
} from 'lucide-react';
import { useLearningEngine, TierPerformance, FactorPerformance, WeightHistoryEntry } from '@/hooks/useLearningEngine';

const TIER_COLOR: Record<string, string> = {
  ELITE: 'text-amber-400',
  STRONG: 'text-emerald-400',
  WATCHLIST: 'text-blue-400',
  LOW: 'text-muted-foreground',
};

const WEIGHT_LABELS: Record<string, string> = {
  ai_weight: 'AI Confidence',
  consensus_weight: 'Consensus',
  capper_weight: 'Capper Grade',
  roi_weight: 'ROI',
  market_weight: 'Market',
  alignment_bonus: 'Alignment Bonus',
};

function WeightBar({ label, value, defaultVal, max = 0.5 }: { label: string; value: number; defaultVal: number; max?: number }) {
  const isBonus = label === 'Alignment Bonus';
  const displayVal = isBonus ? value : Math.round(value * 100);
  const displayDefault = isBonus ? defaultVal : Math.round(defaultVal * 100);
  const pct = isBonus ? (value / 20) * 100 : (value / max) * 100;
  const delta = Math.round((value - defaultVal) * (isBonus ? 10 : 1000)) / (isBonus ? 10 : 10);
  const deltaColor = delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-muted-foreground';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-black">{isBonus ? `+${displayVal}` : `${displayVal}%`}</span>
          {delta !== 0 && (
            <span className={`text-[10px] font-bold ${deltaColor} flex items-center gap-0.5`}>
              {delta > 0 ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
              {Math.abs(delta)}{isBonus ? '' : '%'}
            </span>
          )}
          {delta === 0 && <Minus className="h-2.5 w-2.5 text-muted-foreground/50" />}
        </div>
      </div>
      <Progress value={Math.min(100, pct)} className="h-1.5" />
    </div>
  );
}

function TierPerformanceTable({ tiers }: { tiers: TierPerformance[] }) {
  if (tiers.length === 0) return (
    <Card className="border-dashed">
      <CardContent className="p-6 text-center text-xs text-muted-foreground">No resolved picks yet</CardContent>
    </Card>
  );
  return (
    <Card>
      <CardHeader className="pb-2 border-b border-border/50">
        <CardTitle className="text-xs font-bold tracking-widest flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-blue-400" /> TIER PERFORMANCE
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {tiers.map((t, i) => (
          <div key={t.tier} className={`flex items-center justify-between px-4 py-3 text-xs ${i < tiers.length - 1 ? 'border-b border-border/30' : ''}`}>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-[10px] font-bold ${TIER_COLOR[t.tier]}`}>{t.tier}</Badge>
              <span className="text-muted-foreground">{t.total} picks</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-bold">{t.winRate}% WR</span>
              <span className={`font-black ${t.roi > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {t.roi > 0 ? '+' : ''}{t.roi}% ROI
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function FactorBreakdown({ factors }: { factors: FactorPerformance[] }) {
  if (factors.length === 0) return null;
  const grouped = factors.reduce<Record<string, FactorPerformance[]>>((acc, f) => {
    (acc[f.factor] = acc[f.factor] || []).push(f);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="pb-2 border-b border-border/50">
        <CardTitle className="text-xs font-bold tracking-widest flex items-center gap-2">
          <Zap className="h-4 w-4 text-purple-400" /> FACTOR ANALYSIS
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {Object.entries(grouped).map(([factor, items]) => (
          <div key={factor}>
            <h4 className="text-[10px] font-bold tracking-widest text-muted-foreground mb-2">{factor.toUpperCase()}</h4>
            <div className="space-y-1.5">
              {items.map(f => (
                <div key={f.bucket} className="flex items-center justify-between text-xs">
                  <span className="capitalize">{f.bucket}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{f.wins}W / {f.losses}L</span>
                    <span className="font-bold">{f.winRate}%</span>
                    <span className={`font-black text-[11px] ${f.roi > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {f.roi > 0 ? '+' : ''}{f.roi}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function WeightAuditLog({ history }: { history: WeightHistoryEntry[] }) {
  if (history.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2 border-b border-border/50">
        <CardTitle className="text-xs font-bold tracking-widest flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-400" /> WEIGHT ADJUSTMENT HISTORY
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {history.slice(0, 5).map((h, i) => (
          <div key={h.id} className={`px-4 py-3 ${i < Math.min(history.length, 5) - 1 ? 'border-b border-border/30' : ''}`}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">{new Date(h.created_at).toLocaleDateString()}</span>
              <span className="text-[10px] text-muted-foreground">{h.sample_size} picks analyzed</span>
            </div>
            {h.adjustments_applied && Object.keys(h.adjustments_applied).length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-1">
                {Object.entries(h.adjustments_applied).map(([key, adj]) => (
                  <Badge key={key} variant="outline" className={`text-[9px] ${(adj as any).delta > 0 ? 'text-emerald-400 border-emerald-500/30' : 'text-red-400 border-red-500/30'}`}>
                    {WEIGHT_LABELS[key] || key}: {(adj as any).delta > 0 ? '+' : ''}{Math.round((adj as any).delta * 100)}%
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-[10px] text-muted-foreground">No changes needed</span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function LearningDashboard() {
  const {
    weights, weightsLoading, learningEvents, eventsLoading,
    weightHistory, tierPerformance, factorPerformance,
    recalibrate, isRecalibrating, totalEvents, canRecalibrate,
  } = useLearningEngine();

  const defaults = { ai_weight: 0.40, consensus_weight: 0.15, capper_weight: 0.20, roi_weight: 0.15, market_weight: 0.10, alignment_bonus: 10 };

  if (weightsLoading || eventsLoading) {
    return <Card><CardContent className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="h-5 w-5 text-purple-400" />
          <div>
            <h2 className="text-sm font-black tracking-[0.1em]">LEARNING ENGINE</h2>
            <p className="text-[10px] text-muted-foreground">
              {totalEvents} events · {weights.recalibration_count} recalibrations
              {weights.last_recalibrated_at && ` · Last: ${new Date(weights.last_recalibrated_at).toLocaleDateString()}`}
            </p>
          </div>
        </div>
        <Button
          onClick={() => recalibrate.mutate()}
          disabled={isRecalibrating || !canRecalibrate}
          size="sm"
          className="gap-1.5 text-xs"
        >
          {isRecalibrating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Recalibrate
        </Button>
      </div>

      {/* Status */}
      {!canRecalibrate && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-3 flex items-center gap-2 text-xs">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span>Need at least 10 resolved picks to recalibrate. Currently: {totalEvents}.</span>
          </CardContent>
        </Card>
      )}

      {canRecalibrate && (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-3 flex items-center gap-2 text-xs">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            <span>System ready to learn. {totalEvents} events tracked. Weights adjust ±10% max per cycle.</span>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Current Weights */}
        <Card>
          <CardHeader className="pb-2 border-b border-border/50">
            <CardTitle className="text-xs font-bold tracking-widest flex items-center gap-2">
              <Shield className="h-4 w-4 text-amber-400" /> DYNAMIC WEIGHTS
              <Badge variant="outline" className="text-[9px] ml-auto">v{weights.recalibration_count}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <WeightBar label="AI Confidence" value={weights.ai_weight} defaultVal={defaults.ai_weight} />
            <WeightBar label="Consensus" value={weights.consensus_weight} defaultVal={defaults.consensus_weight} />
            <WeightBar label="Capper Grade" value={weights.capper_weight} defaultVal={defaults.capper_weight} />
            <WeightBar label="ROI" value={weights.roi_weight} defaultVal={defaults.roi_weight} />
            <WeightBar label="Market" value={weights.market_weight} defaultVal={defaults.market_weight} />
            <WeightBar label="Alignment Bonus" value={weights.alignment_bonus} defaultVal={defaults.alignment_bonus} max={20} />
          </CardContent>
        </Card>

        {/* Tier Performance */}
        <TierPerformanceTable tiers={tierPerformance} />
      </div>

      {/* Factor Analysis */}
      <FactorBreakdown factors={factorPerformance} />

      {/* Weight History */}
      <WeightAuditLog history={weightHistory} />

      {/* Disclaimer */}
      <Card className="border-amber-500/20">
        <CardContent className="p-3 text-center">
          <AlertTriangle className="h-4 w-4 mx-auto text-amber-400 mb-1" />
          <p className="text-[9px] font-bold text-amber-400 tracking-wider">SAFETY LIMITS ACTIVE</p>
          <p className="text-[8px] text-muted-foreground mt-0.5">Weight changes capped at ±10% per cycle. Min 10 picks required. All adjustments logged.</p>
        </CardContent>
      </Card>
    </div>
  );
}
