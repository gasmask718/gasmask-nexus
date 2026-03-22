import { Badge } from '@/components/ui/badge';

interface Brain {
  score: number;
  reasoning: string;
}

interface PredictionResultProps {
  prediction: {
    predicted_outcome: string;
    final_confidence?: number;
    confidence_tier?: string;
    stats_brain_score?: number;
    stats_brain_reasoning?: string;
    market_brain_score?: number;
    market_brain_reasoning?: string;
    context_brain_score?: number;
    context_brain_reasoning?: string;
    polymarket_brain_score?: number | null;
    polymarket_brain_reasoning?: string | null;
    brain_count?: number;
    data_quality?: string;
    brains?: { stats: Brain; market: Brain; context: Brain; polymarket?: Brain };
  };
}

const tierColors: Record<string, string> = {
  elite: 'text-green-600 bg-green-500/15 border-green-500/40',
  strong: 'text-blue-600 bg-blue-500/15 border-blue-500/40',
  moderate: 'text-amber-600 bg-amber-500/15 border-amber-500/40',
  weak: 'text-red-500 bg-red-500/15 border-red-500/40',
};

export function PredictionResult({ prediction }: PredictionResultProps) {
  const tier = prediction.confidence_tier || 'moderate';
  const finalConf = prediction.final_confidence || 50;
  const hasPolymarket = prediction.polymarket_brain_score != null;

  const brains = prediction.brains || {
    stats: { score: prediction.stats_brain_score || 50, reasoning: prediction.stats_brain_reasoning || '' },
    market: { score: prediction.market_brain_score || 50, reasoning: prediction.market_brain_reasoning || '' },
    context: { score: prediction.context_brain_score || 50, reasoning: prediction.context_brain_reasoning || '' },
  };

  const coreBrains: { label: string; key: string; weight: string; score: number; reasoning: string }[] = [
    { label: '📊 Stats', key: 'stats', weight: hasPolymarket ? '35%' : '40%', score: brains.stats?.score || 0, reasoning: brains.stats?.reasoning || 'Analyzing...' },
    { label: '💰 Market', key: 'market', weight: hasPolymarket ? '30%' : '35%', score: brains.market?.score || 0, reasoning: brains.market?.reasoning || 'Analyzing...' },
    { label: '🧠 Context', key: 'context', weight: hasPolymarket ? '20%' : '25%', score: brains.context?.score || 0, reasoning: brains.context?.reasoning || 'Analyzing...' },
  ];

  if (hasPolymarket) {
    coreBrains.push({
      label: '🔮 Polymarket',
      key: 'polymarket',
      weight: '15%',
      score: prediction.polymarket_brain_score || 0,
      reasoning: prediction.polymarket_brain_reasoning || prediction.brains?.polymarket?.reasoning || 'Real money consensus',
    });
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Prediction: {prediction.predicted_outcome}
          {hasPolymarket && (
            <Badge variant="outline" className="ml-1.5 text-[8px] h-3.5 px-1 text-violet-500 border-violet-500/40">
              4-Brain
            </Badge>
          )}
          {prediction.data_quality && (
            <Badge variant="outline" className={`ml-1.5 text-[8px] h-3.5 px-1 ${
              prediction.data_quality === 'full' ? 'text-green-500 border-green-500/40' :
              prediction.data_quality === 'partial' ? 'text-amber-500 border-amber-500/40' :
              'text-red-400 border-red-400/40'
            }`}>
              {prediction.data_quality === 'full' ? '📊 Full Stats' :
               prediction.data_quality === 'partial' ? '⚠️ Partial Stats' :
               '🔴 Odds Only'}
            </Badge>
          )}
        </span>
        <Badge className={`text-[10px] ${tierColors[tier] || tierColors.moderate}`}>
          {finalConf}% — {tier?.toUpperCase()}
        </Badge>
      </div>

      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            finalConf >= 85 ? 'bg-green-500' :
            finalConf >= 70 ? 'bg-blue-500' :
            finalConf >= 55 ? 'bg-amber-500' : 'bg-red-400'
          }`}
          style={{ width: `${finalConf}%` }}
        />
      </div>

      <div className={`grid gap-2 ${hasPolymarket ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {coreBrains.map(brain => (
          <div key={brain.key} className="text-center space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
              <span>{brain.label}</span>
              <span>{brain.weight}</span>
            </div>
            <p className={`text-lg font-bold ${
              brain.score >= 70 ? 'text-green-500' :
              brain.score >= 55 ? 'text-amber-500' : 'text-red-400'
            }`}>
              {brain.score}
            </p>
            <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
              {brain.reasoning}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
