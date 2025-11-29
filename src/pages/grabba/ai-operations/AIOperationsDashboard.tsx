import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Brain,
  AlertTriangle,
  TrendingUp,
  Package,
  Truck,
  Users,
  Zap,
  RefreshCw,
  ChevronRight,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react';
import { useAIAlerts, useAIPredictions, useAITasks, useAITaskRunner } from '@/hooks/useAIEngine';
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

const AIOperationsDashboard = () => {
  const { data: alerts, isLoading: alertsLoading } = useAIAlerts();
  const { data: predictions, isLoading: predictionsLoading } = useAIPredictions();
  const { data: tasks, isLoading: tasksLoading } = useAITasks();
  const { runTask, isRunning } = useAITaskRunner();

  const criticalAlerts = alerts?.filter(a => a.severity === 'critical') || [];
  const warningAlerts = alerts?.filter(a => a.severity === 'warning') || [];

  const quickActions = [
    { label: 'Run Daily Report', icon: TrendingUp, task: tasks?.find(t => t.name === 'Daily Sales Report') },
    { label: 'Check Inventory', icon: Package, task: tasks?.find(t => t.name === 'Inventory Health Check') },
    { label: 'Optimize Routes', icon: Truck, task: tasks?.find(t => t.name === 'Route Optimization') },
    { label: 'CRM Follow-ups', icon: Users, task: tasks?.find(t => t.name === 'CRM Follow-up List') },
  ];

  return (
    <GrabbaLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Brain className="h-8 w-8 text-primary" />
              AI Operations Center
            </h1>
            <p className="text-muted-foreground mt-1">
              Central command for all AI-powered automations and insights
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/grabba/ai-operations/tasks">
              <Button variant="outline">View All Tasks</Button>
            </Link>
            <Link to="/grabba/ai-operations/predictions">
              <Button variant="outline">Predictions</Button>
            </Link>
            <Link to="/grabba/ai-operations/alerts">
              <Button variant="default">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Alerts ({alerts?.length || 0})
              </Button>
            </Link>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-red-500/20 bg-red-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Critical Alerts</p>
                  <p className="text-3xl font-bold text-red-500">{criticalAlerts.length}</p>
                </div>
                <AlertTriangle className="h-10 w-10 text-red-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-500/20 bg-yellow-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Warnings</p>
                  <p className="text-3xl font-bold text-yellow-500">{warningAlerts.length}</p>
                </div>
                <Clock className="h-10 w-10 text-yellow-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-500/20 bg-green-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Tasks</p>
                  <p className="text-3xl font-bold text-green-500">
                    {tasks?.filter(t => t.isEnabled).length || 0}
                  </p>
                </div>
                <CheckCircle className="h-10 w-10 text-green-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">AI Health</p>
                  <p className="text-3xl font-bold text-primary">98%</p>
                </div>
                <Brain className="h-10 w-10 text-primary/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Quick Actions
              </CardTitle>
              <CardDescription>Run AI tasks manually</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {quickActions.map((action, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  className="w-full justify-start"
                  disabled={isRunning || !action.task}
                  onClick={() => action.task && runTask(action.task)}
                >
                  <action.icon className="h-4 w-4 mr-2" />
                  {action.label}
                  {isRunning && <RefreshCw className="h-4 w-4 ml-auto animate-spin" />}
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* AI Alerts Feed */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                AI Alerts & Problems
              </CardTitle>
              <CardDescription>Issues detected by the AI system</CardDescription>
            </CardHeader>
            <CardContent>
              {alertsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : alerts && alerts.length > 0 ? (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {alerts.slice(0, 10).map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-3 rounded-lg border ${
                          alert.severity === 'critical'
                            ? 'bg-red-500/10 border-red-500/30'
                            : alert.severity === 'warning'
                            ? 'bg-yellow-500/10 border-yellow-500/30'
                            : 'bg-muted/50 border-border'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  alert.severity === 'critical'
                                    ? 'destructive'
                                    : alert.severity === 'warning'
                                    ? 'secondary'
                                    : 'outline'
                                }
                              >
                                {alert.severity}
                              </Badge>
                              <span className="font-medium">{alert.title}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {alert.description}
                            </p>
                          </div>
                          <Button size="sm" variant="ghost">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p>No active alerts. System is running smoothly.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Predictions Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              AI Predictions & Forecasts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {predictionsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
              </div>
            ) : (
              <Tabs defaultValue="sales">
                <TabsList>
                  <TabsTrigger value="sales">Sales Forecast</TabsTrigger>
                  <TabsTrigger value="inventory">Inventory</TabsTrigger>
                  <TabsTrigger value="demand">Demand Spikes</TabsTrigger>
                </TabsList>

                <TabsContent value="sales" className="mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {predictions?.salesForecasts.map((forecast) => (
                      <Card key={forecast.brand}>
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium capitalize">{forecast.brand}</span>
                            <Badge variant={forecast.trend === 'rising' ? 'default' : forecast.trend === 'declining' ? 'destructive' : 'secondary'}>
                              {forecast.trend}
                            </Badge>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">This Week</span>
                              <span>${forecast.currentWeek.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Next Week</span>
                              <span className="font-medium">${forecast.nextWeek.toLocaleString()}</span>
                            </div>
                          </div>
                          <Progress value={forecast.confidence} className="mt-3 h-1" />
                          <p className="text-xs text-muted-foreground mt-1">{forecast.confidence}% confidence</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="inventory" className="mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {predictions?.inventoryProjections.map((item) => (
                      <Card key={item.brand} className={
                        item.urgency === 'critical' ? 'border-red-500/30' :
                        item.urgency === 'warning' ? 'border-yellow-500/30' : ''
                      }>
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium capitalize">{item.brand}</span>
                            <Badge variant={
                              item.urgency === 'critical' ? 'destructive' :
                              item.urgency === 'warning' ? 'secondary' : 'outline'
                            }>
                              {item.urgency}
                            </Badge>
                          </div>
                          <p className="text-2xl font-bold">{item.daysUntilDepletion} days</p>
                          <p className="text-sm text-muted-foreground">until depletion</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="demand" className="mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {predictions?.demandSpikes.map((spike, idx) => (
                      <Card key={idx}>
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{spike.region}</p>
                              <p className="text-sm text-muted-foreground">{spike.date}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-green-500">+{spike.expectedIncrease}%</p>
                              <p className="text-sm text-muted-foreground">expected increase</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        {/* Recommendations Panel */}
        <Card>
          <CardHeader>
            <CardTitle>AI Recommendations</CardTitle>
            <CardDescription>Suggested actions based on current data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <h4 className="font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Restock Hot Mama
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Critical inventory level. Order within 24 hours to avoid stockout.
                </p>
                <Button size="sm" className="mt-3" variant="outline">
                  Auto Fix
                </Button>
              </div>
              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <h4 className="font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  Follow up: Smoke Kings
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  No order in 15 days. High likelihood of reorder if contacted today.
                </p>
                <Button size="sm" className="mt-3" variant="outline">
                  Schedule Call
                </Button>
              </div>
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <h4 className="font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  Bronx Route Optimization
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Detected 3 stores near each other. Can save 45 mins per driver.
                </p>
                <Button size="sm" className="mt-3" variant="outline">
                  Apply Route
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </GrabbaLayout>
  );
};

export default AIOperationsDashboard;
