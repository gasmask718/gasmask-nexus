import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  ArrowLeft,
  Brain, 
  FlaskConical, 
  Shield, 
  UserCheck, 
  Rocket,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Lock
} from 'lucide-react';
import { 
  LearningProposal,
  useProposalDetails,
  useRunSimulation,
  useCheckSentinelGate,
  useHumanApprove,
  usePromote
} from '@/hooks/useAILearning';

interface ProposalPipelineProps {
  proposal: LearningProposal;
  onBack: () => void;
}

export function ProposalPipeline({ proposal, onBack }: ProposalPipelineProps) {
  const { data: details, isLoading } = useProposalDetails(proposal.id);
  const runSimulation = useRunSimulation();
  const checkSentinelGate = useCheckSentinelGate();
  const humanApprove = useHumanApprove();
  const promote = usePromote();

  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalForm, setApprovalForm] = useState({
    approverEmail: '',
    approvalReason: '',
    scopeDescription: '',
    rollbackInstructions: ''
  });

  const currentProposal = details?.proposal || proposal;

  const handleRunSimulation = () => {
    runSimulation.mutate({
      proposalId: proposal.id,
      simulationType: 'historical_replay'
    });
  };

  const handleCheckSentinel = () => {
    checkSentinelGate.mutate(proposal.id);
  };

  const handleApprove = () => {
    humanApprove.mutate({
      proposalId: proposal.id,
      approverId: crypto.randomUUID(), // In real app, use actual user ID
      approverEmail: approvalForm.approverEmail,
      approverRole: 'admin',
      approvalReason: approvalForm.approvalReason,
      scopeDescription: approvalForm.scopeDescription,
      rollbackInstructions: approvalForm.rollbackInstructions
    });
    setApprovalDialogOpen(false);
  };

  const handlePromote = () => {
    if (details?.approvals?.[0]) {
      promote.mutate({
        proposalId: proposal.id,
        approvalId: details.approvals[0].id
      });
    }
  };

  const getStepStatus = (step: string): 'complete' | 'current' | 'pending' | 'failed' => {
    const status = currentProposal.status;
    
    switch (step) {
      case 'propose':
        return 'complete';
      case 'simulate':
        if (status === 'proposed') return 'current';
        if (status === 'simulating') return 'current';
        if (status === 'simulation_failed') return 'failed';
        return ['simulation_passed', 'sentinel_approved', 'sentinel_rejected', 'approved', 'promoted'].includes(status) ? 'complete' : 'pending';
      case 'sentinel':
        if (status === 'simulation_passed') return 'current';
        if (status === 'sentinel_rejected') return 'failed';
        return ['sentinel_approved', 'approved', 'promoted'].includes(status) ? 'complete' : 'pending';
      case 'human':
        if (status === 'sentinel_approved') return 'current';
        return ['approved', 'promoted'].includes(status) ? 'complete' : 'pending';
      case 'promote':
        if (status === 'approved') return 'current';
        return status === 'promoted' ? 'complete' : 'pending';
      default:
        return 'pending';
    }
  };

  const StepIcon = ({ step, status }: { step: string; status: string }) => {
    const icons: Record<string, React.ReactNode> = {
      propose: <Brain className="h-5 w-5" />,
      simulate: <FlaskConical className="h-5 w-5" />,
      sentinel: <Shield className="h-5 w-5" />,
      human: <UserCheck className="h-5 w-5" />,
      promote: <Rocket className="h-5 w-5" />
    };

    const stepStatus = getStepStatus(step);
    
    if (stepStatus === 'complete') {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    }
    if (stepStatus === 'failed') {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
    if (stepStatus === 'current') {
      return <div className="animate-pulse">{icons[step]}</div>;
    }
    return <div className="text-muted-foreground">{icons[step]}</div>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading proposal details...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h2 className="text-xl font-semibold">{currentProposal.title}</h2>
          <p className="text-sm text-muted-foreground">{currentProposal.description}</p>
        </div>
      </div>

      {/* Pipeline Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Promotion Pipeline</CardTitle>
          <CardDescription>Each step must pass before proceeding</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {['propose', 'simulate', 'sentinel', 'human', 'promote'].map((step, index) => (
              <div key={step} className="flex items-center">
                <div className={`flex flex-col items-center ${index > 0 ? 'ml-4' : ''}`}>
                  <div className={`p-3 rounded-full border-2 ${
                    getStepStatus(step) === 'complete' ? 'border-green-500 bg-green-500/10' :
                    getStepStatus(step) === 'current' ? 'border-primary bg-primary/10' :
                    getStepStatus(step) === 'failed' ? 'border-red-500 bg-red-500/10' :
                    'border-muted bg-muted'
                  }`}>
                    <StepIcon step={step} status={currentProposal.status} />
                  </div>
                  <span className="text-xs mt-2 capitalize">{step}</span>
                </div>
                {index < 4 && (
                  <div className={`h-0.5 w-12 mx-2 ${
                    getStepStatus(step) === 'complete' ? 'bg-green-500' : 'bg-muted'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Proposal Details */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current Artifact</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-48">
              {JSON.stringify(currentProposal.current_artifact, null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Proposed Artifact</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-48">
              {JSON.stringify(currentProposal.proposed_artifact, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>

      {/* Risk Assessment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Risk Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Badge variant="outline" className={
              currentProposal.risk_level === 'low' ? 'bg-green-500/10 text-green-500' :
              currentProposal.risk_level === 'medium' ? 'bg-yellow-500/10 text-yellow-500' :
              currentProposal.risk_level === 'high' ? 'bg-orange-500/10 text-orange-500' :
              'bg-red-500/10 text-red-500'
            }>
              {currentProposal.risk_level.toUpperCase()} RISK
            </Badge>
            {currentProposal.expected_improvement_pct && (
              <span className="text-sm text-muted-foreground">
                Expected improvement: +{currentProposal.expected_improvement_pct}%
              </span>
            )}
          </div>
          <p className="text-sm">{currentProposal.risk_assessment}</p>
          
          <div className="mt-4 flex gap-2">
            {currentProposal.affects_speech && (
              <Badge variant="outline">Affects Speech</Badge>
            )}
            {currentProposal.affects_timing && (
              <Badge variant="outline">Affects Timing</Badge>
            )}
            {currentProposal.affects_escalation && (
              <Badge variant="outline">Affects Escalation</Badge>
            )}
            {currentProposal.affects_routing && (
              <Badge variant="outline">Affects Routing</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Simulation Results */}
      {details?.sandboxRuns && details.sandboxRuns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              Simulation Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            {details.sandboxRuns.map((run) => (
              <div key={run.id} className="border rounded-lg p-4 mb-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{run.simulation_type.replace('_', ' ')}</span>
                  <Badge variant="outline" className={
                    run.status === 'passed' ? 'bg-green-500/10 text-green-500' :
                    run.status === 'failed' ? 'bg-red-500/10 text-red-500' :
                    'bg-yellow-500/10 text-yellow-500'
                  }>
                    {run.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Test Cases:</span>
                    <span className="ml-2">{run.test_cases_count}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Improvement:</span>
                    <span className="ml-2">{run.improvement_pct}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Safety Violations:</span>
                    <span className="ml-2">{run.safety_violations}</span>
                  </div>
                </div>
                {run.failure_reason && (
                  <p className="text-sm text-red-500 mt-2">{run.failure_reason}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            {currentProposal.status === 'proposed' && (
              <Button 
                onClick={handleRunSimulation}
                disabled={runSimulation.isPending}
              >
                <Play className="h-4 w-4 mr-2" />
                {runSimulation.isPending ? 'Running...' : 'Run Simulation'}
              </Button>
            )}

            {currentProposal.status === 'simulation_passed' && (
              <Button 
                onClick={handleCheckSentinel}
                disabled={checkSentinelGate.isPending}
              >
                <Shield className="h-4 w-4 mr-2" />
                {checkSentinelGate.isPending ? 'Checking...' : 'Check Sentinel Gate'}
              </Button>
            )}

            {currentProposal.status === 'sentinel_approved' && (
              <Button onClick={() => setApprovalDialogOpen(true)}>
                <UserCheck className="h-4 w-4 mr-2" />
                Human Approval
              </Button>
            )}

            {currentProposal.status === 'approved' && (
              <Button 
                onClick={handlePromote}
                disabled={promote.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                <Rocket className="h-4 w-4 mr-2" />
                {promote.isPending ? 'Promoting...' : 'Promote to Production'}
              </Button>
            )}

            {currentProposal.status === 'promoted' && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Promoted Successfully</span>
              </div>
            )}

            {currentProposal.is_immutable && (
              <Badge variant="outline" className="ml-auto">
                <Lock className="h-3 w-3 mr-1" />
                Immutable
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Human Approval Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Human Approval Required</DialogTitle>
            <DialogDescription>
              By signing this approval, you are authorizing the promotion of this AI improvement.
              This action is cryptographically signed and cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Your Email (Identity)</Label>
              <Input
                value={approvalForm.approverEmail}
                onChange={(e) => setApprovalForm(prev => ({ ...prev, approverEmail: e.target.value }))}
                placeholder="admin@company.com"
              />
            </div>

            <div>
              <Label>Approval Reason</Label>
              <Textarea
                value={approvalForm.approvalReason}
                onChange={(e) => setApprovalForm(prev => ({ ...prev, approvalReason: e.target.value }))}
                placeholder="Why are you approving this change?"
              />
            </div>

            <div>
              <Label>Scope Description</Label>
              <Input
                value={approvalForm.scopeDescription}
                onChange={(e) => setApprovalForm(prev => ({ ...prev, scopeDescription: e.target.value }))}
                placeholder="What is affected by this change?"
              />
            </div>

            <div>
              <Label>Rollback Instructions</Label>
              <Textarea
                value={approvalForm.rollbackInstructions}
                onChange={(e) => setApprovalForm(prev => ({ ...prev, rollbackInstructions: e.target.value }))}
                placeholder="How to rollback if issues occur?"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleApprove}
              disabled={
                !approvalForm.approverEmail || 
                !approvalForm.approvalReason ||
                humanApprove.isPending
              }
            >
              <Lock className="h-4 w-4 mr-2" />
              Sign & Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
