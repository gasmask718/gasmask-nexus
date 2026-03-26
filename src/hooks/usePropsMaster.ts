import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PropMaster {
  id: string;
  player_name: string;
  team: string | null;
  opponent: string | null;
  sport: string;
  stat_type: string;
  line: number;
  platform: string;
  odds: string | null;
  game_time: string | null;
  game_date: string | null;
  source: string;
  prediction: string | null;
  confidence_score: number | null;
  edge_score: number | null;
  reasoning_json: any;
  season_avg: number | null;
  last_5_avg: number | null;
  last_10_avg: number | null;
  hit_rate: number | null;
  matchup_avg: number | null;
  actual_result: number | null;
  result: string;
  settled_at: string | null;
  batch_id: string | null;
  upload_group_id: string | null;
  original_image_url: string | null;
  created_at: string;
  updated_at: string;
}

const KEY = 'props-master';

export function usePropsMaster(filters?: {
  platform?: string;
  gameDate?: string;
  minConfidence?: number;
  result?: string;
  bestOnly?: boolean;
}) {
  return useQuery({
    queryKey: [KEY, filters],
    queryFn: async () => {
      let query = (supabase.from('props_master') as any)
        .select('*')
        .order('confidence_score', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(500);

      if (filters?.platform && filters.platform !== 'all') {
        query = query.eq('platform', filters.platform);
      }
      if (filters?.gameDate) {
        query = query.eq('game_date', filters.gameDate);
      }
      if (filters?.minConfidence) {
        query = query.gte('confidence_score', filters.minConfidence);
      }
      if (filters?.result && filters.result !== 'all') {
        query = query.eq('result', filters.result);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PropMaster[];
    },
  });
}

export function usePropsMasterStats(gameDate?: string) {
  return useQuery({
    queryKey: ['props-master-stats', gameDate],
    queryFn: async () => {
      let query = (supabase.from('props_master') as any).select('platform, confidence_score, result, prediction');
      if (gameDate) query = query.eq('game_date', gameDate);

      const { data, error } = await query;
      if (error) throw error;
      const props = data || [];

      const byPlatform: Record<string, number> = {};
      let totalConfidence = 0;
      let withConfidence = 0;
      let wins = 0;
      let losses = 0;
      let pending = 0;

      for (const p of props) {
        byPlatform[p.platform] = (byPlatform[p.platform] || 0) + 1;
        if (p.confidence_score) { totalConfidence += p.confidence_score; withConfidence++; }
        if (p.result === 'win') wins++;
        else if (p.result === 'loss') losses++;
        else pending++;
      }

      return {
        total: props.length,
        byPlatform,
        avgConfidence: withConfidence ? Math.round(totalConfidence / withConfidence) : 0,
        wins,
        losses,
        pending,
        winRate: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0,
      };
    },
  });
}

export function usePropCrossIntelligence(playerName?: string, statType?: string) {
  return useQuery({
    queryKey: ['prop-cross-intel', playerName, statType],
    queryFn: async () => {
      if (!playerName || !statType) return [];
      const { data, error } = await (supabase.from('props_master') as any)
        .select('*')
        .eq('player_name', playerName)
        .eq('stat_type', statType)
        .order('line', { ascending: true });
      if (error) throw error;
      return (data || []) as PropMaster[];
    },
    enabled: !!playerName && !!statType,
  });
}

export function usePropMutations() {
  const qc = useQueryClient();

  const addProp = useMutation({
    mutationFn: async (input: Partial<PropMaster> & { player_name: string; stat_type: string; line: number }) => {
      const { error } = await (supabase.from('props_master') as any).insert({
        ...input,
        source: input.source || 'manual',
        platform: input.platform || 'manual',
        result: 'pending',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      toast.success('Prop added');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateProp = useMutation({
    mutationFn: async (input: { id: string } & Partial<PropMaster>) => {
      const { id, ...updates } = input;
      const { error } = await (supabase.from('props_master') as any)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadImage = useMutation({
    mutationFn: async (input: { imageBase64: string; platform: string }) => {
      const { data, error } = await supabase.functions.invoke('sbo-parse-prop-image', {
        body: { image: input.imageBase64, platform: input.platform },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to parse image');
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [KEY] });
      toast.success(`Parsed ${data.count || 0} props from image`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { addProp, updateProp, uploadImage };
}
