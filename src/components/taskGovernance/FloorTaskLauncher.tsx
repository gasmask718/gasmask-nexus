/**
 * FloorTaskLauncher - Embeddable task launcher for any floor
 * Provides a consistent UI for launching and monitoring AI tasks
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Brain, 
  Play, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Loader2,
  ChevronRight,
  Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  FloorId,
  GovernedTask,
  TaskTemplate,
  getTaskTemplatesByFloor,
  getTasksByFloor,
  createGovernedTask,
  startTask,
} from '@/services/taskGovernance';
import { GovernedTaskCard } from './GovernedTaskCard';

interface FloorTaskLauncherProps {
  floorId: FloorId;
  floorName: string;
  compact?: boolean;
  maxTasks?: number;
}

export function FloorTaskLauncher({
  floorId,
  floorName,
  compact = false,
  maxTasks = 10,
}: FloorTaskLauncherProps) {
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState('active');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Get available task templates for this floor
  const taskTemplates = getTaskTemplatesByFloor(floorId);

  // Fetch active tasks for this floor
  const { data: activeTasks = [], isLoading: loadingActive } = useQuery({
    queryKey: ['governed-tasks', floorId, 'active'],
    queryFn: async () => {
      const queued = await getTasksByFloor(floorId, 'queued', maxTasks);
      const running = await getTasksByFloor(floorId, 'running', maxTasks);
      const paused = await getTasksByFloor(floorId, 'paused_for_approval', maxTasks);
      return [...queued, ...running, ...paused];
    },
    refetchInterval: 5000, // Real-time updates
  });

  // Fetch completed tasks
  const { data: completedTasks = [], isLoading: loadingCompleted } = useQuery({
    queryKey: ['governed-tasks', floorId, 'completed'],
    queryFn: () => getTasksByFloor(floorId, 'completed', maxTasks),
    enabled: selectedTab === 'completed',
  });

  // Fetch failed/cancelled tasks
  const { data: failedTasks = [], isLoading: loadingFailed } = useQuery({
    queryKey: ['governed-tasks', floorId, 'failed'],
    queryFn: async () => {
      const failed = await getTasksByFloor(floorId, 'failed', maxTasks);
      const cancelled = await getTasksByFloor(floorId, 'cancelled', maxTasks);
      return [...failed, ...cancelled];
    },
    enabled: selectedTab === 'failed',
  });

  // Launch task mutation
  const launchTaskMutation = useMutation({
    mutationFn: async (template: TaskTemplate) => {
      const taskId = await createGovernedTask({
        floor_id: floorId,
        task_type: template.task_type,
        task_title: template.task_title,
        task_details: template.description,
        priority: template.risk_level === 'critical' ? 'critical' : 
                  template.risk_level === 'high' ? 'high' : 'medium',
      });
      
      // Auto-start if no approval required
      if (!template.requires_approval) {
        await startTask(taskId);
      }
      
      return taskId;
    },
    onSuccess: (taskId) => {
      queryClient.invalidateQueries({ queryKey: ['governed-tasks', floorId] });
      toast.success('Task launched', { description: 'Check progress in the Active tab' });
      setSelectedTab('active');
      setExpandedTaskId(taskId);
    },
    onError: (error: Error) => {
      toast.error('Failed to launch task', { description: error.message });
    },
  });

  const getRiskBadge = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical':
        return <Badge variant="destructive">Critical Risk</Badge>;
      case 'high':
        return <Badge className="bg-orange-500">High Risk</Badge>;
      case 'medium':
        return <Badge variant="secondary">Medium Risk</Badge>;
      default:
        return <Badge variant="outline">Low Risk</Badge>;
    }
  };

  const getTasksByTab = () => {
    switch (selectedTab) {
      case 'active':
        return activeTasks;
      case 'completed':
        return completedTasks;
      case 'failed':
        return failedTasks;
      default:
        return [];
    }
  };

  const isLoading = selectedTab === 'active' ? loadingActive :
                    selectedTab === 'completed' ? loadingCompleted : loadingFailed;

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            AI Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Activity className="h-3 w-3 text-blue-500" />
                <span>{activeTasks.filter(t => t.status === 'running').length} running</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-amber-500" />
                <span>{activeTasks.filter(t => t.status === 'queued').length} queued</span>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setSelectedTab('available')}>
              Launch Task
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          {floorName} Tasks
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="available" className="flex items-center gap-1">
              <Play className="h-3 w-3" />
              Available
            </TabsTrigger>
            <TabsTrigger value="active" className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              Active
              {activeTasks.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1">
                  {activeTasks.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Completed
            </TabsTrigger>
            <TabsTrigger value="failed" className="flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              Failed
            </TabsTrigger>
          </TabsList>

          {/* Available Tasks */}
          <TabsContent value="available">
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 pr-4">
                {taskTemplates.map((template) => (
                  <Card key={template.id} className="border-l-4 border-l-primary/30">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-sm">{template.task_title}</h4>
                            {getRiskBadge(template.risk_level)}
                            {template.requires_approval && (
                              <Badge variant="outline" className="text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Approval Required
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            {template.description}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              ~{template.estimated_duration_minutes} min
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {template.category.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => launchTaskMutation.mutate(template)}
                          disabled={launchTaskMutation.isPending}
                        >
                          {launchTaskMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Play className="h-3 w-3 mr-1" />
                              Launch
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {taskTemplates.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No tasks available for this floor</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Active / Completed / Failed Tasks */}
          {['active', 'completed', 'failed'].map((tab) => (
            <TabsContent key={tab} value={tab}>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3 pr-4">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : getTasksByTab().length > 0 ? (
                    getTasksByTab().map((task) => (
                      <GovernedTaskCard
                        key={task.id}
                        task={task}
                        isExpanded={expandedTaskId === task.id}
                        onToggleExpand={() => 
                          setExpandedTaskId(expandedTaskId === task.id ? null : task.id)
                        }
                        onRefresh={() => 
                          queryClient.invalidateQueries({ queryKey: ['governed-tasks', floorId] })
                        }
                      />
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      {tab === 'active' && <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />}
                      {tab === 'completed' && <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />}
                      {tab === 'failed' && <XCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />}
                      <p>No {tab} tasks</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
