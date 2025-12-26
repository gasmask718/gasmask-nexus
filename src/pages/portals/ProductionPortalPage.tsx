import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EnhancedPortalLayout, CommandCenterKPI, ActivityFeed, ActivityItem } from '@/components/portal';
import { useSimulationMode } from '@/contexts/SimulationModeContext';
import { useResolvedData } from '@/hooks/useResolvedData';
import { Factory, Boxes, ClipboardList, CheckCircle, AlertTriangle, Truck, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const SIMULATION_BATCHES = [
  { id: 'BATCH-001', product: 'Premium Widget A', quantity: 500, progress: 75, status: 'in_progress' },
  { id: 'BATCH-002', product: 'Standard Widget B', quantity: 300, progress: 100, status: 'completed' },
];

const SIMULATION_WORK_ORDERS = [
  { id: 'WO-001', task: 'Package Batch 001', assignee: 'Team A', priority: 'high', status: 'in_progress' },
  { id: 'WO-002', task: 'Label Batch 002', assignee: 'Team B', priority: 'medium', status: 'pending' },
  { id: 'WO-003', task: 'QC Inspection', assignee: 'QC Team', priority: 'high', status: 'pending' },
  { id: 'WO-004', task: 'Prepare Shipment', assignee: 'Shipping', priority: 'low', status: 'pending' },
  { id: 'WO-005', task: 'Raw Material Check', assignee: 'Inventory', priority: 'medium', status: 'completed' },
];

const SIMULATION_QC = [
  { id: 'QC-001', batch: 'BATCH-001', result: 'pass', notes: 'All units meet spec', date: '2024-01-20' },
  { id: 'QC-002', batch: 'BATCH-002', result: 'pass', notes: 'Minor cosmetic issues on 2 units', date: '2024-01-19' },
];

const SIMULATION_ACTIVITY: ActivityItem[] = [
  { id: '1', type: 'success', title: 'Batch Completed', description: 'BATCH-002 ready for shipment', timestamp: new Date(Date.now() - 60 * 60 * 1000) },
  { id: '2', type: 'success', title: 'QC Passed', description: 'BATCH-001 passed inspection', timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000) },
  { id: '3', type: 'info', title: 'New Work Order', description: 'WO-003 assigned to QC Team', timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000) },
];

type KpiType = 'batches' | 'workOrders' | 'qcPending' | 'shipped' | 'incidents' | null;

export default function ProductionPortalPage() {
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();
  const [selectedKpi, setSelectedKpi] = useState<KpiType>(null);

  const batchesResult = useResolvedData([], SIMULATION_BATCHES);
  const workOrdersResult = useResolvedData([], SIMULATION_WORK_ORDERS);
  const qcResult = useResolvedData([], SIMULATION_QC);
  const activityResult = useResolvedData([], SIMULATION_ACTIVITY);

  const batches = batchesResult.data;
  const workOrders = workOrdersResult.data;
  const qcResults = qcResult.data;
  const activity = activityResult.data;

  const activeBatches = batches.filter(b => b.status === 'in_progress');
  const completedBatches = batches.filter(b => b.status === 'completed');

  const kpis = [
    { key: 'batches' as KpiType, label: 'Active Batches', value: activeBatches.length.toString(), variant: 'cyan' as const },
    { key: 'workOrders' as KpiType, label: 'Work Orders', value: workOrders.length.toString(), variant: 'amber' as const },
    { key: 'qcPending' as KpiType, label: 'QC Pending', value: '1', variant: 'purple' as const },
    { key: 'shipped' as KpiType, label: 'Ready to Ship', value: completedBatches.length.toString(), variant: 'green' as const },
    { key: 'incidents' as KpiType, label: 'Incidents', value: '0', variant: 'red' as const },
  ];

  const handleKpiClick = (kpi: KpiType) => {
    setSelectedKpi(selectedKpi === kpi ? null : kpi);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-emerald-100 text-emerald-800',
      pending: 'bg-amber-100 text-amber-800',
      pass: 'bg-emerald-100 text-emerald-800',
      fail: 'bg-red-100 text-red-800',
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
      case 'batches':
        return (
          <div className="space-y-3">
            <h4 className="font-semibold">Active Production Batches</h4>
            {activeBatches.map(batch => (
              <div key={batch.id} className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium">{batch.id}</p>
                    <p className="text-sm text-muted-foreground">{batch.product} • Qty: {batch.quantity}</p>
                  </div>
                  {getStatusBadge(batch.status)}
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={batch.progress} className="flex-1" />
                  <span className="text-sm font-medium">{batch.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        );
      case 'workOrders':
        return (
          <div className="space-y-2">
            <h4 className="font-semibold">Work Orders</h4>
            {workOrders.map(wo => (
              <div key={wo.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{wo.task}</p>
                  <p className="text-sm text-muted-foreground">{wo.assignee}</p>
                </div>
                <div className="flex items-center gap-2">
                  {getPriorityBadge(wo.priority)}
                  {getStatusBadge(wo.status)}
                </div>
              </div>
            ))}
          </div>
        );
      case 'qcPending':
        return (
          <div className="space-y-2">
            <h4 className="font-semibold">QC Results</h4>
            {qcResults.map(qc => (
              <div key={qc.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{qc.batch}</p>
                  <p className="text-sm text-muted-foreground">{qc.notes}</p>
                </div>
                {getStatusBadge(qc.result)}
              </div>
            ))}
          </div>
        );
      case 'shipped':
        return (
          <div className="space-y-2">
            <h4 className="font-semibold">Ready for Shipment</h4>
            {completedBatches.map(batch => (
              <div key={batch.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">{batch.id}</p>
                  <p className="text-sm text-muted-foreground">{batch.product} • Qty: {batch.quantity}</p>
                </div>
                <Button size="sm" variant="outline">Prepare Shipment</Button>
              </div>
            ))}
          </div>
        );
      case 'incidents':
        return (
          <div className="text-center py-6">
            <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-2" />
            <p className="font-medium">No Active Incidents</p>
            <p className="text-sm text-muted-foreground">All systems operating normally</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <EnhancedPortalLayout
      title="Production Portal"
      subtitle="Manufacturing, QC, and batch tracking"
      portalIcon={<Factory className="h-4 w-4 text-primary-foreground" />}
      quickActions={[
        { label: 'New Batch', href: '/portals/production/batches/new' },
        { label: 'Work Orders', href: '/portals/production/work-orders' },
        { label: 'QC Dashboard', href: '/portals/production/qc' },
      ]}
    >
      {/* KPI Command Center */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {kpis.map(kpi => (
          <CommandCenterKPI
            key={kpi.key}
            label={kpi.label}
            value={kpi.value}
            variant={kpi.variant}
            isActive={selectedKpi === kpi.key}
            onClick={() => handleKpiClick(kpi.key)}
            isSimulated={batchesResult.isSimulated}
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

      {/* Quick Actions Grid */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/portals/production/batches')}>
          <CardContent className="p-4 flex items-center gap-3">
            <Boxes className="h-8 w-8 text-primary" />
            <div>
              <p className="font-medium">Production Runs</p>
              <p className="text-sm text-muted-foreground">View all batches</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/portals/production/work-orders')}>
          <CardContent className="p-4 flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-amber-500" />
            <div>
              <p className="font-medium">Work Orders</p>
              <p className="text-sm text-muted-foreground">Manage tasks</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate('/portals/production/qc')}>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
            <div>
              <p className="font-medium">Quality Control</p>
              <p className="text-sm text-muted-foreground">QC checks & reports</p>
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
