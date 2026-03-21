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
    brains?: { stats: Brain; market: Brain; context: Brain };
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

  const brains = prediction.brains || {
    stats: { score: prediction.stats_brain_score || 50, reasoning: prediction.stats_brain_reasoning || '' },
    market: { score: prediction.market_brain_score || 50, reasoning: prediction.market_brain_reasoning || '' },
    context: { score: prediction.context_brain_score || 50, reasoning: prediction.context_brain_reasoning || '' },
  };

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Prediction: {prediction.predicted_outcome}
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

      <div className="grid grid-cols-3 gap-2">
        {([
          { label: '📊 Stats', key: 'stats' as const, weight: '40%' },
          { label: '💰 Market', key: 'market' as const, weight: '35%' },
          { label: '🧠 Context', key: 'context' as const, weight: '25%' },
        ]).map(brain => (
          <div key={brain.key} className="text-center space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
              <span>{brain.label}</span>
              <span>{brain.weight}</span>
            </div>
            <p className={`text-lg font-bold ${
              (brains[brain.key]?.score || 0) >= 70 ? 'text-green-500' :
              (brains[brain.key]?.score || 0) >= 55 ? 'text-amber-500' : 'text-red-400'
            }`}>
              {brains[brain.key]?.score ?? '?'}
            </p>
            <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
              {brains[brain.key]?.reasoning || 'Analyzing...'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
