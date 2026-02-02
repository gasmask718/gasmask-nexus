import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  ArrowUpCircle,
  MessageSquare,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAlertActions } from "@/hooks/useDeliveryAlerts";
import type { LiveAlert } from "@/hooks/useLiveMapData";

interface AlertDrawerProps {
  alert: LiveAlert | null;
  open: boolean;
  onClose: () => void;
}

export function AlertDrawer({
  alert,
  open,
  onClose,
}: AlertDrawerProps) {
  const navigate = useNavigate();
  const { acknowledgeAlert, resolveAlert, escalateAlert } = useAlertActions();
  const [resolutionNotes, setResolutionNotes] = useState('');

  if (!alert) return null;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const handleAcknowledge = () => {
    acknowledgeAlert.mutate(alert.id, {
      onSuccess: () => {
        // Keep drawer open to show updated state
      },
    });
  };

  const handleResolve = () => {
    if (!resolutionNotes.trim()) return;
    resolveAlert.mutate({
      alertId: alert.id,
      resolutionNotes,
    }, {
      onSuccess: () => {
        setResolutionNotes('');
        onClose();
      },
    });
  };

  const handleEscalate = () => {
    // For now, escalate to a generic admin
    escalateAlert.mutate({
      alertId: alert.id,
      escalateTo: 'admin',
      reason: 'Escalated from Live Map',
    });
  };

  const timeAgo = Math.round((Date.now() - new Date(alert.created_at).getTime()) / 60000);

  return (
    <Sheet open={open} onOpenChange={() => onClose()}>
      <SheetContent side="right" className="w-[400px] sm:w-[450px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            {getSeverityIcon(alert.severity)}
            <div>
              <div className="text-lg">{alert.title}</div>
              <div className="text-sm font-normal text-muted-foreground">
                Alert #{alert.id.slice(0, 8)}
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status & Severity */}
          <div className="flex items-center gap-3">
            <Badge className={getSeverityColor(alert.severity)}>
              {alert.severity.toUpperCase()}
            </Badge>
            <Badge variant="outline">{alert.status}</Badge>
            {alert.sla_breached && (
              <Badge variant="destructive">SLA BREACHED</Badge>
            )}
          </div>

          {/* Description */}
          {alert.description && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Description</h4>
              <p className="text-sm text-muted-foreground">{alert.description}</p>
            </div>
          )}

          {/* Timing */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Created
              </div>
              <div className="font-medium text-sm">
                {timeAgo < 60 ? `${timeAgo}m ago` : `${Math.round(timeAgo / 60)}h ago`}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Escalation Level</div>
              <div className="font-medium text-sm">Level {alert.escalation_level}</div>
            </div>
          </div>

          {/* SLA Info */}
          {alert.sla_deadline && (
            <div className="rounded-lg border p-3 border-red-200 bg-red-50 dark:bg-red-950/20">
              <div className="text-xs text-muted-foreground">SLA Deadline</div>
              <div className={`font-medium ${alert.sla_breached ? 'text-red-500' : ''}`}>
                {new Date(alert.sla_deadline).toLocaleString()}
              </div>
            </div>
          )}

          <Separator />

          {/* Quick Actions */}
          <div className="space-y-3">
            <h4 className="font-medium">Quick Actions</h4>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={handleAcknowledge}
                disabled={alert.status !== 'open' || acknowledgeAlert.isPending}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Acknowledge
              </Button>
              <Button
                variant="outline"
                onClick={handleEscalate}
                disabled={escalateAlert.isPending}
              >
                <ArrowUpCircle className="h-4 w-4 mr-2" />
                Escalate
              </Button>
            </div>
          </div>

          <Separator />

          {/* Resolve */}
          <div className="space-y-3">
            <h4 className="font-medium">Resolve Alert</h4>
            <Textarea
              placeholder="Enter resolution notes..."
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              rows={3}
            />
            <Button
              className="w-full"
              onClick={handleResolve}
              disabled={!resolutionNotes.trim() || resolveAlert.isPending}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Resolve Alert
            </Button>
          </div>

          <Separator />

          {/* Navigation */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate('/delivery/route-ops')}
          >
            <Eye className="h-4 w-4 mr-2" />
            View in Route Ops Center
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
