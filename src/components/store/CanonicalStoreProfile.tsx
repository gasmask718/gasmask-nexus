/**
 * CanonicalStoreProfile - THE SINGLE SOURCE OF TRUTH
 * 
 * This wrapper ensures the full StoreDetail component is used everywhere,
 * with permission-based controls for different user contexts (Admin vs Ambassador).
 * 
 * RULE: There is only ONE store profile implementation. All views use this component.
 */
import { createContext, useContext, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type ViewerRole = 'admin' | 'ambassador' | 'viewer';

interface StoreProfileContextValue {
  viewerRole: ViewerRole;
  canEdit: (field: string) => boolean;
  canDelete: boolean;
  isAmbassadorContext: boolean;
}

const StoreProfileContext = createContext<StoreProfileContextValue>({
  viewerRole: 'viewer',
  canEdit: () => false,
  canDelete: false,
  isAmbassadorContext: false,
});

export const useStoreProfilePermissions = () => useContext(StoreProfileContext);

// Fields ambassadors are allowed to edit
const AMBASSADOR_EDITABLE_FIELDS = [
  'notes',
  'responsiveness',
  'sticker_status',
  'sticker_door',
  'sticker_instore',
  'sticker_phone',
  'sticker_taken_down',
  'visit_notes',
];

interface CanonicalStoreProfileProviderProps {
  children: React.ReactNode;
  storeId: string;
  forceAmbassadorContext?: boolean;
}

export function CanonicalStoreProfileProvider({
  children,
  storeId,
  forceAmbassadorContext = false,
}: CanonicalStoreProfileProviderProps) {
  const { user } = useAuth();

  // Check user role
  const { data: userRoles } = useQuery({
    queryKey: ['user-roles', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      return data?.map(r => r.role) || [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Check if user is assigned ambassador for this store
  const { data: isAssignedAmbassador } = useQuery({
    queryKey: ['store-ambassador-check', storeId, user?.id],
    queryFn: async () => {
      if (!user || !storeId) return false;
      
      // First get the ambassador record for this user
      const { data: ambassador } = await supabase
        .from('ambassadors')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (!ambassador) return false;

      // Check if ambassador is assigned to this store
      const { data } = await (supabase as any)
        .from('store_assignments')
        .select('id')
        .eq('store_id', storeId)
        .eq('ambassador_id', ambassador.id)
        .eq('active', true)
        .limit(1);
      
      return (data?.length || 0) > 0;
    },
    enabled: !!user && !!storeId,
    staleTime: 5 * 60 * 1000,
  });

  const contextValue = useMemo<StoreProfileContextValue>(() => {
    const isAdmin = userRoles?.includes('admin') || userRoles?.includes('owner');
    const isAmbassador = userRoles?.includes('ambassador') || isAssignedAmbassador;
    
    let viewerRole: ViewerRole = 'viewer';
    if (isAdmin && !forceAmbassadorContext) {
      viewerRole = 'admin';
    } else if (isAmbassador) {
      viewerRole = 'ambassador';
    }

    return {
      viewerRole,
      canEdit: (field: string) => {
        if (viewerRole === 'admin') return true;
        if (viewerRole === 'ambassador') {
          return AMBASSADOR_EDITABLE_FIELDS.includes(field);
        }
        return false;
      },
      canDelete: viewerRole === 'admin',
      isAmbassadorContext: forceAmbassadorContext || viewerRole === 'ambassador',
    };
  }, [userRoles, isAssignedAmbassador, forceAmbassadorContext]);

  return (
    <StoreProfileContext.Provider value={contextValue}>
      {children}
    </StoreProfileContext.Provider>
  );
}

export { StoreProfileContext };
