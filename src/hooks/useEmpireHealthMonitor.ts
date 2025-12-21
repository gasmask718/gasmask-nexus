// 🧠 EMPIRE HEALTH MONITOR (EHM)
// Runs periodically, checking for:
// - Missing DB tables
// - Module diagnostics integrity
// - Route health
// - Sidebar consistency

import { useEffect, useState, useCallback } from 'react';
import { departmentRegistry } from '@/modules/RegisterDepartments';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';

export interface HealthCheckResult {
  timestamp: Date;
  status: 'healthy' | 'degraded' | 'critical';
  checks: {
    name: string;
    passed: boolean;
    message?: string;
  }[];
  moduleDiagnostics: {
    totalModules: number;
    enabledModules: number;
    totalRoutes: number;
    totalSidebarItems: number;
  };
}

const REQUIRED_TABLES = [
  'universal_orders',
  'universal_ledger',
  'universal_messages',
  'universal_activity',
  'audit_trail',
  'profiles',
  'user_roles',
  'orders',
  'stores',
];

export function useEmpireHealthMonitor(intervalMs = 300000) { // 5 minutes default
  const [lastCheck, setLastCheck] = useState<HealthCheckResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const { roles, loading } = useUserRole();
  
  // Memoize admin check to prevent dependency instability
  const isAdminUser = roles.includes('admin');

  const runHealthCheck = useCallback(async (): Promise<HealthCheckResult> => {
    console.log('🧠 Running Empire Health Scan...');
    setIsRunning(true);

    const checks: HealthCheckResult['checks'] = [];
    
    // Get module diagnostics
    const diagnostics = departmentRegistry.getDiagnostics();

    // Check required tables
    for (const table of REQUIRED_TABLES) {
      try {
        const { error } = await supabase.from(table as any).select('id').limit(1);
        checks.push({
          name: `Table: ${table}`,
          passed: !error,
          message: error ? `Missing or inaccessible: ${error.message}` : 'OK',
        });
        if (error) {
          console.warn(`⚠️ Table check failed: ${table}`, error.message);
        }
      } catch (err) {
        checks.push({
          name: `Table: ${table}`,
          passed: false,
          message: 'Error checking table',
        });
      }
    }

    // Check module health
    checks.push({
      name: 'Modules Registered',
      passed: diagnostics.totalModules > 0,
      message: `${diagnostics.totalModules} modules registered`,
    });

    checks.push({
      name: 'Routes Configured',
      passed: diagnostics.totalRoutes > 0,
      message: `${diagnostics.totalRoutes} routes configured`,
    });

    checks.push({
      name: 'Sidebar Items',
      passed: diagnostics.totalSidebarItems > 0,
      message: `${diagnostics.totalSidebarItems} sidebar items`,
    });

    // Determine overall status
    const failedChecks = checks.filter(c => !c.passed);
    let status: HealthCheckResult['status'] = 'healthy';
    if (failedChecks.length > 0 && failedChecks.length <= 2) {
      status = 'degraded';
    } else if (failedChecks.length > 2) {
      status = 'critical';
    }

    const result: HealthCheckResult = {
      timestamp: new Date(),
      status,
      checks,
      moduleDiagnostics: {
        totalModules: diagnostics.totalModules,
        enabledModules: diagnostics.enabledModules,
        totalRoutes: diagnostics.totalRoutes,
        totalSidebarItems: diagnostics.totalSidebarItems,
      },
    };

    console.log('🧠 Empire Health Scan Complete:', result);
    setLastCheck(result);
    setIsRunning(false);
    
    return result;
  }, []);

  useEffect(() => {
    // Wait for role loading to complete and only run for admin users
    if (loading || !isAdminUser) return;
    
    // Only run initial check once
    if (!hasInitialized) {
      runHealthCheck();
      setHasInitialized(true);
    }

    // Set up interval for periodic checks
    const interval = setInterval(() => {
      runHealthCheck();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [loading, isAdminUser, intervalMs, runHealthCheck, hasInitialized]);

  return {
    lastCheck,
    isRunning,
    runHealthCheck,
  };
}

export default useEmpireHealthMonitor;
