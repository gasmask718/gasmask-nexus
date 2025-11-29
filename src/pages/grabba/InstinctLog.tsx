import { useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  Brain,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Shield,
  Activity,
  RefreshCw,
  Settings,
  Eye,
  XCircle,
} from 'lucide-react';
import {
  useInstinctScan,
  useTriggers,
  useTriggerStats,
  useTriggerActions,
  useAutopilotSettings,
  useHealthScores,
} from '@/hooks/useInstincts';

const severityColors: Record<string, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-blue-500 text-white',
};

const categoryIcons: Record<string, any> = {
  finance: TrendingUp,
  crm: Eye,
  inventory: Shield,
  operations: Activity,
  personal: Brain,
  ambassador: Zap,
};

export default function InstinctLog() {
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  const { scan, isScanning } = useInstinctScan();
  const { data: triggers, isLoading: triggersLoading } = useTriggers({
    status: statusFilter === 'all' ? undefined : statusFilter,
    severity: severityFilter === 'all' ? undefined : severityFilter,
    limit: 50,
  });
  const { data: stats } = useTriggerStats();
  const { updateStatus, bulkResolve, isUpdating } = useTriggerActions();
  const { settings, updateSettings, isUpdating: settingsUpdating } = useAutopilotSettings();
  const { data: healthScores } = useHealthScores();

  const handleResolve = (id: string) => updateStatus({ id, status: 'resolved' });
  const handleDismiss = (id: string) => updateStatus({ id, status: 'dismissed' });
  const handleProcess = (id: string) => updateStatus({ id, status: 'processing' });

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Brain className="h-8 w-8 text-primary" />
              Instinct Log
            </h1>
            <p className="text-muted-foreground">Autonomous AI Nervous System Monitor</p>
          </div>
          <Button onClick={() => scan()} disabled={isScanning}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Scanning...' : 'Run Instinct Scan'}
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-destructive">{stats?.critical || 0}</div>
              <div className="text-sm text-muted-foreground">Critical</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-orange-500">{stats?.high || 0}</div>
              <div className="text-sm text-muted-foreground">High</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-yellow-500">{stats?.medium || 0}</div>
              <div className="text-sm text-muted-foreground">Medium</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-blue-500">{stats?.low || 0}</div>
              <div className="text-sm text-muted-foreground">Low</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold">{stats?.open || 0}</div>
              <div className="text-sm text-muted-foreground">Open</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-green-500">{stats?.resolved_today || 0}</div>
              <div className="text-sm text-muted-foreground">Resolved Today</div>
            </CardContent>
          </Card>
        </div>

        {/* Health Scores */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Financial Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Progress value={healthScores?.financial || 0} className="flex-1" />
                <span className="text-2xl font-bold">{healthScores?.financial || 0}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Operational Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Progress value={healthScores?.operational || 0} className="flex-1" />
                <span className="text-2xl font-bold">{healthScores?.operational || 0}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Overall Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Progress value={healthScores?.overall || 0} className="flex-1" />
                <span className="text-2xl font-bold">{healthScores?.overall || 0}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="triggers">
          <TabsList>
            <TabsTrigger value="triggers">Triggers</TabsTrigger>
            <TabsTrigger value="autopilot">Autopilot Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="triggers" className="space-y-4">
            {/* Filters */}
            <div className="flex gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Triggers List */}
            <div className="space-y-3">
              {triggersLoading ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    Loading triggers...
                  </CardContent>
                </Card>
              ) : triggers?.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p>No triggers detected. System running smoothly!</p>
                  </CardContent>
                </Card>
              ) : (
                triggers?.map((trigger) => {
                  const CategoryIcon = categoryIcons[trigger.category] || AlertTriangle;
                  return (
                    <Card key={trigger.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="p-2 rounded-lg bg-muted">
                              <CategoryIcon className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className={severityColors[trigger.severity]}>
                                  {trigger.severity}
                                </Badge>
                                <Badge variant="outline">{trigger.category}</Badge>
                                <Badge variant="secondary">{trigger.trigger_type}</Badge>
                              </div>
                              <p className="font-medium">{trigger.condition_detected}</p>
                              {trigger.recommended_action && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  <strong>Action:</strong> {trigger.recommended_action}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-2">
                                <Clock className="h-3 w-3 inline mr-1" />
                                {new Date(trigger.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          {trigger.status === 'open' && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleProcess(trigger.id)}
                                disabled={isUpdating}
                              >
                                <Clock className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleResolve(trigger.id)}
                                disabled={isUpdating}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDismiss(trigger.id)}
                                disabled={isUpdating}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>

          <TabsContent value="autopilot" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Autopilot Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Enable Autopilot</p>
                    <p className="text-sm text-muted-foreground">
                      Allow AI to take automatic actions based on triggers
                    </p>
                  </div>
                  <Switch
                    checked={settings?.autopilot_enabled || false}
                    onCheckedChange={(checked) => updateSettings({ autopilot_enabled: checked })}
                    disabled={settingsUpdating}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Auto-Create Tasks</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically create tasks from high-severity triggers
                    </p>
                  </div>
                  <Switch
                    checked={settings?.auto_create_tasks || false}
                    onCheckedChange={(checked) => updateSettings({ auto_create_tasks: checked })}
                    disabled={settingsUpdating}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Auto-Assign Routes</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically generate and assign routes for store visits
                    </p>
                  </div>
                  <Switch
                    checked={settings?.auto_assign_routes || false}
                    onCheckedChange={(checked) => updateSettings({ auto_assign_routes: checked })}
                    disabled={settingsUpdating}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Auto-Send Communications</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically send follow-up messages and reminders
                    </p>
                  </div>
                  <Switch
                    checked={settings?.auto_send_communications || false}
                    onCheckedChange={(checked) => updateSettings({ auto_send_communications: checked })}
                    disabled={settingsUpdating}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Auto Financial Corrections</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically suggest and apply budget corrections
                    </p>
                  </div>
                  <Switch
                    checked={settings?.auto_financial_corrections || false}
                    onCheckedChange={(checked) => updateSettings({ auto_financial_corrections: checked })}
                    disabled={settingsUpdating}
                  />
                </div>

                <div className="pt-4 border-t">
                  <p className="font-medium mb-2">Severity Threshold</p>
                  <p className="text-sm text-muted-foreground mb-3">
                    Minimum severity level for automatic actions
                  </p>
                  <Select
                    value={settings?.severity_threshold || 'high'}
                    onValueChange={(value: any) => updateSettings({ severity_threshold: value })}
                    disabled={settingsUpdating}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Critical Only</SelectItem>
                      <SelectItem value="high">High & Critical</SelectItem>
                      <SelectItem value="medium">Medium & Above</SelectItem>
                      <SelectItem value="low">All Severities</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}