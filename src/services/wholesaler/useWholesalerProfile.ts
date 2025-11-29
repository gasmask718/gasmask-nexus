import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface WholesalerProfile {
  id: string;
  user_id: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  tax_id: string | null;
  notes: string | null;
  status: string | null;
  shipping_preferences: any;
  website_url: string | null;
  wholesaler_type: string | null;
  created_at: string | null;
}

export function useWholesalerProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['wholesaler-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('wholesaler_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as WholesalerProfile | null;
    },
    enabled: !!user,
  });

  const updateProfile = useMutation({
    mutationFn: async (updates: Partial<WholesalerProfile>) => {
      if (!user || !profileQuery.data) throw new Error('No profile found');

      const { error } = await supabase
        .from('wholesaler_profiles')
        .update(updates)
        .eq('id', profileQuery.data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesaler-profile'] });
      toast.success('Profile updated');
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  return {
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading,
    updateProfile: updateProfile.mutateAsync,
    isUpdating: updateProfile.isPending,
  };
}
