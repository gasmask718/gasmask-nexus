// ═══════════════════════════════════════════════════════════════════════════════
// ALERTS PANEL — Floor 4 Phase 3
// Real-time alert monitoring and management
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  ArrowUp,
  Eye,
  MessageSquare,
  XCircle,
} from "lucide-react";
import { useOpenAlerts, useAlertStats, useAlertActions, type DeliveryAlert, type AlertSeverity } from "@/hooks/useDeliveryAlerts";
import { formatDistanceToNow } from "date-fns";

export function AlertsPanel() {
  const { data: alerts, isLoading } = useOpenAlerts();
  const { data: stats } = useAlertStats();
  const { acknowledgeAlert, startAlert, resolveAlert, escalateAlert } = useAlertActions();
  
  const [selectedAlert, setSelectedAlert] = useState<DeliveryAlert | null>(null);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  
  const getSeverityColor = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'high':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default:
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }
  };
  
  const getSeverityIcon = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-4 w-4" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };
  
  const handleAcknowledge = async (alertId: string) => {
    await acknowledgeAlert.mutateAsync(alertId);
  };
  
  const handleStart = async (alertId: string) => {
    await startAlert.mutateAsync(alertId);
  };
  
  const handleResolve = async () => {
    if (!selectedAlert || !resolutionNotes.trim()) return;
    
    await resolveAlert.mutateAsync({
      alertId: selectedAlert.id,
      resolutionNotes: resolutionNotes.trim(),
    });
    
    setResolveDialogOpen(false);
    setSelectedAlert(null);
    setResolutionNotes("");
  };
  
  const handleEscalate = async (alert: DeliveryAlert) => {
    // In production, would show a dialog to select escalation target
    await escalateAlert.mutateAsync({
      alertId: alert.id,
      escalateTo: 'manager', // Would be actual user ID
      reason: 'Requires higher authority',
    });
  };
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Live Alerts
          </CardTitle>
          
          {stats && (
            <div className="flex items-center gap-2">
              {stats.critical > 0 && (
                <Badge variant="destructive">{stats.critical} Critical</Badge>
              )}
              {stats.high > 0 && (
                <Badge className="bg-orange-500">{stats.high} High</Badge>
              )}
              {stats.slaBreached > 0 && (
                <Badge variant="outline" className="border-red-500 text-red-500">
                  <Clock className="h-3 w-3 mr-1" />
                  {stats.slaBreached} SLA Breached
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading alerts...
            </div>
          ) : alerts?.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p className="text-muted-foreground">All clear - no open alerts</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts?.map((alert) => (
                <Card 
                  key={alert.id} 
                  className={`border-l-4 ${
                    alert.severity === 'critical' ? 'border-l-red-500' :
                    alert.severity === 'high' ? 'border-l-orange-500' :
                    alert.severity === 'medium' ? 'border-l-yellow-500' :
                    'border-l-blue-500'
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={getSeverityColor(alert.severity)}>
                          {getSeverityIcon(alert.severity)}
                          <span className="ml-1 capitalize">{alert.severity}</span>
                        </Badge>
                        
                        {alert.sla_breached && (
                          <Badge variant="destructive" className="gap-1">
                            <Clock className="h-3 w-3" />
                            SLA Breached
                          </Badge>
                        )}
                        
                        {alert.escalation_level > 1 && (
                          <Badge variant="outline" className="gap-1">
                            <ArrowUp className="h-3 w-3" />
                            Level {alert.escalation_level}
                          </Badge>
                        )}
                      </div>
                      
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    
                    <h4 className="font-medium mb-1">{alert.title}</h4>
                    {alert.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {alert.description}
                      </p>
                    )}
                    
                    {/* SLA Timer */}
                    {alert.sla_deadline && !alert.sla_breached && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                        <Clock className="h-3 w-3" />
                        SLA: {formatDistanceToNow(new Date(alert.sla_deadline))} remaining
                      </div>
                    )}
                    
                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      {alert.status === 'open' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleAcknowledge(alert.id)}
                          disabled={acknowledgeAlert.isPending}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Acknowledge
                        </Button>
                      )}
                      
                      {alert.status === 'acknowledged' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleStart(alert.id)}
                          disabled={startAlert.isPending}
                        >
                          Working on it
                        </Button>
                      )}
                      
                      <Button 
                        size="sm" 
                        variant="default"
                        onClick={() => {
                          setSelectedAlert(alert);
                          setResolveDialogOpen(true);
                        }}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Resolve
                      </Button>
                      
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleEscalate(alert)}
                        disabled={escalateAlert.isPending}
                      >
                        <ArrowUp className="h-3 w-3 mr-1" />
                        Escalate
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
      
      {/* Resolve Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Alert</DialogTitle>
          </DialogHeader>
          
          {selectedAlert && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <h4 className="font-medium">{selectedAlert.title}</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedAlert.description}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Resolution Notes (required)
                </label>
                <Textarea
                  placeholder="Describe how this was resolved..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleResolve}
              disabled={!resolutionNotes.trim() || resolveAlert.isPending}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Resolve Alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
