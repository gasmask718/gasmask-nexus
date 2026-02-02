/**
 * useQAScanner - Core hook for QA Command Center
 * 
 * Scans routes, actions, and data health across Floors 1-9
 */
import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FLOOR_REGISTRY, FloorModule } from '@/lib/qa/floorRegistry';

export interface RouteIssue {
  id: string;
  floor: string;
  pageName: string;
  path: string;
  componentFile: string;
  status: 'ok' | '404' | 'dead_actions' | 'empty_shell' | 'rls_denied' | 'api_error' | 'crash';
  severity: 'P0' | 'P1' | 'P2';
  lastError?: string;
  category: string;
}

export interface ActionIssue {
  id: string;
  floor: string;
  pageName: string;
  path: string;
  actionLabel: string;
  actionType: 'button' | 'link' | 'menu';
  status: 'wired' | 'disabled_intentional' | 'missing_wiring';
  severity: 'P0' | 'P1' | 'P2';
  componentFile: string;
}

export interface DataHealthIssue {
  id: string;
  floor: string;
  tableName: string;
  status: 'ok' | 'connection_failed' | 'table_missing' | 'rls_denied' | 'column_missing';
  severity: 'P0' | 'P1' | 'P2';
  error?: string;
}

export interface QAScanResults {
  routeIssues: RouteIssue[];
  actionIssues: ActionIssue[];
  dataHealthIssues: DataHealthIssue[];
  floorSummaries: FloorSummary[];
  timestamp: string;
}

export interface FloorSummary {
  floorId: string;
  floorName: string;
  totalPages: number;
  pagesOk: number;
  pagesWithIssues: number;
  p0Count: number;
  p1Count: number;
  p2Count: number;
  status: 'healthy' | 'warning' | 'critical';
}

