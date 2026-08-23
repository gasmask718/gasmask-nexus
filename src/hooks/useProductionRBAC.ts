/**
 * Production RBAC Hook
 * 
 * Determines the user's production role tier and gates
 * UI sections accordingly.
 * 
 * Tiers:
 *   - admin: owner, admin → full access (costs, margins, config, approvals)
 *   - manager: production role → operational access (batches, submissions, forecasts)
 *   - worker: production_office_users → read-only + submission
 *   - none: no production access
 */

import { useMemo } from 'react';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { supabase } from '@/integrations/supabase/client';
import { useMutation } from '@tanstack/react-query';

export type ProductionRoleTier = 'admin' | 'manager' | 'worker' | 'none';

interface ProductionPermissions {
  tier: ProductionRoleTier;
  isLoading: boolean;
  
  // Granular checks
  canViewCosts: boolean;
  canEditCosts: boolean;
  canViewMargins: boolean;
  canViewForecasts: boolean;
  canManageLeadTimes: boolean;
  canApproveSubmissions: boolean;
  canManageBatches: boolean;
  canManageWorkers: boolean;
  canManagePayroll: boolean;
  canViewAuditLog: boolean;
  canSubmitLogs: boolean;
  canViewOwnSubmissions: boolean;
}

const ADMIN_ROLES: string[] = ['owner', 'admin', 'ceo'];
const MANAGER_ROLES: string[] = ['va'];

export function useProductionRBAC(): ProductionPermissions {
  const { data: profileData, isLoading } = useCurrentUserProfile();
  
  const tier = useMemo<ProductionRoleTier>(() => {
    if (!profileData?.profile) return 'none';
    
    const role = profileData.profile.primary_role as string;
    
    if (ADMIN_ROLES.includes(role)) return 'admin';
    if (MANAGER_ROLES.includes(role)) return 'manager';
    
    // Production-assigned users get manager tier
    if (role === 'production') return 'manager';
    
    // Fallback — could be office-assigned user
    return 'worker';
  }, [profileData]);
  
  return useMemo(() => ({
    tier,
    isLoading,
    
    // Admin (HQ) only — costs/margins never appear on an office leader's screen
    canViewCosts: tier === 'admin',
    canEditCosts: tier === 'admin',
    canViewMargins: tier === 'admin',
    canViewAuditLog: tier === 'admin',
    
    // Manager+
    canViewForecasts: tier === 'admin' || tier === 'manager',
    canManageLeadTimes: tier === 'admin',
    canApproveSubmissions: tier === 'admin' || tier === 'manager',
    canManageBatches: tier === 'admin' || tier === 'manager',
    canManageWorkers: tier === 'admin' || tier === 'manager',
    canManagePayroll: tier === 'admin' || tier === 'manager',
    
    // Worker+
    canSubmitLogs: tier !== 'none',
    canViewOwnSubmissions: tier !== 'none',
  }), [tier, isLoading]);
}

/**
 * Hook to log access denials for audit
 */
export function useLogAccessDenial() {
  return useMutation({
    mutationFn: async (params: {
      resource: string;
      action: string;
      userRole: string;
      requiredRole: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      await supabase
        .from('production_access_denials')
        .insert({
          user_id: user.id,
          attempted_resource: params.resource,
          attempted_action: params.action,
          user_role: params.userRole,
          required_role: params.requiredRole,
        });
    },
  });
}
