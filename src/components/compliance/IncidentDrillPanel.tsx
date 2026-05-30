import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { 
  useIncidentDrills, 
  useRunDrill,
  DRILL_TYPES
} from "@/hooks/useIncidentDrills";
import { 
  Siren, 
  Play, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Clock,
  Zap,
  Shield,
  User,
  FileText,
  Bell
} from "lucide-react";
import { format } from "date-fns";

interface Props {
  businessId: string | null;
}

export function IncidentDrillPanel({ businessId }: Props) {
  const [selectedDrill, setSelectedDrill] = useState<string | null>(null);
  const [newDrill, setNewDrill] = useState({
    drill_type: '',
    drill_name: '',
    description: ''
  });

  const { data: drills, isLoading } = useIncidentDrills(businessId);
  const runDrill = useRunDrill();

  const handleRunDrill = () => {
    if (!businessId || !newDrill.drill_type || !newDrill.drill_name) return;
    runDrill.mutate({
      businessId,
      drillType: newDrill.drill_type,
      drillName: newDrill.drill_name,
      description: newDrill.description,
      initiatedBy: 'admin'
    }, {
      onSuccess: () => {
        setNewDrill({ drill_type: '', drill_name: '', description: '' });
      }
    });
  };

  const getStatusIcon = (status: string, score?: number | null) => {
    if (status === 'in_progress') return <Clock className="h-5 w-5 text-blue-500 animate-pulse" />;
    if (status === 'completed' && score && score >= 80) return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    if (status === 'completed' && score && score < 80) return <AlertTriangle className="h-5 w-5 text-orange-500" />;
    if (status === 'failed') return <XCircle className="h-5 w-5 text-red-500" />;
    return <Clock className="h-5 w-5 text-muted-foreground" />;
  };

  const getDrillIcon = (drillType: string) => {
    switch (drillType) {
      case 'kill_switch_activation': return <Zap className="h-4 w-4" />;
      case 'human_takeover': return <User className="h-4 w-4" />;
      case 'ai_stop_command': return <XCircle className="h-4 w-4" />;
      case 'confidence_breach_response': return <AlertTriangle className="h-4 w-4" />;
      case 'audit_persistence': return <FileText className="h-4 w-4" />;
      case 'alert_verification': return <Bell className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  const selectedDrillData = drills?.find(d => d.id === selectedDrill);

  // Calculate overall readiness score
  const completedDrills = drills?.filter(d => d.status === 'completed') || [];
  const avgScore = completedDrills.length > 0
    ? completedDrills.reduce((sum, d) => sum + (d.drill_readiness_score || 0), 0) / completedDrills.length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Siren className="h-6 w-6" />
            Incident Drill Mode
          </h2>
          <p className="text-muted-foreground">
            Operational readiness testing: trigger simulated emergencies
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground">Overall Readiness</div>
          <div className={`text-3xl font-bold ${
            avgScore >= 90 ? 'text-green-500' :
            avgScore >= 70 ? 'text-yellow-500' : 'text-red-500'
          }`}>
            {avgScore.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Quick Drill Launcher */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Launch New Drill</CardTitle>
          <CardDescription>Execute an operational readiness drill</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Drill Type</Label>
              <Select
                value={newDrill.drill_type}
                onValueChange={(v) => {
                  const drillInfo = DRILL_TYPES.find(d => d.value === v);
                  setNewDrill(d => ({ 
                    ...d, 
                    drill_type: v,
                    drill_name: d.drill_name || drillInfo?.label || ''
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select drill type" />
                </SelectTrigger>
                <SelectContent>
                  {DRILL_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        {getDrillIcon(type.value)}
                        <div>
                          <div>{type.label}</div>
                          <div className="text-xs text-muted-foreground">{type.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Drill Name</Label>
              <Input
                value={newDrill.drill_name}
                onChange={(e) => setNewDrill(d => ({ ...d, drill_name: e.target.value }))}
                placeholder="e.g., Q1 Kill Switch Test"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Input
                value={newDrill.description}
                onChange={(e) => setNewDrill(d => ({ ...d, description: e.target.value }))}
                placeholder="Drill context..."
              />
            </div>
            <div className="flex items-end">
              <Button 
                className="w-full"
                onClick={handleRunDrill}
                disabled={runDrill.isPending || !newDrill.drill_type || !newDrill.drill_name}
              >
                {runDrill.isPending ? (
                  <>Running...</>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Execute Drill
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Drill History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Drill History</CardTitle>
            <CardDescription>{drills?.length || 0} drills executed</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : drills?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No drills executed yet
                  </div>
                ) : (
                  drills?.map(drill => (
                    <div
                      key={drill.id}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedDrill === drill.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedDrill(drill.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(drill.status, drill.drill_readiness_score)}
                          <span className="font-medium">{drill.drill_name}</span>
                        </div>
                        {drill.drill_readiness_score && (
                          <Badge className={
                            drill.drill_readiness_score >= 90 ? 'bg-green-500' :
                            drill.drill_readiness_score >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                          }>
                            {drill.drill_readiness_score}%
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        {getDrillIcon(drill.drill_type)}
                        <span>{DRILL_TYPES.find(t => t.value === drill.drill_type)?.label}</span>
                        <span>•</span>
                        <span>{format(new Date(drill.initiated_at), 'MMM d, yyyy HH:mm')}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Drill Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Drill Results</CardTitle>
            <CardDescription>
              {selectedDrillData ? selectedDrillData.drill_name : 'Select a drill'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedDrillData ? (
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                Select a drill to view results
              </div>
            ) : (
              <div className="space-y-4">
                {/* Readiness Score */}
                <div className="text-center p-6 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-2">Readiness Score</div>
                  <div className={`text-5xl font-bold ${
                    (selectedDrillData.drill_readiness_score || 0) >= 90 ? 'text-green-500' :
                    (selectedDrillData.drill_readiness_score || 0) >= 70 ? 'text-yellow-500' : 'text-red-500'
                  }`}>
                    {selectedDrillData.drill_readiness_score?.toFixed(0) || 0}%
                  </div>
                  <Progress 
                    value={selectedDrillData.drill_readiness_score || 0} 
                    className="mt-4 h-2"
                  />
                </div>

                {/* Verification Results */}
                <div className="grid grid-cols-2 gap-3">
                  <div className={`p-3 rounded-lg border flex items-center gap-2 ${
                    selectedDrillData.ai_stopped_correctly ? 'bg-green-500/10 border-green-500/20' : 'bg-muted'
                  }`}>
                    {selectedDrillData.ai_stopped_correctly ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <div className="font-medium text-sm">AI Stopped</div>
                      <div className="text-xs text-muted-foreground">
                        {selectedDrillData.ai_stopped_correctly ? 'Verified' : 'N/A'}
                      </div>
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg border flex items-center gap-2 ${
                    selectedDrillData.human_takeover_activated ? 'bg-green-500/10 border-green-500/20' : 'bg-muted'
                  }`}>
                    {selectedDrillData.human_takeover_activated ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <div className="font-medium text-sm">Human Takeover</div>
                      <div className="text-xs text-muted-foreground">
                        {selectedDrillData.human_takeover_activated ? 'Activated' : 'N/A'}
                      </div>
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg border flex items-center gap-2 ${
                    selectedDrillData.audit_logs_persisted ? 'bg-green-500/10 border-green-500/20' : 'bg-muted'
                  }`}>
                    {selectedDrillData.audit_logs_persisted ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <div className="font-medium text-sm">Audit Logs</div>
                      <div className="text-xs text-muted-foreground">
                        {selectedDrillData.audit_logs_persisted ? 'Persisted' : 'N/A'}
                      </div>
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg border flex items-center gap-2 ${
                    selectedDrillData.alerts_fired_correctly ? 'bg-green-500/10 border-green-500/20' : 'bg-muted'
                  }`}>
                    {selectedDrillData.alerts_fired_correctly ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <div className="font-medium text-sm">Alerts Fired</div>
                      <div className="text-xs text-muted-foreground">
                        {selectedDrillData.alerts_fired_correctly ? 'Correct' : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Findings */}
                {selectedDrillData.findings && selectedDrillData.findings.length > 0 && (
                  <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                    <div className="font-medium text-orange-500 mb-2">Findings</div>
                    <ul className="text-sm space-y-1">
                      {selectedDrillData.findings.map((finding, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <AlertTriangle className="h-3 w-3 text-orange-500" />
                          {finding}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Latency Metrics */}
                {selectedDrillData.latency_metrics && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="font-medium text-sm mb-2">Latency Metrics</div>
                    <div className="text-xs font-mono">
                      {JSON.stringify(selectedDrillData.latency_metrics, null, 2)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}