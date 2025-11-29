import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, ExternalLink, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { useAutopilotTaskStats, useAutopilotSuggestions } from "@/hooks/useGrabbaAutopilot";
import { getFloorName } from "@/engine/GrabbaAutopilotEngine";
import { Link } from "react-router-dom";

export function AutopilotOverview() {
  const stats = useAutopilotTaskStats();
  const { suggestions, stats: suggestionStats, isLoading } = useAutopilotSuggestions();

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-cyan-500/5 to-blue-500/5 border-cyan-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-cyan-500" />
            Autopilot Control
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const mostLoadedFloor = suggestionStats?.mostLoadedFloor ?? 0;
  const mostLoadedCount = suggestionStats?.byFloor[mostLoadedFloor] ?? 0;

  return (
    <Card className="bg-gradient-to-br from-cyan-500/5 to-blue-500/5 border-cyan-500/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-cyan-500 animate-pulse" />
              Autopilot Control
            </CardTitle>
            <CardDescription>AI-powered task automation</CardDescription>
          </div>
          <Link to="/grabba/autopilot-console">
            <Button className="bg-cyan-500 hover:bg-cyan-600">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Console
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {/* Task Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="text-center p-3 rounded-lg bg-background/50 border border-border/50">
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Pending Tasks</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-2xl font-bold text-red-500">{stats.critical}</p>
            <p className="text-xs text-muted-foreground">Critical</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <p className="text-2xl font-bold text-orange-500">{stats.high}</p>
            <p className="text-xs text-muted-foreground">High Priority</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-2xl font-bold text-amber-500">{stats.medium + stats.low}</p>
            <p className="text-xs text-muted-foreground">Other</p>
          </div>
        </div>

        {/* Most Loaded Floor */}
        {mostLoadedCount > 0 && (
          <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">Most Loaded Floor</span>
              </div>
              <Badge className="bg-purple-500">
                Floor {mostLoadedFloor}: {getFloorName(mostLoadedFloor)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {mostLoadedCount} tasks need attention
            </p>
          </div>
        )}

        {/* AI Suggestions Preview */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            If you only do 3 things today, do these:
          </p>
          {suggestions.slice(0, 3).map((task, i) => (
            <div 
              key={task.id}
              className="flex items-center gap-3 p-2 rounded-lg bg-background/50 border border-border/50"
            >
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-500 text-xs font-bold">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  Floor {task.floor} • {task.priority}
                </p>
              </div>
            </div>
          ))}
          {suggestions.length === 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-600">All caught up! No urgent tasks.</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
