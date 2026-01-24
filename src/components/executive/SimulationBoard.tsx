import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  FlaskConical, 
  Play, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  TrendingUp,
  Shield,
  Phone,
  Activity
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SimulationResult {
  id: string;
  simulation_name: string;
  simulation_type: string;
  status: string;
  expected_call_volume?: number;
  risk_exposure_score?: number;
  compliance_load_score?: number;
  sentinel_stress_projection?: number;
  simulation_passed?: boolean;
  failure_reasons?: string[];
  recommendations?: string[];
  projected_outcomes?: Record<string, unknown>;
  created_at: string;
  completed_at?: string;
}

interface SimulationBoardProps {
  directiveId?: string;
  businessId: string;
  onApproved?: () => void;
}

export function SimulationBoard({ directiveId, businessId, onApproved }: SimulationBoardProps) {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const runSimulation = async (type: string) => {
    if (!directiveId) {
      toast({
        title: 'No Directive Selected',
        description: 'Select a directive to simulate',
        variant: 'destructive'
      });
      return;
    }

    setIsRunning(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('executive-directive-manager', {
        body: {
          action: 'simulate',
          directive_id: directiveId,
          simulation_params: {
            simulation_type: type,
            input_parameters: { scope: 'full', include_edge_cases: true }
          }
        }
      });

      if (error) throw error;
      if (data.success) {
        setResult(data.simulation);
        toast({
          title: data.simulation.simulation_passed ? 'Simulation Passed' : 'Simulation Failed',
          description: data.simulation.simulation_passed 
            ? 'Directive is safe to execute'
            : 'Review recommendations before proceeding',
          variant: data.simulation.simulation_passed ? 'default' : 'destructive'
        });
      }
    } catch (error) {
      console.error('Simulation error:', error);
      toast({ title: 'Error', description: 'Simulation failed', variant: 'destructive' });
    } finally {
      setIsRunning(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.9) return 'text-green-500';
    if (score >= 0.7) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getRiskColor = (score: number) => {
    if (score <= 0.2) return 'text-green-500';
    if (score <= 0.4) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            <CardTitle>Simulation Board</CardTitle>
          </div>
          <Badge variant="outline">No Simulation = No Execution</Badge>
        </div>
        <CardDescription>
          "What happens if we do this?" — Preview outcomes before committing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Simulation Controls */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => runSimulation('what_if')}
            disabled={isRunning || !directiveId}
          >
            <Play className="h-4 w-4 mr-1" />
            What-If
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => runSimulation('stress_test')}
            disabled={isRunning || !directiveId}
          >
            <Activity className="h-4 w-4 mr-1" />
            Stress Test
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => runSimulation('risk_assessment')}
            disabled={isRunning || !directiveId}
          >
            <AlertTriangle className="h-4 w-4 mr-1" />
            Risk Check
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => runSimulation('compliance_check')}
            disabled={isRunning || !directiveId}
          >
            <Shield className="h-4 w-4 mr-1" />
            Compliance
          </Button>
        </div>

        {isRunning && (
          <div className="py-8 text-center">
            <Activity className="h-8 w-8 mx-auto text-primary animate-pulse mb-2" />
            <p className="text-muted-foreground">Running simulation...</p>
          </div>
        )}

        {result && (
          <div className="space-y-4 pt-4 border-t">
            {/* Status Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {result.simulation_passed ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span className={`font-semibold ${result.simulation_passed ? 'text-green-500' : 'text-red-500'}`}>
                  {result.simulation_passed ? 'SIMULATION PASSED' : 'SIMULATION FAILED'}
                </span>
              </div>
              <Badge>{result.simulation_type.replace('_', ' ')}</Badge>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  Expected Calls
                </div>
                <p className="text-xl font-bold">{result.expected_call_volume || 0}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <AlertTriangle className="h-3 w-3" />
                  Risk Exposure
                </div>
                <p className={`text-xl font-bold ${getRiskColor(result.risk_exposure_score || 0)}`}>
                  {((result.risk_exposure_score || 0) * 100).toFixed(0)}%
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Shield className="h-3 w-3" />
                  Compliance
                </div>
                <p className={`text-xl font-bold ${getScoreColor(result.compliance_load_score || 0)}`}>
                  {((result.compliance_load_score || 0) * 100).toFixed(0)}%
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  Sentinel Stress
                </div>
                <p className={`text-xl font-bold ${getRiskColor(result.sentinel_stress_projection || 0)}`}>
                  {((result.sentinel_stress_projection || 0) * 100).toFixed(0)}%
                </p>
              </div>
            </div>

            {/* Failure Reasons */}
            {result.failure_reasons && result.failure_reasons.length > 0 && (
              <div className="bg-red-500/10 rounded-lg p-3">
                <p className="text-sm font-medium text-red-500 mb-1">Failure Reasons:</p>
                <ul className="text-sm text-muted-foreground list-disc list-inside">
                  {result.failure_reasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {result.recommendations && result.recommendations.length > 0 && (
              <div className="bg-primary/10 rounded-lg p-3">
                <p className="text-sm font-medium text-primary mb-1">Recommendations:</p>
                <ul className="text-sm text-muted-foreground list-disc list-inside">
                  {result.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Approval Action */}
            {result.simulation_passed && onApproved && (
              <div className="flex justify-end pt-2">
                <Button onClick={onApproved}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Approve & Proceed to Execution
                </Button>
              </div>
            )}
          </div>
        )}

        {!directiveId && !result && (
          <div className="py-8 text-center text-muted-foreground">
            <FlaskConical className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Select a directive to run simulations</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SimulationBoard;
