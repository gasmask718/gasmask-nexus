import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Bot, ArrowRight, Plus, ExternalLink, CheckCircle2, Loader2
} from "lucide-react";
import { useAutopilotSuggestions, useQueueSuggestions } from "@/hooks/useGrabbaAutopilot";
import { getFloorName, type AutopilotTask } from "@/engine/GrabbaAutopilotEngine";
import { TASK_TYPE_CONFIG, PRIORITY_CONFIG } from "@/config/grabbaAutopilotConfig";
import { Link } from "react-router-dom";

interface AutopilotSuggestionsPanelProps {
  floor: number;
  compact?: boolean;
}

export function AutopilotSuggestionsPanel({ floor, compact = false }: AutopilotSuggestionsPanelProps) {
  const { suggestions, isLoading } = useAutopilotSuggestions(floor);
  const { queueSuggestions, isLoading: isQueuing } = useQueueSuggestions();

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-cyan-500/5 to-blue-500/5 border-cyan-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Bot className="h-4 w-4 text-cyan-500" />
            Autopilot Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const floorTasks = suggestions.filter(s => s.floor === floor);

  return (
    <Card className="bg-gradient-to-br from-cyan-500/5 to-blue-500/5 border-cyan-500/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Bot className="h-4 w-4 text-cyan-500" />
              Autopilot Suggestions
            </CardTitle>
            {!compact && (
              <CardDescription className="text-xs mt-1">
                AI-recommended tasks for {getFloorName(floor)}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2">
            {floorTasks.length > 0 && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => queueSuggestions(floorTasks)}
                disabled={isQueuing}
                className="h-7 text-xs"
              >
                {isQueuing ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3 mr-1" />
                )}
                Queue All
              </Button>
            )}
            <Link to={`/grabba/autopilot-console?floor=${floor}`}>
              <Button size="sm" variant="ghost" className="h-7 text-xs">
                <ExternalLink className="h-3 w-3 mr-1" />
                Console
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {floorTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
            <p className="text-sm font-medium text-green-600">All Clear!</p>
            <p className="text-xs text-muted-foreground">No priority tasks for this floor</p>
          </div>
        ) : (
          <ScrollArea className={compact ? "h-[200px]" : "h-[250px]"}>
            <div className="space-y-2">
              {floorTasks.map((task) => (
                <TaskSuggestionCard 
                  key={task.id} 
                  task={task} 
                  compact={compact}
                  onQueue={() => queueSuggestions([task])}
                  isQueuing={isQueuing}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function TaskSuggestionCard({ 
  task, 
  compact,
  onQueue,
  isQueuing 
}: { 
  task: AutopilotTask; 
  compact?: boolean;
  onQueue: () => void;
  isQueuing: boolean;
}) {
  const taskConfig = TASK_TYPE_CONFIG[task.type as keyof typeof TASK_TYPE_CONFIG];
  const priorityConfig = PRIORITY_CONFIG[task.priority];

  return (
    <div className="p-3 rounded-lg border bg-card/50 hover:bg-card/80 transition-all">
      <div className="flex items-start gap-3">
        <div className="text-lg">{taskConfig?.icon || '📋'}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-sm truncate">{task.title}</span>
            <Badge className={`text-xs ${priorityConfig?.color}`}>
              {task.priority}
            </Badge>
          </div>
          {!compact && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {task.description}
            </p>
          )}
        </div>
        <Button 
          size="icon" 
          variant="ghost" 
          className="h-7 w-7 shrink-0"
          onClick={onQueue}
          disabled={isQueuing}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
