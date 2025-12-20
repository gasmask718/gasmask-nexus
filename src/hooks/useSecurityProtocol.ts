/**
 * Dynasty OS Security Protocol Hook
 * Centralized security checks for the entire application
 * 
 * ROLE HIERARCHY (from RLS Constitution):
 * - owner: Full access, bypasses all limits
 * - admin: Operational access, limited finance
 * - employee/staff: Scoped by brand/company
 * - store: Own store data only
 * - driver/biker: Assigned routes/deliveries only
 * - ambassador: Own stats/commissions only
 * - wholesaler: Own products/orders only
 * - customer: Own orders/profile only
 * - developer: UI only, NO data access
 */

import { useCallback, useMemo } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { AppRole } from '@/utils/roleRouting';

// High-risk tables (owner-only access)
const OWNER_ONLY_TABLES = [
  'financial_totals',
  'payout_calculations',
  'payroll',
  'bank_accounts',
  'identity_documents',
  'ai_core_prompts',
  'ai_decision_logs',
  'service_keys_log',
];

// Sensitive tables that require admin access
const ADMIN_ONLY_TABLES = [
  'user_roles',
  'audit_logs',
  'audit_log',
  'system_checkpoints',
  'api_clients',
  'va_permissions',
  'automation_rules',
];

// Tables that require elevated access (admin, employee, accountant)
const ELEVATED_ACCESS_TABLES = [
  'orders',
  'payouts',
  'grants',
  'funding_requests',
  'crm_contacts',
  'crm_calls',
  'crm_messages',
  'portfolio_positions',
  'sports_bets',
  'billing',
  'ai_work_tasks',
];

// Elevated roles
const ELEVATED_ROLES: AppRole[] = ['admin', 'employee', 'accountant'];

// Portal roles (strict isolation)
const PORTAL_ROLES: AppRole[] = ['driver', 'biker', 'ambassador', 'store', 'wholesaler', 'customer'];

export function useSecurityProtocol() {
  const { role, isAdmin, hasRole, loading } = useUserRole();

  /**
   * Check if user is the owner (highest privilege)
   */
  const isOwner = useCallback((): boolean => {
    return hasRole('owner' as AppRole);
  }, [hasRole]);

  /**
   * Check if user is a developer (UI only, no data)
   */
  const isDeveloper = useCallback((): boolean => {
    return hasRole('developer' as AppRole);
  }, [hasRole]);

  /**
   * Check if user has elevated access
   */
  const isElevatedUser = useMemo(() => {
    if (!role) return false;
    return ELEVATED_ROLES.includes(role) || role === 'owner';
  }, [role]);

  /**
   * Check if user is a portal user (strict isolation)
   */
  const isPortalUser = useMemo(() => {
    if (!role) return false;
    return PORTAL_ROLES.includes(role);
  }, [role]);

  /**
   * Check if user can access a specific table
   */
  const canAccessTable = useCallback((tableName: string): boolean => {
    // Developers can access NO tables
    if (isDeveloper()) return false;
    
    // Owners can access everything
    if (isOwner()) return true;
    
    // Admins can access admin tables but not owner-only
    if (isAdmin()) {
      return !OWNER_ONLY_TABLES.includes(tableName);
    }
    
    // Owner-only tables blocked for everyone else
    if (OWNER_ONLY_TABLES.includes(tableName)) {
      return false;
    }
    
    // Admin-only tables blocked for non-admins
    if (ADMIN_ONLY_TABLES.includes(tableName)) {
      return false;
    }
    
    // Elevated access tables
    if (ELEVATED_ACCESS_TABLES.includes(tableName)) {
      return isElevatedUser;
    }
    
    return true;
  }, [isAdmin, isOwner, isDeveloper, isElevatedUser]);

  /**
   * Check if user can perform destructive operations
   */
  const canPerformDestructiveAction = useCallback((): boolean => {
    if (isDeveloper()) return false;
    return isOwner() || isAdmin();
  }, [isAdmin, isOwner, isDeveloper]);

  /**
   * Check if user can access system settings
   */
  const canAccessSystemSettings = useCallback((): boolean => {
    if (isDeveloper()) return false;
    return isOwner() || isAdmin();
  }, [isAdmin, isOwner, isDeveloper]);

  /**
   * Check if user can manage other users
   */
  const canManageUsers = useCallback((): boolean => {
    if (isDeveloper()) return false;
    return isOwner() || isAdmin();
  }, [isAdmin, isOwner, isDeveloper]);

  /**
   * Check if user can view financial data
   */
  const canViewFinancials = useCallback((): boolean => {
    if (isDeveloper()) return false;
    if (!role) return false;
    return ['owner', 'admin', 'accountant', 'employee'].includes(role);
  }, [role, isDeveloper]);

  /**
   * Check if user can view owner-only financials
   */
  const canViewOwnerFinancials = useCallback((): boolean => {
    return isOwner();
  }, [isOwner]);

  /**
   * Check if user can export data
   */
  const canExportData = useCallback((): boolean => {
    if (isDeveloper()) return false;
    if (!role) return false;
    return ['owner', 'admin', 'accountant', 'employee'].includes(role);
  }, [role, isDeveloper]);

  /**
   * Check if user can access AI workforce controls
   */
  const canAccessAIWorkforce = useCallback((): boolean => {
    if (isDeveloper()) return false;
    return isOwner() || isElevatedUser;
  }, [isOwner, isElevatedUser, isDeveloper]);

  /**
   * Check if user can access AI core (owner only)
   */
  const canAccessAICore = useCallback((): boolean => {
    return isOwner();
  }, [isOwner]);

  /**
   * Get list of tables user can access
   */
  const getAccessibleTables = useCallback((): string[] => {
    if (isDeveloper()) return [];
    
    if (isOwner()) {
      return [...OWNER_ONLY_TABLES, ...ADMIN_ONLY_TABLES, ...ELEVATED_ACCESS_TABLES];
    }
    
    if (isAdmin()) {
      return [...ADMIN_ONLY_TABLES, ...ELEVATED_ACCESS_TABLES];
    }
    
    if (isElevatedUser) {
      return ELEVATED_ACCESS_TABLES;
    }
    
    return [];
  }, [isAdmin, isOwner, isDeveloper, isElevatedUser]);

  return {
    // State
    loading,
    role,
    isElevatedUser,
    isPortalUser,
    
    // Permission checks
    isOwner,
    isDeveloper,
    isAdmin,
    canAccessTable,
    canPerformDestructiveAction,
    canAccessSystemSettings,
    canManageUsers,
    canViewFinancials,
    canViewOwnerFinancials,
    canExportData,
    canAccessAIWorkforce,
    canAccessAICore,
    getAccessibleTables,
    
    // Constants
    OWNER_ONLY_TABLES,
    ADMIN_ONLY_TABLES,
    ELEVATED_ACCESS_TABLES,
    ELEVATED_ROLES,
    PORTAL_ROLES,
  };
}

export default useSecurityProtocol;
