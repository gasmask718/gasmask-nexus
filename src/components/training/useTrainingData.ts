import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type TrainingRole =
  | 'driver'
  | 'biker'
  | 'ambassador'
  | 'production'
  | 'office'
  | 'wholesaler';

export interface TrainingModule {
  id: string;
  role: TrainingRole;
  title: string;
  title_es: string | null;
  step_order: number;
  content_md: string;
  content_md_es: string | null;
  video_url: string | null;
  screenshots: string[];
  is_active: boolean;
  is_first_day: boolean;
  version: number;
  updated_at: string;
}

export interface TrainingProgress {
  user_id: string;
  role: string | null;
  first_day_dismissed_at: string | null;
  first_day_started_at: string | null;
  completed_module_ids: string[];
  last_module_id: string | null;
}

const TABLE = 'role_sop_modules';
const PROG = 'role_sop_user_progress';

export function useTrainingModules(role: TrainingRole, opts: { includeInactive?: boolean } = {}) {
  return useQuery({
    queryKey: ['training-modules', role, opts.includeInactive ?? false],
    queryFn: async () => {
      let q = (supabase as any).from(TABLE).select('*').eq('role', role).order('step_order');
      if (!opts.includeInactive) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as TrainingModule[];
    },
  });
}

export function useAllTrainingModules() {
  return useQuery({
    queryKey: ['training-modules', 'all'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select('*')
        .order('role')
        .order('step_order');
      if (error) throw error;
      return (data ?? []) as TrainingModule[];
    },
  });
}

export function useTrainingProgress() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['training-progress', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(PROG)
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as TrainingProgress | null;
    },
  });
}

export function useUpdateProgress() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<TrainingProgress>) => {
      if (!user?.id) throw new Error('not signed in');
      const { data, error } = await (supabase as any)
        .from(PROG)
        .upsert({ user_id: user.id, ...patch }, { onConflict: 'user_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training-progress', user?.id] }),
  });
}

export function useUpsertTrainingModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: Partial<TrainingModule> & { role: TrainingRole; title: string }) => {
      const { data, error } = await (supabase as any).from(TABLE).upsert(m).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training-modules'] }),
  });
}

export function useDeleteTrainingModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from(TABLE).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training-modules'] }),
  });
}
