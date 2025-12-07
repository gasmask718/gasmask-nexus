import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  ArrowRightLeft, 
  Shield, 
  Users,
  CheckCircle,
  AlertTriangle,
  Clock
} from "lucide-react";
import { useAIAgents } from "@/hooks/useAIAgents";
import { useBusiness } from "@/contexts/BusinessContext";
import { formatDistanceToNow } from "date-fns";

export function AgentInsightsPanel() {
  const { currentBusiness } = useBusiness();
  const { 
    agents, 
    supervisionLogs, 
    handoffLogs,
    stats 
  } = useAIAgents(currentBusiness?.id);

  // Calculate insights
  const totalCompleted = agents.reduce((sum, a) => sum + a.tasks_completed, 0);
  const avgSuccessRate = agents.length > 0 
    ? agents.reduce((sum, a) => sum + a.success_rate, 0) / agents.length 
    : 0;
  const mostActiveAgent = agents.reduce((best, a) => 
    a.tasks_completed > (best?.tasks_completed || 0) ? a : best, agents[0]);

  const recentSupervision = supervisionLogs.slice(0, 5);
  const recentHandoffs = handoffLogs.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Total Completed</span>
            </div>
            <p className="text-2xl font-bold">{totalCompleted}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Avg Success Rate</span>
            </div>
            <p className="text-2xl font-bold">{avgSuccessRate.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowRightLeft className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">Total Handoffs</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalHandoffs}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Supervisor Actions</span>
            </div>
            <p className="text-2xl font-bold">{supervisionLogs.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Most Active Agent */}
      {mostActiveAgent && (
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Most Active Agent</p>
                <p className="text-lg font-bold">{mostActiveAgent.name}</p>
                <p className="text-sm text-muted-foreground">
                  {mostActiveAgent.tasks_completed} tasks • {mostActiveAgent.success_rate}% success rate
                </p>
              </div>
              <div className="p-3 rounded-full bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Supervision Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5" />
              Supervisor Decisions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentSupervision.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">
                No supervision activity yet
              </p>
            ) : (
              <ScrollArea className="h-[250px]">
                <div className="space-y-3">
                  {recentSupervision.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 p-2 bg-muted/30 rounded-lg">
                      <div className={`p-1.5 rounded-full ${
                        log.decision === 'approve' ? 'bg-green-500/10' :
                        log.decision === 'reject' ? 'bg-red-500/10' :
                        'bg-amber-500/10'
                      }`}>
                        {log.decision === 'approve' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : log.decision === 'reject' ? (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        ) : (
                          <Clock className="h-4 w-4 text-amber-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs capitalize">
                            {log.decision}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        {log.notes && (
                          <p className="text-sm text-muted-foreground mt-1 truncate">
                            {log.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Handoff Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowRightLeft className="h-5 w-5" />
              Recent Handoffs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentHandoffs.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">
                No handoffs recorded yet
              </p>
            ) : (
              <ScrollArea className="h-[250px]">
                <div className="space-y-3">
                  {recentHandoffs.map((handoff) => (
                    <div key={handoff.id} className="flex items-start gap-3 p-2 bg-muted/30 rounded-lg">
                      <div className="p-1.5 rounded-full bg-purple-500/10">
                        <ArrowRightLeft className="h-4 w-4 text-purple-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 text-sm">
                          <span className="font-medium">
                            {handoff.from_agent?.name || "Unknown"}
                          </span>
                          <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">
                            {handoff.to_agent?.name || "Unknown"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {handoff.reason}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(handoff.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agent Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Agent Performance Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Agent</th>
                  <th className="text-left py-2 font-medium">Role</th>
                  <th className="text-center py-2 font-medium">Status</th>
                  <th className="text-right py-2 font-medium">Tasks</th>
                  <th className="text-right py-2 font-medium">Success</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr key={agent.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{agent.name}</td>
                    <td className="py-3 capitalize">{agent.role.replace('_', ' ')}</td>
                    <td className="py-3 text-center">
                      <Badge variant={agent.active ? "default" : "secondary"}>
                        {agent.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-3 text-right">{agent.tasks_completed}</td>
                    <td className="py-3 text-right">
                      <span className={agent.success_rate >= 80 ? "text-green-500" : agent.success_rate >= 60 ? "text-amber-500" : "text-red-500"}>
                        {agent.success_rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
