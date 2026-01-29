/**
 * ViewAsContext - Admin impersonation context for viewing portal as any ambassador
 * Provides read-only view of the portal from ambassador's perspective
 */
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ViewAsAmbassador {
  id: string;
  name: string | null;
  user_id: string | null;
}

interface ViewAsContextType {
  isViewingAs: boolean;
  viewAsAmbassador: ViewAsAmbassador | null;
  startViewAs: (ambassador: ViewAsAmbassador) => Promise<void>;
  stopViewAs: () => void;
  // The effective ambassador ID to use for queries
  effectiveAmbassadorId: string | null;
  effectiveUserId: string | null;
}

const ViewAsContext = createContext<ViewAsContextType>({
  isViewingAs: false,
  viewAsAmbassador: null,
  startViewAs: async () => {},
  stopViewAs: () => {},
  effectiveAmbassadorId: null,
  effectiveUserId: null,
});

export function ViewAsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [viewAsAmbassador, setViewAsAmbassador] = useState<ViewAsAmbassador | null>(null);

  // Check if current user is admin
  const { data: isAdmin } = useQuery({
    queryKey: ['is-admin-for-viewas', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'owner']);
      return (data?.length || 0) > 0;
    },
    enabled: !!user?.id,
  });

  // Get current user's ambassador record (if any)
  const { data: myAmbassador } = useQuery({
    queryKey: ['my-ambassador-record', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('ambassadors')
        .select('id, name, user_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();
      return data;
    },
    enabled: !!user?.id && !viewAsAmbassador,
  });

  const startViewAs = useCallback(async (ambassador: ViewAsAmbassador) => {
    if (!isAdmin) {
      toast.error('Only admins can use View As mode');
      return;
    }

    try {
      // Log the impersonation
      await supabase.from('admin_impersonation_log').insert({
        admin_user_id: user!.id,
        impersonated_ambassador_id: ambassador.id,
      });

      setViewAsAmbassador(ambassador);
      toast.success(`Now viewing as ${ambassador.name || 'Ambassador'}`);
    } catch (error) {
      console.error('Failed to start View As:', error);
      toast.error('Failed to start View As mode');
    }
  }, [isAdmin, user]);

  const stopViewAs = useCallback(() => {
    if (viewAsAmbassador) {
      // Update end time in log (best effort)
      supabase
        .from('admin_impersonation_log')
        .update({ ended_at: new Date().toISOString() })
        .eq('admin_user_id', user!.id)
        .eq('impersonated_ambassador_id', viewAsAmbassador.id)
        .is('ended_at', null)
        .then(() => {});
    }
    
    setViewAsAmbassador(null);
    toast.info('Exited View As mode');
  }, [viewAsAmbassador, user]);

  // Determine effective IDs
  const effectiveAmbassadorId = viewAsAmbassador?.id || myAmbassador?.id || null;
  const effectiveUserId = viewAsAmbassador?.user_id || user?.id || null;

  return (
    <ViewAsContext.Provider
      value={{
        isViewingAs: !!viewAsAmbassador,
        viewAsAmbassador,
        startViewAs,
        stopViewAs,
        effectiveAmbassadorId,
        effectiveUserId,
      }}
    >
      {children}
    </ViewAsContext.Provider>
  );
}

export function useViewAs() {
  return useContext(ViewAsContext);
}

export default ViewAsContext;
