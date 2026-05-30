import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  useIncidentSimulations, 
  useSimulationRuns, 
  useIncidentFindings,
  useCreateSimulation,
  useRunSimulation,
  useResolveFinding
} from "@/hooks/useIncidentSimulation";
import { 
  FlaskConical, 
  Play, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock,
  Plus,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";

const SCENARIO_TYPES = [
  { value: 'confidence_collapse', label: 'Confidence Collapse', description: 'AI confidence drops mid-sentence' },
  { value: 'kill_switch_activation', label: 'Kill Switch Activation', description: 'Test kill switch during AI speech' },
  { value: 'no_human_fallback', label: 'No Human Fallback', description: 'Escalation with no human available' },
  { value: 'conflicting_state_transitions', label: 'State Conflicts', description: 'Conflicting state transition attempts' },
  { value: 'delayed_audit_logging', label: 'Delayed Audit', description: 'Audit log persistence delays' },
  { value: 'speech_overlap', label: 'Speech Overlap', description: 'AI and human speak simultaneously' },
  { value: 'network_latency_spike', label: 'Network Latency', description: 'Network latency affecting calls' },
  { value: 'partial_transcript_loss', label: 'Transcript Loss', description: 'Partial transcript data loss' },
  { value: 'regulatory_violation_attempt', label: 'Regulatory Violation', description: 'AI attempts forbidden phrases' }
];

interface Props {
  businessId: string | null;
}

export function IncidentSimulationDashboard({ businessId }: Props) {
  const [selectedSimulation, setSelectedSimulation] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSimulation, setNewSimulation] = useState({
    name: '',
    description: '',
    scenario_type: '',
    severity: 'medium'
  });

  const { data: simulations, isLoading } = useIncidentSimulations(businessId);
  const { data: runs } = useSimulationRuns(selectedSimulation);
  const { data: findings } = useIncidentFindings(selectedRun);
  const createSimulation = useCreateSimulation();
  const runSimulation = useRunSimulation();
  const resolveFinding = useResolveFinding();

  const handleCreate = () => {
    if (!newSimulation.name || !newSimulation.scenario_type) return;
    createSimulation.mutate({
      ...newSimulation,
      business_id: businessId
    }, {
      onSuccess: () => {
        setIsCreateOpen(false);
        setNewSimulation({ name: '', description: '', scenario_type: '', severity: 'medium' });
      }
    });
  };

  const handleRun = (simulationId: string) => {
    if (!businessId) return;
    runSimulation.mutate({ simulationId, businessId });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-muted';
    }
  };

  const getStatusIcon = (status: string, passed?: boolean | null) => {
    if (status === 'running') return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
    if (status === 'completed' && passed) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (status === 'completed' && !passed) return <XCircle className="h-4 w-4 text-red-500" />;
    if (status === 'failed') return <AlertTriangle className="h-4 w-4 text-red-500" />;
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FlaskConical className="h-6 w-6" />
            Incident Simulation Engine
          </h2>
          <p className="text-muted-foreground">
            Pre-failure training: simulate incidents without affecting production
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Simulation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Incident Simulation</DialogTitle>
              <DialogDescription>
                Define a new simulation scenario to test system resilience
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={newSimulation.name}
                  onChange={(e) => setNewSimulation(s => ({ ...s, name: e.target.value }))}
                  placeholder="e.g., Kill Switch Response Test"
                />
              </div>
              <div className="space-y-2">
                <Label>Scenario Type</Label>
                <Select
                  value={newSimulation.scenario_type}
                  onValueChange={(v) => setNewSimulation(s => ({ ...s, scenario_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select scenario" />
                  </SelectTrigger>
                  <SelectContent>
                    {SCENARIO_TYPES.map(s => (
                      <SelectItem key={s.value} value={s.value}>
                        <div>
                          <div className="font-medium">{s.label}</div>
                          <div className="text-xs text-muted-foreground">{s.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select
                  value={newSimulation.severity}
                  onValueChange={(v) => setNewSimulation(s => ({ ...s, severity: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={newSimulation.description}
                  onChange={(e) => setNewSimulation(s => ({ ...s, description: e.target.value }))}
                  placeholder="Describe the simulation scenario..."
                />
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={createSimulation.isPending}>
                Create Simulation
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Simulations List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Simulations</CardTitle>
            <CardDescription>{simulations?.length || 0} defined</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : simulations?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No simulations yet</div>
                ) : (
                  simulations?.map(sim => (
                    <div
                      key={sim.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedSimulation === sim.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => {
                        setSelectedSimulation(sim.id);
                        setSelectedRun(null);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{sim.name}</div>
                        <Badge className={getSeverityColor(sim.severity)}>
                          {sim.severity}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {SCENARIO_TYPES.find(s => s.value === sim.scenario_type)?.label || sim.scenario_type}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(sim.created_at), 'MMM d, yyyy')}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRun(sim.id);
                          }}
                          disabled={runSimulation.isPending}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Run
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Runs List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Simulation Runs</CardTitle>
            <CardDescription>
              {selectedSimulation ? `${runs?.length || 0} runs` : 'Select a simulation'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {!selectedSimulation ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Select a simulation to view runs
                  </div>
                ) : runs?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No runs yet. Click "Run" to execute.
                  </div>
                ) : (
                  runs?.map(run => (
                    <div
                      key={run.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedRun === run.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedRun(run.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(run.status, run.passed)}
                          <span className="font-medium capitalize">{run.status}</span>
                        </div>
                        {run.run_duration_ms && (
                          <span className="text-xs text-muted-foreground">
                            {run.run_duration_ms}ms
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {format(new Date(run.started_at), 'MMM d, yyyy HH:mm:ss')}
                      </div>
                      {run.failure_reason && (
                        <div className="text-xs text-red-500 mt-1 truncate">
                          {run.failure_reason}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Findings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Findings</CardTitle>
            <CardDescription>
              {selectedRun ? `${findings?.length || 0} findings` : 'Select a run'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {!selectedRun ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Select a run to view findings
                  </div>
                ) : findings?.length === 0 ? (
                  <div className="text-center py-8 text-green-500 flex flex-col items-center gap-2">
                    <CheckCircle2 className="h-8 w-8" />
                    <span>No findings - simulation passed</span>
                  </div>
                ) : (
                  findings?.map(finding => (
                    <div
                      key={finding.id}
                      className={`p-3 rounded-lg border ${
                        finding.resolved ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant={
                          finding.severity === 'critical' ? 'destructive' :
                          finding.severity === 'error' ? 'destructive' :
                          finding.severity === 'warning' ? 'secondary' : 'outline'
                        }>
                          {finding.severity}
                        </Badge>
                        {!finding.resolved && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => resolveFinding.mutate({ findingId: finding.id })}
                          >
                            Resolve
                          </Button>
                        )}
                      </div>
                      <div className="font-medium mt-2 capitalize">
                        {finding.finding_type.replace(/_/g, ' ')}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {finding.description}
                      </div>
                      {finding.recommended_action && (
                        <div className="text-xs text-blue-500 mt-2">
                          💡 {finding.recommended_action}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}