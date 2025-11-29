import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Bot, Play, CheckCircle, X, Clock, AlertTriangle, 
  Filter, RefreshCw, Loader2, Sparkles, ExternalLink
} from "lucide-react";
import { useSearchParams, Link } from "react-router-dom";
import { useAutopilotTasks, useUpdateAutopilotTaskStatus, useAutopilotSuggestions, useQueueSuggestions } from "@/hooks/useGrabbaAutopilot";
import { getFloorName, type AutopilotTask, type AutopilotStatus } from "@/engine/GrabbaAutopilotEngine";
import { TASK_TYPE_CONFIG, PRIORITY_CONFIG, STATUS_CONFIG } from "@/config/grabbaAutopilotConfig";
import { format } from "date-fns";

const FLOORS = [
  { value: 'all', label: 'All Floors' },
  { value: '0', label: '👑 Penthouse' },
  { value: '1', label: 'F1 - CRM' },
  { value: '2', label: 'F2 - Communication' },
  { value: '3', label: 'F3 - Inventory' },
  { value: '4', label: 'F4 - Delivery' },
  { value: '5', label: 'F5 - Finance' },
  { value: '6', label: 'F6 - Production' },
  { value: '7', label: 'F7 - Wholesale' },
  { value: '8', label: 'F8 - Ambassadors' },
];

