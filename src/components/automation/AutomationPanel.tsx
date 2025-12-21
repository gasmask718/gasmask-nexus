import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Zap, Brain, Activity, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { useAutomationRules, useAutomationEvents, useAutomationStats, useAINodes, useAIPredictions } from '@/hooks/useAutomation';
import { AutomationTriggerCard } from './AutomationTriggerCard';
import { useUserRole } from '@/hooks/useUserRole';
import { formatDistanceToNow } from 'date-fns';

interface AutomationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  floorId?: string;
}

export function AutomationPanel({ isOpen, onClose, floorId }: AutomationPanelProps) {
  const [activeTab, setActiveTab] = useState('rules');
  const { rules, toggle, execute } = useAutomationRules(floorId);
  const events = useAutomationEvents({ limit: 30 });
  const stats = useAutomationStats();
  const { nodes, toggle: toggleNode, runAll } = useAINodes();
  const predictions = useAIPredictions({ limit: 20 });
  const { role } = useUserRole();

  const canManage = role === 'admin' || role === 'employee';
  const canView = canManage || role === 'csr';

  // Show message if user doesn't have permission instead of silently returning null
  if (!canView) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Automation Control Center
            </SheetTitle>
          </SheetHeader>
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground text-center">
              You don't have permission to view automations.<br />
              Please contact an administrator.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Automation Control Center
          </SheetTitle>
        </SheetHeader>

        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-2 my-4">
          <Card className="p-2">
            <div className="text-center">
              <div className="text-lg font-bold">{stats.enabledRules}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
          </Card>
          <Card className="p-2">
            <div className="text-center">
              <div className="text-lg font-bold">{stats.totalEvents}</div>
              <div className="text-xs text-muted-foreground">Events</div>
            </div>
          </Card>
          <Card className="p-2">
            <div className="text-center">
              <div className="text-lg font-bold text-green-500">{stats.completedEvents}</div>
              <div className="text-xs text-muted-foreground">Success</div>
            </div>
          </Card>
          <Card className="p-2">
            <div className="text-center">
              <div className="text-lg font-bold text-red-500">{stats.failedEvents}</div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </div>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="rules" className="text-xs">
              <Zap className="h-3 w-3 mr-1" />
              Rules
            </TabsTrigger>
            <TabsTrigger value="events" className="text-xs">
              <Activity className="h-3 w-3 mr-1" />
              Events
            </TabsTrigger>
            <TabsTrigger value="ai" className="text-xs">
              <Brain className="h-3 w-3 mr-1" />
              AI Nodes
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[calc(100vh-280px)] mt-4">
            <TabsContent value="rules" className="space-y-3 m-0">
              {rules.map((rule) => (
                <AutomationTriggerCard
                  key={rule.id}
                  rule={rule}
                  onToggle={(enabled) => toggle(rule.id, enabled)}
                  onExecute={() => execute(rule.id)}
                  disabled={!canManage}
                />
              ))}
            </TabsContent>

            <TabsContent value="events" className="space-y-2 m-0">
              {events.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No automation events yet
                </div>
              ) : (
                events.map((event) => (
                  <Card key={event.id} className="p-3">
                    <div className="flex items-start gap-3">
                      {event.status === 'completed' ? (
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                      ) : event.status === 'failed' ? (
                        <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                      ) : (
                        <Clock className="h-4 w-4 text-yellow-500 mt-0.5 animate-pulse" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm truncate">{event.ruleName}</span>
                          <Badge
                            variant={
                              event.status === 'completed'
                                ? 'default'
                                : event.status === 'failed'
                                ? 'destructive'
                                : 'secondary'
                            }
                            className="text-xs"
                          >
                            {event.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                        </p>
                        {event.error && (
                          <p className="text-xs text-red-500 mt-1">{event.error}</p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="ai" className="space-y-4 m-0">
              {/* AI Nodes */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>AI Nodes</span>
                    <Button size="sm" variant="outline" onClick={() => runAll()} disabled={!canManage}>
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Run All
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {nodes.map((node) => (
                    <div key={node.nodeType} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Brain className={`h-4 w-4 ${node.isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div>
                          <div className="text-sm font-medium">{node.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {node.predictionsGenerated} predictions • {node.accuracy}% accuracy
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={node.isActive}
                        onCheckedChange={(active) => toggleNode(node.nodeType, active)}
                        disabled={!canManage}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Recent Predictions */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Recent Predictions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {predictions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No predictions yet. Run AI nodes to generate.
                    </p>
                  ) : (
                    predictions.slice(0, 5).map((pred) => (
                      <div key={pred.id} className="p-2 rounded-md border">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{pred.title}</span>
                          <Badge variant="outline" className="text-xs">
                            {Math.round(pred.confidence)}%
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{pred.description}</p>
                        {pred.suggestedAction && (
                          <p className="text-xs text-primary mt-1">→ {pred.suggestedAction}</p>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
