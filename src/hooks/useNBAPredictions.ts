// NBA Predictions Engine Hook
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types for NBA data - aligned with database schema
export interface NBAGame {
  id: string;
  game_id: string;
  home_team: string;
  away_team: string;
  game_time: string;
  game_date: string;
  status: string;
}

export interface NBAProp {
  id: string;
  game_id: string;
  game_date: string;
  player_id: string;
  player_name: string;
  team: string;
  opponent: string;
  stat_type: string;
  line_value: number;
  over_under: string;
  estimated_probability: number | null;
  break_even_probability: number | null;
  edge: number | null;
  confidence_score: number | null;
  simulated_roi: number | null;
  recommendation: string | null;
  reasoning: string[] | null;
  opponent_def_tier: string | null;
  pace_tier: string | null;
  minutes_trend: string | null;
  data_completeness: number | null;
  source: string | null;
  volatility_score: string | null;
  calibration_factors: any | null;
  projected_value: number | null;
  back_to_back: boolean | null;
  home_game: boolean | null;
  created_at: string;
  // Stats visibility fields (extracted from calibration_factors for UI display)
  last_5_avg?: number | null;
  season_avg?: number | null;
  last_5_minutes_avg?: number | null;
  injury_status?: string | null;
}

export interface NBAStatsRefreshLog {
  id: string;
  refresh_date: string;
  status: string | null;
  games_fetched: number | null;
  players_updated: number | null;
  teams_updated: number | null;
  props_generated: number | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

// Fetch today's NBA games
export const useNBAGamesToday = () => {
  return useQuery({
    queryKey: ['nba-games-today'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('nba_games_today')
        .select('*')
        .eq('game_date', today)
        .order('game_time', { ascending: true });
      
      if (error) throw error;
      return (data || []) as NBAGame[];
    },
  });
};

// Fetch today's NBA props
export const useNBAPropsToday = (filters?: {
  minConfidence?: number;
  recommendation?: string;
  statType?: string;
}) => {
  return useQuery({
    queryKey: ['nba-props-today', filters],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      let query = supabase
        .from('nba_props_generated')
        .select('*')
        .eq('game_date', today)
        .order('confidence_score', { ascending: false });
      
      if (filters?.minConfidence) {
        query = query.gte('confidence_score', filters.minConfidence);
      }
      if (filters?.recommendation) {
        query = query.eq('recommendation', filters.recommendation);
      }
      if (filters?.statType) {
        query = query.eq('stat_type', filters.statType);
      }
      
      const { data, error } = await query.limit(500);
      if (error) throw error;
      return (data || []) as NBAProp[];
    },
  });
};

// Get top AI props (singles)
export const useTopAIProps = (minConfidence: number = 65) => {
  return useQuery({
    queryKey: ['nba-top-props', minConfidence],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('nba_props_generated')
        .select('*')
        .eq('game_date', today)
        .in('recommendation', ['strong_play', 'lean'])
        .gte('confidence_score', minConfidence)
        .gt('simulated_roi', 0)
        .order('confidence_score', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return (data || []) as NBAProp[];
    },
  });
};

// Get parlay-eligible props (lower volatility, correlation safe)
export const useParlayEligibleProps = () => {
  return useQuery({
    queryKey: ['nba-parlay-eligible'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('nba_props_generated')
        .select('*')
        .eq('game_date', today)
        .in('recommendation', ['strong_play', 'lean'])
        .in('volatility_score', ['low', 'medium'])
        .gte('confidence_score', 55)
        .order('confidence_score', { ascending: false })
        .limit(30);
      
      if (error) throw error;
      
      // Filter to avoid correlated props (same player)
      const seenPlayers = new Set<string>();
      const filtered = (data || []).filter((prop) => {
        if (seenPlayers.has(prop.player_id)) return false;
        seenPlayers.add(prop.player_id);
        return true;
      });
      
      return filtered as NBAProp[];
    },
  });
};

// Get props to avoid
export const usePropsToAvoid = () => {
  return useQuery({
    queryKey: ['nba-props-avoid'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('nba_props_generated')
        .select('*')
        .eq('game_date', today)
        .eq('recommendation', 'avoid')
        .order('edge', { ascending: true })
        .limit(15);
      
      if (error) throw error;
      return (data || []) as NBAProp[];
    },
  });
};

// Get latest refresh log
export const useNBARefreshLog = () => {
  return useQuery({
    queryKey: ['nba-refresh-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nba_stats_refresh_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as NBAStatsRefreshLog | null;
    },
  });
};

// Run NBA prediction engine (manual trigger)
export const useRunNBAPredictions = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      // Step 1: Refresh stats
      toast.info('Fetching NBA stats...');
      const statsResponse = await supabase.functions.invoke('nba-stats-engine', {
        body: { action: 'refresh_stats' },
      });
      
      if (statsResponse.error) {
        throw new Error(statsResponse.error.message || 'Failed to refresh stats');
      }
      
      console.log('Stats refreshed:', statsResponse.data);
      
      // Step 2: Generate props
      toast.info('Generating predictions...');
      const propsResponse = await supabase.functions.invoke('nba-stats-engine', {
        body: { action: 'generate_props' },
      });
      
      if (propsResponse.error) {
        throw new Error(propsResponse.error.message || 'Failed to generate props');
      }
      
      console.log('Props generated:', propsResponse.data);
      
      return {
        stats: statsResponse.data,
        props: propsResponse.data,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['nba-games-today'] });
      queryClient.invalidateQueries({ queryKey: ['nba-props-today'] });
      queryClient.invalidateQueries({ queryKey: ['nba-top-props'] });
      queryClient.invalidateQueries({ queryKey: ['nba-parlay-eligible'] });
      queryClient.invalidateQueries({ queryKey: ['nba-props-avoid'] });
      queryClient.invalidateQueries({ queryKey: ['nba-refresh-log'] });
      
      toast.success(
        `NBA Predictions Ready: ${data.props?.props_generated || 0} props generated for ${data.stats?.games_fetched || 0} games`
      );
    },
    onError: (error) => {
      console.error('NBA Prediction error:', error);
      toast.error(`Failed to run predictions: ${error.message}`);
    },
  });
};

// Copy prop to bets_simulated for tracking
export const useCopyPropToSimulated = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (prop: NBAProp) => {
      const volatilityNum = prop.volatility_score === 'low' ? 25 : prop.volatility_score === 'high' ? 75 : 50;
      
      const { data, error } = await supabase
        .from('bets_simulated')
        .insert({
          source: 'ai_model_nba',
          platform: 'pick_em',
          bet_type: `${prop.player_name} ${prop.over_under.toUpperCase()} ${prop.line_value} ${prop.stat_type}`,
          description: `${prop.team} vs ${prop.opponent} - ${prop.player_name} ${prop.over_under} ${prop.line_value} ${prop.stat_type}`,
          estimated_probability: prop.estimated_probability,
          confidence_score: prop.confidence_score,
          simulated_roi: prop.simulated_roi,
          volatility_score: volatilityNum,
          status: 'simulated',
          calibration_factors: prop.calibration_factors,
          data_completeness: prop.data_completeness,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['simulated-bets'] });
      toast.success('Prop added to simulated bets');
    },
    onError: (error) => {
      console.error('Error copying prop:', error);
      toast.error('Failed to add prop to simulated bets');
    },
  });
};
