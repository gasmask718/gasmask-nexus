// NBA Stats Display Component - Shows stats used in probability calculations
// CRITICAL: These values MUST match what's used in probability calculations
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Activity, Shield, Zap, Clock, Heart, Database, User, Calendar } from 'lucide-react';

interface NBAStatsDisplayProps {
  playerName: string;
  team: string;
  opponent: string;
  gameDate?: string | null;
  last5Avg: number | null;
  seasonAvg: number | null;
  last5MinutesAvg: number | null;
  opponentDefTier: string | null;
  paceTier: string | null;
  injuryStatus: string | null;
  dataCompleteness: number | null;
  source: string | null;
  statType: string;
  forceExpanded?: boolean; // For Top AI Props - cannot collapse
}

// HARD FAIL: Check if stats are sufficient for display
export const hasRequiredStats = (props: {
  playerName: string | null;
  team: string | null;
  opponent: string | null;
  last5Avg: number | null;
  seasonAvg: number | null;
  last5MinutesAvg: number | null;
  opponentDefTier: string | null;
  paceTier: string | null;
  source: string | null;
}): boolean => {
  // Player identity must be valid
  if (!props.playerName || props.playerName.includes('Player') || props.playerName === 'Unknown') return false;
  if (!props.team) return false;
  if (!props.opponent) return false;
  
  // Core stats must be numeric and non-zero
  if (props.last5Avg === null || props.last5Avg <= 0) return false;
  if (props.seasonAvg === null || props.seasonAvg <= 0) return false;
  if (props.last5MinutesAvg === null || props.last5MinutesAvg <= 0) return false;
  
  // Context data must be present
  if (!props.opponentDefTier) return false;
  if (!props.paceTier) return false;
  
  // Source must be verified
  if (!props.source || !props.source.includes('SportsDataIO')) return false;
  
  return true;
};

