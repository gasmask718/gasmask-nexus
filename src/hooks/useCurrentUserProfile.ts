import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  getCurrentUserProfile, 
  createUserProfile, 
  createRoleProfile,
  UserProfile, 
  PrimaryRole, 
  PreferredLanguage 
} from '@/services/roleService';

export function useCurrentUserProfile() {
  return useQuery({
    queryKey: ['currentUserProfile'],
    queryFn: getCurrentUserProfile,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      full_name?: string;
      phone?: string;
      primary_role: PrimaryRole;
      preferred_language?: PreferredLanguage;
      roleData?: Record<string, any>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create main profile
      const profile = await createUserProfile(user.id, {
        full_name: params.full_name,
        phone: params.phone,
        primary_role: params.primary_role,
        preferred_language: params.preferred_language
      });

      // Create role-specific profile
      if (params.roleData) {
        await createRoleProfile(user.id, params.primary_role, params.roleData);
      }

      return profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
    }
  });
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<UserProfile>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('user_profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
    }
  });
}

export function useIsAdmin() {
  const { data, isLoading } = useCurrentUserProfile();
  
  return {
    isAdmin: data?.profile?.primary_role === 'admin' || data?.profile?.primary_role === 'va',
    isLoading
  };
}
