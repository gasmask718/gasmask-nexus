// Hooks for betting simulation engine
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  simulatePlayerProp, 
  simulatePowerEntry, 
  simulateFlexEntry,
  generateBatchSummary,
  PlayerPropInput,
  SimulationResult,
} from '@/ai-engine/propSimulationEngine';
import type { Database } from '@/integrations/supabase/types';

type MarketType = Database['public']['Tables']['market_lines']['Row']['market_type'];
type BetStatus = Database['public']['Tables']['bets_simulated']['Row']['status'];

// Fetch market lines
export const useMarketLines = (filters?: {
  platform?: string;
  market_type?: MarketType;
  sport?: string;
}) => {
  return useQuery({
    queryKey: ['market-lines', filters],
    queryFn: async () => {
      let query = supabase
        .from('market_lines')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (filters?.platform) {
        query = query.eq('platform', filters.platform);
      }
      if (filters?.market_type) {
        query = query.eq('market_type', filters.market_type);
      }
      if (filters?.sport) {
        query = query.eq('sport', filters.sport);
      }
      
      const { data, error } = await query.limit(200);
      if (error) throw error;
      return data || [];
    },
  });
};

// Fetch simulated bets - no status filter by default, shows ALL simulated bets
export const useSimulatedBets = (status?: BetStatus) => {
  return useQuery({
    queryKey: ['simulated-bets', status],
    queryFn: async () => {
      let query = supabase
        .from('bets_simulated')
        .select('*')
        .order('created_at', { ascending: false });
      
      // Only filter by status if explicitly provided
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query.limit(500); // Increased limit
      if (error) throw error;
      return data || [];
    },
  });
};

// Fetch ALL simulated bets from latest run (no filters)
export const useAllSimulatedBets = () => {
  return useQuery({
    queryKey: ['all-simulated-bets'],
    queryFn: async () => {
      // Get the latest simulation run
      const { data: latestRun } = await supabase
        .from('simulation_runs')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      let query = supabase
        .from('bets_simulated')
        .select('*')
        .order('created_at', { ascending: false });
      
      // If we have a latest run, get bets from around that time
      if (latestRun?.created_at) {
        const runDate = new Date(latestRun.created_at);
        runDate.setMinutes(runDate.getMinutes() - 5); // 5 min buffer
        query = query.gte('created_at', runDate.toISOString());
      }
      
      const { data, error } = await query.limit(500);
      if (error) throw error;
      return data || [];
    },
  });
};

// Fetch simulation runs
export const useSimulationRuns = () => {
  return useQuery({
    queryKey: ['simulation-runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('simulation_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data || [];
    },
  });
};

// Add market line
export const useAddMarketLine = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (line: {
      platform: string;
      sport: string;
      league?: string;
      event: string;
      market_type: MarketType;
      player_name?: string;
      stat_type?: string;
      line_value: number;
      over_under?: string;
      odds_or_payout: number;
    }) => {
      const { data, error } = await supabase
        .from('market_lines')
        .insert([line])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market-lines'] });
      toast.success('Market line added');
    },
    onError: (error) => {
      console.error('Error adding market line:', error);
      toast.error('Failed to add market line');
    },
  });
};

// Run simulation on market lines
export const useRunSimulation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: {
      platforms?: string[];
      market_types?: MarketType[];
      date_range?: { start: string; end: string };
    }) => {
      // Fetch relevant market lines
      let query = supabase
        .from('market_lines')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (params.platforms && params.platforms.length > 0) {
        query = query.in('platform', params.platforms);
      }
      if (params.market_types && params.market_types.length > 0) {
        query = query.in('market_type', params.market_types);
      }
      
      const { data: lines, error: linesError } = await query.limit(500);
      if (linesError) throw linesError;
      
      // Simulate each prop line
      const simulations: { input: PlayerPropInput; result: SimulationResult }[] = [];
      const simulatedBets: any[] = [];
      
      for (const line of lines || []) {
        if (line.market_type === 'player_prop' || line.market_type === 'fantasy_prop') {
          const input: PlayerPropInput = {
            player_name: line.player_name || 'Unknown',
            stat_type: line.stat_type || 'PTS',
            line_value: line.line_value,
            over_under: (line.over_under?.toLowerCase() || 'over') as 'over' | 'under',
            platform: line.platform,
            odds_or_payout: line.odds_or_payout || -110,
          };
          
          const result = simulatePlayerProp(input);
          simulations.push({ input, result });
          
          // Create simulated bet record
          simulatedBets.push({
            source: 'ai_model',
            platform: line.platform,
            market_line_id: line.id,
            bet_type: `${line.player_name} ${line.over_under} ${line.line_value} ${line.stat_type}`,
            description: `${line.event} - ${line.player_name} ${line.over_under} ${line.line_value} ${line.stat_type}`,
            estimated_probability: result.estimated_probability,
            confidence_score: result.confidence_score,
            simulated_roi: result.simulated_roi,
            volatility_score: result.volatility_score,
            status: 'simulated',
          });
        }
      }
      
      // Insert simulated bets
      if (simulatedBets.length > 0) {
        const { error: insertError } = await supabase
          .from('bets_simulated')
          .insert(simulatedBets);
        
        if (insertError) console.error('Error inserting simulated bets:', insertError);
      }
      
      // Generate summary
      const summary = generateBatchSummary(simulations);
      
      // Create simulation run record
      const { data: runData, error: runError } = await supabase
        .from('simulation_runs')
        .insert([{
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0],
          markets_included: params.market_types || ['player_prop', 'fantasy_prop'],
          platforms_included: params.platforms || ['all'],
          total_bets: summary.total_bets,
          roi: summary.average_simulated_roi,
          notes: JSON.stringify({
            average_confidence: summary.average_confidence,
            average_edge: summary.average_edge,
            strong_plays: summary.strong_plays,
            leans: summary.leans,
            top_props_count: summary.top_props.length,
          }),
        }])
        .select()
        .single();
      
      if (runError) console.error('Error creating simulation run:', runError);
      
      return { summary, run: runData, simulations };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['simulated-bets'] });
      queryClient.invalidateQueries({ queryKey: ['simulation-runs'] });
      toast.success(`Simulation complete: ${data.summary.total_bets} props analyzed`);
    },
    onError: (error) => {
      console.error('Simulation error:', error);
      toast.error('Failed to run simulation');
    },
  });
};

