import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw, 
  Users,
  Phone,
  Target,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';

interface CampaignRun {
  id: string;
  campaign_id: string;
  run_number: number;
  status: string;
  actual_start?: string;
  total_targets: number;
  contacts_attempted: number;
  contacts_reached: number;
  conversions: number;
  escalations: number;
  opt_outs: number;
  violations: number;
  initial_confidence?: number;
  outbound_campaigns?: {
    name: string;
    status: string;
  };
}

interface ActiveRunsMonitorProps {
  runs: CampaignRun[];
  onHalt: (runId: string) => void;
  isLoading: boolean;
}

export function ActiveRunsMonitor({ runs, onHalt, isLoading }: ActiveRunsMonitorProps) {
  if (runs.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Play className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-lg font-medium">No Active Runs</p>
          <p className="text-muted-foreground">
            Start a campaign run to see real-time execution monitoring
          </p>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500';
      case 'paused': return 'bg-yellow-500';
      case 'halted': return 'bg-red-500';
      default: return 'bg-muted';
    }
  };

  return (
    <div className="space-y-4">
      {runs.map(run => {
        const progress = run.total_targets > 0 
          ? (run.contacts_attempted / run.total_targets) * 100 
          : 0;
        
        const conversionRate = run.contacts_reached > 0
          ? ((run.conversions / run.contacts_reached) * 100).toFixed(1)
          : '0';

        return (
          <Card key={run.id}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(run.status)} animate-pulse`} />
                  <div>
                    <p className="font-semibold">
                      {run.outbound_campaigns?.name || 'Campaign'} - Run #{run.run_number}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Started {run.actual_start ? new Date(run.actual_start).toLocaleTimeString() : 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(run.status)}>
                    {run.status.toUpperCase()}
                  </Badge>
                  {run.status === 'running' && (
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => onHalt(run.id)}
                      disabled={isLoading}
                    >
                      <Square className="h-4 w-4 mr-1" />
                      Emergency Halt
                    </Button>
                  )}
                </div>
              </div>

              {/* Progress */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Progress</span>
                  <span>{run.contacts_attempted} / {run.total_targets} contacts</span>
                </div>
                <Progress value={progress} />
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Reached</p>
                    <p className="font-semibold">{run.contacts_reached}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Conversions</p>
                    <p className="font-semibold text-green-500">{run.conversions}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Conv. Rate</p>
                    <p className="font-semibold">{conversionRate}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-yellow-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Escalations</p>
                    <p className="font-semibold text-yellow-500">{run.escalations}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Violations</p>
                    <p className="font-semibold text-red-500">{run.violations}</p>
                  </div>
                </div>
              </div>

              {/* Confidence Indicator */}
              {run.initial_confidence && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">AI Confidence</span>
                    <Badge variant={run.initial_confidence > 0.8 ? 'default' : 'secondary'}>
                      {(run.initial_confidence * 100).toFixed(0)}%
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default ActiveRunsMonitor;
