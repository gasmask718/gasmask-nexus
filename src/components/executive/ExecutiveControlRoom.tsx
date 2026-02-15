import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, 
  Play, 
  Pause, 
  Square, 
  RotateCcw, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Activity,
  FileSignature,
  Zap,
  Eye,
  Lock,
  Unlock,
  TrendingUp,
  Users,
  Phone,
  Target,
  Compass,
  FlaskConical,
  ShieldCheck,
  BarChart3,
  GitBranch
} from 'lucide-react';
import { useExecutiveAI } from '@/hooks/useExecutiveAI';
import { useExecutiveDirectives } from '@/hooks/useExecutiveDirectives';
import { useBusiness } from '@/contexts/BusinessContext';
import { PolicyBuilder } from './PolicyBuilder';
import { ActiveRunsMonitor } from './ActiveRunsMonitor';
import { PolicyViolationsLog } from './PolicyViolationsLog';
import { DirectivesPanel } from './DirectivesPanel';
import { SimulationBoard } from './SimulationBoard';
import { PowersMatrixPanel } from './PowersMatrixPanel';
import { AIDispatchAnalytics } from './AIDispatchAnalytics';
import { AILearningPanel } from './AILearningPanel';
import { AIConfidenceCalibration } from './AIConfidenceCalibration';
import { AIConfidenceCorrections } from './AIConfidenceCorrections';
import { AIActionOutcomeAttribution } from './AIActionOutcomeAttribution';
import { AISLABreachPostMortems } from './AISLABreachPostMortems';
import { AICounterfactualSimulation } from './AICounterfactualSimulation';
import { AIDecisionQualityIndex } from './AIDecisionQualityIndex';

