import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Bot, 
  Headphones, 
  TrendingUp, 
  RefreshCw, 
  Receipt, 
  Truck, 
  Shield,
  Pause,
  Play,
  Settings
} from "lucide-react";
import type { AIAgent, AgentRole } from "@/hooks/useAIAgents";

interface AIAgentCardProps {
  agent: AIAgent;
  assignmentCount: number;
  onToggle: (active: boolean) => void;
  onPause?: () => void;
  isSupervisor?: boolean;
}

const roleConfig: Record<AgentRole, { icon: React.ElementType; color: string; label: string }> = {
  customer_service: { icon: Headphones, color: "bg-blue-500", label: "Customer Service" },
  sales: { icon: TrendingUp, color: "bg-green-500", label: "Sales" },
  retention: { icon: RefreshCw, color: "bg-amber-500", label: "Retention" },
  billing: { icon: Receipt, color: "bg-purple-500", label: "Billing" },
  dispatcher: { icon: Truck, color: "bg-cyan-500", label: "Dispatcher" },
  supervisor: { icon: Shield, color: "bg-red-500", label: "Supervisor" },
};

export function AIAgentCard({ agent, assignmentCount, onToggle, onPause, isSupervisor }: AIAgentCardProps) {
  const config = roleConfig[agent.role];
  const Icon = config.icon;

  return (
    <Card className={`relative overflow-hidden ${!agent.active ? 'opacity-60' : ''}`}>
      <div className={`absolute top-0 left-0 w-1 h-full ${config.color}`} />
      
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.color}/10`}>
              <Icon className={`h-5 w-5 ${config.color.replace('bg-', 'text-')}`} />
            </div>
            <div>
              <CardTitle className="text-base">{agent.name}</CardTitle>
              <Badge variant="outline" className="mt-1 text-xs">
                {config.label}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isSupervisor && (
              <Badge variant="destructive" className="text-xs">
                <Shield className="h-3 w-3 mr-1" />
                Required
              </Badge>
            )}
            <Switch 
              checked={agent.active} 
              onCheckedChange={onToggle}
              disabled={isSupervisor && agent.active}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {agent.description && (
          <p className="text-sm text-muted-foreground">{agent.description}</p>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Active Tasks</p>
            <p className="text-lg font-semibold">{assignmentCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Completed</p>
            <p className="text-lg font-semibold">{agent.tasks_completed}</p>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Success Rate</span>
            <span className="font-medium">{agent.success_rate}%</span>
          </div>
          <Progress value={agent.success_rate} className="h-2" />
        </div>

        {agent.capabilities && agent.capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(agent.capabilities as string[]).slice(0, 4).map((cap, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {cap}
              </Badge>
            ))}
            {(agent.capabilities as string[]).length > 4 && (
              <Badge variant="secondary" className="text-xs">
                +{(agent.capabilities as string[]).length - 4}
              </Badge>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {agent.active && onPause && (
            <Button variant="outline" size="sm" onClick={onPause} className="flex-1">
              <Pause className="h-4 w-4 mr-1" />
              Pause
            </Button>
          )}
          <Button variant="ghost" size="sm" className="flex-1">
            <Settings className="h-4 w-4 mr-1" />
            Configure
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