// Get top simulated props from latest run (no date filter to avoid missing data)
export const useTodaysTopProps = () => {
  return useQuery({
    queryKey: ['todays-top-props'],
    queryFn: async () => {
      // Get all simulated bets, sorted by confidence
      const { data, error } = await supabase
        .from('bets_simulated')
        .select('*')
        .order('confidence_score', { ascending: false })
        .limit(20); // Get more to ensure we have enough
      
      if (error) throw error;
      return data || [];
    },
  });
};

// Simulate a pick'em entry
export const useSimulatePickemEntry = () => {
  return useMutation({
    mutationFn: async (params: {
      bet_ids: string[];
      entry_type: 'power' | 'flex';
      platform: 'prizepicks' | 'underdog';
    }) => {
      // Fetch the selected simulated bets
      const { data: bets, error } = await supabase
        .from('bets_simulated')
        .select('*')
        .in('id', params.bet_ids);
      
      if (error) throw error;
      if (!bets || bets.length === 0) throw new Error('No bets found');
      
      // Convert to simulation results
      const legResults: SimulationResult[] = bets.map(bet => {
        // Map numeric volatility to string label
        const volScore = bet.volatility_score;
        let volLabel: 'low' | 'medium' | 'high' = 'medium';
        if (typeof volScore === 'number') {
          if (volScore <= 33) volLabel = 'low';
          else if (volScore >= 67) volLabel = 'high';
        }
        
        return {
          estimated_probability: bet.estimated_probability || 0.5,
          confidence_score: bet.confidence_score || 50,
          volatility_score: volLabel,
          simulated_roi: bet.simulated_roi || 0,
          break_even_probability: 0.5,
          edge: 0,
          recommendation: 'pass' as const,
          reasoning: [],
        };
      });
      
      if (params.entry_type === 'power') {
        return simulatePowerEntry(legResults, params.platform);
      } else {
        return simulateFlexEntry(legResults, params.platform);
      }
    },
  });
};

// Create a parlay simulation
export const useCreateParlaySimulation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: {
      bet_ids: string[];
      parlay_type: 'sportsbook' | 'pickem';
      platform: string;
      payout_structure?: any;
    }) => {
      // Fetch bets
      const { data: bets, error: fetchError } = await supabase
        .from('bets_simulated')
        .select('*')
        .in('id', params.bet_ids);
      
      if (fetchError) throw fetchError;
      
      // Calculate combined probability
      const combinedProb = bets?.reduce(
        (acc, bet) => acc * (bet.estimated_probability || 0.5),
        1
      ) || 0;
      
      const avgConfidence = (bets?.reduce(
        (acc, bet) => acc + (bet.confidence_score || 50),
        0
      ) || 0) / (bets?.length || 1);
      
      // Estimate payout based on parlay type
      const numLegs = bets?.length || 1;
      const estimatedPayout = params.parlay_type === 'pickem'
        ? (numLegs === 2 ? 3 : numLegs === 3 ? 5 : numLegs === 4 ? 10 : 20)
        : Math.pow(1.91, numLegs); // Approximate sportsbook parlay
      
      const expectedValue = (combinedProb * estimatedPayout) - 1;
      
      const { data, error } = await supabase
        .from('parlays')
        .insert([{
          parlay_type: params.parlay_type,
          legs: params.bet_ids,
          platform: params.platform,
          payout_structure: params.payout_structure || { multiplier: estimatedPayout },
          estimated_probability: combinedProb,
          simulated_roi: expectedValue,
          confidence_score: avgConfidence,
          status: 'simulated',
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parlays'] });
      toast.success('Parlay simulation created');
    },
  });
};

// Fetch parlays
export const useParlays = (status?: 'simulated' | 'approved' | 'executed') => {
  return useQuery({
    queryKey: ['parlays', status],
    queryFn: async () => {
      let query = supabase
        .from('parlays')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data || [];
    },
  });
};
