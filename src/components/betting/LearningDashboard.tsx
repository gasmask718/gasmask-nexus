import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Brain, TrendingUp, RefreshCw, Loader2, BarChart3, Zap, Shield,
  ArrowUp, ArrowDown, Minus, Clock, CheckCircle, AlertTriangle,
  Lock, Unlock, RotateCcw, SlidersHorizontal, Lightbulb, Activity,
  TriangleAlert
} from 'lucide-react';
import { useLearningEngine, TierPerformance, FactorPerformance, WeightHistoryEntry, DEFAULT_WEIGHTS } from '@/hooks/useLearningEngine';

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
          <span className="text-[10px] text-muted-foreground">def: {isBonus ? `+${displayDefault}` : `${displayDefault}%`}</span>
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

function WeightAuditLog({ history, onRollback }: { history: WeightHistoryEntry[]; onRollback: (h: WeightHistoryEntry) => void }) {
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
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{new Date(h.created_at).toLocaleDateString()}</span>
                <Badge variant="outline" className="text-[9px]">{h.trigger_reason?.replace(/_/g, ' ')}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{h.sample_size} picks</span>
                {h.adjustments_applied && Object.keys(h.adjustments_applied).length > 0 && h.trigger_reason !== 'rollback' && (
                  <Button variant="ghost" size="sm" className="h-5 px-2 text-[9px] gap-1" onClick={() => onRollback(h)}>
                    <RotateCcw className="h-2.5 w-2.5" /> Revert
                  </Button>
                )}
              </div>
            </div>
            {h.pre_recal_win_rate != null && (
              <span className="text-[9px] text-muted-foreground">Pre-recal WR: {h.pre_recal_win_rate}%</span>
            )}
            {h.adjustments_applied && Object.keys(h.adjustments_applied).length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-1">
                {Object.entries(h.adjustments_applied).map(([key, adj]) => (
                  <Badge key={key} variant="outline" className={`text-[9px] ${(adj as any).delta > 0 ? 'text-emerald-400 border-emerald-500/30' : 'text-red-400 border-red-500/30'}`}>
                    {WEIGHT_LABELS[key] || key}: {(adj as any).delta > 0 ? '+' : ''}{Math.round((adj as any).delta * 100)}%
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-[10px] text-muted-foreground">No changes</span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ManualWeightEditor({ weights, onSave, onClose }: {
  weights: Record<string, number>;
  onSave: (w: Record<string, number>) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState({ ...weights });
  const keys: { key: string; label: string; min: number; max: number; step: number; isBonus?: boolean }[] = [
    { key: 'ai_weight', label: 'AI Confidence', min: 0.1, max: 0.6, step: 0.01 },
    { key: 'consensus_weight', label: 'Consensus', min: 0.05, max: 0.35, step: 0.01 },
    { key: 'capper_weight', label: 'Capper Grade', min: 0.05, max: 0.35, step: 0.01 },
    { key: 'roi_weight', label: 'ROI', min: 0.05, max: 0.35, step: 0.01 },
    { key: 'market_weight', label: 'Market', min: 0, max: 0.25, step: 0.01 },
    { key: 'alignment_bonus', label: 'Alignment Bonus', min: 0, max: 20, step: 1, isBonus: true },
  ];

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2 border-b border-border/50">
        <CardTitle className="text-xs font-bold tracking-widest flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-blue-400" /> MANUAL WEIGHT OVERRIDE
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {keys.map(({ key, label, min, max, step, isBonus }) => (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{label}</span>
              <span className="font-black">{isBonus ? `+${draft[key]}` : `${Math.round(draft[key] * 100)}%`}</span>
            </div>
            <Slider
              value={[draft[key]]}
              min={min}
              max={max}
              step={step}
              onValueChange={([v]) => setDraft(d => ({ ...d, [key]: Math.round(v * (isBonus ? 10 : 1000)) / (isBonus ? 10 : 1000) }))}
            />
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          <Button size="sm" className="flex-1 text-xs" onClick={() => onSave(draft)}>Save Weights</Button>
          <Button size="sm" variant="outline" className="text-xs" onClick={onClose}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function InsightsPanel({ insights }: { insights: ReturnType<typeof useLearningEngine>['insights'] }) {
  if (insights.totalResolved === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2 border-b border-border/50">
        <CardTitle className="text-xs font-bold tracking-widest flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-400" /> LEARNING INSIGHTS
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground font-bold tracking-wider">OVERALL WIN RATE</span>
            <p className={`text-lg font-black ${insights.overallWinRate >= 52 ? 'text-emerald-400' : insights.overallWinRate >= 48 ? 'text-amber-400' : 'text-red-400'}`}>
              {insights.overallWinRate}%
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground font-bold tracking-wider">RESOLVED PICKS</span>
            <p className="text-lg font-black">{insights.totalResolved}</p>
          </div>
          {insights.bestFactor && (
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground font-bold tracking-wider">BEST FACTOR</span>
              <p className="font-bold text-emerald-400">{insights.bestFactor.name}</p>
              <p className="text-[10px] text-muted-foreground">{insights.bestFactor.winRate}% WR</p>
            </div>
          )}
          {insights.worstFactor && (
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground font-bold tracking-wider">WEAKEST FACTOR</span>
              <p className="font-bold text-red-400">{insights.worstFactor.name}</p>
              <p className="text-[10px] text-muted-foreground">{insights.worstFactor.winRate}% WR</p>
            </div>
          )}
          {insights.bestTier && (
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground font-bold tracking-wider">TOP TIER</span>
              <p className={`font-bold ${TIER_COLOR[insights.bestTier.name] || ''}`}>{insights.bestTier.name}</p>
              <p className="text-[10px] text-emerald-400">{insights.bestTier.roi > 0 ? '+' : ''}{insights.bestTier.roi}% ROI</p>
            </div>
          )}
          {insights.worstTier && (
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground font-bold tracking-wider">WEAKEST TIER</span>
              <p className={`font-bold ${TIER_COLOR[insights.worstTier.name] || ''}`}>{insights.worstTier.name}</p>
              <p className="text-[10px] text-red-400">{insights.worstTier.roi > 0 ? '+' : ''}{insights.worstTier.roi}% ROI</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function LearningDashboard() {
  const {
    weights, weightsLoading, learningEvents, eventsLoading,
    weightHistory, tierPerformance, factorPerformance, insights,
    recalibrate, isRecalibrating, totalEvents, canRecalibrate,
    toggleWeightLock, setManualWeights, rollbackWeights, resetToDefaults,
  } = useLearningEngine();

  const [showManualEditor, setShowManualEditor] = useState(false);

  const defaults = {
    ai_weight: DEFAULT_WEIGHTS.ai_weight,
    consensus_weight: DEFAULT_WEIGHTS.consensus_weight,
    capper_weight: DEFAULT_WEIGHTS.capper_weight,
    roi_weight: DEFAULT_WEIGHTS.roi_weight,
    market_weight: DEFAULT_WEIGHTS.market_weight,
    alignment_bonus: DEFAULT_WEIGHTS.alignment_bonus,
  };

  if (weightsLoading || eventsLoading) {
    return <Card><CardContent className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></CardContent></Card>;
  }

  const systemHealth = insights.degradationWarning ? 'WARNING' : insights.learningHealthy ? 'GOOD' : 'WARNING';

  return (
    <div className="space-y-4">
      {/* ── Status Panel ── */}
      <Card className={`border-${systemHealth === 'GOOD' ? 'emerald' : 'amber'}-500/20 bg-${systemHealth === 'GOOD' ? 'emerald' : 'amber'}-500/5`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
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
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-[10px] font-bold ${systemHealth === 'GOOD' ? 'text-emerald-400 border-emerald-500/30' : 'text-amber-400 border-amber-500/30'}`}>
                <Activity className="h-3 w-3 mr-1" />
                {systemHealth}
              </Badge>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center">
              <p className="text-lg font-black">{totalEvents}</p>
              <p className="text-[9px] text-muted-foreground tracking-wider">EVENTS</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-black">{weights.recalibration_count}</p>
              <p className="text-[9px] text-muted-foreground tracking-wider">RECALS</p>
            </div>
            <div className="text-center">
              <p className={`text-lg font-black ${insights.overallWinRate >= 52 ? 'text-emerald-400' : 'text-foreground'}`}>{insights.overallWinRate}%</p>
              <p className="text-[9px] text-muted-foreground tracking-wider">WIN RATE</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-black flex items-center justify-center gap-1">
                {weights.weights_locked ? <Lock className="h-4 w-4 text-amber-400" /> : <Unlock className="h-4 w-4 text-emerald-400" />}
              </p>
              <p className="text-[9px] text-muted-foreground tracking-wider">{weights.weights_locked ? 'LOCKED' : 'ACTIVE'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Degradation Warning ── */}
      {insights.degradationWarning && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-3 flex items-center gap-3 text-xs">
            <TriangleAlert className="h-5 w-5 text-red-400 shrink-0" />
            <div>
              <p className="font-bold text-red-400">Performance degradation detected after last recalibration</p>
              <p className="text-muted-foreground mt-0.5">Win rate dropped. Consider rolling back to previous weights or locking weights.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Controls ── */}
      <Card>
        <CardHeader className="pb-2 border-b border-border/50">
          <CardTitle className="text-xs font-bold tracking-widest flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-400" /> CONTROLS
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {/* Weight Lock Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              {weights.weights_locked ? <Lock className="h-3.5 w-3.5 text-amber-400" /> : <Unlock className="h-3.5 w-3.5 text-emerald-400" />}
              <span className="font-medium">Weight Lock</span>
              <span className="text-[10px] text-muted-foreground">{weights.weights_locked ? 'Learning paused' : 'Learning active'}</span>
            </div>
            <Switch
              checked={weights.weights_locked}
              onCheckedChange={(checked) => toggleWeightLock.mutate(checked)}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => recalibrate.mutate()}
              disabled={isRecalibrating || !canRecalibrate}
              size="sm"
              className="gap-1.5 text-xs"
            >
              {isRecalibrating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Recalibrate
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setShowManualEditor(!showManualEditor)}
            >
              <SlidersHorizontal className="h-3 w-3" />
              {showManualEditor ? 'Hide Editor' : 'Manual Override'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
              onClick={() => resetToDefaults.mutate()}
            >
              <RotateCcw className="h-3 w-3" />
              Reset Defaults
            </Button>
          </div>

          {!canRecalibrate && !weights.weights_locked && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-amber-400" />
              Need {10 - totalEvents} more resolved picks to recalibrate
            </p>
          )}
          {weights.weights_locked && (
            <p className="text-[10px] text-amber-400 flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Unlock weights to enable recalibration
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Manual Weight Editor ── */}
      {showManualEditor && (
        <ManualWeightEditor
          weights={{
            ai_weight: weights.ai_weight,
            consensus_weight: weights.consensus_weight,
            capper_weight: weights.capper_weight,
            roi_weight: weights.roi_weight,
            market_weight: weights.market_weight,
            alignment_bonus: weights.alignment_bonus,
          }}
          onSave={(w) => {
            setManualWeights.mutate(w);
            setShowManualEditor(false);
          }}
          onClose={() => setShowManualEditor(false)}
        />
      )}

      {/* ── Insights ── */}
      <InsightsPanel insights={insights} />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Current Weights */}
        <Card>
          <CardHeader className="pb-2 border-b border-border/50">
            <CardTitle className="text-xs font-bold tracking-widest flex items-center gap-2">
              <Shield className="h-4 w-4 text-amber-400" /> DYNAMIC WEIGHTS
              <Badge variant="outline" className="text-[9px] ml-auto">v{weights.recalibration_count}</Badge>
              {weights.weights_locked && <Lock className="h-3 w-3 text-amber-400" />}
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

      {/* Weight History with Rollback */}
      <WeightAuditLog
        history={weightHistory}
        onRollback={(h) => rollbackWeights.mutate(h)}
      />

      {/* Safety Footer */}
      <Card className="border-amber-500/20">
        <CardContent className="p-3 text-center">
          <AlertTriangle className="h-4 w-4 mx-auto text-amber-400 mb-1" />
          <p className="text-[9px] font-bold text-amber-400 tracking-wider">SAFETY LIMITS ACTIVE</p>
          <p className="text-[8px] text-muted-foreground mt-0.5">
            Weight changes capped at ±10% per cycle · Min 10 picks required · All adjustments logged · Rollback available · Manual override enabled
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
