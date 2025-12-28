// NBA Stats Display Component - Shows stats used in probability calculations
// CRITICAL: These values MUST match what's used in probability calculations
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Activity, Shield, Zap, Clock, Heart, Database, User } from 'lucide-react';

interface NBAStatsDisplayProps {
  playerName: string;
  team: string;
  opponent: string;
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
  playerName,
  team,
  opponent,
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
      return <span className="text-destructive italic text-xs">Stats unavailable</span>;
    }
    return <span className="font-semibold">{value.toFixed(1)}</span>;
  };

  const getDefTierBadge = (tier: string | null) => {
    if (!tier) return { label: 'Stats unavailable', className: 'bg-destructive/10 text-destructive border-destructive/20' };
    switch (tier.toLowerCase()) {
      case 'high':
      case 'top':
        return { label: 'Top 10 DEF', className: 'bg-red-500/10 text-red-600 border-red-500/20' };
      case 'medium':
      case 'med':
        return { label: 'Mid DEF', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
      case 'low':
      case 'bottom':
        return { label: 'Weak DEF', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' };
      default:
        return { label: tier, className: 'bg-muted text-muted-foreground' };
    }
  };

  const getPaceTierBadge = (tier: string | null) => {
    if (!tier) return { label: 'Stats unavailable', className: 'bg-destructive/10 text-destructive border-destructive/20' };
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

  // Check for valid source
  const isValidSource = source && source.includes('SportsDataIO');
  const sourceDisplay = isValidSource ? 'SportsDataIO' : (source || 'Unknown');

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
    <div className="space-y-3 text-xs border-t border-border/50 pt-3 mt-3">
      {/* Header: Player identity & source verification */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">{playerName}</span>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">{team} vs {opponent}</span>
        </div>
        <Badge 
          variant="outline" 
          className={`text-xs ${isValidSource ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-destructive/10 text-destructive border-destructive/20'}`}
        >
          <Database className="h-3 w-3 mr-1" />
          {sourceDisplay}
        </Badge>
      </div>

      {/* Warnings for missing data */}
      {missingStats > 0 && (
        <div className="flex items-center gap-2 p-2 bg-amber-500/10 rounded-md">
          <AlertTriangle className="h-3 w-3 text-amber-600" />
          <span className="text-amber-600">
            {missingStats} stat{missingStats > 1 ? 's' : ''} unavailable — confidence reduced
          </span>
        </div>
      )}

      {/* Performance Stats Grid - THESE ARE THE EXACT VALUES USED IN PREDICTIONS */}
      <div className="grid grid-cols-3 gap-3 p-3 bg-muted/30 rounded-md">
        <div className="flex flex-col">
          <span className="text-muted-foreground flex items-center gap-1 mb-1">
            <Activity className="h-3 w-3" /> Last 5 Avg
          </span>
          <div className="text-sm">{formatStat(last5Avg, 'L5')}</div>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground mb-1">Season Avg</span>
          <div className="text-sm">{formatStat(seasonAvg, 'Season')}</div>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground flex items-center gap-1 mb-1">
            <Clock className="h-3 w-3" /> L5 Minutes
          </span>
          <div className="text-sm">{formatStat(last5MinutesAvg, 'Minutes')}</div>
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
        {dataCompleteness !== null && (
          <Badge variant="outline" className="bg-muted text-muted-foreground">
            Data: {dataCompleteness}%
          </Badge>
        )}
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
      <div className="p-3 bg-destructive/10 rounded-md text-xs font-mono">
        <p className="text-destructive font-semibold">⚠️ No raw stats data available - prop may use fallback values</p>
      </div>
    );
  }

  const isValidSource = source && source.includes('SportsDataIO');

  return (
    <div className="p-3 bg-muted/50 rounded-md text-xs font-mono space-y-2">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-muted-foreground">Raw API Values (Debug)</span>
        {!isValidSource && (
          <Badge variant="destructive" className="text-xs">NOT REAL DATA</Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <span className="text-muted-foreground">Source:</span>
        <span className={isValidSource ? 'text-emerald-600' : 'text-destructive'}>{source || 'unknown'}</span>
        <span className="text-muted-foreground">Data Completeness:</span>
        <span>{dataCompleteness ?? 0}%</span>
        {Object.entries(calibrationFactors).map(([key, value]) => (
          <div key={key} className="contents">
            <span className="text-muted-foreground">{key}:</span>
            <span>{typeof value === 'number' ? value.toFixed(3) : String(value ?? 'null')}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
