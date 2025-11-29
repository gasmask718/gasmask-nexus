import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Play,
  Pause,
  RefreshCw,
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  ListTodo,
} from 'lucide-react';
import { useAITasks, useAITaskLogs, useAITaskRunner } from '@/hooks/useAIEngine';
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';
import { Skeleton } from '@/components/ui/skeleton';
import type { TaskCategory, TaskFrequency } from '@/ai-engine/aiTasks';

const AITasks = () => {
  const { data: tasks, isLoading: tasksLoading } = useAITasks();
  const { data: logs, isLoading: logsLoading } = useAITaskLogs();
  const { runTask, isRunning } = useAITaskRunner();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | 'all'>('all');
  const [frequencyFilter, setFrequencyFilter] = useState<TaskFrequency | 'all'>('all');

  const filteredTasks = tasks?.filter(task => {
    const matchesSearch = task.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || task.category === categoryFilter;
    const matchesFrequency = frequencyFilter === 'all' || task.frequency === frequencyFilter;
    return matchesSearch && matchesCategory && matchesFrequency;
  });

  const categories: TaskCategory[] = ['finance', 'deliveries', 'crm', 'wholesale', 'production', 'communication', 'inventory', 'ambassadors'];
  const frequencies: TaskFrequency[] = ['daily', 'weekly', 'monthly', 'manual'];

  const getCategoryColor = (category: TaskCategory) => {
    const colors: Record<TaskCategory, string> = {
      finance: 'bg-green-500/20 text-green-500',
      deliveries: 'bg-blue-500/20 text-blue-500',
      crm: 'bg-purple-500/20 text-purple-500',
      wholesale: 'bg-orange-500/20 text-orange-500',
      production: 'bg-yellow-500/20 text-yellow-500',
      communication: 'bg-pink-500/20 text-pink-500',
      inventory: 'bg-cyan-500/20 text-cyan-500',
      ambassadors: 'bg-indigo-500/20 text-indigo-500',
    };
    return colors[category] || 'bg-muted';
  };

  return (
    <GrabbaLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ListTodo className="h-8 w-8 text-primary" />
              AI Tasks Manager
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage automated tasks and scheduling
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tasks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as TaskCategory | 'all')}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={frequencyFilter} onValueChange={(v) => setFrequencyFilter(v as TaskFrequency | 'all')}>
                <SelectTrigger className="w-[180px]">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Frequencies</SelectItem>
                  {frequencies.map(freq => (
                    <SelectItem key={freq} value={freq} className="capitalize">{freq}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tasks Table */}
        <Tabs defaultValue="tasks">
          <TabsList>
            <TabsTrigger value="tasks">Tasks ({filteredTasks?.length || 0})</TabsTrigger>
            <TabsTrigger value="logs">Run Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {tasksLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Frequency</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Run</TableHead>
                        <TableHead>Next Run</TableHead>
                        <TableHead>Enabled</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTasks?.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{task.name}</p>
                              <p className="text-sm text-muted-foreground">{task.description}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getCategoryColor(task.category)}>
                              {task.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize">{task.frequency}</TableCell>
                          <TableCell>
                            <Badge variant={
                              task.status === 'completed' ? 'default' :
                              task.status === 'running' ? 'secondary' :
                              task.status === 'failed' ? 'destructive' : 'outline'
                            }>
                              {task.status === 'running' && <RefreshCw className="h-3 w-3 mr-1 animate-spin" />}
                              {task.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {task.lastRun ? new Date(task.lastRun).toLocaleString() : 'Never'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {task.nextRun ? new Date(task.nextRun).toLocaleString() : '-'}
                          </TableCell>
                          <TableCell>
                            <Switch checked={task.isEnabled} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isRunning}
                              onClick={() => runTask(task)}
                            >
                              {isRunning ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Task Run Logs</CardTitle>
                <CardDescription>History of executed tasks</CardDescription>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {logs?.map((log) => (
                        <div
                          key={log.id}
                          className={`p-4 rounded-lg border ${
                            log.status === 'completed'
                              ? 'bg-green-500/5 border-green-500/20'
                              : log.status === 'failed'
                              ? 'bg-red-500/5 border-red-500/20'
                              : 'bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {log.status === 'completed' ? (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                              ) : log.status === 'failed' ? (
                                <XCircle className="h-5 w-5 text-red-500" />
                              ) : (
                                <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
                              )}
                              <div>
                                <p className="font-medium">{log.taskName}</p>
                                <p className="text-sm text-muted-foreground">
                                  Started: {new Date(log.startedAt).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant={log.status === 'completed' ? 'default' : log.status === 'failed' ? 'destructive' : 'secondary'}>
                                {log.status}
                              </Badge>
                              {log.completedAt && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Duration: {Math.round((new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()) / 1000)}s
                                </p>
                              )}
                            </div>
                          </div>
                          {log.error && (
                            <p className="text-sm text-red-500 mt-2">{log.error}</p>
                          )}
                          {log.result && (
                            <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-x-auto">
                              {JSON.stringify(log.result, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </GrabbaLayout>
  );
};

export default AITasks;
