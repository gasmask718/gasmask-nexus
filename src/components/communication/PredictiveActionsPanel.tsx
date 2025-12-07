import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { 
  Zap, 
  MessageSquare, 
  Phone, 
  ClipboardList, 
  AlertTriangle,
  Bot,
  Settings,
  Play,
  Store
} from "lucide-react";
import { usePredictiveIntelligence } from "@/hooks/usePredictiveIntelligence";
import { useState } from "react";

interface PredictiveActionsPanelProps {
  businessId?: string;
}

export function PredictiveActionsPanel({ businessId }: PredictiveActionsPanelProps) {
  const { 
    predictiveActions, 
    actionsLoading, 
    executeAction, 
    isExecuting,
    autopilotSettings,
    updateAutopilot,
    stats 
  } = usePredictiveIntelligence(businessId);

  const [churnThreshold, setChurnThreshold] = useState(autopilotSettings?.churn_threshold || 75);
  const [opportunityThreshold, setOpportunityThreshold] = useState(autopilotSettings?.opportunity_threshold || 80);

  const getActionIcon = (type: string) => {
    if (type.includes("message") || type.includes("sms")) {
      return <MessageSquare className="h-4 w-4" />;
    }
    if (type.includes("call")) {
      return <Phone className="h-4 w-4" />;
    }
    if (type.includes("task")) {
      return <ClipboardList className="h-4 w-4" />;
    }
    return <Zap className="h-4 w-4" />;
  };

  const getPriorityBadge = (priority: string) => {
    if (priority === "high") return <Badge variant="destructive">High Priority</Badge>;
    if (priority === "medium") return <Badge className="bg-yellow-500">Medium</Badge>;
    return <Badge variant="secondary">Low</Badge>;
  };

  const handleAutopilotToggle = (enabled: boolean) => {
    updateAutopilot({ enabled });
  };

  const handleAutoRecoveryToggle = (enabled: boolean) => {
    updateAutopilot({ auto_recovery_enabled: enabled });
  };

  const handleAutoUpsellToggle = (enabled: boolean) => {
    updateAutopilot({ auto_upsell_enabled: enabled });
  };

  const handleThresholdUpdate = () => {
    updateAutopilot({ 
      churn_threshold: churnThreshold, 
      opportunity_threshold: opportunityThreshold 
    });
  };

  if (actionsLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Autopilot Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Predictive Autopilot Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Predictive Autopilot</Label>
              <p className="text-sm text-muted-foreground">
                AI automatically acts on predictions
              </p>
            </div>
            <Switch
              checked={autopilotSettings?.enabled || false}
              onCheckedChange={handleAutopilotToggle}
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-Recovery Sequences</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically trigger recovery for at-risk stores
                </p>
              </div>
              <Switch
                checked={autopilotSettings?.auto_recovery_enabled || false}
                onCheckedChange={handleAutoRecoveryToggle}
                disabled={!autopilotSettings?.enabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-Upsell Sequences</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically trigger upsell for high-opportunity stores
                </p>
              </div>
              <Switch
                checked={autopilotSettings?.auto_upsell_enabled || false}
                onCheckedChange={handleAutoUpsellToggle}
                disabled={!autopilotSettings?.enabled}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Churn Risk Threshold</Label>
                <span className="text-sm font-medium">{churnThreshold}%</span>
              </div>
              <Slider
                value={[churnThreshold]}
                onValueChange={([value]) => setChurnThreshold(value)}
                max={100}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Trigger recovery when churn risk exceeds this threshold
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Opportunity Threshold</Label>
                <span className="text-sm font-medium">{opportunityThreshold}%</span>
              </div>
              <Slider
                value={[opportunityThreshold]}
                onValueChange={([value]) => setOpportunityThreshold(value)}
                max={100}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Trigger upsell when opportunity score exceeds this threshold
              </p>
            </div>

            <Button onClick={handleThresholdUpdate} variant="outline" className="w-full">
              <Settings className="h-4 w-4 mr-2" />
              Save Thresholds
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pending Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Pending Predictive Actions
            </span>
            <Badge variant="secondary">{stats.pendingActionsCount} pending</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {predictiveActions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No pending actions</p>
              <p className="text-sm">AI will generate actions based on predictions</p>
            </div>
          ) : (
            <div className="space-y-4">
              {predictiveActions.map((action) => (
                <div
                  key={action.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getActionIcon(action.action_type)}
                        <span className="font-medium capitalize">{action.action_type}</span>
                        {getPriorityBadge(action.priority)}
                      </div>

                      {action.store && (
                        <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                          <Store className="h-3 w-3" />
                          {action.store.store_name}
                        </div>
                      )}

                      {action.ai_reason && (
                        <p className="text-sm mb-2">
                          <strong>Reason:</strong> {action.ai_reason}
                        </p>
                      )}

                      {action.recommended_content && (
                        <div className="bg-muted/50 p-2 rounded text-sm">
                          <strong>Recommended:</strong> {action.recommended_content}
                        </div>
                      )}

                      {action.predicted_intent && (
                        <Badge variant="outline" className="mt-2">
                          Intent: {action.predicted_intent}
                        </Badge>
                      )}
                    </div>

                    <Button
                      size="sm"
                      onClick={() => executeAction(action.id)}
                      disabled={isExecuting}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Execute
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
