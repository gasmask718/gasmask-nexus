// ═══════════════════════════════════════════════════════════════════════════════
// COLLECTIONS DASHBOARD — Floor 5 Finance & Orders
// Collections Command Center with KPIs, queues, and promise tracking
// ═══════════════════════════════════════════════════════════════════════════════

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  AlertTriangle, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  Mail, 
  MessageSquare, 
  Phone, 
  RefreshCw, 
  Scale, 
  TrendingUp, 
  Users,
  FileText,
  XCircle,
} from 'lucide-react';
import { useCollectionStats, useCollectionQueue } from '@/hooks/useCollections';
import { usePromiseStats, useUpcomingPromises, useOverduePromises } from '@/hooks/usePaymentPromises';
import { useAutomationQueueStats, useQueueMutations } from '@/hooks/useCollectionAutomation';
import { formatCurrency } from '@/lib/format';
import { format } from 'date-fns';

// ═══════════════════════════════════════════════════════════════════════════════
// RISK TIER COLORS
// ═══════════════════════════════════════════════════════════════════════════════

const riskColors = {
  low: 'bg-green-500/10 text-green-600 border-green-500/20',
  medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  high: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  critical: 'bg-red-500/10 text-red-600 border-red-500/20',
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function CollectionsDashboard() {
  const { data: stats, isLoading: statsLoading } = useCollectionStats();
  const { data: promiseStats, isLoading: promiseLoading } = usePromiseStats();
  const { data: queueStats, isLoading: queueLoading } = useAutomationQueueStats();
  const { data: upcomingPromises } = useUpcomingPromises(7);
  const { data: overduePromises } = useOverduePromises();
  const { data: pendingQueue } = useCollectionQueue('pending');
  const { retryFailed } = useQueueMutations();

  const isLoading = statsLoading || promiseLoading || queueLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Collections Dashboard</h1>
          <p className="text-muted-foreground">Monitor and manage outstanding accounts</p>
        </div>
        <Button variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Outstanding</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(stats?.total_outstanding || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Total Overdue</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-destructive">
              {formatCurrency(stats?.total_overdue || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Accounts</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.total_accounts || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Escalated</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.escalated_count || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Active Promises</span>
            </div>
            <p className="text-2xl font-bold mt-1">{promiseStats?.active_count || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Kept Rate (30d)</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {promiseStats?.kept_rate?.toFixed(0) || 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Risk Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Risk Distribution</CardTitle>
          <CardDescription>Accounts by risk tier</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {(['low', 'medium', 'high', 'critical'] as const).map((tier) => (
              <div key={tier} className={`p-4 rounded-lg border ${riskColors[tier]}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize">{tier}</span>
                  <Badge variant="outline" className={riskColors[tier]}>
                    {stats?.by_risk_tier?.[tier]?.count || 0}
                  </Badge>
                </div>
                <p className="text-lg font-bold mt-2">
                  {formatCurrency(stats?.by_risk_tier?.[tier]?.amount || 0)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="queue">Automation Queue</TabsTrigger>
          <TabsTrigger value="promises">Payment Promises</TabsTrigger>
          <TabsTrigger value="stages">Collection Stages</TabsTrigger>
        </TabsList>

        {/* Automation Queue Tab */}
        <TabsContent value="queue" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4 flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Mail className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{queueStats?.pending_emails || 0}</p>
                  <p className="text-xs text-muted-foreground">Emails Pending</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <MessageSquare className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{queueStats?.pending_sms || 0}</p>
                  <p className="text-xs text-muted-foreground">SMS Pending</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Phone className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{queueStats?.pending_calls || 0}</p>
                  <p className="text-xs text-muted-foreground">Calls Required</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <FileText className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{queueStats?.pending_statements || 0}</p>
                  <p className="text-xs text-muted-foreground">Statements</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{queueStats?.pending_escalations || 0}</p>
                  <p className="text-xs text-muted-foreground">Escalations</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Queue Stats */}
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-green-500/10">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {queueStats?.processed_today || 0} processed today
            </Badge>
            {(queueStats?.failed_count || 0) > 0 && (
              <Badge variant="destructive" className="cursor-pointer" onClick={() => retryFailed.mutate()}>
                <XCircle className="h-3 w-3 mr-1" />
                {queueStats?.failed_count} failed - Click to retry
              </Badge>
            )}
          </div>

          {/* Pending Queue List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pending Actions</CardTitle>
            </CardHeader>
            <CardContent>
              {(pendingQueue || []).length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No pending actions in queue</p>
              ) : (
                <div className="space-y-2">
                  {(pendingQueue || []).slice(0, 10).map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {item.action_type === 'email_sent' && <Mail className="h-4 w-4 text-blue-600" />}
                        {item.action_type === 'sms_sent' && <MessageSquare className="h-4 w-4 text-green-600" />}
                        {item.action_type === 'call_logged' && <Phone className="h-4 w-4 text-purple-600" />}
                        <div>
                          <p className="font-medium text-sm capitalize">
                            {item.action_type.replace(/_/g, ' ')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Scheduled: {format(new Date(item.scheduled_for), 'MMM d, yyyy, h:mm a')}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">Pending</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Promises Tab */}
        <TabsContent value="promises" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Active Promises</p>
                <p className="text-2xl font-bold">{promiseStats?.active_count || 0}</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(promiseStats?.active_amount || 0)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Due Next 7 Days</p>
                <p className="text-2xl font-bold text-amber-600">{promiseStats?.due_next_7_days || 0}</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(promiseStats?.due_next_7_days_amount || 0)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Kept (30d)</p>
                <p className="text-2xl font-bold text-green-600">{promiseStats?.kept_30d || 0}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Broken (30d)</p>
                <p className="text-2xl font-bold text-red-600">{promiseStats?.broken_30d || 0}</p>
              </CardContent>
            </Card>
          </div>

          {/* Kept Rate Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Promise Fulfillment Rate (30 days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Kept Rate</span>
                  <span className="font-medium">{promiseStats?.kept_rate?.toFixed(1) || 0}%</span>
                </div>
                <Progress value={promiseStats?.kept_rate || 0} className="h-3" />
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Promises */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upcoming Promises (Next 7 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              {(upcomingPromises || []).length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No upcoming promises</p>
              ) : (
                <div className="space-y-2">
                  {(upcomingPromises || []).map((promise) => (
                    <div key={promise.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{formatCurrency(promise.promise_amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          Due: {format(new Date(promise.promise_date), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600">
                        <Clock className="h-3 w-3 mr-1" />
                        Upcoming
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Overdue Promises */}
          {(overduePromises || []).length > 0 && (
            <Card className="border-red-500/50">
              <CardHeader>
                <CardTitle className="text-base text-red-600">Overdue Promises</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(overduePromises || []).map((promise) => (
                    <div key={promise.id} className="flex items-center justify-between p-3 bg-red-500/5 rounded-lg">
                      <div>
                        <p className="font-medium">{formatCurrency(promise.promise_amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          Was due: {format(new Date(promise.promise_date), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <Badge variant="destructive">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Overdue
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Collection Stages Tab */}
        <TabsContent value="stages" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats?.by_stage || {}).map(([stage, count]) => (
              <Card key={stage}>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground capitalize">
                    {stage.replace(/_/g, ' ')}
                  </p>
                  <p className="text-2xl font-bold">{count}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CollectionsDashboard;
