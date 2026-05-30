import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  useSentinelStatus,
  useActiveBaseline,
  useSentinelEvaluations,
  useDriftEvents,
  useContainmentActions,
  useRunSentinelEvaluation,
  useCreateBaseline,
  useCertifyBaseline,
  useActivateBaseline,
  useRestoreFromContainment,
  useComplianceBaselines
} from "@/hooks/useComplianceSentinel";
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Activity,
  RefreshCw,
  Clock,
  Zap,
  Lock,
  Unlock,
  TrendingDown,
  TrendingUp,
  Eye,
  FileCheck,
  Play
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface Props {
  businessId: string | null;
}

export function SentinelDashboard({ businessId }: Props) {
  const { data: status, isLoading: statusLoading } = useSentinelStatus(businessId);
  const { data: activeBaseline } = useActiveBaseline(businessId);
  const { data: baselines } = useComplianceBaselines(businessId);
  const { data: evaluations } = useSentinelEvaluations(businessId, 10);
  const { data: driftEvents } = useDriftEvents(businessId, true);
  const { data: containmentActions } = useContainmentActions(businessId, true);
  
  const runEvaluation = useRunSentinelEvaluation();
  const createBaseline = useCreateBaseline();
  const certifyBaseline = useCertifyBaseline();
  const activateBaseline = useActivateBaseline();
  const restoreContainment = useRestoreFromContainment();

  const getComplianceStateColor = (state: string) => {
    switch (state) {
      case 'compliant': return 'text-green-500 bg-green-500/10 border-green-500';
      case 'warning': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500';
      case 'degraded': return 'text-orange-500 bg-orange-500/10 border-orange-500';
      case 'halted': return 'text-red-500 bg-red-500/10 border-red-500';
      default: return 'text-muted-foreground bg-muted border-muted';
    }
  };

  const getComplianceStateIcon = (state: string) => {
    switch (state) {
      case 'compliant': return <CheckCircle2 className="h-8 w-8 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-8 w-8 text-yellow-500" />;
      case 'degraded': return <TrendingDown className="h-8 w-8 text-orange-500" />;
      case 'halted': return <XCircle className="h-8 w-8 text-red-500" />;
      default: return <Activity className="h-8 w-8 text-muted-foreground" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return <Badge variant="destructive">Critical</Badge>;
      case 'warning': return <Badge className="bg-yellow-500">Warning</Badge>;
      case 'info': return <Badge variant="secondary">Info</Badge>;
      default: return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const handleCreateAndActivateBaseline = async () => {
    if (!businessId) return;
    
    // Create baseline from canonical data
    await createBaseline.mutateAsync({
      businessId,
      baselineName: "Canonical Baseline",
      thresholds: {
        min_permission_rate: 99.0,
        max_kill_switch_latency_ms: 100,
        max_confidence_breach_rate: 1.0,
        max_human_takeover_latency_ms: 5000,
        max_unapproved_technique_count: 0,
        min_audit_completeness_rate: 99.0,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Eye className="h-6 w-6" />
            Compliance Sentinel
          </h2>
          <p className="text-muted-foreground">
            Continuous drift detection and auto-containment
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => businessId && runEvaluation.mutate({ businessId })}
            disabled={runEvaluation.isPending || !activeBaseline}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${runEvaluation.isPending ? 'animate-spin' : ''}`} />
            Run Evaluation
          </Button>
        </div>
      </div>

      {/* Main Status Banner */}
      <Card className={`border-2 ${getComplianceStateColor(status?.compliance_state || 'unknown')}`}>
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`h-16 w-16 rounded-full flex items-center justify-center ${
                getComplianceStateColor(status?.compliance_state || 'unknown').replace('text-', 'bg-').replace('/10', '/20')
              }`}>
                {getComplianceStateIcon(status?.compliance_state || 'unknown')}
              </div>
              <div>
                <div className="text-2xl font-bold capitalize">
                  {status?.compliance_state === 'compliant' ? 'System Compliant' :
                   status?.compliance_state === 'degraded' ? 'System Degraded' :
                   status?.compliance_state === 'halted' ? 'AI Halted' :
                   status?.compliance_state === 'warning' ? 'Warning Active' :
                   'Status Unknown'}
                </div>
                <div className="text-muted-foreground flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Last evaluation: {status?.last_evaluation_at 
                      ? formatDistanceToNow(new Date(status.last_evaluation_at), { addSuffix: true })
                      : 'Never'}
                  </span>
                  {status?.sentinel_enabled ? (
                    <Badge variant="outline" className="text-green-500 border-green-500">
                      <Shield className="h-3 w-3 mr-1" /> Sentinel Active
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" /> Sentinel Disabled
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            <div className="text-right space-y-1">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Active Drifts</div>
                  <div className={`text-2xl font-bold ${
                    (status?.active_drift_count || 0) === 0 ? 'text-green-500' : 'text-orange-500'
                  }`}>
                    {status?.active_drift_count || 0}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Critical</div>
                  <div className={`text-2xl font-bold ${
                    (status?.active_critical_count || 0) === 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {status?.active_critical_count || 0}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Warnings</div>
                  <div className={`text-2xl font-bold ${
                    (status?.active_warning_count || 0) === 0 ? 'text-green-500' : 'text-yellow-500'
                  }`}>
                    {status?.active_warning_count || 0}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Containment Banner */}
          {status?.is_contained && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Lock className="h-5 w-5 text-red-500" />
                  <div>
                    <div className="font-medium text-red-500">Auto-Containment Active</div>
                    <div className="text-sm text-muted-foreground">
                      AI downgraded to <span className="font-mono">{status.containment_level}</span> mode
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {status.containment_reason}
                    </div>
                  </div>
                </div>
                {containmentActions?.[0] && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => restoreContainment.mutate({
                      actionId: containmentActions[0].id,
                      restoredBy: "admin",
                      approvedBy: "admin",
                    })}
                    disabled={restoreContainment.isPending}
                  >
                    <Unlock className="h-4 w-4 mr-2" />
                    Restore (Requires Approval)
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* No Baseline Warning */}
      {!activeBaseline && (
        <Card className="border-2 border-dashed border-yellow-500/50">
          <CardContent className="py-8 text-center">
            <FileCheck className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Active Baseline</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Create and certify a compliance baseline to enable drift detection.
            </p>
            <Button
              onClick={handleCreateAndActivateBaseline}
              disabled={createBaseline.isPending}
            >
              <Play className="h-4 w-4 mr-2" />
              {createBaseline.isPending ? 'Creating...' : 'Create Canonical Baseline'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Active Baseline Info */}
      {activeBaseline && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Active Baseline: {activeBaseline.baseline_name}
            </CardTitle>
            <CardDescription>
              Version {activeBaseline.baseline_version} • 
              {activeBaseline.is_regulator_grade && " Regulator Grade • "}
              Certified {activeBaseline.certified_at 
                ? formatDistanceToNow(new Date(activeBaseline.certified_at), { addSuffix: true })
                : 'Not certified'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-xs text-muted-foreground">Min Permission Rate</div>
                <div className="text-lg font-bold">{activeBaseline.min_permission_rate}%</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-xs text-muted-foreground">Max Kill Switch Latency</div>
                <div className="text-lg font-bold">{activeBaseline.max_kill_switch_latency_ms}ms</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-xs text-muted-foreground">Max Breach Rate</div>
                <div className="text-lg font-bold">{activeBaseline.max_confidence_breach_rate}%</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-xs text-muted-foreground">Max Takeover Latency</div>
                <div className="text-lg font-bold">{activeBaseline.max_human_takeover_latency_ms}ms</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-xs text-muted-foreground">Unapproved Techniques</div>
                <div className="text-lg font-bold text-green-500">{activeBaseline.max_unapproved_technique_count}</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-xs text-muted-foreground">Min Audit Complete</div>
                <div className="text-lg font-bold">{activeBaseline.min_audit_completeness_rate}%</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="drifts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="drifts" className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Active Drifts ({driftEvents?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="evaluations" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Evaluations
          </TabsTrigger>
          <TabsTrigger value="containment" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Containment Log
          </TabsTrigger>
          <TabsTrigger value="baselines" className="flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            Baselines
          </TabsTrigger>
        </TabsList>

        <TabsContent value="drifts">
          <Card>
            <CardHeader>
              <CardTitle>Active Drift Events</CardTitle>
              <CardDescription>Unresolved deviations from baseline thresholds</CardDescription>
            </CardHeader>
            <CardContent>
              {!driftEvents?.length ? (
                <div className="text-center py-8 text-green-500 flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-8 w-8" />
                  <span>No active drifts - system within baseline thresholds</span>
                </div>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {driftEvents.map(event => (
                      <div
                        key={event.id}
                        className={`p-4 rounded-lg border-2 ${
                          event.severity === 'critical' ? 'border-red-500 bg-red-500/10' :
                          event.severity === 'warning' ? 'border-yellow-500 bg-yellow-500/10' :
                          'border-muted'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              {getSeverityBadge(event.severity)}
                              <span className="font-medium">{event.drift_type.replace(/_/g, ' ')}</span>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {event.metric_name}: {event.current_value?.toFixed(2)} 
                              {event.drift_direction === 'above_threshold' ? ' > ' : ' < '}
                              {event.baseline_value?.toFixed(2)} (baseline)
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Deviation: {event.deviation_percentage?.toFixed(1)}% • 
                              First detected {formatDistanceToNow(new Date(event.first_detected_at), { addSuffix: true })}
                            </div>
                          </div>
                          {event.triggered_containment && (
                            <Badge variant="destructive">
                              <Lock className="h-3 w-3 mr-1" /> Triggered Containment
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evaluations">
          <Card>
            <CardHeader>
              <CardTitle>Recent Evaluations</CardTitle>
              <CardDescription>Hash-chained evaluation history</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {evaluations?.map((evaluation, idx) => (
                    <div
                      key={evaluation.id}
                      className="p-3 rounded-lg border flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-3 w-3 rounded-full ${
                          evaluation.status === 'passed' ? 'bg-green-500' :
                          evaluation.status === 'warning' ? 'bg-yellow-500' :
                          evaluation.status === 'critical' ? 'bg-red-500' :
                          'bg-muted'
                        }`} />
                        <div>
                          <div className="font-medium capitalize">{evaluation.status}</div>
                          <div className="text-xs text-muted-foreground">
                            {evaluation.evaluation_type} • 
                            {evaluation.completed_at 
                              ? format(new Date(evaluation.completed_at), 'MMM d, yyyy HH:mm:ss')
                              : 'Running...'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-mono text-xs text-muted-foreground">
                          {evaluation.drift_count} drifts
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {evaluation.duration_ms}ms
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="containment">
          <Card>
            <CardHeader>
              <CardTitle>Containment Actions</CardTitle>
              <CardDescription>Immutable log of auto-containment events</CardDescription>
            </CardHeader>
            <CardContent>
              {!containmentActions?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  No containment actions recorded
                </div>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {containmentActions.map(action => (
                      <div
                        key={action.id}
                        className="p-4 rounded-lg border-2 border-red-500/50 bg-red-500/5"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="destructive">{action.action_type}</Badge>
                              {action.restored_at ? (
                                <Badge variant="outline" className="text-green-500 border-green-500">
                                  Restored
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Active</Badge>
                              )}
                            </div>
                            <div className="text-sm mt-2">{action.action_reason}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {action.previous_mode} → {action.new_mode} • 
                              {format(new Date(action.executed_at), 'MMM d, yyyy HH:mm:ss')}
                            </div>
                          </div>
                          <div className="text-right text-xs font-mono text-muted-foreground">
                            {action.action_hash?.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="baselines">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Compliance Baselines</CardTitle>
                  <CardDescription>Certified reference points for drift detection</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCreateAndActivateBaseline}
                  disabled={createBaseline.isPending}
                >
                  Create New Baseline
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {baselines?.map(baseline => (
                    <div
                      key={baseline.id}
                      className={`p-4 rounded-lg border ${
                        baseline.is_active ? 'border-green-500 bg-green-500/5' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{baseline.baseline_name}</span>
                            <Badge variant="outline">v{baseline.baseline_version}</Badge>
                            {baseline.is_active && (
                              <Badge className="bg-green-500">Active</Badge>
                            )}
                            {baseline.is_regulator_grade && (
                              <Badge variant="secondary">Regulator Grade</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {baseline.certified_at 
                              ? `Certified ${format(new Date(baseline.certified_at), 'MMM d, yyyy')}`
                              : 'Not certified'}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {!baseline.certified_at && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => certifyBaseline.mutate({
                                baselineId: baseline.id,
                                certifiedBy: "admin",
                                isRegulatorGrade: true,
                              })}
                            >
                              Certify
                            </Button>
                          )}
                          {baseline.certified_at && !baseline.is_active && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => activateBaseline.mutate({ baselineId: baseline.id })}
                            >
                              Activate
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
