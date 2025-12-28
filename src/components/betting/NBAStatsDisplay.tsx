// NBA Stats Display Component - Shows stats used in probability calculations
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Activity, Shield, Zap, Clock, Heart, Database } from 'lucide-react';

interface NBAStatsDisplayProps {
  last5Avg: number | null;
  seasonAvg: number | null;
  last5MinutesAvg: number | null;
  opponentDefTier: string | null;
  paceTier: string | null;
  injuryStatus: string | null;
  dataCompleteness: number | null;
  source: string | null;
  statType: string;
  compact?: boolean;
}

export const NBAStatsDisplay = ({
  last5Avg,
  seasonAvg,
  last5MinutesAvg,
  opponentDefTier,
  paceTier,
  injuryStatus,
  dataCompleteness,
  source,
  statType,
  compact = false,
}: NBAStatsDisplayProps) => {
  const formatStat = (value: number | null, label: string) => {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground italic">Data unavailable</span>;
    }
    return <span className="font-medium">{value.toFixed(1)}</span>;
  };

  const getDefTierBadge = (tier: string | null) => {
    if (!tier) return { label: 'Data unavailable', className: 'bg-muted text-muted-foreground' };
    switch (tier.toLowerCase()) {
      case 'high':
      case 'top':
        return { label: 'Top 10 Defense', className: 'bg-red-500/10 text-red-600 border-red-500/20' };
      case 'medium':
      case 'med':
        return { label: 'Mid Defense', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
      case 'low':
      case 'bottom':
        return { label: 'Weak Defense', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' };
      default:
        return { label: tier, className: 'bg-muted text-muted-foreground' };
    }
  };

  const getPaceTierBadge = (tier: string | null) => {
    if (!tier) return { label: 'Data unavailable', className: 'bg-muted text-muted-foreground' };
    switch (tier.toLowerCase()) {
      case 'fast':
        return { label: 'Fast Pace', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' };
      case 'avg':
      case 'average':
        return { label: 'Avg Pace', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' };
      case 'slow':
        return { label: 'Slow Pace', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
      default:
        return { label: tier, className: 'bg-muted text-muted-foreground' };
    }
  };

  const getInjuryBadge = (status: string | null) => {
    if (!status || status.toLowerCase() === 'active' || status.toLowerCase() === 'healthy') {
      return { label: 'Active', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' };
    }
    if (status.toLowerCase() === 'questionable') {
      return { label: 'Questionable', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
    }
    if (status.toLowerCase() === 'out' || status.toLowerCase() === 'injured') {
      return { label: 'OUT', className: 'bg-red-500 text-white' };
    }
    return { label: status, className: 'bg-muted text-muted-foreground' };
  };

  const defTier = getDefTierBadge(opponentDefTier);
  const pace = getPaceTierBadge(paceTier);
  const injury = getInjuryBadge(injuryStatus);

  // Calculate if any stats are missing (for confidence reduction indicator)
  const missingStats = [last5Avg, seasonAvg, last5MinutesAvg, opponentDefTier, paceTier].filter(
    (s) => s === null || s === undefined
  ).length;

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">L5:</span>
        {formatStat(last5Avg, 'L5')}
        <span className="text-muted-foreground">Szn:</span>
        {formatStat(seasonAvg, 'Season')}
        <Badge variant="outline" className={`text-xs ${defTier.className}`}>
          <Shield className="h-3 w-3 mr-1" />
          {defTier.label}
        </Badge>
        <Badge variant="outline" className={`text-xs ${pace.className}`}>
          <Zap className="h-3 w-3 mr-1" />
          {pace.label}
        </Badge>
        <Badge variant="outline" className={`text-xs ${injury.className}`}>
          <Heart className="h-3 w-3 mr-1" />
          {injury.label}
        </Badge>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-xs">
      {/* Data Source Label */}
      <div className="flex items-center gap-2">
        <Database className="h-3 w-3 text-muted-foreground" />
        <span className="text-muted-foreground">Source:</span>
        <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
          {source || 'SportsDataIO'}
        </Badge>
        {missingStats > 0 && (
          <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {missingStats} stats missing (confidence reduced)
          </Badge>
        )}
      </div>

      {/* Performance Stats */}
      <div className="grid grid-cols-3 gap-3 p-2 bg-muted/30 rounded-md">
        <div className="flex flex-col">
          <span className="text-muted-foreground flex items-center gap-1">
            <Activity className="h-3 w-3" /> L5 Avg
          </span>
          {formatStat(last5Avg, 'L5')}
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground">Season Avg</span>
          {formatStat(seasonAvg, 'Season')}
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> L5 Min Avg
          </span>
          {formatStat(last5MinutesAvg, 'Minutes')}
        </div>
      </div>

      {/* Context Badges */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={defTier.className}>
          <Shield className="h-3 w-3 mr-1" />
          {defTier.label}
        </Badge>
        <Badge variant="outline" className={pace.className}>
          <Zap className="h-3 w-3 mr-1" />
          {pace.label}
        </Badge>
        <Badge variant="outline" className={injury.className}>
          <Heart className="h-3 w-3 mr-1" />
          {injury.label}
        </Badge>
      </div>
    </div>
  );
};

// Stats Debug Panel - Shows raw API values
interface StatsDebugPanelProps {
  calibrationFactors: any;
  source: string | null;
  dataCompleteness: number | null;
}

export const StatsDebugPanel = ({ calibrationFactors, source, dataCompleteness }: StatsDebugPanelProps) => {
  if (!calibrationFactors) {
    return (
      <div className="p-3 bg-muted/50 rounded-md text-xs font-mono">
        <p className="text-muted-foreground">No raw stats data available</p>
      </div>
    );
  }

  return (
    <div className="p-3 bg-muted/50 rounded-md text-xs font-mono space-y-1">
      <div className="font-semibold text-muted-foreground mb-2">Raw API Values</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <span className="text-muted-foreground">Source:</span>
        <span>{source || 'unknown'}</span>
        <span className="text-muted-foreground">Data Completeness:</span>
        <span>{dataCompleteness ?? 0}%</span>
        {Object.entries(calibrationFactors).map(([key, value]) => (
          <>
            <span key={`label-${key}`} className="text-muted-foreground">{key}:</span>
            <span key={`value-${key}`}>{typeof value === 'number' ? value.toFixed(3) : String(value)}</span>
          </>
        ))}
      </div>
    </div>
  );
};
