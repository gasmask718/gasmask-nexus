import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  RefreshCw, AlertTriangle, CheckCircle, Database, Users, Calendar, 
  XCircle, ChevronDown, Clock, Server, Shield, Activity, List, Filter, X, ChevronLeft, ChevronRight, TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';
import NBAMoneylineLeans from '@/components/betting/NBAMoneylineLeans';

interface PlayerStats {
  id: string;
  player_id: string;
  player_name: string;
  team: string;
  position: string | null;
  last_5_games_avg_pts: number | null;
  last_5_games_avg_reb: number | null;
  last_5_games_avg_ast: number | null;
  last_5_games_avg_3pm: number | null;
  last_5_games_avg_pra: number | null;
  season_avg_pts: number | null;
  season_avg_reb: number | null;
  season_avg_ast: number | null;
  season_avg_3pm: number | null;
  season_avg_min: number | null;
  minutes_last_5_avg: number | null;
  std_pts: number | null;
  injury_status: string | null;
  last_updated: string;
}

interface GameData {
  id: string;
  game_id: string;
  home_team: string;
  away_team: string;
  game_date: string;
  game_time: string | null;
  status: string;
}

interface PropData {
  id: string;
  player_id: string;
  player_name: string;
  team: string;
  opponent: string;
  stat_type: string;
  line_value: number;
  projected_value: number;
  estimated_probability: number;
  confidence_score: number;
  calibration_factors: Record<string, unknown>;
  data_completeness: number | null;
  game_date: string;
  recommendation: string;
}

