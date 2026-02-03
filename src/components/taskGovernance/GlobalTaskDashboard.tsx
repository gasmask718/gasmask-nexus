/**
 * GlobalTaskDashboard - Cross-floor task visibility
 * Shows all active tasks across Floors 1-9
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Brain,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  MessageSquare,
  Package,
  Truck,
  DollarSign,
  Factory,
  ShoppingCart,
  Users,
  Loader2,
  Trash2,
} from 'lucide-react';
import { getAllActiveTasks, FLOOR_REGISTRIES, FloorId } from '@/services/taskGovernance';

const FLOOR_ICONS: Record<FloorId, React.ElementType> = {
  floor1_crm: Building2,
  floor2_communication: MessageSquare,
  floor3_inventory: Package,
  floor4_delivery: Truck,
  floor5_finance: DollarSign,
  floor6_production: Factory,
  floor7_marketplace: ShoppingCart,
  floor8_ambassadors: Users,
  floor9_ai: Brain,
};

export function GlobalTaskDashboard() {
  const [showDeleted, setShowDeleted] = useState(false);
  
  const { data: activeTasks = [], isLoading } = useQuery({
    queryKey: ['global-active-tasks', showDeleted],
    queryFn: () => getAllActiveTasks({ includeDeleted: showDeleted }),
    refetchInterval: 5000,
  });

  // Group tasks by floor
  const tasksByFloor = activeTasks.reduce((acc, task) => {
    const floorId = task.floor_id;
    if (!acc[floorId]) acc[floorId] = [];
    acc[floorId].push(task);
    return acc;
  }, {} as Record<FloorId, typeof activeTasks>);

  // Calculate stats
  const runningCount = activeTasks.filter(t => t.status === 'running').length;
  const queuedCount = activeTasks.filter(t => t.status === 'queued').length;
  const awaitingApproval = activeTasks.filter(t => t.status === 'paused_for_approval').length;
  const deletedCount = activeTasks.filter(t => t.deleted_at !== null).length;

  const getFloorName = (floorId: FloorId) => {
    return FLOOR_REGISTRIES.find(r => r.floor_id === floorId)?.floor_name || floorId;
  };

  const getStatusBadge = (status: string, isDeleted?: boolean) => {
    if (isDeleted) {
      return <Badge variant="outline" className="text-muted-foreground">
        <XCircle className="h-3 w-3 mr-1" />
        Deleted
      </Badge>;
    }
    switch (status) {
      case 'running':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Running
        </Badge>;
      case 'queued':
        return <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          Queued
        </Badge>;
      case 'paused_for_approval':
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Awaiting Approval
        </Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Global Task Command Center
          </CardTitle>
          <div className="flex items-center gap-2">
            <Switch
              id="show-deleted"
              checked={showDeleted}
              onCheckedChange={setShowDeleted}
            />
            <Label htmlFor="show-deleted" className="text-xs text-muted-foreground">
              <Trash2 className="h-3 w-3 inline mr-1" />
              Show Deleted ({deletedCount})
            </Label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{runningCount}</p>
                <p className="text-xs text-muted-foreground">Running</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-900/30">
                <Clock className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{queuedCount}</p>
                <p className="text-xs text-muted-foreground">Queued</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{awaitingApproval}</p>
                <p className="text-xs text-muted-foreground">Awaiting Approval</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator className="my-4" />

        {/* Tasks by Floor */}
        <ScrollArea className="h-[400px]">
          <div className="space-y-6 pr-4">
            {Object.entries(tasksByFloor).length > 0 ? (
              Object.entries(tasksByFloor).map(([floorId, tasks]) => {
                const FloorIcon = FLOOR_ICONS[floorId as FloorId] || Brain;
                return (
                  <div key={floorId}>
                    <div className="flex items-center gap-2 mb-3">
                      <FloorIcon className="h-4 w-4 text-primary" />
                      <h3 className="font-medium text-sm">{getFloorName(floorId as FloorId)}</h3>
                      <Badge variant="outline" className="ml-auto">
                        {tasks.length} active
                      </Badge>
                    </div>
                    <div className="space-y-2 pl-6">
                      {tasks.map(task => {
                        const percentage = task.total_items > 0 
                          ? Math.round((task.items_processed / task.total_items) * 100) 
                          : 0;
                        const isDeleted = task.deleted_at !== null;
                        
                        return (
                          <div 
                            key={task.id}
                            className={`p-3 rounded-lg border bg-card flex items-center justify-between ${isDeleted ? 'opacity-50' : ''}`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`font-medium text-sm ${isDeleted ? 'line-through' : ''}`}>{task.task_title}</span>
                                {getStatusBadge(task.status, isDeleted)}
                              </div>
                              {task.total_items > 0 && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-primary rounded-full transition-all"
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                  <span>{percentage}%</span>
                                  <span className="text-muted-foreground">
                                    ({task.items_processed}/{task.total_items})
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">All Clear</p>
                <p className="text-sm">No active tasks across any floor</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
