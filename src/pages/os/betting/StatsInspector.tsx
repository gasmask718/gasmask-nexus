import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, AlertTriangle, CheckCircle, Database, Users, Calendar } from 'lucide-react';
import { toast } from 'sonner';

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
  game_date: string;
}

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

const StatsInspector = () => {
  const [refreshing, setRefreshing] = useState(false);

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
    }
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
    }
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
    }
  });

  const handleRefreshStats = async () => {
    setRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke('nba-stats-engine', {
        body: { action: 'refresh_stats' }
      });
      
      if (error) throw error;
      
      await Promise.all([refetchPlayers(), refetchGames(), refetchProps()]);
      toast.success('Stats refreshed from SportsDataIO');
    } catch (err) {
      toast.error('Failed to refresh stats');
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

  const playersWithIssues = playerStats?.filter(p => getPlayerDataQuality(p) < 100) || [];
  const completePlayerCount = (playerStats?.length || 0) - playersWithIssues.length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stats Inspector</h1>
          <p className="text-muted-foreground">Owner-only debugging view for SportsDataIO data</p>
        </div>
        <Button onClick={handleRefreshStats} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh from API
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                <p className="text-2xl font-bold">{completePlayerCount}</p>
                <p className="text-sm text-muted-foreground">Complete Data</p>
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
      </div>

      <Tabs defaultValue="players" className="w-full">
        <TabsList>
          <TabsTrigger value="players">
            <Users className="w-4 h-4 mr-2" />
            Players ({playerStats?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="games">
            <Calendar className="w-4 h-4 mr-2" />
            Games ({games?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="props">
            <Database className="w-4 h-4 mr-2" />
            Props ({props?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="issues">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Issues ({playersWithIssues.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="players">
          <Card>
            <CardHeader>
              <CardTitle>Player Stats from SportsDataIO</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPlayers ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {playerStats?.map((player) => (
                      <Card key={player.id} className="bg-muted/30">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">{player.player_name}</CardTitle>
                            <Badge variant={getPlayerDataQuality(player) === 100 ? 'default' : 'destructive'}>
                              {getPlayerDataQuality(player).toFixed(0)}%
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{player.team}</p>
                        </CardHeader>
                        <CardContent className="text-sm space-y-1">
                          <FieldValue label="PlayerID" value={player.player_id} isRequired />
                          <FieldValue label="Position" value={player.position} />
                          <FieldValue label="Last 5 PTS" value={player.last_5_games_avg_pts} isRequired />
                          <FieldValue label="Last 5 REB" value={player.last_5_games_avg_reb} isRequired />
                          <FieldValue label="Last 5 AST" value={player.last_5_games_avg_ast} isRequired />
                          <FieldValue label="Last 5 3PM" value={player.last_5_games_avg_3pm} />
                          <FieldValue label="Season PTS" value={player.season_avg_pts} />
                          <FieldValue label="Season REB" value={player.season_avg_reb} />
                          <FieldValue label="Season AST" value={player.season_avg_ast} />
                          <FieldValue label="Minutes (L5)" value={player.minutes_last_5_avg} isRequired />
                          <FieldValue label="Season Min" value={player.season_avg_min} />
                          <FieldValue label="Injury" value={player.injury_status} />
                          <FieldValue label="Last Updated" value={new Date(player.last_updated).toLocaleString()} />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="games">
          <Card>
            <CardHeader>
              <CardTitle>Today's NBA Games</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingGames ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : games?.length === 0 ? (
                <p className="text-muted-foreground">No games scheduled for today</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {games?.map((game) => (
                    <Card key={game.id} className="bg-muted/30">
                      <CardContent className="pt-6 space-y-2">
                        <div className="text-center">
                          <p className="text-lg font-bold">{game.away_team} @ {game.home_team}</p>
                          <Badge variant="outline">{game.status}</Badge>
                        </div>
                        <FieldValue label="GameID" value={game.game_id} isRequired />
                        <FieldValue label="Game Date" value={game.game_date} isRequired />
                        <FieldValue label="Game Time" value={game.game_time} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="props">
          <Card>
            <CardHeader>
              <CardTitle>Generated Props with Calibration Data</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingProps ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : props?.length === 0 ? (
                <p className="text-muted-foreground">No props generated for today</p>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4">
                    {props?.slice(0, 50).map((prop) => (
                      <Card key={prop.id} className="bg-muted/30">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="font-bold">{prop.player_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {prop.team} vs {prop.opponent} | {prop.stat_type}
                              </p>
                            </div>
                            <Badge variant={prop.confidence_score >= 70 ? 'default' : 'secondary'}>
                              {prop.confidence_score}% conf
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Prop Data</p>
                              <FieldValue label="PlayerID" value={prop.player_id} isRequired />
                              <FieldValue label="Line" value={prop.line_value} isRequired />
                              <FieldValue label="Projected" value={prop.projected_value?.toFixed(2)} isRequired />
                              <FieldValue label="Probability" value={(prop.estimated_probability * 100).toFixed(1) + '%'} />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Calibration Factors</p>
                              {prop.calibration_factors && Object.entries(prop.calibration_factors).map(([key, value]) => (
                                <FieldValue 
                                  key={key} 
                                  label={key} 
                                  value={typeof value === 'number' ? value.toFixed(2) : String(value)} 
                                  isRequired={['last_5_avg', 'season_avg', 'minutes_l5', 'player_id'].includes(key)}
                                />
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issues">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                Players with Missing Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              {playersWithIssues.length === 0 ? (
                <div className="flex items-center gap-2 text-green-500">
                  <CheckCircle className="w-5 h-5" />
                  <p>All players have complete required data</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {playersWithIssues.map((player) => (
                      <Card key={player.id} className="bg-destructive/10 border-destructive/30">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-bold">{player.player_name} ({player.team})</p>
                            <Badge variant="destructive">
                              {getPlayerDataQuality(player).toFixed(0)}% complete
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                            {player.last_5_games_avg_pts === null && (
                              <Badge variant="outline" className="text-destructive">Missing: last_5_pts</Badge>
                            )}
                            {player.last_5_games_avg_reb === null && (
                              <Badge variant="outline" className="text-destructive">Missing: last_5_reb</Badge>
                            )}
                            {player.last_5_games_avg_ast === null && (
                              <Badge variant="outline" className="text-destructive">Missing: last_5_ast</Badge>
                            )}
                            {player.minutes_last_5_avg === null && (
                              <Badge variant="outline" className="text-destructive">Missing: minutes_avg</Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StatsInspector;
