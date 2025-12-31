import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useSimplifiedAccuracy() {
  return useQuery({
    queryKey: ['simplified-accuracy'],
    queryFn: async () => {
      // Get settlement count (moneyline) - direct from confirmed_game_winners
      const { count: moneylineCount } = await supabase
        .from('confirmed_game_winners')
        .select('*', { count: 'exact', head: true })
        .eq('confirmation_revoked', false);

      // Get prop results count
      const { count: propCount } = await supabase
        .from('prop_results')
        .select('*', { count: 'exact', head: true });

      const { count: propWins } = await supabase
        .from('prop_results')
        .select('*', { count: 'exact', head: true })
        .eq('result', 'W');

      const { count: propLosses } = await supabase
        .from('prop_results')
        .select('*', { count: 'exact', head: true })
        .eq('result', 'L');

      // Settlement is source of truth - no AI accuracy tracking here
      // AI predictions are separate from settlement
      return {
        moneyline: {
          total: moneylineCount || 0,
          wins: 0,
          losses: 0,
          winRate: 0,
        },
        props: {
          total: propCount || 0,
          wins: propWins || 0,
          losses: propLosses || 0,
          winRate: propCount ? ((propWins || 0) / propCount) * 100 : 0,
        },
        combined: {
          total: (moneylineCount || 0) + (propCount || 0),
          wins: propWins || 0,
          losses: propLosses || 0,
          winRate: 0,
        },
      };
    },
  });
}
