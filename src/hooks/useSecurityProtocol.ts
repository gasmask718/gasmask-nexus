/**
 * Dynasty OS Security Protocol Hook
 * Centralized security checks for the entire application
 */

import { useCallback, useMemo } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { AppRole } from '@/utils/roleRouting';

// Sensitive tables that require admin access
const ADMIN_ONLY_TABLES = [
  'user_roles',
  'audit_logs',
  'audit_log',
  'system_checkpoints',
  'api_clients',
  'va_permissions',
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

export function useSecurityProtocol() {
  const { role, isAdmin, hasRole, loading } = useUserRole();

  /**
   * Check if user has elevated access
   */
  const isElevatedUser = useMemo(() => {
    if (!role) return false;
    return ELEVATED_ROLES.includes(role);
  }, [role]);

  /**
   * Check if user can access a specific table
   */
  const canAccessTable = useCallback((tableName: string): boolean => {
    if (isAdmin()) return true;
    
    if (ADMIN_ONLY_TABLES.includes(tableName)) {
      return false;
    }
    
    if (ELEVATED_ACCESS_TABLES.includes(tableName)) {
      return isElevatedUser;
    }
    
    return true;
  }, [isAdmin, isElevatedUser]);

  /**
   * Check if user can perform destructive operations
   */
  const canPerformDestructiveAction = useCallback((): boolean => {
    return isAdmin();
  }, [isAdmin]);

  /**
   * Check if user can access system settings
   */
  const canAccessSystemSettings = useCallback((): boolean => {
    return isAdmin();
  }, [isAdmin]);

  /**
   * Check if user can manage other users
   */
  const canManageUsers = useCallback((): boolean => {
    return isAdmin();
  }, [isAdmin]);

  /**
   * Check if user can view financial data
   */
  const canViewFinancials = useCallback((): boolean => {
    if (!role) return false;
    return ['admin', 'accountant', 'employee'].includes(role);
  }, [role]);

  /**
   * Check if user can export data
   */
  const canExportData = useCallback((): boolean => {
    if (!role) return false;
    return ['admin', 'accountant', 'employee'].includes(role);
  }, [role]);

  /**
   * Check if user can access AI workforce controls
   */
  const canAccessAIWorkforce = useCallback((): boolean => {
    return isElevatedUser;
  }, [isElevatedUser]);

  /**
   * Get list of tables user can access
   */
  const getAccessibleTables = useCallback((): string[] => {
    if (isAdmin()) {
      return [...ADMIN_ONLY_TABLES, ...ELEVATED_ACCESS_TABLES];
    }
    
    if (isElevatedUser) {
      return ELEVATED_ACCESS_TABLES;
    }
    
    return [];
  }, [isAdmin, isElevatedUser]);

  return {
    // State
    loading,
    role,
    isElevatedUser,
    
    // Permission checks
    isAdmin,
    canAccessTable,
    canPerformDestructiveAction,
    canAccessSystemSettings,
    canManageUsers,
    canViewFinancials,
    canExportData,
    canAccessAIWorkforce,
    getAccessibleTables,
    
    // Constants
    ADMIN_ONLY_TABLES,
    ELEVATED_ACCESS_TABLES,
    ELEVATED_ROLES,
  };
}

export default useSecurityProtocol;
