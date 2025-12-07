import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, Plus, Shield, AlertTriangle } from "lucide-react";
import { useAIAgents } from "@/hooks/useAIAgents";
import { useBusiness } from "@/contexts/BusinessContext";
import { AIAgentCard } from "./AIAgentCard";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function AIAgentsPanel() {
  const { currentBusiness } = useBusiness();
  const { 
    agents, 
    agentsLoading, 
    assignments, 
    toggleAgent,
    stats 
  } = useAIAgents(currentBusiness?.id);

  const getAssignmentCount = (agentId: string) => 
    assignments.filter(a => a.agent_id === agentId).length;

  if (agentsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Bot className="h-8 w-8 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Agents</p>
            <p className="text-2xl font-bold">{stats.totalAgents}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-green-500">{stats.activeAgents}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Pending Tasks</p>
            <p className="text-2xl font-bold text-amber-500">{stats.pendingTasks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">In Progress</p>
            <p className="text-2xl font-bold text-blue-500">{stats.inProgressTasks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Handoffs</p>
            <p className="text-2xl font-bold">{stats.totalHandoffs}</p>
          </CardContent>
        </Card>
      </div>

      {/* Supervisor Warning */}
      {!stats.hasSupervisor && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Supervisor Required:</strong> The Supervisor agent must be active to ensure quality control and safety.
          </AlertDescription>
        </Alert>
      )}

      {/* Agents Grid */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Bot className="h-5 w-5" />
          AI Agent Team
        </h3>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Agent
        </Button>
      </div>

      {agents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bot className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No AI agents configured yet</p>
            <Button className="mt-4">
              <Plus className="h-4 w-4 mr-1" />
              Create First Agent
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AIAgentCard
              key={agent.id}
              agent={agent}
              assignmentCount={getAssignmentCount(agent.id)}
              onToggle={(active) => toggleAgent({ agentId: agent.id, active })}
              isSupervisor={agent.role === "supervisor"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
