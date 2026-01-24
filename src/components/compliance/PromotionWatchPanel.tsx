import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
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
  Eye,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
  Shield
} from 'lucide-react';
import { Promotion, useWatchEvents, useRollback } from '@/hooks/useAILearning';
import { format, formatDistanceToNow } from 'date-fns';

interface PromotionWatchPanelProps {
  promotion: Promotion;
  onBack: () => void;
}

export function PromotionWatchPanel({ promotion, onBack }: PromotionWatchPanelProps) {
  const { data: events, isLoading } = useWatchEvents(promotion.id);
  const rollback = useRollback();
  
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false);
  const [rollbackReason, setRollbackReason] = useState('');

  const timeRemaining = promotion.watch_mode_until 
    ? Math.max(0, new Date(promotion.watch_mode_until).getTime() - Date.now())
    : 0;
  
  const watchProgress = promotion.watch_mode_until
    ? Math.min(100, ((48 * 60 * 60 * 1000 - timeRemaining) / (48 * 60 * 60 * 1000)) * 100)
    : 100;

  const criticalEvents = events?.filter(e => e.severity === 'critical') || [];
  const warningEvents = events?.filter(e => e.severity === 'warning') || [];

  const handleRollback = () => {
    rollback.mutate({
      promotionId: promotion.id,
      rollbackReason,
      rolledBackBy: crypto.randomUUID() // In real app, use actual user ID
    });
    setRollbackDialogOpen(false);
  };

  const getEventIcon = (eventType: string, severity: string) => {
    if (severity === 'critical') return <AlertTriangle className="h-4 w-4 text-red-500" />;
    if (severity === 'warning') return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    if (eventType === 'permanence_granted') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    return <Activity className="h-4 w-4 text-blue-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h2 className="text-xl font-semibold">Watch Mode: v{promotion.version_number}</h2>
          <p className="text-sm text-muted-foreground">{promotion.promotion_scope}</p>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Watch Progress</span>
              <Eye className="h-4 w-4 text-primary" />
            </div>
            <Progress value={watchProgress} className="mb-2" />
            <div className="flex items-center justify-between text-xs">
              <span>{Math.round(watchProgress)}% complete</span>
              {timeRemaining > 0 && (
                <span className="text-muted-foreground">
                  {formatDistanceToNow(new Date(promotion.watch_mode_until || ''))} remaining
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">Health Status</span>
              {criticalEvents.length > 0 ? (
                <Badge variant="destructive">Critical</Badge>
              ) : warningEvents.length > 0 ? (
                <Badge className="bg-yellow-500">Warning</Badge>
              ) : (
                <Badge className="bg-green-500">Healthy</Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span>{criticalEvents.length} critical</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <span>{warningEvents.length} warnings</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">Sensitivity</span>
              <Shield className="h-4 w-4 text-purple-500" />
            </div>
            {promotion.elevated_sensitivity ? (
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600">
                Elevated Sensitivity Active
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-green-500/10 text-green-600">
                Normal Sensitivity
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Artifact Comparison */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Previous Version</CardTitle>
            <CardDescription>Can be restored via rollback</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-48">
              {JSON.stringify(promotion.previous_snapshot, null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Current Version (Active)</CardTitle>
            <CardDescription>Currently in production</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-48">
              {JSON.stringify(promotion.new_snapshot, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>

      {/* Watch Events Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Watch Events Timeline
          </CardTitle>
          <CardDescription>Real-time monitoring of promotion health</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-4">Loading events...</p>
          ) : events && events.length > 0 ? (
            <div className="space-y-4">
              {events.map((event) => (
                <div key={event.id} className="flex items-start gap-4 border-l-2 pl-4 pb-4 border-muted">
                  <div className="flex-shrink-0 mt-1">
                    {getEventIcon(event.event_type, event.severity)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {event.event_type.replace(/_/g, ' ')}
                      </span>
                      <Badge 
                        variant="outline" 
                        className={
                          event.severity === 'critical' ? 'bg-red-500/10 text-red-500' :
                          event.severity === 'warning' ? 'bg-yellow-500/10 text-yellow-500' :
                          'bg-blue-500/10 text-blue-500'
                        }
                      >
                        {event.severity}
                      </Badge>
                      {event.triggered_rollback && (
                        <Badge variant="destructive">Triggered Rollback</Badge>
                      )}
                    </div>
                    {event.action_taken && (
                      <p className="text-sm text-muted-foreground mt-1">{event.action_taken}</p>
                    )}
                    {event.anomaly_score !== null && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Anomaly score: {(event.anomaly_score * 100).toFixed(1)}%
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(event.created_at), 'MMM d, yyyy HH:mm:ss')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">No events recorded yet</p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Promoted: {format(new Date(promotion.promoted_at), 'MMM d, yyyy HH:mm')}
            </div>
            <Button 
              variant="destructive"
              onClick={() => setRollbackDialogOpen(true)}
              disabled={promotion.is_rolled_back}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Instant Rollback
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Rollback Confirmation Dialog */}
      <Dialog open={rollbackDialogOpen} onOpenChange={setRollbackDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Confirm Rollback
            </DialogTitle>
            <DialogDescription>
              This will immediately restore the previous version. The rollback is auditable and irreversible in logs.
            </DialogDescription>
          </DialogHeader>

          <div>
            <Textarea
              placeholder="Reason for rollback..."
              value={rollbackReason}
              onChange={(e) => setRollbackReason(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRollbackDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleRollback}
              disabled={!rollbackReason || rollback.isPending}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {rollback.isPending ? 'Rolling back...' : 'Confirm Rollback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
