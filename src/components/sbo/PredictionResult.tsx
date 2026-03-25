import { Badge } from '@/components/ui/badge';
import { Crown, Flame, Shield, AlertTriangle } from 'lucide-react';

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
  homeTeam?: string;
  awayTeam?: string;
  intel?: any;
}

const tierColors: Record<string, string> = {
  elite: 'text-green-600 bg-green-500/15 border-green-500/40',
  strong: 'text-blue-600 bg-blue-500/15 border-blue-500/40',
  moderate: 'text-amber-600 bg-amber-500/15 border-amber-500/40',
  weak: 'text-red-500 bg-red-500/15 border-red-500/40',
};

function StatsAvailabilityBadge({ intel, dataQuality }: { intel: any; dataQuality?: string }) {
  if (!intel && dataQuality === 'odds_only') {
    return (
      <div className="mt-2 p-2 rounded bg-destructive/5 border border-destructive/20 text-[10px] space-y-0.5">
        <p className="text-destructive font-medium">🔴 No stats available — prediction based on odds only</p>
        <p className="text-muted-foreground">Missing: ORtg, DRtg, Records, Pace, Injuries, Last 10</p>
      </div>
    );
  }

  if (dataQuality === 'partial' && intel) {
    const present: string[] = [];
    const missing: string[] = [];
    intel.offensive_rating_home ? present.push('ORtg') : missing.push('ORtg');
    intel.defensive_rating_home ? present.push('DRtg') : missing.push('DRtg');
    intel.home_record_home ? present.push('Home record') : missing.push('Home record');
    intel.away_record_away ? present.push('Away record') : missing.push('Away record');
    intel.pace_home ? present.push('Pace') : missing.push('Pace');
    intel.last_5_home ? present.push('Last 10') : missing.push('Last 10');
    intel.injury_report?.length > 0 ? present.push('Injuries') : missing.push('Injuries');
    intel.back_to_back_home !== null ? present.push('B2B') : missing.push('B2B');

    return (
      <div className="mt-2 p-2 rounded bg-amber-500/5 border border-amber-500/20 text-[10px] space-y-0.5">
        <p className="text-amber-500 font-medium">⚠️ Partial stats — some data unavailable</p>
        {present.length > 0 && <p className="text-muted-foreground">✅ Available: {present.join(', ')}</p>}
        {missing.length > 0 && <p className="text-muted-foreground">❌ Missing: {missing.join(', ')}</p>}
      </div>
    );
  }

  if (dataQuality === 'full') {
    return (
      <div className="mt-2 p-1.5 rounded bg-emerald-500/5 border border-emerald-500/20 text-[10px]">
        <p className="text-emerald-500 font-medium">✅ Full stats — ORtg, DRtg, Records, Pace, Injuries, B2B all present</p>
      </div>
    );
  }

  return null;
}

export function PredictionResult({ prediction, homeTeam, awayTeam, intel }: PredictionResultProps) {
  const tier = prediction.confidence_tier || 'moderate';
  const finalConf = prediction.final_confidence || 50;
  const hasPolymarket = prediction.polymarket_brain_score != null;

  const predictedTeamLabel = (homeTeam && awayTeam)
    ? (prediction.predicted_outcome === 'home' ? homeTeam : awayTeam)
    : prediction.predicted_outcome;

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
      label: '🔮 Polymarket', key: 'polymarket', weight: '15%',
      score: prediction.polymarket_brain_score || 0,
      reasoning: prediction.polymarket_brain_reasoning || prediction.brains?.polymarket?.reasoning || 'Real money consensus',
    });
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">
          AI Pick: <span className="font-bold">{predictedTeamLabel}</span>
          {hasPolymarket && (
            <Badge variant="outline" className="ml-1.5 text-[8px] h-3.5 px-1 text-violet-500 border-violet-500/40">4-Brain</Badge>
          )}
          {prediction.data_quality && (
            <Badge variant="outline" className={`ml-1.5 text-[8px] h-3.5 px-1 ${
              prediction.data_quality === 'full' ? 'text-green-500 border-green-500/40' :
              prediction.data_quality === 'partial' ? 'text-amber-500 border-amber-500/40' :
              'text-red-400 border-red-400/40'
            }`}>
              {prediction.data_quality === 'full' ? '📊 Full Stats' :
               prediction.data_quality === 'partial' ? '⚠️ Partial Stats' : '🔴 Odds Only'}
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
            finalConf >= 85 ? 'bg-green-500' : finalConf >= 70 ? 'bg-blue-500' : finalConf >= 55 ? 'bg-amber-500' : 'bg-red-400'
          }`}
          style={{ width: `${finalConf}%` }}
        />
      </div>

      <StatsAvailabilityBadge intel={intel} dataQuality={prediction.data_quality} />

      <div className={`grid gap-2 ${hasPolymarket ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {coreBrains.map(brain => (
          <div key={brain.key} className="text-center space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
              <span>{brain.label}</span>
              <span>{brain.weight}</span>
            </div>
            <p className={`text-lg font-bold ${
              brain.score >= 70 ? 'text-green-500' : brain.score >= 55 ? 'text-amber-500' : 'text-red-400'
            }`}>{brain.score}</p>
            <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">{brain.reasoning}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