export default function GrabbaAutopilotConsole() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFloor = searchParams.get('floor');
  
  const [floorFilter, setFloorFilter] = useState<string>(initialFloor || 'all');
  const [activeTab, setActiveTab] = useState<AutopilotStatus>('pending');

  const filters = {
    floor: floorFilter !== 'all' ? parseInt(floorFilter) : undefined,
    status: activeTab,
    limit: 100,
  };

  const { data: tasks, isLoading, refetch } = useAutopilotTasks(filters);
  const updateStatus = useUpdateAutopilotTaskStatus();
  const { suggestions, stats, isLoading: suggestionsLoading } = useAutopilotSuggestions(
    floorFilter !== 'all' ? parseInt(floorFilter) : undefined
  );
  const { queueSuggestions, isLoading: isQueuing } = useQueueSuggestions();

  const handleFloorChange = (value: string) => {
    setFloorFilter(value);
    if (value !== 'all') {
      setSearchParams({ floor: value });
    } else {
      setSearchParams({});
    }
  };

  const taskCounts = {
    pending: tasks?.length || 0,
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Bot className="h-8 w-8 text-cyan-500" />
              Autopilot Console
            </h1>
            <p className="text-muted-foreground mt-1">
              AI-generated task queue and automation control center
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={floorFilter} onValueChange={handleFloorChange}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by floor" />
              </SelectTrigger>
              <SelectContent>
                {FLOORS.map(floor => (
                  <SelectItem key={floor.value} value={floor.value}>
                    {floor.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Task Panel */}
          <div className="lg:col-span-2 space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
              <Card className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 border-slate-500/20">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{stats?.total || 0}</p>
                  <p className="text-xs text-muted-foreground">Total Suggestions</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-red-500">{stats?.critical || 0}</p>
                  <p className="text-xs text-muted-foreground">Critical</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-orange-500">{stats?.high || 0}</p>
                  <p className="text-xs text-muted-foreground">High</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-cyan-500">{taskCounts.pending}</p>
                  <p className="text-xs text-muted-foreground">In Queue</p>
                </CardContent>
              </Card>
            </div>

            {/* Task Tabs */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Task Queue</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AutopilotStatus)}>
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="pending" className="gap-2">
                      <Clock className="h-4 w-4" /> Pending
                    </TabsTrigger>
                    <TabsTrigger value="in_progress" className="gap-2">
                      <Play className="h-4 w-4" /> In Progress
                    </TabsTrigger>
                    <TabsTrigger value="completed" className="gap-2">
                      <CheckCircle className="h-4 w-4" /> Completed
                    </TabsTrigger>
                    <TabsTrigger value="dismissed" className="gap-2">
                      <X className="h-4 w-4" /> Dismissed
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value={activeTab} className="mt-4">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : tasks?.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p>No {activeTab.replace('_', ' ')} tasks</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-3">
                          {tasks?.map((task: any) => (
                            <TaskCard 
                              key={task.id} 
                              task={task} 
                              onStatusChange={(status) => updateStatus.mutate({ taskId: task.id, status })}
                              isUpdating={updateStatus.isPending}
                            />
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Side Panel */}
          <div className="space-y-4">
            {/* AI Suggestions */}
            <Card className="bg-gradient-to-br from-purple-500/5 to-pink-500/5 border-purple-500/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    AI Suggestions
                  </CardTitle>
                  {suggestions.length > 0 && (
                    <Button 
                      size="sm" 
                      onClick={() => queueSuggestions(suggestions)}
                      disabled={isQueuing}
                      className="h-7 text-xs"
                    >
                      {isQueuing ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Queue All'}
                    </Button>
                  )}
                </div>
                <CardDescription className="text-xs">
                  {suggestions.length} new suggestions from Intelligence Core
                </CardDescription>
              </CardHeader>
              <CardContent>
                {suggestionsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : suggestions.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    No new suggestions
                  </div>
                ) : (
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {suggestions.slice(0, 10).map(task => (
                        <SuggestionCard 
                          key={task.id} 
                          task={task}
                          onQueue={() => queueSuggestions([task])}
                          isQueuing={isQueuing}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Floor Focus */}
            {stats && stats.mostLoadedFloor !== undefined && (
              <Card className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 border-amber-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Focus Area
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-amber-500">
                      Floor {stats.mostLoadedFloor}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {getFloorName(stats.mostLoadedFloor)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {stats.byFloor[stats.mostLoadedFloor] || 0} tasks need attention
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-3"
                      onClick={() => handleFloorChange(String(stats.mostLoadedFloor))}
                    >
                      Focus on this floor
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Links */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Quick Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link to="/grabba/command-penthouse">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Command Penthouse
                  </Button>
                </Link>
                <Link to="/grabba/ai-insights">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    AI Insights
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskCard({ 
  task, 
  onStatusChange,
  isUpdating 
}: { 
  task: any; 
  onStatusChange: (status: AutopilotStatus) => void;
  isUpdating: boolean;
}) {
  const taskConfig = TASK_TYPE_CONFIG[task.type as keyof typeof TASK_TYPE_CONFIG];
  const priorityConfig = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG];
  const statusConfig = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG];

  return (
    <div className={`p-4 rounded-lg border bg-card/50 ${priorityConfig?.borderColor || ''}`}>
      <div className="flex items-start gap-3">
        <div className="text-xl">{taskConfig?.icon || '📋'}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold">{task.title}</span>
            <Badge className={priorityConfig?.color}>{task.priority}</Badge>
            <Badge variant="outline">Floor {task.floor}</Badge>
            {task.brand && <Badge variant="outline">{task.brand}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
            {task.description}
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Created: {format(new Date(task.created_at), 'MMM d, h:mm a')}</span>
            {task.suggested_due_date && (
              <span>Due: {format(new Date(task.suggested_due_date), 'MMM d')}</span>
            )}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          {task.status === 'pending' && (
            <>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => onStatusChange('in_progress')}
                disabled={isUpdating}
              >
                <Play className="h-4 w-4" />
              </Button>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => onStatusChange('dismissed')}
                disabled={isUpdating}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
          {task.status === 'in_progress' && (
            <Button 
              size="sm" 
              variant="default"
              onClick={() => onStatusChange('completed')}
              disabled={isUpdating}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Done
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SuggestionCard({ 
  task, 
  onQueue,
  isQueuing 
}: { 
  task: AutopilotTask; 
  onQueue: () => void;
  isQueuing: boolean;
}) {
  const taskConfig = TASK_TYPE_CONFIG[task.type as keyof typeof TASK_TYPE_CONFIG];
  const priorityConfig = PRIORITY_CONFIG[task.priority];

  return (
    <div className="p-2 rounded-lg border bg-card/50 text-sm">
      <div className="flex items-center gap-2">
        <span>{taskConfig?.icon || '📋'}</span>
        <span className="flex-1 truncate font-medium">{task.title}</span>
        <Badge className={`text-xs ${priorityConfig?.color}`}>{task.priority}</Badge>
        <Button 
          size="icon" 
          variant="ghost" 
          className="h-6 w-6"
          onClick={onQueue}
          disabled={isQueuing}
        >
          <Play className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
