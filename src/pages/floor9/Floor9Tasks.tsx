/**
 * Floor9Tasks - AI Task Visibility Layer
 * 
 * Part of Phase 9.1 — Shadow Mode governance
 * Tasks are observable execution records, not automation triggers.
 */
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShadowModeBanner, RecommendationOnlyBadge } from "@/components/floor9";
import { ClipboardList, Clock, Brain, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useFloor9Tasks } from "@/hooks/useFloor9";
import { Badge } from "@/components/ui/badge";

export default function Floor9Tasks() {
  const { data: tasks, isLoading } = useFloor9Tasks({});

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'processing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'pending': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4" />;
      case 'processing': return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'failed': return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <ShadowModeBanner />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                AI Tasks
              </CardTitle>
              <CardDescription>
                Tasks proposed, analyzed, or executed by AI agents — visibility only
              </CardDescription>
            </div>
            <RecommendationOnlyBadge />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading tasks…</span>
            </div>
          ) : tasks && tasks.length > 0 ? (
            <div className="space-y-3">
              {tasks.map(task => (
                <Card key={task.id} className="border-l-4 border-l-primary/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Brain className="h-4 w-4 text-primary" />
                        {task.task_title}
                      </CardTitle>
                      <Badge className={getStatusColor(task.status)}>
                        <span className="flex items-center gap-1">
                          {getStatusIcon(task.status)}
                          {task.status}
                        </span>
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-2">
                    {task.task_details && (
                      <p className="text-sm text-muted-foreground">
                        {task.task_details}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(task.created_at).toLocaleString()}
                      </div>
                      {task.department && (
                        <Badge variant="outline" className="text-xs">
                          {task.department}
                        </Badge>
                      )}
                      {task.priority && (
                        <Badge variant="secondary" className="text-xs">
                          Priority: {task.priority}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg">No AI Tasks Recorded</h3>
              <p className="text-muted-foreground">
                AI task activity will appear here when workers begin processing
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
