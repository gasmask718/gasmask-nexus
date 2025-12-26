import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EnhancedPortalLayout, CommandCenterKPI, ActivityFeed, ActivityItem } from '@/components/portal';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { useResolvedData } from '@/hooks/useResolvedData';
import { Headphones, Inbox, CheckSquare, AlertCircle, FileText, ChevronUp, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

const SIMULATION_TASKS = [
  { id: 'TSK-001', title: 'Update store contact info', category: 'data_entry', priority: 'high', status: 'pending', dueDate: 'Today' },
  { id: 'TSK-002', title: 'Follow up with lead #123', category: 'outreach', priority: 'medium', status: 'in_progress', dueDate: 'Today' },
  { id: 'TSK-003', title: 'Process refund request', category: 'support', priority: 'high', status: 'pending', dueDate: 'Today' },
  { id: 'TSK-004', title: 'Verify product listings', category: 'data_entry', priority: 'low', status: 'pending', dueDate: 'Tomorrow' },
  { id: 'TSK-005', title: 'Schedule driver interviews', category: 'hr', priority: 'medium', status: 'pending', dueDate: 'This Week' },
];

const SIMULATION_APPROVALS = [
  { id: 'APR-001', type: 'Expense Report', amount: '$245.00', submitter: 'John Driver', status: 'pending' },
  { id: 'APR-002', type: 'Time Off Request', days: '3 days', submitter: 'Sarah Biker', status: 'pending' },
  { id: 'APR-003', type: 'Product Addition', product: 'New Widget X', submitter: 'Wholesaler A', status: 'pending' },
];

const SIMULATION_TICKETS = [
  { id: 'TKT-001', subject: 'Order not delivered', customer: 'Store ABC', priority: 'high', status: 'open' },
  { id: 'TKT-002', subject: 'Wrong item received', customer: 'Store XYZ', priority: 'medium', status: 'open' },
];

const SIMULATION_CHECKLIST = [
  { id: 'CHK-001', task: 'Check email inbox', completed: true },
  { id: 'CHK-002', task: 'Review pending approvals', completed: true },
  { id: 'CHK-003', task: 'Process support tickets', completed: false },
  { id: 'CHK-004', task: 'Update CRM notes', completed: false },
  { id: 'CHK-005', task: 'End of day report', completed: false },
];

const SIMULATION_ACTIVITY: ActivityItem[] = [
  { id: '1', type: 'success', title: 'Task Completed', description: 'Updated 5 store records', timestamp: new Date(Date.now() - 30 * 60 * 1000) },
  { id: '2', type: 'info', title: 'Approval Submitted', description: 'Forwarded expense report', timestamp: new Date(Date.now() - 60 * 60 * 1000) },
  { id: '3', type: 'success', title: 'Ticket Resolved', description: 'Closed TKT-099', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000) },
];

type KpiType = 'tasks' | 'approvals' | 'tickets' | 'urgent' | null;

