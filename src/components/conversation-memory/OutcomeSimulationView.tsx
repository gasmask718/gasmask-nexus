import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Brain, 
  Sparkles, 
  AlertTriangle, 
  TrendingUp, 
  Clock, 
  Shield,
  Phone,
  MessageSquare,
  Mail,
  Pause,
  ArrowUpRight,
  Eye,
  Pin,
  X,
  RefreshCw,
  Lock,
  MessageCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { 
  useOutcomeSimulations, 
  useSimulationScenarios, 
  useGenerateSimulation,
  useUpdateScenario,
  useUpdateSimulation,
  useAddSimulationFeedback,
  useLockScenarioForExecution,
  SimulationScenario,
} from '@/hooks/useOutcomeSimulation';
import { toast } from 'sonner';

interface OutcomeSimulationViewProps {
  conversationId: string;
  onScenarioSelect?: (scenario: SimulationScenario) => void;
}

const actionIcons: Record<string, React.ReactNode> = {
  call: <Phone className="h-4 w-4" />,
  text: <MessageSquare className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  silence: <Pause className="h-4 w-4" />,
  escalation: <ArrowUpRight className="h-4 w-4" />,
};

const toneColors: Record<string, string> = {
  friendly: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  firm: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  reassuring: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  direct: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'de-escalating': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  neutral: 'bg-muted text-muted-foreground border-border',
};