interface RefreshLog {
  id: string;
  refresh_date: string;
  status: string;
  players_updated: number | null;
  teams_updated: number | null;
  games_fetched: number | null;
  props_generated: number | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface StageStatus {
  status: 'success' | 'fail' | 'pending' | 'unknown';
  message: string;
  timestamp?: string;
}

const StatusBadge = ({ status, label }: { status: StageStatus['status']; label: string }) => {
  const variants = {
    success: { icon: CheckCircle, className: 'bg-green-500/20 text-green-400 border-green-500/50' },
    fail: { icon: XCircle, className: 'bg-red-500/20 text-red-400 border-red-500/50' },
    pending: { icon: Clock, className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' },
    unknown: { icon: AlertTriangle, className: 'bg-muted text-muted-foreground border-border' }
  };
  
  const { icon: Icon, className } = variants[status];
  
  return (
    <Badge variant="outline" className={`${className} gap-1`}>
      <Icon className="w-3 h-3" />
      {label}
    </Badge>
  );
};

const FieldValue = ({ label, value, isRequired = false }: { label: string; value: unknown; isRequired?: boolean }) => {
  const isMissing = value === null || value === undefined || value === '';
  const isZero = value === 0;
  
  return (
    <div className="flex justify-between items-center py-1 border-b border-border/50">
      <span className="text-muted-foreground text-sm">{label}</span>
      <div className="flex items-center gap-2">
        {isMissing && isRequired ? (
          <Badge variant="destructive" className="text-xs">
            <AlertTriangle className="w-3 h-3 mr-1" />
            MISSING
          </Badge>
        ) : isZero && isRequired ? (
          <Badge variant="outline" className="text-xs text-yellow-500 border-yellow-500">
            ZERO
          </Badge>
        ) : (
          <span className="font-mono text-sm">{String(value ?? 'null')}</span>
        )}
      </div>
    </div>
  );
};

// ========================
// ALL PROPS VIEW COMPONENT
// ========================
const PROPS_PER_PAGE = 50;

interface AllPropsViewProps {
  props: PropData[];
  loading: boolean;
}

const AllPropsView = ({ props, loading }: AllPropsViewProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [playerFilter, setPlayerFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [statTypeFilter, setStatTypeFilter] = useState('all');
  const [recommendationFilter, setRecommendationFilter] = useState('all');
  const [minConfidence, setMinConfidence] = useState<number | ''>('');
  const [maxConfidence, setMaxConfidence] = useState<number | ''>('');

  // Get unique values for filters
  const uniqueTeams = useMemo(() => {
    const teams = new Set(props.map(p => p.team));
    return Array.from(teams).sort();
  }, [props]);

  const uniqueStatTypes = useMemo(() => {
    const types = new Set(props.map(p => p.stat_type));
    return Array.from(types).sort();
  }, [props]);

  const uniqueRecommendations = useMemo(() => {
    const recs = new Set(props.map(p => p.recommendation).filter(Boolean));
    return Array.from(recs).sort();
  }, [props]);

  // Check if any filters are active
  const hasActiveFilters = playerFilter !== '' || 
    teamFilter !== 'all' || 
    statTypeFilter !== 'all' || 
    recommendationFilter !== 'all' ||
    minConfidence !== '' ||
    maxConfidence !== '';

  // Clear all filters
  const clearFilters = () => {
    setPlayerFilter('');
    setTeamFilter('all');
    setStatTypeFilter('all');
    setRecommendationFilter('all');
    setMinConfidence('');
    setMaxConfidence('');
    setCurrentPage(1);
  };

  // Filter props
  const filteredProps = useMemo(() => {
    return props.filter(prop => {
      if (playerFilter && !prop.player_name.toLowerCase().includes(playerFilter.toLowerCase())) {
        return false;
      }
      if (teamFilter !== 'all' && prop.team !== teamFilter) {
        return false;
      }
      if (statTypeFilter !== 'all' && prop.stat_type !== statTypeFilter) {
        return false;
      }
      if (recommendationFilter !== 'all' && prop.recommendation !== recommendationFilter) {
        return false;
      }
      if (minConfidence !== '' && prop.confidence_score < minConfidence) {
        return false;
      }
      if (maxConfidence !== '' && prop.confidence_score > maxConfidence) {
        return false;
      }
      return true;
    });
  }, [props, playerFilter, teamFilter, statTypeFilter, recommendationFilter, minConfidence, maxConfidence]);

  // Paginate
  const totalPages = Math.ceil(filteredProps.length / PROPS_PER_PAGE);
  const paginatedProps = useMemo(() => {
    const startIdx = (currentPage - 1) * PROPS_PER_PAGE;
    return filteredProps.slice(startIdx, startIdx + PROPS_PER_PAGE);
  }, [filteredProps, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [playerFilter, teamFilter, statTypeFilter, recommendationFilter, minConfidence, maxConfidence]);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              <CardTitle className="text-lg">Filters</CardTitle>
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2">
                  Active
                </Badge>
              )}
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />
                Clear All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Player Name</label>
              <Input
                placeholder="Search player..."
                value={playerFilter}
                onChange={(e) => setPlayerFilter(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Team</label>
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {uniqueTeams.map(team => (
                    <SelectItem key={team} value={team}>{team}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Stat Type</label>
              <Select value={statTypeFilter} onValueChange={setStatTypeFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Stats" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stats</SelectItem>
                  {uniqueStatTypes.map(stat => (
                    <SelectItem key={stat} value={stat}>{stat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Recommendation</label>
              <Select value={recommendationFilter} onValueChange={setRecommendationFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {uniqueRecommendations.map(rec => (
                    <SelectItem key={rec} value={rec}>{rec}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Min Confidence</label>
              <Input
                type="number"
                placeholder="0"
                min={0}
                max={100}
                value={minConfidence}
                onChange={(e) => setMinConfidence(e.target.value ? Number(e.target.value) : '')}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Max Confidence</label>
              <Input
                type="number"
                placeholder="100"
                min={0}
                max={100}
                value={maxConfidence}
                onChange={(e) => setMaxConfidence(e.target.value ? Number(e.target.value) : '')}
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Count & Pagination Info */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            Showing {paginatedProps.length > 0 ? ((currentPage - 1) * PROPS_PER_PAGE) + 1 : 0}
            –{Math.min(currentPage * PROPS_PER_PAGE, filteredProps.length)}
          </span>
          {' '}of{' '}
          <span className="font-medium text-foreground">{filteredProps.length}</span>
          {' '}props
          {filteredProps.length !== props.length && (
            <span className="text-muted-foreground"> (filtered from {props.length} total)</span>
          )}
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Props List */}
      <Card>
        <CardContent className="pt-4">
          {paginatedProps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {hasActiveFilters ? 'No props match your filters.' : 'No props available.'}
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedProps.map((prop) => {
                const cf = prop.calibration_factors || {};
                return (
                  <div
                    key={prop.id}
                    className="p-4 rounded-lg border bg-muted/20 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate">{prop.player_name}</span>
                          <Badge variant="outline" className="shrink-0">{prop.team}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          vs {prop.opponent} | {prop.stat_type} {prop.line_value}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Projected</p>
                          <p className="font-mono font-medium">{prop.projected_value?.toFixed(1)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Prob</p>
                          <p className="font-mono font-medium">{(prop.estimated_probability * 100).toFixed(0)}%</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Confidence</p>
                          <Badge 
                            variant={prop.confidence_score >= 70 ? 'default' : prop.confidence_score >= 50 ? 'secondary' : 'outline'}
                          >
                            {prop.confidence_score}%
                          </Badge>
                        </div>
                        {prop.recommendation && (
                          <Badge 
                            variant={prop.recommendation.toLowerCase().includes('strong') ? 'default' : 'secondary'}
                            className={prop.recommendation.toLowerCase().includes('over') ? 'bg-green-600' : prop.recommendation.toLowerCase().includes('under') ? 'bg-red-600' : ''}
                          >
                            {prop.recommendation}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {/* Calibration factors preview */}
                    <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-4 md:grid-cols-8 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">L5 Avg:</span>{' '}
                        <span className="font-mono">{(cf.last_5_avg as number)?.toFixed(1) ?? '–'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Season:</span>{' '}
                        <span className="font-mono">{(cf.season_avg as number)?.toFixed(1) ?? '–'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Min L5:</span>{' '}
                        <span className="font-mono">{(cf.minutes_l5 as number)?.toFixed(0) ?? '–'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">STD:</span>{' '}
                        <span className="font-mono">{(cf.std as number)?.toFixed(2) ?? '–'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Def Rank:</span>{' '}
                        <span className="font-mono">{cf.def_rank as number ?? '–'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Pace:</span>{' '}
                        <span className="font-mono">{(cf.pace_rating as number)?.toFixed(1) ?? '–'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Injury:</span>{' '}
                        <span className="font-mono">{(cf.injury_status as string) || 'active'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Complete:</span>{' '}
                        <span className="font-mono">{cf.data_completeness as number}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          >
            First
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>
          <span className="px-4 text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
          >
            Last
          </Button>
        </div>
      )}
    </div>
  );
};

const StatsInspector = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [apiStatus, setApiStatus] = useState<StageStatus>({ status: 'unknown', message: 'Not checked' });
  const [parseStatus, setParseStatus] = useState<StageStatus>({ status: 'unknown', message: 'Not checked' });
  const [dbStatus, setDbStatus] = useState<StageStatus>({ status: 'unknown', message: 'Not checked' });

  // Check owner access
  useEffect(() => {
    const checkOwnerAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsOwner(false);
        return;
      }
      
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      
      const hasAccess = roles?.some(r => r.role === 'owner' || r.role === 'admin') ?? false;
      setIsOwner(hasAccess);
    };
    
    checkOwnerAccess();
  }, []);

  // Fetch player stats
  const { data: playerStats, refetch: refetchPlayers, isLoading: loadingPlayers } = useQuery({
    queryKey: ['stats-inspector-players'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nba_player_stats')
        .select('*')
        .order('last_updated', { ascending: false });
      
      if (error) throw error;
      return data as PlayerStats[];
    },
    enabled: isOwner === true
  });

  // Fetch today's games
  const { data: games, refetch: refetchGames, isLoading: loadingGames } = useQuery({
    queryKey: ['stats-inspector-games'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('nba_games_today')
        .select('*')
        .eq('game_date', today);
      
      if (error) throw error;
      return data as GameData[];
    },
    enabled: isOwner === true
  });

  // Fetch generated props
  const { data: props, refetch: refetchProps, isLoading: loadingProps } = useQuery({
    queryKey: ['stats-inspector-props'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('nba_props_generated')
        .select('*')
        .eq('game_date', today)
        .order('confidence_score', { ascending: false });
      
      if (error) throw error;
      return data as PropData[];
    },
    enabled: isOwner === true
  });

  // Fetch refresh logs
  const { data: refreshLogs, refetch: refetchLogs } = useQuery({
    queryKey: ['stats-inspector-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nba_stats_refresh_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as RefreshLog[];
    },
    enabled: isOwner === true
  });

  // Update status indicators based on data
  useEffect(() => {
    if (!refreshLogs || refreshLogs.length === 0) return;
    
    const latestLog = refreshLogs[0];
    
    // API Status
    if (latestLog.status === 'success') {
      setApiStatus({ 
        status: 'success', 
        message: `Fetched ${latestLog.players_updated || 0} players, ${latestLog.games_fetched || 0} games`,
        timestamp: latestLog.created_at
      });
    } else if (latestLog.status === 'error') {
      setApiStatus({ 
        status: 'fail', 
        message: latestLog.error_message || 'API fetch failed',
        timestamp: latestLog.created_at
      });
    }
    
    // Parse Status - based on player data quality
    if (playerStats && playerStats.length > 0) {
      const validPlayers = playerStats.filter(p => 
        p.last_5_games_avg_pts !== null && 
        p.minutes_last_5_avg !== null
      );
      if (validPlayers.length > 0) {
        setParseStatus({ 
          status: 'success', 
          message: `${validPlayers.length}/${playerStats.length} players parsed correctly` 
        });
      } else {
        setParseStatus({ status: 'fail', message: 'No valid player data parsed' });
      }
    }
    
    // DB Status - based on props
    if (props && props.length > 0) {
      setDbStatus({ 
        status: 'success', 
        message: `${props.length} props written to database` 
      });
    } else if (playerStats && playerStats.length > 0) {
      setDbStatus({ status: 'pending', message: 'Stats loaded, props not generated' });
    } else {
      setDbStatus({ status: 'fail', message: 'No data in database' });
    }
  }, [refreshLogs, playerStats, props]);

  const handleRefreshStats = async () => {
    setRefreshing(true);
    setApiStatus({ status: 'pending', message: 'Fetching from SportsDataIO...' });
    
    try {
      const { data, error } = await supabase.functions.invoke('nba-stats-engine', {
        body: { action: 'refresh_stats' }
      });
      
      if (error) throw error;
      
      setApiStatus({ 
        status: 'success', 
        message: `Updated ${data?.players_updated || 0} players`,
        timestamp: new Date().toISOString()
      });
      
      await Promise.all([refetchPlayers(), refetchGames(), refetchProps(), refetchLogs()]);
      toast.success('Stats refreshed from SportsDataIO');
    } catch (err) {
      setApiStatus({ status: 'fail', message: String(err) });
      toast.error('Failed to refresh stats');
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleGenerateProps = async () => {
    setRefreshing(true);
    setDbStatus({ status: 'pending', message: 'Generating props...' });
    
    try {
      const { data, error } = await supabase.functions.invoke('nba-stats-engine', {
        body: { action: 'generate_props' }
      });
      
      if (error) throw error;
      
      setDbStatus({ 
        status: 'success', 
        message: `Generated ${data?.props_generated || 0} props` 
      });
      
      await refetchProps();
      toast.success(`Generated ${data?.props_generated || 0} props`);
    } catch (err) {
      setDbStatus({ status: 'fail', message: String(err) });
      toast.error('Failed to generate props');
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  };

  const getPlayerDataQuality = (player: PlayerStats) => {
    const requiredFields = [
      player.last_5_games_avg_pts,
      player.last_5_games_avg_reb,
      player.last_5_games_avg_ast,
      player.minutes_last_5_avg
    ];
    const filledFields = requiredFields.filter(f => f !== null && f !== undefined).length;
    return (filledFields / requiredFields.length) * 100;
  };

  const isPlayerEligible = (player: PlayerStats) => {
    return player.last_5_games_avg_pts !== null &&
           player.last_5_games_avg_reb !== null &&
           player.last_5_games_avg_ast !== null &&
           player.minutes_last_5_avg !== null &&
           player.minutes_last_5_avg > 10;
  };

  const isPropEligible = (prop: PropData) => {
    const cf = prop.calibration_factors;
    return cf && 
           cf.last_5_avg !== undefined && 
           cf.season_avg !== undefined &&
           cf.minutes_l5 !== undefined &&
           Number(cf.minutes_l5) > 10;
  };

  // Access control
  if (isOwner === null) {
    return (
      <div className="p-6 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isOwner === false) {
    return <Navigate to="/os/sports-betting" replace />;
  }

  const playersWithIssues = playerStats?.filter(p => getPlayerDataQuality(p) < 100) || [];
  const eligiblePlayers = playerStats?.filter(isPlayerEligible) || [];
  const eligibleProps = props?.filter(isPropEligible) || [];
  const blockedProps = props?.filter(p => !isPropEligible(p)) || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">NBA Stats Inspector</h1>
            <Badge variant="outline" className="text-xs">OWNER ONLY</Badge>
          </div>
          <p className="text-muted-foreground mt-1">Debug SportsDataIO data flow and prop eligibility</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefreshStats} disabled={refreshing} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Stats
          </Button>
          <Button onClick={handleGenerateProps} disabled={refreshing}>
            <Database className="w-4 h-4 mr-2" />
            Generate Props
          </Button>
        </div>
      </div>

      {/* Pipeline Status */}
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Pipeline Status
          </CardTitle>
          <CardDescription>Real-time status of each data processing stage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-muted/30 border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">API Fetch</span>
                <StatusBadge status={apiStatus.status} label={apiStatus.status.toUpperCase()} />
              </div>
              <p className="text-xs text-muted-foreground">{apiStatus.message}</p>
              {apiStatus.timestamp && (
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(apiStatus.timestamp).toLocaleString()}
                </p>
              )}
            </div>
            
            <div className="p-4 rounded-lg bg-muted/30 border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Parsing</span>
                <StatusBadge status={parseStatus.status} label={parseStatus.status.toUpperCase()} />
              </div>
              <p className="text-xs text-muted-foreground">{parseStatus.message}</p>
            </div>
            
            <div className="p-4 rounded-lg bg-muted/30 border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">DB Write</span>
                <StatusBadge status={dbStatus.status} label={dbStatus.status.toUpperCase()} />
              </div>
              <p className="text-xs text-muted-foreground">{dbStatus.message}</p>
            </div>
            
            <div className="p-4 rounded-lg bg-muted/30 border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Props Eligible</span>
                <StatusBadge 
                  status={eligibleProps.length > 0 ? 'success' : 'fail'} 
                  label={eligibleProps.length > 0 ? 'YES' : 'NO'} 
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {eligibleProps.length} ready, {blockedProps.length} blocked
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{playerStats?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total Players</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{eligiblePlayers.length}</p>
                <p className="text-sm text-muted-foreground">Eligible Players</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{playersWithIssues.length}</p>
                <p className="text-sm text-muted-foreground">Missing Fields</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{games?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Today's Games</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Database className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{props?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Props Generated</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="moneyline" className="w-full">
        <TabsList className="grid grid-cols-7 w-full max-w-4xl">
          <TabsTrigger value="moneyline">
            <TrendingUp className="w-4 h-4 mr-2" />
            Moneyline
          </TabsTrigger>
          <TabsTrigger value="all-props">
            <List className="w-4 h-4 mr-2" />
            All Props
          </TabsTrigger>
          <TabsTrigger value="raw">
            <Server className="w-4 h-4 mr-2" />
            Raw API
          </TabsTrigger>
          <TabsTrigger value="processed">
            <Activity className="w-4 h-4 mr-2" />
            Processed
          </TabsTrigger>
          <TabsTrigger value="database">
            <Database className="w-4 h-4 mr-2" />
            Database
          </TabsTrigger>
          <TabsTrigger value="eligibility">
            <CheckCircle className="w-4 h-4 mr-2" />
            Eligibility
          </TabsTrigger>
          <TabsTrigger value="logs">
            <Clock className="w-4 h-4 mr-2" />
            Logs
          </TabsTrigger>
        </TabsList>

        {/* MONEYLINE LEANS - Separate from props */}
        <TabsContent value="moneyline">
          <NBAMoneylineLeans />
        </TabsContent>

        {/* ALL PROPS VIEW - Full dataset with pagination and filters */}
        <TabsContent value="all-props">
          <AllPropsView props={props || []} loading={loadingProps} />
        </TabsContent>

        {/* SECTION A: Raw API Data */}
        <TabsContent value="raw">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="w-5 h-5" />
                  Raw SportsDataIO Data
                </CardTitle>
                <CardDescription>Direct API responses stored in database</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingPlayers || loadingGames ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-4">
                      {/* Games */}
                      <Collapsible defaultOpen>
                        <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-muted/50 rounded-lg">
                          <ChevronDown className="w-4 h-4" />
                          <span className="font-medium">Today's Games ({games?.length || 0})</span>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {games?.map((game) => (
                              <Card key={game.id} className="bg-muted/30">
                                <CardContent className="pt-4 space-y-1 text-sm">
                                  <p className="font-bold text-center">{game.away_team} @ {game.home_team}</p>
                                  <FieldValue label="GameID" value={game.game_id} isRequired />
                                  <FieldValue label="Date" value={game.game_date} isRequired />
                                  <FieldValue label="Time" value={game.game_time} />
                                  <FieldValue label="Status" value={game.status} />
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>

                      {/* Players Raw */}
                      <Collapsible>
                        <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-muted/50 rounded-lg">
                          <ChevronDown className="w-4 h-4" />
                          <span className="font-medium">Players ({playerStats?.length || 0})</span>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {playerStats?.slice(0, 30).map((player) => (
                              <Card key={player.id} className="bg-muted/30">
                                <CardContent className="pt-4 space-y-1 text-sm">
                                  <div className="flex items-center justify-between">
                                    <p className="font-bold">{player.player_name}</p>
                                    <Badge variant="outline">{player.team}</Badge>
                                  </div>
                                  <FieldValue label="PlayerID" value={player.player_id} isRequired />
                                  <FieldValue label="Position" value={player.position} />
                                  <FieldValue label="Injury" value={player.injury_status} />
                                  <FieldValue label="Last Updated" value={new Date(player.last_updated).toLocaleString()} />
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* SECTION B: Processed Stats */}
        <TabsContent value="processed">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Processed Stats (Model Inputs)
              </CardTitle>
              <CardDescription>Stats used for probability calculations</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingPlayers ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {playerStats?.map((player) => {
                      const eligible = isPlayerEligible(player);
                      return (
                        <Card key={player.id} className={eligible ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'}>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">{player.player_name}</CardTitle>
                              <StatusBadge status={eligible ? 'success' : 'fail'} label={eligible ? 'READY' : 'BLOCKED'} />
                            </div>
                            <p className="text-sm text-muted-foreground">{player.team}</p>
                          </CardHeader>
                          <CardContent className="text-sm space-y-1">
                            <FieldValue label="Last 5 PTS" value={player.last_5_games_avg_pts?.toFixed(1)} isRequired />
                            <FieldValue label="Last 5 REB" value={player.last_5_games_avg_reb?.toFixed(1)} isRequired />
                            <FieldValue label="Last 5 AST" value={player.last_5_games_avg_ast?.toFixed(1)} isRequired />
                            <FieldValue label="Last 5 3PM" value={player.last_5_games_avg_3pm?.toFixed(1)} />
                            <FieldValue label="Season PTS" value={player.season_avg_pts?.toFixed(1)} />
                            <FieldValue label="Season MIN" value={player.season_avg_min?.toFixed(1)} />
                            <FieldValue label="Minutes (L5)" value={player.minutes_last_5_avg?.toFixed(1)} isRequired />
                            <FieldValue label="STD PTS" value={player.std_pts?.toFixed(2)} />
                            <FieldValue label="Injury Status" value={player.injury_status || 'active'} />
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SECTION C: Database Verification */}
        <TabsContent value="database">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Database Verification
              </CardTitle>
              <CardDescription>Props written to database with calibration factors</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingProps ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : props?.length === 0 ? (
                <div className="flex items-center gap-2 text-yellow-500 p-4 bg-yellow-500/10 rounded-lg">
                  <AlertTriangle className="w-5 h-5" />
                  <p>No props generated for today. Run "Generate Props" to create them.</p>
                </div>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4">
                    {props?.slice(0, 50).map((prop) => {
                      const eligible = isPropEligible(prop);
                      const cf = prop.calibration_factors || {};
                      
                      return (
                        <Card key={prop.id} className={eligible ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'}>
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <p className="font-bold">{prop.player_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {prop.team} vs {prop.opponent} | {prop.stat_type} | Line: {prop.line_value}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <StatusBadge status={eligible ? 'success' : 'fail'} label={eligible ? 'ELIGIBLE' : 'BLOCKED'} />
                                <Badge variant="outline">{prop.confidence_score}%</Badge>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Prop Data</p>
                                <FieldValue label="PlayerID" value={cf.player_id as string} isRequired />
                                <FieldValue label="Projected" value={prop.projected_value?.toFixed(2)} isRequired />
                                <FieldValue label="Probability" value={(prop.estimated_probability * 100).toFixed(1) + '%'} />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Averages</p>
                                <FieldValue label="Last 5 Avg" value={(cf.last_5_avg as number)?.toFixed(2)} isRequired />
                                <FieldValue label="Season Avg" value={(cf.season_avg as number)?.toFixed(2)} isRequired />
                                <FieldValue label="STD" value={(cf.std as number)?.toFixed(2)} />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Context</p>
                                <FieldValue label="Minutes (L5)" value={(cf.minutes_l5 as number)?.toFixed(1)} isRequired />
                                <FieldValue label="Opp Def Rank" value={cf.def_rank as number} />
                                <FieldValue label="Pace" value={(cf.pace_rating as number)?.toFixed(1)} />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Meta</p>
                                <FieldValue label="Injury" value={cf.injury_status as string || 'active'} />
                                <FieldValue label="Source" value={cf.stats_source as string} isRequired />
                                <FieldValue label="Completeness" value={(cf.data_completeness as number) + '%'} />
                              </div>
                            </div>
                            {!eligible && (
                              <div className="mt-3 p-2 bg-red-500/10 rounded text-sm text-red-400">
                                <strong>Block Reason:</strong>{' '}
                                {cf.minutes_l5 === undefined ? 'Missing minutes data' :
                                 Number(cf.minutes_l5) <= 10 ? `Low minutes (${cf.minutes_l5})` :
                                 cf.last_5_avg === undefined ? 'Missing last 5 avg' :
                                 'Unknown reason'}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Eligibility Summary */}
        <TabsContent value="eligibility">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-green-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  Eligible Props ({eligibleProps.length})
                </CardTitle>
                <CardDescription>Ready for simulation and display</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {eligibleProps.map((prop) => (
                      <div key={prop.id} className="p-3 bg-green-500/10 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{prop.player_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {prop.stat_type} {prop.line_value} | {prop.team} vs {prop.opponent}
                            </p>
                          </div>
                          <Badge>{prop.confidence_score}%</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="border-red-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-400">
                  <XCircle className="w-5 h-5" />
                  Blocked Props ({blockedProps.length})
                </CardTitle>
                <CardDescription>Missing required data</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {blockedProps.map((prop) => {
                      const cf = prop.calibration_factors || {};
                      return (
                        <div key={prop.id} className="p-3 bg-red-500/10 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{prop.player_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {prop.stat_type} {prop.line_value}
                              </p>
                            </div>
                            <Badge variant="destructive">BLOCKED</Badge>
                          </div>
                          <p className="text-xs text-red-400 mt-1">
                            {cf.minutes_l5 === undefined ? 'Missing: minutes_l5' :
                             Number(cf.minutes_l5) <= 10 ? `Low minutes: ${cf.minutes_l5}` :
                             cf.last_5_avg === undefined ? 'Missing: last_5_avg' :
                             'Data incomplete'}
                          </p>
                        </div>
                      );
                    })}
                    {blockedProps.length === 0 && (
                      <p className="text-muted-foreground text-center py-4">No blocked props</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Logs */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Refresh Logs
              </CardTitle>
              <CardDescription>History of API refresh operations</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {refreshLogs?.map((log) => (
                    <Card key={log.id} className={log.status === 'success' ? 'bg-green-500/5' : 'bg-red-500/5'}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={log.status === 'success' ? 'success' : 'fail'} label={log.status.toUpperCase()} />
                            <span className="font-medium">{log.refresh_date}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <p>Players: {log.players_updated || 0}</p>
                          <p>Games: {log.games_fetched || 0}</p>
                          <p>Props: {log.props_generated || 0}</p>
                        </div>
                        {log.error_message && (
                          <p className="text-sm text-red-400 mt-2 p-2 bg-red-500/10 rounded">
                            Error: {log.error_message}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {(!refreshLogs || refreshLogs.length === 0) && (
                    <p className="text-muted-foreground text-center py-4">No refresh logs yet</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StatsInspector;