export function useQAScanner() {
  const [scanResults, setScanResults] = useState<QAScanResults | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);

  // Compute P0/P1/P2 counts
  const { p0Count, p1Count, p2Count } = useMemo(() => {
    if (!scanResults) return { p0Count: 0, p1Count: 0, p2Count: 0 };
    
    const allIssues = [
      ...scanResults.routeIssues,
      ...scanResults.actionIssues,
      ...scanResults.dataHealthIssues,
    ];

    return {
      p0Count: allIssues.filter(i => i.severity === 'P0').length,
      p1Count: allIssues.filter(i => i.severity === 'P1').length,
      p2Count: allIssues.filter(i => i.severity === 'P2').length,
    };
  }, [scanResults]);

  // Scan route registry
  const scanRoutes = useCallback(async (): Promise<RouteIssue[]> => {
    const issues: RouteIssue[] = [];

    for (const floor of FLOOR_REGISTRY) {
      for (const module of floor.modules) {
        // Check if route exists and is accessible
        const issue: RouteIssue = {
          id: `route-${module.path.replace(/\//g, '-')}`,
          floor: floor.name,
          pageName: module.name,
          path: module.path,
          componentFile: module.componentFile || 'Unknown',
          status: 'ok',
          severity: 'P2',
          category: module.category || 'general',
        };

        // Check for known problem patterns
        if (module.isPlaceholder) {
          issue.status = 'empty_shell';
          issue.severity = 'P1';
          issue.lastError = 'Page is a placeholder without real content';
        }

        if (module.hasDeadActions) {
          issue.status = 'dead_actions';
          issue.severity = 'P0';
          issue.lastError = 'Page contains unconnected action buttons';
        }

        if (module.requiresAuth && !module.hasAuthCheck) {
          issue.status = 'rls_denied';
          issue.severity = 'P0';
          issue.lastError = 'Protected route missing auth verification';
        }

        // Only add if there's an issue
        if (issue.status !== 'ok') {
          issues.push(issue);
        }
      }
    }

    return issues;
  }, []);

  // Scan action wiring
  const scanActions = useCallback(async (): Promise<ActionIssue[]> => {
    const issues: ActionIssue[] = [];

    for (const floor of FLOOR_REGISTRY) {
      for (const module of floor.modules) {
        if (module.knownDeadActions) {
          for (const action of module.knownDeadActions) {
            issues.push({
              id: `action-${module.path}-${action.label}`.replace(/\s/g, '-'),
              floor: floor.name,
              pageName: module.name,
              path: module.path,
              actionLabel: action.label,
              actionType: action.type as 'button' | 'link' | 'menu',
              status: 'missing_wiring',
              severity: 'P0',
              componentFile: module.componentFile || 'Unknown',
            });
          }
        }
      }
    }

    return issues;
  }, []);

  // Scan data health
  const scanDataHealth = useCallback(async (): Promise<DataHealthIssue[]> => {
    const issues: DataHealthIssue[] = [];
    
    // Core tables to check per floor
    const floorTables: Record<string, string[]> = {
      'Floor 1': ['store_master', 'contacts', 'crm_businesses', 'follow_ups'],
      'Floor 2': ['ai_call_logs', 'ai_call_campaigns', 'communication_logs'],
      'Floor 3': ['inventory', 'products', 'suppliers', 'purchase_orders'],
      'Floor 4': ['routes', 'route_stops', 'deliveries', 'bikers'],
      'Floor 5': ['invoices', 'payroll_records', 'accounting_ledger'],
      'Floor 6': ['production_batches', 'production_work_orders'],
    };

    for (const [floor, tables] of Object.entries(floorTables)) {
      for (const table of tables) {
        try {
          const { data, error } = await supabase
            .from(table as any)
            .select('id')
            .limit(1);

          if (error) {
            issues.push({
              id: `data-${floor}-${table}`,
              floor,
              tableName: table,
              status: error.code === 'PGRST301' ? 'rls_denied' : 'connection_failed',
              severity: 'P0',
              error: error.message,
            });
          }
        } catch (err: any) {
          issues.push({
            id: `data-${floor}-${table}`,
            floor,
            tableName: table,
            status: 'table_missing',
            severity: 'P1',
            error: err.message,
          });
        }
      }
    }

    return issues;
  }, []);

  // Generate floor summaries
  const generateFloorSummaries = useCallback((
    routeIssues: RouteIssue[],
    actionIssues: ActionIssue[],
    dataIssues: DataHealthIssue[]
  ): FloorSummary[] => {
    return FLOOR_REGISTRY.map(floor => {
      const floorRouteIssues = routeIssues.filter(i => i.floor === floor.name);
      const floorActionIssues = actionIssues.filter(i => i.floor === floor.name);
      const floorDataIssues = dataIssues.filter(i => i.floor === floor.name);
      
      const allFloorIssues = [...floorRouteIssues, ...floorActionIssues, ...floorDataIssues];
      const p0 = allFloorIssues.filter(i => i.severity === 'P0').length;
      const p1 = allFloorIssues.filter(i => i.severity === 'P1').length;
      const p2 = allFloorIssues.filter(i => i.severity === 'P2').length;

      return {
        floorId: floor.id,
        floorName: floor.name,
        totalPages: floor.modules.length,
        pagesOk: floor.modules.length - floorRouteIssues.length,
        pagesWithIssues: floorRouteIssues.length,
        p0Count: p0,
        p1Count: p1,
        p2Count: p2,
        status: p0 > 0 ? 'critical' : p1 > 0 ? 'warning' : 'healthy',
      };
    });
  }, []);

  // Run full scan
  const runFullScan = useCallback(async () => {
    setIsScanning(true);
    
    try {
      const [routeIssues, actionIssues, dataHealthIssues] = await Promise.all([
        scanRoutes(),
        scanActions(),
        scanDataHealth(),
      ]);

      const floorSummaries = generateFloorSummaries(routeIssues, actionIssues, dataHealthIssues);
      
      const results: QAScanResults = {
        routeIssues,
        actionIssues,
        dataHealthIssues,
        floorSummaries,
        timestamp: new Date().toISOString(),
      };

      setScanResults(results);
      setLastScanTime(results.timestamp);
    } catch (error) {
      console.error('[QA Scanner] Error during scan:', error);
    } finally {
      setIsScanning(false);
    }
  }, [scanRoutes, scanActions, scanDataHealth, generateFloorSummaries]);

  return {
    scanResults,
    isScanning,
    runFullScan,
    p0Count,
    p1Count,
    p2Count,
    lastScanTime,
  };
}
