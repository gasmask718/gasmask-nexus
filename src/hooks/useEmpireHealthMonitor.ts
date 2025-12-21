// 🧠 EMPIRE HEALTH MONITOR (EHM)
// Runs ONCE on app load for admin users only
// Can be manually triggered via runHealthCheck()

import { useEffect, useState, useCallback, useRef } from 'react';
import { departmentRegistry } from '@/modules/RegisterDepartments';
import { supabase } from '@/integrations/supabase/client';

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

// Module-level singleton to prevent multiple instances from running
let globalHasRun = false;
let globalLastCheck: HealthCheckResult | null = null;

export function useEmpireHealthMonitor() {
  const [lastCheck, setLastCheck] = useState<HealthCheckResult | null>(globalLastCheck);
  const [isRunning, setIsRunning] = useState(false);
  const hasRunRef = useRef(false);

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
    globalLastCheck = result;
    setLastCheck(result);
    setIsRunning(false);
    
    return result;
  }, []);

  useEffect(() => {
    // Use both ref and module-level flag to prevent duplicate runs
    if (hasRunRef.current || globalHasRun) {
      return;
    }

    // Mark as run immediately to prevent race conditions
    hasRunRef.current = true;
    globalHasRun = true;

    // Run health check once on mount
    runHealthCheck();

    // No interval - only manual refresh allowed
    // No cleanup needed since we don't set up any subscriptions
  }, [runHealthCheck]);

  return {
    lastCheck,
    isRunning,
    runHealthCheck,
  };
}

export default useEmpireHealthMonitor;