export function ExecutiveControlRoom() {
  const { currentBusiness } = useBusiness();
  const businessId = currentBusiness?.id;
  
  const {
    isLoading,
    policies,
    activeRuns,
    engineState,
    fetchPolicies,
    fetchEngineStatus,
    signPolicy,
    suspendPolicy,
    setHumanOverride,
    haltRun,
  } = useExecutiveAI(businessId);

  const {
    directives,
    activeDirectives,
    draftDirectives,
    simulations,
    powersMatrix,
    advisoryMode,
    isLoading: directivesLoading,
    fetchDirectives,
    activateDirective,
    revokeDirective,
    runSimulation,
    fetchPowersMatrix,
  } = useExecutiveDirectives(businessId);

  const [showPolicyBuilder, setShowPolicyBuilder] = useState(false);
  const [activeTab, setActiveTab] = useState('directives');

  useEffect(() => {
    if (businessId) {
      fetchPolicies();
      fetchEngineStatus();
      fetchDirectives();
      fetchPowersMatrix();
    }
  }, [businessId, fetchPolicies, fetchEngineStatus, fetchDirectives, fetchPowersMatrix]);

  // Refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (businessId) {
        fetchEngineStatus();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [businessId, fetchEngineStatus]);

  const activePolicies = policies.filter(p => p.status === 'active');
  const draftPolicies = policies.filter(p => p.status === 'draft');

  const getEngineStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-500';
      case 'paused': return 'text-yellow-500';
      case 'halted': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'autonomous': return <Zap className="h-4 w-4 text-green-500" />;
      case 'semi_autonomous': return <Eye className="h-4 w-4 text-yellow-500" />;
      default: return <Shield className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Executive AI Control Room
          </h1>
          <p className="text-muted-foreground">
            Governed autonomous operations • Policy-bound execution
          </p>
        </div>
        <div className="flex gap-2">
          {engineState?.human_override_active ? (
            <Button 
              variant="outline" 
              onClick={() => setHumanOverride(false)}
              className="border-green-500 text-green-500"
            >
              <Unlock className="h-4 w-4 mr-2" />
              Release Override
            </Button>
          ) : (
            <Button 
              variant="destructive" 
              onClick={() => setHumanOverride(true, 'Manual override activated')}
            >
              <Lock className="h-4 w-4 mr-2" />
              Human Override
            </Button>
          )}
        </div>
      </div>

      {/* Engine Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Engine Status</p>
                <p className={`text-2xl font-bold ${getEngineStatusColor(engineState?.status || 'idle')}`}>
                  {engineState?.status?.toUpperCase() || 'IDLE'}
                </p>
              </div>
              <Activity className={`h-8 w-8 ${getEngineStatusColor(engineState?.status || 'idle')}`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Autonomy Mode</p>
                <div className="flex items-center gap-2">
                  {getModeIcon(engineState?.mode || 'supervised')}
                  <span className="text-lg font-semibold capitalize">
                    {engineState?.mode?.replace('_', ' ') || 'Supervised'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Trust Score</p>
                <p className="text-2xl font-bold">
                  {((engineState?.current_trust_score || 0) * 100).toFixed(1)}%
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
            <Progress 
              value={(engineState?.current_trust_score || 0) * 100} 
              className="mt-2" 
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Runs</p>
                <p className="text-2xl font-bold">{activeRuns.length}</p>
              </div>
              <Target className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Human Override Banner */}
      {engineState?.human_override_active && (
        <Card className="border-yellow-500 bg-yellow-500/10">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="font-semibold text-yellow-500">Human Override Active</p>
                <p className="text-sm text-muted-foreground">
                  {engineState.override_reason || 'AI autonomy is restricted. All actions require human approval.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="directives" className="flex items-center gap-2">
            <Compass className="h-4 w-4" />
            Directives ({activeDirectives.length})
          </TabsTrigger>
          <TabsTrigger value="simulation" className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            Simulation
          </TabsTrigger>
          <TabsTrigger value="powers" className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Powers Matrix
          </TabsTrigger>
          <TabsTrigger value="policies" className="flex items-center gap-2">
            <FileSignature className="h-4 w-4" />
            Policies ({activePolicies.length})
          </TabsTrigger>
          <TabsTrigger value="runs" className="flex items-center gap-2">
            <Play className="h-4 w-4" />
            Active Runs ({activeRuns.length})
          </TabsTrigger>
          <TabsTrigger value="violations" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Violations
          </TabsTrigger>
          <TabsTrigger value="ai-analytics" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            AI Analytics
          </TabsTrigger>
          <TabsTrigger value="ai-learning" className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            AI Learning
          </TabsTrigger>
          <TabsTrigger value="confidence" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Confidence
          </TabsTrigger>
          <TabsTrigger value="corrections" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Corrections
          </TabsTrigger>
          <TabsTrigger value="attribution" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Attribution
          </TabsTrigger>
          <TabsTrigger value="post-mortems" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Post-Mortems
          </TabsTrigger>
          <TabsTrigger value="counterfactual" className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            What-If
          </TabsTrigger>
          <TabsTrigger value="dqi" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            DQI
          </TabsTrigger>
          <TabsTrigger value="metrics" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Performance
          </TabsTrigger>
        </TabsList>

        {/* Directives Tab */}
        <TabsContent value="directives">
          <DirectivesPanel
            directives={directives}
            activeDirectives={activeDirectives}
            draftDirectives={draftDirectives}
            businessId={businessId!}
            isLoading={directivesLoading}
            advisoryMode={advisoryMode}
            onActivate={activateDirective}
            onRevoke={revokeDirective}
            onSimulate={runSimulation}
            onRefresh={fetchDirectives}
          />
        </TabsContent>

        {/* Simulation Tab */}
        <TabsContent value="simulation">
          <SimulationBoard
            businessId={businessId!}
            directiveId={activeDirectives[0]?.id}
          />
        </TabsContent>

        {/* Powers Matrix Tab */}
        <TabsContent value="powers">
          <PowersMatrixPanel powers={powersMatrix} isLoading={directivesLoading} />
        </TabsContent>

        {/* Policies Tab */}
        <TabsContent value="policies" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Executive Policies</h3>
            <Button onClick={() => setShowPolicyBuilder(true)}>
              <FileSignature className="h-4 w-4 mr-2" />
              New Policy
            </Button>
          </div>

          {showPolicyBuilder && (
            <PolicyBuilder 
              businessId={businessId!} 
              onClose={() => setShowPolicyBuilder(false)}
              onCreated={() => {
                fetchPolicies();
                setShowPolicyBuilder(false);
              }}
            />
          )}

          {/* Active Policies */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Active Policies</h4>
            {activePolicies.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center">
                  <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No active policies</p>
                  <p className="text-sm text-muted-foreground">
                    AI cannot operate without a signed executive policy
                  </p>
                </CardContent>
              </Card>
            ) : (
              activePolicies.map(policy => (
                <Card key={policy.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <div>
                          <p className="font-semibold">{policy.policy_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {policy.policy_scope} • Risk: {policy.risk_classification}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="bg-green-500">
                          Signed
                        </Badge>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => suspendPolicy(policy.id, 'Manual suspension')}
                        >
                          <Pause className="h-4 w-4 mr-1" />
                          Suspend
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Allowed:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {policy.allowed_actions.slice(0, 3).map(action => (
                            <Badge key={action} variant="outline" className="text-xs">
                              {action}
                            </Badge>
                          ))}
                          {policy.allowed_actions.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{policy.allowed_actions.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Rate Limit:</span>
                        <p>{policy.max_contact_rate || 100}/hr</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Signed:</span>
                        <p>{policy.signed_at ? new Date(policy.signed_at).toLocaleDateString() : 'N/A'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Draft Policies */}
          {draftPolicies.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Pending Signature</h4>
              {draftPolicies.map(policy => (
                <Card key={policy.id} className="border-dashed">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileSignature className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-semibold">{policy.policy_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {policy.policy_scope} • Draft
                          </p>
                        </div>
                      </div>
                      <Button 
                        onClick={() => signPolicy(policy.id, 'Policy approved and signed')}
                        disabled={isLoading}
                      >
                        <FileSignature className="h-4 w-4 mr-2" />
                        Sign & Activate
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Active Runs Tab */}
        <TabsContent value="runs">
          <ActiveRunsMonitor 
            runs={activeRuns} 
            onHalt={haltRun}
            isLoading={isLoading}
          />
        </TabsContent>

        {/* Violations Tab */}
        <TabsContent value="violations">
          <PolicyViolationsLog businessId={businessId} />
        </TabsContent>

        {/* AI Analytics Tab (Read-Only) */}
        <TabsContent value="ai-analytics">
          <AIDispatchAnalytics />
        </TabsContent>

        {/* AI Learning Tab (Opt-In, Gated) */}
        <TabsContent value="ai-learning">
          <AILearningPanel />
        </TabsContent>

        {/* Confidence Calibration Tab (Read-Only, Phase 7) */}
        <TabsContent value="confidence">
          <AIConfidenceCalibration />
        </TabsContent>

        {/* Confidence Corrections Tab (Human-Approved, Phase 8) */}
        <TabsContent value="corrections">
          <AIConfidenceCorrections />
        </TabsContent>

        {/* Action Outcome Attribution Tab (Read-Only, Phase 9) */}
        <TabsContent value="attribution">
          <AIActionOutcomeAttribution />
        </TabsContent>

        {/* SLA Breach Post-Mortems Tab (Read-Only, Phase 10) */}
        <TabsContent value="post-mortems">
          <AISLABreachPostMortems />
        </TabsContent>

        {/* Counterfactual Simulation Tab (Read-Only, Phase 11) */}
        <TabsContent value="counterfactual">
          <AICounterfactualSimulation />
        </TabsContent>

        {/* Decision Quality Index Tab (Read-Only, Phase 12) */}
        <TabsContent value="dqi">
          <AIDecisionQualityIndex />
        </TabsContent>


        {/* Performance Tab */}
        <TabsContent value="metrics">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Decisions Today</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{engineState?.total_decisions_today || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Successful Executions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-500">
                  {engineState?.successful_executions_today || 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Escalations</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-yellow-500">
                  {engineState?.escalations_today || 0}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Violations</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-red-500">
                  {engineState?.violations_today || 0}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ExecutiveControlRoom;
