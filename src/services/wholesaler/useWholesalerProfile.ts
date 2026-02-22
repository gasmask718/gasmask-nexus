import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ensureWholesalerProfile } from "@/services/roleService";

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
  commission_percent: number | null;
  warehouse_address: string | null;
  created_at: string | null;
}

export function useWholesalerProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['wholesaler-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;

      // First attempt
      let { data, error } = await supabase
        .from('wholesaler_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      // Auto-heal: create profile if missing
      if (!data) {
        await ensureWholesalerProfile(user.id);
        const retry = await supabase
          .from('wholesaler_profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        if (retry.error) throw retry.error;
        data = retry.data;
      }

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
