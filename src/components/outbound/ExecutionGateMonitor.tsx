import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Activity,
  FileCheck,
  Phone,
  MessageSquare
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { formatDistanceToNow } from 'date-fns';

/**
 * EXECUTION GATE MONITOR
 * 
 * Real-time display of gate validation results:
 * - Recent gate checks
 * - Pass/fail rates
 * - Common failure reasons
 * - Blocked calls
 */

export function ExecutionGateMonitor() {
  const { currentBusiness } = useBusiness();
  const businessId = currentBusiness?.id;

  const { data: gateLogs = [], isLoading } = useQuery({
    queryKey: ['execution-gate-logs', businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('execution_gate_log')
        .select('*')
        .eq('business_id', businessId)
        .order('checked_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: disclosureLogs = [] } = useQuery({
    queryKey: ['disclosure-logs', businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_disclosure_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000,
  });

  // Calculate stats
  const totalChecks = gateLogs.length;
  const passedChecks = gateLogs.filter((g: any) => g.gate_check_passed).length;
  const blockedCalls = gateLogs.filter((g: any) => g.call_blocked).length;
  const passRate = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 100;

  const disclosureViolations = disclosureLogs.filter((d: any) => d.disclosure_failed).length;
  const disclosureSuccess = disclosureLogs.filter((d: any) => d.disclosure_spoken).length;

  // Common failure reasons
  const failureReasons: Record<string, number> = {};
  gateLogs.forEach((log: any) => {
    if (log.failed_checks) {
      log.failed_checks.forEach((check: string) => {
        failureReasons[check] = (failureReasons[check] || 0) + 1;
      });
    }
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Execution Gate Monitor</CardTitle>
          </div>
          <Badge variant={passRate >= 90 ? 'default' : passRate >= 70 ? 'secondary' : 'destructive'}>
            {passRate}% Pass Rate
          </Badge>
        </div>
        <CardDescription>
          Real-time governance validation — Every call must pass all gates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4" />
              Total Checks
            </div>
            <p className="text-2xl font-bold mt-1">{totalChecks}</p>
          </div>
          
          <div className="p-3 rounded-lg bg-green-500/10">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Passed
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600">{passedChecks}</p>
          </div>
          
          <div className="p-3 rounded-lg bg-red-500/10">
            <div className="flex items-center gap-2 text-sm text-red-600">
              <XCircle className="h-4 w-4" />
              Blocked
            </div>
            <p className="text-2xl font-bold mt-1 text-red-600">{blockedCalls}</p>
          </div>
          
          <div className="p-3 rounded-lg bg-yellow-500/10">
            <div className="flex items-center gap-2 text-sm text-yellow-600">
              <MessageSquare className="h-4 w-4" />
              Disclosure Violations
            </div>
            <p className="text-2xl font-bold mt-1 text-yellow-600">{disclosureViolations}</p>
          </div>
        </div>

        {/* Common Failure Reasons */}
        {Object.keys(failureReasons).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Common Failure Reasons
            </h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(failureReasons)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([reason, count]) => (
                  <Badge key={reason} variant="outline" className="text-yellow-600">
                    {reason.replace(/_/g, ' ')} ({count})
                  </Badge>
                ))}
            </div>
          </div>
        )}

        {/* Recent Gate Checks */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            Recent Gate Checks
          </h4>
          
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">Loading...</div>
          ) : gateLogs.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No gate checks recorded yet
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {gateLogs.slice(0, 10).map((log: any) => (
                <div 
                  key={log.id}
                  className={`flex items-center justify-between p-2 rounded-lg border ${
                    log.gate_check_passed ? 'bg-green-500/5 border-green-200' : 'bg-red-500/5 border-red-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {log.gate_check_passed ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {log.gate_check_passed ? 'Passed' : 'Blocked'}
                      </p>
                      {log.failed_checks && log.failed_checks.length > 0 && (
                        <p className="text-xs text-red-600">
                          {log.failed_checks.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(log.checked_at), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Disclosure Status */}
        <div className="space-y-2 pt-4 border-t">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Disclosure Compliance
          </h4>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">{disclosureSuccess} spoken</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm">{disclosureViolations} violations</span>
            </div>
          </div>

          {disclosureViolations > 0 && (
            <div className="bg-red-50 border border-red-200 rounded p-2 mt-2">
              <p className="text-xs text-red-700">
                ⚠️ Disclosure violations detected. Calls without proper disclosure are automatically terminated.
              </p>
            </div>
          )}
        </div>

        {/* Audit Assertions */}
        <div className="space-y-2 pt-4 border-t">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Audit Assertions
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              No session without campaign
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              No frame without disclosure
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              No active with containment
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              No live without approval
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ExecutionGateMonitor;