function ScenarioCard({ 
  scenario, 
  onPin, 
  onDismiss, 
  onViewEvidence,
  onLock,
  isLocking,
}: { 
  scenario: SimulationScenario;
  onPin: () => void;
  onDismiss: () => void;
  onViewEvidence: () => void;
  onLock: () => void;
  isLocking: boolean;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const trustColor = scenario.trust_impact_score > 0 
    ? 'text-emerald-400' 
    : scenario.trust_impact_score < 0 
      ? 'text-rose-400' 
      : 'text-muted-foreground';

  return (
    <Card className={`relative ${scenario.is_recommended ? 'ring-2 ring-primary' : ''} ${scenario.is_pinned ? 'bg-primary/5' : ''}`}>
      {scenario.is_recommended && (
        <div className="absolute -top-2 left-4">
          <Badge className="bg-primary text-primary-foreground text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            Recommended
          </Badge>
        </div>
      )}
      {scenario.is_pinned && (
        <div className="absolute -top-2 right-4">
          <Badge variant="outline" className="text-xs">
            <Pin className="h-3 w-3 mr-1" />
            Pinned
          </Badge>
        </div>
      )}
      
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-muted">
              {actionIcons[scenario.initiating_action_type] || <MessageCircle className="h-4 w-4" />}
            </div>
            <div>
              <CardTitle className="text-sm font-medium">{scenario.scenario_name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={toneColors[scenario.tone_profile] || toneColors.neutral}>
                  {scenario.tone_profile}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  #{scenario.scenario_rank}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold">{scenario.confidence_level}%</div>
            <div className="text-xs text-muted-foreground">confidence</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Risk/Opportunity/Trust meters */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Risk</span>
              <span className="text-rose-400">{scenario.risk_score}</span>
            </div>
            <Progress value={scenario.risk_score} className="h-1.5 bg-rose-500/20" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Opportunity</span>
              <span className="text-emerald-400">{scenario.opportunity_score}</span>
            </div>
            <Progress value={scenario.opportunity_score} className="h-1.5 bg-emerald-500/20" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Trust</span>
              <span className={trustColor}>{scenario.trust_impact_score > 0 ? '+' : ''}{scenario.trust_impact_score}</span>
            </div>
            <Progress 
              value={Math.abs(scenario.trust_impact_score)} 
              className={`h-1.5 ${scenario.trust_impact_score >= 0 ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`} 
            />
          </div>
        </div>

        {/* Predicted Response */}
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-xs text-muted-foreground mb-1">Predicted Response</p>
          <p className="text-sm">{scenario.predicted_contact_response}</p>
        </div>

        {/* Time Estimate */}
        {scenario.time_to_resolution_estimate && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Est. resolution: {scenario.time_to_resolution_estimate}
          </div>
        )}

        {/* Warnings */}
        {scenario.warnings && scenario.warnings.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {scenario.warnings.map((warning, idx) => (
              <Badge key={idx} variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/30">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {warning}
              </Badge>
            ))}
          </div>
        )}

        {/* Expandable Details */}
        {showDetails && (
          <div className="space-y-3 pt-2 border-t border-border">
            {/* Outcomes */}
            {scenario.predicted_outcomes && scenario.predicted_outcomes.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Predicted Outcomes</p>
                <ul className="space-y-1">
                  {scenario.predicted_outcomes.map((outcome: string, idx: number) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <TrendingUp className="h-3 w-3 mt-1 text-primary" />
                      {outcome}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Intent Shift */}
            {scenario.predicted_intent_shift && Object.keys(scenario.predicted_intent_shift).length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Intent Shift</p>
                <Badge variant="outline">
                  {scenario.predicted_intent_shift.type}: {scenario.predicted_intent_shift.direction}
                </Badge>
              </div>
            )}

            {/* Signals to Watch */}
            {scenario.signals_to_watch && scenario.signals_to_watch.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Watch For</p>
                <div className="flex flex-wrap gap-1">
                  {scenario.signals_to_watch.map((signal, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      <Eye className="h-3 w-3 mr-1" />
                      {signal}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Reasoning */}
            {scenario.recommendation_reasoning && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-xs text-primary mb-1">Reasoning</p>
                <p className="text-sm">{scenario.recommendation_reasoning}</p>
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Less' : 'More'} Details
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={onViewEvidence} title="View Evidence">
              <Eye className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onPin}
              className={scenario.is_pinned ? 'text-primary' : ''}
              title={scenario.is_pinned ? 'Unpin' : 'Pin'}
            >
              <Pin className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDismiss} title="Dismiss">
              <X className="h-4 w-4" />
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={onLock}
              disabled={isLocking}
              className="ml-2"
            >
              {isLocking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-1" />
                  Lock
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function OutcomeSimulationView({ conversationId, onScenarioSelect }: OutcomeSimulationViewProps) {
  const [intuitionNote, setIntuitionNote] = useState('');
  const [selectedEvidence, setSelectedEvidence] = useState<any[] | null>(null);

  const { data: simulations, isLoading: loadingSimulations } = useOutcomeSimulations(conversationId);
  const activeSimulation = simulations?.find(s => s.status === 'active');
  const { data: scenarios, isLoading: loadingScenarios } = useSimulationScenarios(activeSimulation?.id || null);

  const generateSimulation = useGenerateSimulation();
  const updateScenario = useUpdateScenario();
  const updateSimulation = useUpdateSimulation();
  const addFeedback = useAddSimulationFeedback();
  const lockScenario = useLockScenarioForExecution();

  const handleGenerate = async (constraints?: Record<string, any>) => {
    try {
      await generateSimulation.mutateAsync({ 
        conversationId, 
        triggeringContext: { type: 'manual' },
        constraints,
      });
      toast.success('Outcome simulation generated');
    } catch (error) {
      toast.error('Failed to generate simulation');
      console.error(error);
    }
  };

  const handlePin = async (scenario: SimulationScenario) => {
    try {
      await updateScenario.mutateAsync({
        scenarioId: scenario.id,
        updates: { is_pinned: !scenario.is_pinned },
      });
    } catch (error) {
      toast.error('Failed to update scenario');
    }
  };

  const handleDismiss = async (scenario: SimulationScenario) => {
    try {
      await updateScenario.mutateAsync({
        scenarioId: scenario.id,
        updates: { is_dismissed: true },
      });
      toast.success('Scenario dismissed');
    } catch (error) {
      toast.error('Failed to dismiss scenario');
    }
  };

  const handleLock = async (scenario: SimulationScenario) => {
    if (!activeSimulation) return;
    try {
      await lockScenario.mutateAsync({
        simulationId: activeSimulation.id,
        scenarioId: scenario.id,
      });
      toast.success('Scenario locked for execution');
      onScenarioSelect?.(scenario);
    } catch (error) {
      toast.error('Failed to lock scenario');
    }
  };

  const handleAddIntuition = async () => {
    if (!activeSimulation || !intuitionNote.trim()) return;
    try {
      await addFeedback.mutateAsync({
        simulation_id: activeSimulation.id,
        feedback_type: 'override',
        human_intuition_note: intuitionNote,
        actual_outcome: {},
        scenario_id: null,
        executed_scenario_id: null,
        predicted_vs_actual_accuracy: null,
        feedback_notes: null,
        created_by: null,
      });
      setIntuitionNote('');
      toast.success('Intuition note added');
    } catch (error) {
      toast.error('Failed to add note');
    }
  };

  if (loadingSimulations) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Outcome Simulation</h3>
            <p className="text-sm text-muted-foreground">
              Preview futures before acting
            </p>
          </div>
        </div>
        <Button 
          onClick={() => handleGenerate()}
          disabled={generateSimulation.isPending}
        >
          {generateSimulation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {activeSimulation ? 'Re-Simulate' : 'Generate Simulation'}
        </Button>
      </div>

      {/* Active Simulation Info */}
      {activeSimulation && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    Confidence: <span className="font-medium">{activeSimulation.confidence_index}%</span>
                  </span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    Expires: {new Date(activeSimulation.expiry_timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <Badge variant={activeSimulation.status === 'active' ? 'default' : 'secondary'}>
                  {activeSimulation.status}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {scenarios?.length || 0} scenarios
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scenarios Grid */}
      {loadingScenarios ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : scenarios && scenarios.length > 0 ? (
        <ScrollArea className="h-[600px] pr-4">
          <div className="grid gap-4 md:grid-cols-2">
            {scenarios.map((scenario) => (
              <ScenarioCard
                key={scenario.id}
                scenario={scenario}
                onPin={() => handlePin(scenario)}
                onDismiss={() => handleDismiss(scenario)}
                onViewEvidence={() => setSelectedEvidence(scenario.supporting_evidence)}
                onLock={() => handleLock(scenario)}
                isLocking={lockScenario.isPending}
              />
            ))}
          </div>
        </ScrollArea>
      ) : activeSimulation ? (
        <Card className="py-12 text-center">
          <p className="text-muted-foreground">All scenarios dismissed. Generate new simulation?</p>
        </Card>
      ) : (
        <Card className="py-12 text-center">
          <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground mb-4">No active simulations</p>
          <Button variant="outline" onClick={() => handleGenerate()}>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate First Simulation
          </Button>
        </Card>
      )}

      {/* Human Intuition Input */}
      {activeSimulation && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Add Human Intuition
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Add context the AI might be missing... What does your gut say?"
              value={intuitionNote}
              onChange={(e) => setIntuitionNote(e.target.value)}
              className="min-h-[80px]"
            />
            <div className="flex justify-end">
              <Button 
                size="sm" 
                onClick={handleAddIntuition}
                disabled={!intuitionNote.trim() || addFeedback.isPending}
              >
                {addFeedback.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                )}
                Add Note
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Evidence Modal */}
      {selectedEvidence && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50" onClick={() => setSelectedEvidence(null)}>
          <Card className="max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Supporting Evidence</span>
                <Button variant="ghost" size="icon" onClick={() => setSelectedEvidence(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                {selectedEvidence.length > 0 ? (
                  <ul className="space-y-2">
                    {selectedEvidence.map((evidence, idx) => (
                      <li key={idx} className="p-3 rounded-lg bg-muted text-sm">
                        {typeof evidence === 'string' ? evidence : JSON.stringify(evidence)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No evidence recorded</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
