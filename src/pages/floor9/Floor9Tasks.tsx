/**
 * Floor9Tasks - AI Task Execution Center (Phase 9.2)
 * 
 * Part of Phase 9.2 — Assisted Execution Engine
 * Humans assign tasks. AI executes within bounded authority.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  ShadowModeBanner, 
  RecommendationOnlyBadge,
  AssignAITaskModal,
  TaskExecutionCard,
} from "@/components/floor9";
import { 
  ClipboardList, 
  Clock, 
  Brain, 
  Plus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield,
  FileText,
  TrendingUp,
} from "lucide-react";
import { useFloor9Tasks, useWorkforceStats } from "@/hooks/useFloor9";
import { AIWorkTask } from '@/services/floor9/types';

type ExtendedAIWorkTask = AIWorkTask & {
  task_type?: string;
  execution_mode?: string;
  approval_status?: string;
  confidence_score?: number;
  risk_level?: string;
  time_saved_minutes?: number;
  rollback_until?: string;
  target_entity_type?: string;
  instructions?: string;
  // Progress tracking fields
  total_items?: number;
  items_processed?: number;
  items_completed?: number;
  items_blocked?: number;
  items_skipped?: number;
  items_pending_approval?: number;
  cancelled_at?: string;
};

export default function Floor9Tasks() {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  
  const { data: allTasks, isLoading } = useFloor9Tasks({});
  const { data: stats } = useWorkforceStats();

  // Filter tasks by status
  const filterTasks = (status?: string) => {
    if (!allTasks) return [];
    if (!status || status === 'all') return allTasks;
    if (status === 'awaiting_approval') {
      return allTasks.filter(t => 
        (t as ExtendedAIWorkTask).approval_status === 'pending' || 
        (t.status as string) === 'awaiting_approval'
      );
    }
    if (status === 'cancelled') {
      return allTasks.filter(t => (t.status as string) === 'cancelled');
    }
    return allTasks.filter(t => t.status === status);
  };

  const filteredTasks = filterTasks(activeTab);

  const getTabCount = (status: string) => {
    return filterTasks(status).length;
  };

  return (
    <div className="space-y-6">
      <ShadowModeBanner />

      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            AI Task Execution Center
          </h1>
          <p className="text-muted-foreground">
            Assign, monitor, and approve AI-executed tasks with full auditability
          </p>
        </div>
        <Button onClick={() => setShowAssignModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Assign AI Task
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Tasks</p>
                <p className="text-2xl font-bold">{stats?.total_tasks || 0}</p>
              </div>
              <Brain className="h-8 w-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Awaiting Approval</p>
                <p className="text-2xl font-bold text-amber-600">
                  {getTabCount('awaiting_approval')}
                </p>
              </div>
              <Shield className="h-8 w-8 text-amber-600/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Processing</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats?.processing_tasks || 0}
                </p>
              </div>
              <Loader2 className="h-8 w-8 text-blue-600/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Completed Today</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats?.tasks_today || 0}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600/20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Avg Confidence</p>
                <p className="text-2xl font-bold">{stats?.avg_confidence || 0}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Phase 9.2 Governance Notice */}
      <Card className="border-primary/50 bg-primary/5">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm">Phase 9.2: Assisted Execution</p>
              <p className="text-xs text-muted-foreground mt-1">
                AI executes within bounded authority. Humans assign tasks — AI cannot self-assign.
                All execution is sandboxed, logged, and reversible within 30 minutes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Task Queue
              </CardTitle>
              <CardDescription>
                All AI tasks with execution status and approval gates
              </CardDescription>
            </div>
            <RecommendationOnlyBadge />
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">
                All ({getTabCount('all')})
              </TabsTrigger>
              <TabsTrigger value="awaiting_approval" className="text-amber-600">
                Awaiting Approval ({getTabCount('awaiting_approval')})
              </TabsTrigger>
              <TabsTrigger value="pending">
                Pending ({getTabCount('pending')})
              </TabsTrigger>
              <TabsTrigger value="processing">
                Processing ({getTabCount('processing')})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed ({getTabCount('completed')})
              </TabsTrigger>
              <TabsTrigger value="failed">
                Failed ({getTabCount('failed')})
              </TabsTrigger>
              <TabsTrigger value="cancelled" className="text-muted-foreground">
                Cancelled ({getTabCount('cancelled')})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Loading tasks…</span>
                </div>
              ) : filteredTasks.length > 0 ? (
                filteredTasks.map(task => (
                  <TaskExecutionCard 
                    key={task.id} 
                    task={task as ExtendedAIWorkTask} 
                  />
                ))
              ) : (
                <div className="text-center py-12">
                  <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold text-lg">No Tasks in This View</h3>
                  <p className="text-muted-foreground">
                    {activeTab === 'all' 
                      ? 'Click "Assign AI Task" to create a new task'
                      : `No ${activeTab.replace('_', ' ')} tasks found`
                    }
                  </p>
                  {activeTab === 'all' && (
                    <Button 
                      className="mt-4" 
                      onClick={() => setShowAssignModal(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Assign First Task
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Assign Task Modal */}
      <AssignAITaskModal 
        open={showAssignModal} 
        onOpenChange={setShowAssignModal} 
      />
    </div>
  );
}