export default function VAPortalPage() {
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();
  const [selectedKpi, setSelectedKpi] = useState<KpiType>(null);

  const tasksResult = useResolvedData([], SIMULATION_TASKS);
  const approvalsResult = useResolvedData([], SIMULATION_APPROVALS);
  const ticketsResult = useResolvedData([], SIMULATION_TICKETS);
  const checklistResult = useResolvedData([], SIMULATION_CHECKLIST);
  const activityResult = useResolvedData([], SIMULATION_ACTIVITY);

  const tasks = tasksResult.data;
  const approvals = approvalsResult.data;
  const tickets = ticketsResult.data;
  const checklist = checklistResult.data;
  const activity = activityResult.data;

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const pendingApprovals = approvals.filter(a => a.status === 'pending');
  const openTickets = tickets.filter(t => t.status === 'open');
  const urgentItems = [...tasks.filter(t => t.priority === 'high'), ...tickets.filter(t => t.priority === 'high')];
  const checklistProgress = checklist.length > 0 ? Math.round((checklist.filter(c => c.completed).length / checklist.length) * 100) : 0;

  const kpis = [
    { key: 'tasks' as KpiType, label: 'Pending Tasks', value: pendingTasks.length.toString(), variant: 'cyan' as const },
    { key: 'approvals' as KpiType, label: 'Approvals', value: pendingApprovals.length.toString(), variant: 'amber' as const },
    { key: 'tickets' as KpiType, label: 'Open Tickets', value: openTickets.length.toString(), variant: 'purple' as const },
    { key: 'urgent' as KpiType, label: 'Urgent Items', value: urgentItems.length.toString(), variant: 'red' as const },
  ];

  const handleKpiClick = (kpi: KpiType) => {
    setSelectedKpi(selectedKpi === kpi ? null : kpi);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-emerald-100 text-emerald-800',
      open: 'bg-red-100 text-red-800',
    };
    return <Badge className={colors[status] || 'bg-muted'}>{status.replace('_', ' ')}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-amber-100 text-amber-800',
      low: 'bg-blue-100 text-blue-800',
    };
    return <Badge variant="outline" className={colors[priority]}>{priority}</Badge>;
  };

  const renderDetailContent = () => {
    switch (selectedKpi) {
      case 'tasks':
        return (
          <div className="space-y-2">
            <h4 className="font-semibold">Task Inbox</h4>
            {pendingTasks.map(task => (
              <div key={task.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{task.title}</p>
                  <p className="text-sm text-muted-foreground">Due: {task.dueDate} • {task.category}</p>
                </div>
                <div className="flex items-center gap-2">
                  {getPriorityBadge(task.priority)}
                  <Button size="sm" variant="outline">Start</Button>
                </div>
              </div>
            ))}
          </div>
        );
      case 'approvals':
        return (
          <div className="space-y-2">
            <h4 className="font-semibold">Pending Approvals</h4>
            {pendingApprovals.map(approval => (
              <div key={approval.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{approval.type}</p>
                  <p className="text-sm text-muted-foreground">From: {approval.submitter}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="text-emerald-600">Approve</Button>
                  <Button size="sm" variant="outline" className="text-red-600">Reject</Button>
                </div>
              </div>
            ))}
          </div>
        );
      case 'tickets':
        return (
          <div className="space-y-2">
            <h4 className="font-semibold">Open Support Tickets</h4>
            {openTickets.map(ticket => (
              <div key={ticket.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{ticket.subject}</p>
                  <p className="text-sm text-muted-foreground">{ticket.customer}</p>
                </div>
                <div className="flex items-center gap-2">
                  {getPriorityBadge(ticket.priority)}
                  <Button size="sm" variant="ghost">Open</Button>
                </div>
              </div>
            ))}
          </div>
        );
      case 'urgent':
        return (
          <div className="space-y-2">
            <h4 className="font-semibold">Urgent Items</h4>
            {urgentItems.length === 0 ? (
              <div className="text-center py-4">
                <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-muted-foreground">No urgent items</p>
              </div>
            ) : (
              urgentItems.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                  <div>
                    <p className="font-medium">{item.title || item.subject}</p>
                    <p className="text-sm text-muted-foreground">High Priority</p>
                  </div>
                  <Button size="sm" variant="destructive">Handle Now</Button>
                </div>
              ))
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <EnhancedPortalLayout
      title="VA Portal"
      subtitle="Tasks, approvals, and support management"
      portalIcon={<Headphones className="h-4 w-4 text-primary-foreground" />}
      quickActions={[
        { label: 'View Tasks', href: '/portals/va/tasks' },
        { label: 'Approvals', href: '/portals/va/approvals' },
        { label: 'SOP Library', href: '/portals/va/sops' },
      ]}
    >
      {/* KPI Command Center */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {kpis.map(kpi => (
          <CommandCenterKPI
            key={kpi.key}
            label={kpi.label}
            value={kpi.value}
            variant={kpi.variant}
            isActive={selectedKpi === kpi.key}
            onClick={() => handleKpiClick(kpi.key)}
            isSimulated={tasksResult.isSimulated}
          />
        ))}
      </div>

      {/* View Details Bar */}
      {selectedKpi && (
        <Card className="mb-6 border-primary/20">
          <CardHeader className="py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Details</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setSelectedKpi(null)}>
              <ChevronUp className="h-4 w-4 mr-1" /> Close
            </Button>
          </CardHeader>
          <CardContent>{renderDetailContent()}</CardContent>
        </Card>
      )}

      {/* Daily Checklist */}
      <Card className="mb-6">
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Daily Checklist</CardTitle>
            <span className="text-sm text-muted-foreground">{checklistProgress}% complete</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {checklist.map(item => (
            <div key={item.id} className="flex items-center gap-3">
              <Checkbox checked={item.completed} />
              <span className={item.completed ? 'line-through text-muted-foreground' : ''}>{item.task}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Quick Actions Grid */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/portals/va/tasks')}>
          <CardContent className="p-4 flex items-center gap-3">
            <Inbox className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium">Task Inbox</p>
              <p className="text-sm text-muted-foreground">All assigned tasks</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/portals/va/tickets')}>
          <CardContent className="p-4 flex items-center gap-3">
            <Headphones className="h-8 w-8 text-purple-500" />
            <div>
              <p className="font-medium">Support Tickets</p>
              <p className="text-sm text-muted-foreground">Customer service</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/portals/va/sops')}>
          <CardContent className="p-4 flex items-center gap-3">
            <FileText className="h-8 w-8 text-blue-500" />
            <div>
              <p className="font-medium">SOP Library</p>
              <p className="text-sm text-muted-foreground">Procedures & guides</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFeed items={activity} isSimulated={activityResult.isSimulated} />
        </CardContent>
      </Card>
    </EnhancedPortalLayout>
  );
}
