// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 5: AUTONOMY CONSOLE
// Command center for proposal queue, execution ledger, policy, and rollback
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Check, X, RotateCcw, AlertTriangle, Shield, Clock, 
  Zap, Settings, ListChecks, History, Brain, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import {
  useOpenProposals,
  useProposals,
  useExecutions,
  useAutonomyPolicy,
  useApproveProposal,
  useRejectProposal,
  useExecuteProposal,
  useRollbackExecution,
  useUpdatePolicy,
  validateProposalAgainstPolicy,
  type DispatchProposal,
  type DispatchExecution,
  type AutonomyPolicy,
} from "@/hooks/useAutonomyEngine";

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function AutonomyConsole() {
  const [activeTab, setActiveTab] = useState("queue");
  const { data: policy } = useAutonomyPolicy();

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Brain className="h-8 w-8 text-primary" />
              Autonomy Console
            </h1>
            <p className="text-muted-foreground">
              Phase 5: Assisted autonomy with human approval
            </p>
          </div>
          
          {policy?.simulation_only && (
            <Badge variant="outline" className="text-lg px-4 py-2 bg-purple-500/10 text-purple-500 border-purple-500/50">
              <Zap className="h-4 w-4 mr-2" />
              Simulation Mode
            </Badge>
          )}
        </div>

        {/* Simulation Warning */}
        {policy?.simulation_only && (
          <Alert className="border-purple-500/50 bg-purple-500/10">
            <AlertTriangle className="h-4 w-4 text-purple-500" />
            <AlertTitle className="text-purple-500">Simulation Mode Active</AlertTitle>
            <AlertDescription className="text-purple-400">
              Proposals can be generated and approved, but execution is disabled. 
              Enable live mode in Policy settings to allow real actions.
            </AlertDescription>
          </Alert>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full max-w-xl">
            <TabsTrigger value="queue" className="gap-2">
              <ListChecks className="h-4 w-4" />
              Queue
            </TabsTrigger>
            <TabsTrigger value="ledger" className="gap-2">
              <History className="h-4 w-4" />
              Ledger
            </TabsTrigger>
            <TabsTrigger value="rollback" className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Rollback
            </TabsTrigger>
            <TabsTrigger value="policy" className="gap-2">
              <Settings className="h-4 w-4" />
              Policy
            </TabsTrigger>
          </TabsList>

          <TabsContent value="queue">
            <ProposalQueue policy={policy} />
          </TabsContent>

          <TabsContent value="ledger">
            <ExecutionLedger />
          </TabsContent>

          <TabsContent value="rollback">
            <RollbackPanel />
          </TabsContent>

          <TabsContent value="policy">
            <PolicyPanel policy={policy} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROPOSAL QUEUE
// ═══════════════════════════════════════════════════════════════════════════════

function ProposalQueue({ policy }: { policy?: AutonomyPolicy }) {
  const { data: proposals, isLoading, refetch } = useOpenProposals();
  const approveProposal = useApproveProposal();
  const rejectProposal = useRejectProposal();
  const executeProposal = useExecuteProposal();

  const handleApproveAndExecute = async (proposal: DispatchProposal) => {
    if (policy?.simulation_only) {
      await approveProposal.mutateAsync(proposal.id);
      return;
    }

    // Validate against policy
    if (policy) {
      const validation = validateProposalAgainstPolicy(proposal, policy);
      if (!validation.valid) {
        return;
      }
    }

    // Approve first
    await approveProposal.mutateAsync(proposal.id);

    // Then execute (simplified - real implementation would capture state)
    await executeProposal.mutateAsync({
      proposalId: proposal.id,
      beforeState: { snapshot: 'before' },
      afterState: { snapshot: 'after' },
      rollbackPayload: { undo: proposal.proposed_payload },
    });
  };

  const priorityColors = {
    critical: 'bg-red-500/20 text-red-500 border-red-500/50',
    high: 'bg-orange-500/20 text-orange-500 border-orange-500/50',
    medium: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/50',
    low: 'bg-blue-500/20 text-blue-500 border-blue-500/50',
  };

  const typeLabels: Record<string, string> = {
    split_route: 'Split Route',
    reassign_stop: 'Reassign Stop',
    add_support_worker: 'Add Support',
    resequence_stops: 'Resequence',
    pause_route: 'Pause Route',
    ping_worker: 'Ping Worker',
  };

  if (isLoading) {
    return <Card className="p-8 text-center text-muted-foreground">Loading proposals...</Card>;
  }

  if (!proposals?.length) {
    return (
      <Card className="p-8 text-center">
        <Shield className="h-12 w-12 mx-auto text-green-500 mb-4" />
        <p className="text-lg font-medium">No pending proposals</p>
        <p className="text-muted-foreground">All systems nominal</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Proposal Queue</CardTitle>
          <CardDescription>{proposals.length} pending proposals</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <div className="space-y-3">
            {proposals.map((proposal) => {
              const validation = policy ? validateProposalAgainstPolicy(proposal, policy) : { valid: true };
              
              return (
                <div
                  key={proposal.id}
                  className={cn(
                    "p-4 rounded-lg border bg-card transition-colors",
                    !validation.valid && "border-red-500/30 bg-red-500/5"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={priorityColors[proposal.priority]}>
                          {proposal.priority.toUpperCase()}
                        </Badge>
                        <Badge variant="secondary">
                          {typeLabels[proposal.proposal_type] || proposal.proposal_type}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {(proposal.confidence * 100).toFixed(0)}% confidence
                        </span>
                      </div>
                      
                      <p className="text-sm">{proposal.reason}</p>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(proposal.created_at), { addSuffix: true })}
                        </span>
                        {proposal.territory && <span>Territory: {proposal.territory}</span>}
                      </div>

                      {!validation.valid && (
                        <p className="text-xs text-red-400 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {validation.reason}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rejectProposal.mutate(proposal.id)}
                        disabled={rejectProposal.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApproveAndExecute(proposal)}
                        disabled={!validation.valid || approveProposal.isPending}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        {policy?.simulation_only ? 'Approve' : 'Execute'}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTION LEDGER
// ═══════════════════════════════════════════════════════════════════════════════

function ExecutionLedger() {
  const { data: executions, isLoading } = useExecutions();
  const { data: allProposals } = useProposals();

  const executionStatusColors = {
    success: 'bg-green-500/20 text-green-500',
    partial: 'bg-yellow-500/20 text-yellow-600',
    failed: 'bg-red-500/20 text-red-500',
  };

  if (isLoading) {
    return <Card className="p-8 text-center text-muted-foreground">Loading execution history...</Card>;
  }

  if (!executions?.length) {
    return (
      <Card className="p-8 text-center">
        <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-lg font-medium">No executions yet</p>
        <p className="text-muted-foreground">Approved proposals will appear here after execution</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Execution Ledger</CardTitle>
        <CardDescription>Complete audit trail of all executed actions</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <div className="space-y-3">
            {executions.map((execution) => {
              const proposal = allProposals?.find(p => p.id === execution.proposal_id);
              
              return (
                <div key={execution.id} className="p-4 rounded-lg border bg-card">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge className={executionStatusColors[execution.execution_status]}>
                          {execution.execution_status.toUpperCase()}
                        </Badge>
                        {execution.rolled_back_at && (
                          <Badge variant="outline" className="text-purple-500 border-purple-500/50">
                            ROLLED BACK
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-sm">{proposal?.reason || 'Action executed'}</p>
                      
                      {execution.error_message && (
                        <p className="text-xs text-red-400">{execution.error_message}</p>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          Executed: {execution.executed_at ? format(new Date(execution.executed_at), 'MMM d, yyyy HH:mm') : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROLLBACK PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function RollbackPanel() {
  const { data: executions, isLoading } = useExecutions();
  const rollback = useRollbackExecution();

  // Filter to only show rollback-eligible executions
  const eligibleExecutions = executions?.filter(e => {
    if (e.rolled_back_at) return false;
    if (!e.rollback_expires_at) return false;
    return new Date(e.rollback_expires_at) > new Date();
  });

  if (isLoading) {
    return <Card className="p-8 text-center text-muted-foreground">Loading...</Card>;
  }

  if (!eligibleExecutions?.length) {
    return (
      <Card className="p-8 text-center">
        <RotateCcw className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-lg font-medium">No rollback-eligible actions</p>
        <p className="text-muted-foreground">Rollback window is 30 minutes after execution</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rollback Panel</CardTitle>
        <CardDescription>Revert recent actions within their rollback window</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-3">
            {eligibleExecutions.map((execution) => {
              const expiresIn = execution.rollback_expires_at 
                ? formatDistanceToNow(new Date(execution.rollback_expires_at))
                : 'N/A';
              
              return (
                <div key={execution.id} className="p-4 rounded-lg border bg-card flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      Execution {execution.id.slice(0, 8)}...
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Rollback expires in {expiresIn}
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => rollback.mutate(execution.id)}
                    disabled={rollback.isPending}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Rollback
                  </Button>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// POLICY PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function PolicyPanel({ policy }: { policy?: AutonomyPolicy }) {
  const updatePolicy = useUpdatePolicy();

  if (!policy) {
    return <Card className="p-8 text-center text-muted-foreground">Loading policy...</Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Autonomy Policy</CardTitle>
        <CardDescription>Configure guardrails and execution limits</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Simulation Mode Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg border bg-purple-500/5 border-purple-500/20">
          <div>
            <Label className="text-base font-medium">Simulation Mode</Label>
            <p className="text-sm text-muted-foreground">
              When enabled, proposals can be approved but not executed
            </p>
          </div>
          <Switch
            checked={policy.simulation_only}
            onCheckedChange={(checked) => updatePolicy.mutate({ simulation_only: checked })}
          />
        </div>

        {/* Confidence Threshold */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Minimum Confidence Threshold</Label>
            <span className="text-sm font-mono">{(policy.min_confidence_threshold * 100).toFixed(0)}%</span>
          </div>
          <Slider
            value={[policy.min_confidence_threshold * 100]}
            min={50}
            max={95}
            step={5}
            onValueCommit={([value]) => updatePolicy.mutate({ min_confidence_threshold: value / 100 })}
          />
        </div>

        {/* Action Limits */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border bg-secondary/30">
            <Label className="text-sm">Max Actions/Route/Hour</Label>
            <p className="text-2xl font-bold mt-1">{policy.max_actions_per_route_per_hour}</p>
          </div>
          <div className="p-4 rounded-lg border bg-secondary/30">
            <Label className="text-sm">Max Reassigned Stops/Route</Label>
            <p className="text-2xl font-bold mt-1">{policy.max_reassigned_stops_per_route}</p>
          </div>
        </div>

        {/* Enabled Actions */}
        <div className="space-y-2">
          <Label>Enabled Action Types</Label>
          <div className="flex flex-wrap gap-2">
            {policy.enabled_actions.map((action) => (
              <Badge key={action} variant="secondary">{action}</Badge>
            ))}
          </div>
        </div>

        {/* Approval Roles */}
        <div className="space-y-2">
          <Label>Roles Allowed to Approve</Label>
          <div className="flex flex-wrap gap-2">
            {policy.allowed_roles_to_approve.map((role) => (
              <Badge key={role} variant="outline">{role}</Badge>
            ))}
          </div>
        </div>

        {/* Last Updated */}
        <p className="text-xs text-muted-foreground">
          Last updated: {format(new Date(policy.updated_at), 'MMM d, yyyy HH:mm')}
        </p>
      </CardContent>
    </Card>
  );
}
