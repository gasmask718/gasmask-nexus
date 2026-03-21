import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import type { AgentConfig } from '@/hooks/useCallCenterSession';

interface AgentCardsProps {
  agents: AgentConfig[];
  onUpdateMaxConcurrent: (agentId: string, value: number) => void;
}

const agentColorMap: Record<string, { border: string; bg: string; text: string; progress: string }> = {
  green: { border: 'border-green-500/50', bg: 'bg-green-500/5', text: 'text-green-600', progress: 'bg-green-500' },
  blue: { border: 'border-blue-500/50', bg: 'bg-blue-500/5', text: 'text-blue-600', progress: 'bg-blue-500' },
  amber: { border: 'border-amber-500/50', bg: 'bg-amber-500/5', text: 'text-amber-600', progress: 'bg-amber-500' },
  purple: { border: 'border-purple-500/50', bg: 'bg-purple-500/5', text: 'text-purple-600', progress: 'bg-purple-500' },
};

const langFlags: Record<string, string> = {
  arabic: '🇸🇦',
  english: '🇺🇸',
  spanish: '🇪🇸',
};

export function AgentCards({ agents, onUpdateMaxConcurrent }: AgentCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {agents.map(agent => {
        const colors = agentColorMap[agent.color] || agentColorMap.blue;
        const utilization = agent.max_concurrent > 0
          ? (agent.active_calls / agent.max_concurrent) * 100
          : 0;

        return (
          <Card key={agent.id} className={`${colors.border} ${colors.bg} border`}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold truncate">{agent.name}</p>
                <div className="flex items-center gap-1">
                  <div className={`h-2 w-2 rounded-full ${agent.active_calls > 0 ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'}`} />
                  <span className={`text-xs font-mono font-bold ${colors.text}`}>
                    {agent.active_calls}/{agent.max_concurrent}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-2">
                <span>{langFlags[agent.language] || '🌐'} {agent.language}</span>
                <span className="italic truncate ml-1">{agent.greeting_style}</span>
              </div>

              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">Max:</span>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={agent.max_concurrent}
                  onChange={e => onUpdateMaxConcurrent(agent.id, Number(e.target.value) || 1)}
                  className="h-6 w-14 text-xs text-center p-0 bg-transparent border-b border-border rounded-none"
                />
              </div>

              <Progress value={utilization} className="h-1.5" />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