export const NBAStatsDisplay = ({
  playerName,
  team,
  opponent,
  gameDate,
  last5Avg,
  seasonAvg,
  last5MinutesAvg,
  opponentDefTier,
  paceTier,
  injuryStatus,
  dataCompleteness,
  source,
  statType,
  forceExpanded = false,
}: NBAStatsDisplayProps) => {
  const formatStat = (value: number | null, label: string) => {
    if (value === null || value === undefined || value <= 0) {
      return <span className="text-destructive italic text-xs">Missing</span>;
    }
    return <span className="font-semibold">{value.toFixed(1)}</span>;
  };

  const getDefTierBadge = (tier: string | null) => {
    if (!tier) return { label: 'Missing', className: 'bg-destructive/10 text-destructive border-destructive/20' };
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
    if (!tier) return { label: 'Missing', className: 'bg-destructive/10 text-destructive border-destructive/20' };
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

  // Check for valid source
  const isValidSource = source && source.includes('SportsDataIO');
  const sourceDisplay = isValidSource ? 'SportsDataIO' : (source || 'Unknown');

  // Format game date
  const formattedDate = gameDate 
    ? new Date(gameDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'Today';

  return (
    <div className="space-y-3 text-xs border border-border rounded-md p-3 mt-3 bg-card/50">
      {/* Section Title */}
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <span className="font-semibold text-sm text-foreground">Stats Used in Prediction</span>
        <Badge 
          variant="outline" 
          className={`text-xs ${isValidSource ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-destructive/10 text-destructive border-destructive/20'}`}
        >
          <Database className="h-3 w-3 mr-1" />
          {sourceDisplay}
        </Badge>
      </div>

      {/* Player Identity & Matchup */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">{playerName}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>{team} vs {opponent}</span>
          <span className="text-muted-foreground">•</span>
          <Calendar className="h-3 w-3" />
          <span>{formattedDate}</span>
        </div>
      </div>

      {/* Performance Stats Grid - THESE ARE THE EXACT VALUES USED IN PREDICTIONS */}
      <div className="grid grid-cols-3 gap-3 p-3 bg-muted/30 rounded-md">
        <div className="flex flex-col">
          <span className="text-muted-foreground flex items-center gap-1 mb-1">
            <Activity className="h-3 w-3" /> Last 5 Games
          </span>
          <div className="text-sm">{formatStat(last5Avg, 'L5')} <span className="text-muted-foreground">{statType}</span></div>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground mb-1">Season Avg</span>
          <div className="text-sm">{formatStat(seasonAvg, 'Season')} <span className="text-muted-foreground">{statType}</span></div>
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
          Opp DEF: {defTier.label}
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
          <Badge variant="outline" className={dataCompleteness >= 80 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}>
            Data: {dataCompleteness}%
          </Badge>
        )}
      </div>
    </div>
  );
};

// Stats Debug Panel - Shows raw API values (Owner-only)
interface StatsDebugPanelProps {
  calibrationFactors: any;
  source: string | null;
  dataCompleteness: number | null;
  playerId?: string | null;
  gameId?: string | null;
  fetchTimestamp?: string | null;
}

export const StatsDebugPanel = ({ 
  calibrationFactors, 
  source, 
  dataCompleteness,
  playerId,
  gameId,
  fetchTimestamp
}: StatsDebugPanelProps) => {
  if (!calibrationFactors) {
    return (
      <div className="p-3 bg-destructive/10 rounded-md text-xs font-mono">
        <p className="text-destructive font-semibold">⚠️ No raw stats data available - prop may use fallback values</p>
      </div>
    );
  }

  const isValidSource = source && source.includes('SportsDataIO');
  const timestamp = fetchTimestamp || calibrationFactors?.fetch_timestamp || 'Unknown';

  return (
    <div className="p-3 bg-muted/50 rounded-md text-xs font-mono space-y-2 border border-border">
      <div className="flex items-center justify-between mb-2 border-b border-border/50 pb-2">
        <span className="font-semibold text-foreground">View Raw Stats Data</span>
        {!isValidSource && (
          <Badge variant="destructive" className="text-xs">NOT REAL DATA</Badge>
        )}
      </div>
      
      {/* Identifiers */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-b border-border/30 pb-2">
        <span className="text-muted-foreground">PlayerID:</span>
        <span className="text-foreground">{playerId || calibrationFactors?.player_id || 'N/A'}</span>
        <span className="text-muted-foreground">GameID:</span>
        <span className="text-foreground">{gameId || calibrationFactors?.game_id || 'N/A'}</span>
        <span className="text-muted-foreground">Fetch Timestamp:</span>
        <span className="text-foreground">{typeof timestamp === 'string' ? timestamp : new Date(timestamp).toISOString()}</span>
      </div>

      {/* Source & Completeness */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-b border-border/30 pb-2">
        <span className="text-muted-foreground">Source:</span>
        <span className={isValidSource ? 'text-emerald-600' : 'text-destructive'}>{source || 'unknown'}</span>
        <span className="text-muted-foreground">Data Completeness:</span>
        <span>{dataCompleteness ?? 0}%</span>
      </div>
      
      {/* Raw API Values */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <span className="text-muted-foreground font-semibold col-span-2 mt-1">Raw API Values:</span>
        {Object.entries(calibrationFactors).map(([key, value]) => (
          <div key={key} className="contents">
            <span className="text-muted-foreground">{key}:</span>
            <span className="text-foreground">{typeof value === 'number' ? value.toFixed(3) : String(value ?? 'null')}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Hidden Prop Message Component
export const HiddenPropMessage = ({ reason }: { reason?: string }) => (
  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-md text-center">
    <AlertTriangle className="h-5 w-5 text-amber-600 mx-auto mb-2" />
    <p className="text-sm font-medium text-amber-700">
      Prop hidden — {reason || 'insufficient verified stats'}
    </p>
    <p className="text-xs text-amber-600 mt-1">
      No silent fallbacks. Real data required.
    </p>
  </div>
);
