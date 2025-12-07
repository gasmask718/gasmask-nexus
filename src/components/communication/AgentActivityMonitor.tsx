import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { 
  Activity, 
  Play, 
  Pause, 
  ArrowRight, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { useAIAgents, type AgentAssignment } from "@/hooks/useAIAgents";
import { useBusiness } from "@/contexts/BusinessContext";
import { formatDistanceToNow } from "date-fns";

const statusColors: Record<string, string> = {
  pending: "bg-amber-500",
  in_progress: "bg-blue-500",
  completed: "bg-green-500",
  escalated: "bg-red-500",
  failed: "bg-destructive",
};

const priorityColors: Record<string, string> = {
  low: "text-muted-foreground",
  medium: "text-amber-500",
  high: "text-orange-500",
  critical: "text-red-500",
};

function AssignmentRow({ assignment, onExecute }: { assignment: AgentAssignment; onExecute: () => void }) {
  return (
    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
      <div className="flex items-center gap-3 flex-1">
        <div className={`w-2 h-2 rounded-full ${statusColors[assignment.status]}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{assignment.task_type}</span>
            <Badge variant="outline" className={`text-xs ${priorityColors[assignment.priority]}`}>
              {assignment.priority}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {assignment.agent && (
              <span>{assignment.agent.name}</span>
            )}
            {assignment.store && (
              <>
                <ArrowRight className="h-3 w-3" />
                <span>{assignment.store.store_name}</span>
              </>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(assignment.created_at), { addSuffix: true })}
        </span>
        {assignment.status === "pending" && (
          <Button size="sm" variant="outline" onClick={onExecute}>
            <Play className="h-3 w-3 mr-1" />
            Execute
          </Button>
        )}
        {assignment.status === "in_progress" && (
          <Button size="sm" variant="outline">
            <Pause className="h-3 w-3 mr-1" />
            Pause
          </Button>
        )}
      </div>
    </div>
  );
}

export function AgentActivityMonitor() {
  const { currentBusiness } = useBusiness();
  const { 
    agents, 
    assignments, 
    assignmentsLoading,
    updateAssignment,
    stats 
  } = useAIAgents(currentBusiness?.id);

  const handleExecute = (assignmentId: string) => {
    updateAssignment({ id: assignmentId, status: "in_progress" });
  };

  // Calculate agent efficiency
  const activeAgentsWithTasks = agents.filter(a => 
    a.active && assignments.some(as => as.agent_id === a.id)
  );

  return (
    <div className="space-y-6">
      {/* Live Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-green-500/10">
              <Activity className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Agents</p>
              <p className="text-xl font-bold">{stats.activeAgents}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-amber-500/10">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-xl font-bold">{stats.pendingTasks}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-500/10">
              <RefreshCw className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">In Progress</p>
              <p className="text-xl font-bold">{stats.inProgressTasks}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-purple-500/10">
              <ArrowRight className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Handoffs Today</p>
              <p className="text-xl font-bold">{stats.totalHandoffs}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Agent Cards */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Live Agent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeAgentsWithTasks.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No agents currently processing tasks
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeAgentsWithTasks.map((agent) => {
                const agentAssignments = assignments.filter(a => a.agent_id === agent.id);
                const inProgress = agentAssignments.filter(a => a.status === "in_progress").length;
                
                return (
                  <Card key={agent.id} className="bg-muted/30">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium">{agent.name}</span>
                        <Badge variant={inProgress > 0 ? "default" : "secondary"}>
                          {inProgress > 0 ? "Working" : "Idle"}
                        </Badge>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Active Tasks</span>
                          <span>{agentAssignments.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Success Rate</span>
                          <span>{agent.success_rate}%</span>
                        </div>
                        <Progress value={agent.success_rate} className="h-1.5" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assignment Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Assignment Queue
            </span>
            <Badge variant="secondary">{assignments.length} tasks</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assignmentsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="text-muted-foreground">All caught up! No pending tasks.</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {assignments.map((assignment) => (
                  <AssignmentRow 
                    key={assignment.id} 
                    assignment={assignment}
                    onExecute={() => handleExecute(assignment.id)}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
