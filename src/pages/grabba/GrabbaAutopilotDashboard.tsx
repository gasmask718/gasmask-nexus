// ═══════════════════════════════════════════════════════════════════════════════
// GRABBA AUTOPILOT DASHBOARD — AI-Powered Automation Control Center
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { 
  Zap, Brain, Activity, RefreshCw, TrendingUp, 
  AlertTriangle, CheckCircle, Clock, Settings,
  BarChart3, Target, Cpu, Network
} from 'lucide-react';
import {
  useAutomationRules,
  useAutomationEvents,
  useAutomationStats,
  useAINodes,
  useAIPredictions,
} from '@/hooks/useAutomation';
import { AutomationTriggerCard } from '@/components/automation/AutomationTriggerCard';
import { useGrabbaBrand } from '@/contexts/GrabbaBrandContext';
import { GRABBA_FLOORS } from '@/config/grabbaSkyscraper';
import { formatDistanceToNow } from 'date-fns';

export default function GrabbaAutopilotDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const { rules, toggle, execute } = useAutomationRules();
  const events = useAutomationEvents({ limit: 50 });
  const stats = useAutomationStats();
  const { nodes, toggle: toggleNode, runAll } = useAINodes();
  const predictions = useAIPredictions({ limit: 30 });
  const { selectedBrand } = useGrabbaBrand();

  // Calculate floor health based on automation stats
  const floorHealth = GRABBA_FLOORS.map((floor) => {
    const floorRules = rules.filter((r) => r.floorId === floor.id);
    const activeRules = floorRules.filter((r) => r.isEnabled).length;
    const totalRuns = floorRules.reduce((acc, r) => acc + r.runCount, 0);
    return {
      floor,
      activeRules,
      totalRules: floorRules.length,
      totalRuns,
      health: floorRules.length > 0 ? (activeRules / floorRules.length) * 100 : 0,
    };
  });

  return (
    <GrabbaLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="h-6 w-6 text-yellow-500" />
              AI Autopilot Dashboard
            </h1>
            <p className="text-muted-foreground">
              Cross-floor automation network and AI-powered insights
            </p>
          </div>
          <Button onClick={() => runAll(selectedBrand)} variant="default">
            <RefreshCw className="h-4 w-4 mr-2" />
            Run All AI Nodes
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Rules</p>
                  <p className="text-2xl font-bold">{stats.enabledRules}</p>
                </div>
                <Zap className="h-8 w-8 text-yellow-500/50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                of {stats.totalRules} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">AI Nodes Active</p>
                  <p className="text-2xl font-bold">{nodes.filter((n) => n.isActive).length}</p>
                </div>
                <Brain className="h-8 w-8 text-purple-500/50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                of {nodes.length} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Events Today</p>
                  <p className="text-2xl font-bold text-green-500">{stats.completedEvents}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500/50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {stats.failedEvents} failed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Predictions</p>
                  <p className="text-2xl font-bold">{predictions.length}</p>
                </div>
                <Target className="h-8 w-8 text-blue-500/50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Avg {Math.round(predictions.reduce((a, p) => a + p.confidence, 0) / (predictions.length || 1))}% confidence
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 w-full max-w-2xl">
            <TabsTrigger value="overview">
              <Activity className="h-4 w-4 mr-1" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="rules">
              <Zap className="h-4 w-4 mr-1" />
              Rules
            </TabsTrigger>
            <TabsTrigger value="ai-nodes">
              <Brain className="h-4 w-4 mr-1" />
              AI Nodes
            </TabsTrigger>
            <TabsTrigger value="predictions">
              <TrendingUp className="h-4 w-4 mr-1" />
              Predictions
            </TabsTrigger>
            <TabsTrigger value="logs">
              <Clock className="h-4 w-4 mr-1" />
              Logs
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Floor Health Grid */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5" />
                  Floor Automation Health
                </CardTitle>
                <CardDescription>
                  Status of automation rules across all floors
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {floorHealth.map(({ floor, activeRules, totalRules, totalRuns, health }) => (
                    <div key={floor.id} className="p-4 rounded-lg border bg-muted/30">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{floor.emoji}</span>
                        <span className="font-medium text-sm">{floor.name}</span>
                      </div>
                      <Progress value={health} className="h-2 mb-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{activeRules}/{totalRules} active</span>
                        <span>{totalRuns} runs</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity & Predictions Split */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Recent Events */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Recent Automation Events</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {events.slice(0, 10).map((event) => (
                        <div key={event.id} className="flex items-start gap-2 p-2 rounded border">
                          {event.status === 'completed' ? (
                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                          ) : event.status === 'failed' ? (
                            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                          ) : (
                            <Clock className="h-4 w-4 text-yellow-500 mt-0.5 animate-pulse" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{event.ruleName}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                            </p>
                          </div>
                          <Badge variant={event.status === 'completed' ? 'default' : event.status === 'failed' ? 'destructive' : 'secondary'} className="text-xs">
                            {event.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Latest Predictions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Latest AI Predictions</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {predictions.slice(0, 10).map((pred) => (
                        <div key={pred.id} className="p-3 rounded border">
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
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Rules Tab */}
          <TabsContent value="rules" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rules.map((rule) => (
                <AutomationTriggerCard
                  key={rule.id}
                  rule={rule}
                  onToggle={(enabled) => toggle(rule.id, enabled)}
                  onExecute={() => execute(rule.id)}
                />
              ))}
            </div>
          </TabsContent>

          {/* AI Nodes Tab */}
          <TabsContent value="ai-nodes" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {nodes.map((node) => (
                <Card key={node.nodeType} className={node.isActive ? 'border-primary/50' : 'opacity-60'}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Cpu className={`h-5 w-5 ${node.isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                        <h3 className="font-medium">{node.name}</h3>
                      </div>
                      <Switch
                        checked={node.isActive}
                        onCheckedChange={(active) => toggleNode(node.nodeType, active)}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Predictions</span>
                        <span>{node.predictionsGenerated}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Accuracy</span>
                        <span className="text-green-500">{node.accuracy}%</span>
                      </div>
                      {node.lastRun && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Last Run</span>
                          <span>{formatDistanceToNow(new Date(node.lastRun), { addSuffix: true })}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Predictions Tab */}
          <TabsContent value="predictions" className="space-y-4">
            <ScrollArea className="h-[600px]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {predictions.map((pred) => (
                  <Card key={pred.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <Badge variant="outline" className="mb-2">{pred.nodeType}</Badge>
                          <h3 className="font-medium">{pred.title}</h3>
                        </div>
                        <Badge className={pred.confidence > 85 ? 'bg-green-500' : pred.confidence > 70 ? 'bg-yellow-500' : 'bg-red-500'}>
                          {Math.round(pred.confidence)}%
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{pred.description}</p>
                      {pred.actionable && pred.suggestedAction && (
                        <div className="p-2 bg-primary/10 rounded text-sm">
                          <strong>Suggested:</strong> {pred.suggestedAction}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(pred.timestamp), { addSuffix: true })}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardContent className="pt-4">
                <ScrollArea className="h-[600px]">
                  <div className="space-y-2">
                    {events.map((event) => (
                      <div key={event.id} className="flex items-start gap-3 p-3 rounded border hover:bg-muted/50 transition-colors">
                        {event.status === 'completed' ? (
                          <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                        ) : event.status === 'failed' ? (
                          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                        ) : (
                          <Clock className="h-5 w-5 text-yellow-500 mt-0.5 animate-pulse" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{event.ruleName}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Trigger: {event.trigger.replace(/_/g, ' ')}
                          </p>
                          <div className="flex gap-1 mt-1">
                            {event.actions.map((action) => (
                              <Badge key={action} variant="secondary" className="text-xs">
                                {action.replace(/_/g, ' ')}
                              </Badge>
                            ))}
                          </div>
                          {event.error && (
                            <p className="text-sm text-red-500 mt-1">{event.error}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </GrabbaLayout>
  );
}
