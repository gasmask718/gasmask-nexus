import { useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Bot, Users, Briefcase, Play, Send, CheckCircle, Clock, AlertTriangle, 
  XCircle, Zap, Brain, TrendingUp, Building2, DollarSign, Shield
} from 'lucide-react';
import {
  useAIWorkers,
  useAITasks,
  useWorkforceStats,
  useSubmitCommand,
  useRunWorkerEngine,
  useTaskActions,
} from '@/hooks/useAIWorkforce';
import { getDepartments } from '@/services/aiWorkforceEngine';
import type { AIWorker, AIWorkTask } from '@/services/aiWorkforceEngine';

const departmentIcons: Record<string, any> = {
  'Sales/CRM': Users,
  'Operations': Briefcase,
  'Wholesale': Building2,
  'Finance': DollarSign,
  'Intelligence': Brain,
  'Global OS': Shield,
};

const statusColors: Record<string, string> = {
  active: 'bg-green-500',
  sleeping: 'bg-gray-500',
  busy: 'bg-yellow-500',
  error: 'bg-red-500',
};

const taskStatusColors: Record<string, string> = {
  pending: 'bg-gray-500',
  processing: 'bg-blue-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  escalated: 'bg-orange-500',
};

const priorityColors: Record<string, string> = {
  low: 'bg-gray-400',
  medium: 'bg-blue-500',
  high: 'bg-orange-500',
  critical: 'bg-red-600',
};

function WorkerCard({ worker }: { worker: AIWorker }) {
  const DeptIcon = departmentIcons[worker.worker_department] || Bot;
  const experienceLevel = Math.min(Math.floor(worker.experience_points / 100), 10);
  
  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <DeptIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold">{worker.worker_name}</h4>
              <p className="text-xs text-muted-foreground">{worker.worker_role}</p>
            </div>
          </div>
          <Badge className={`${statusColors[worker.status]} text-white text-xs`}>
            {worker.status}
          </Badge>
        </div>
        
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {worker.description}
        </p>
        
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span>Level {experienceLevel}</span>
            <span>{worker.experience_points} XP</span>
          </div>
          <Progress value={(worker.experience_points % 100)} className="h-1.5" />
        </div>
        
        <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-green-500" />
            {worker.tasks_completed}
          </span>
          <span className="flex items-center gap-1">
            <XCircle className="h-3 w-3 text-red-500" />
            {worker.tasks_failed}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskRow({ task, onStatusChange }: { task: AIWorkTask; onStatusChange: (status: string) => void }) {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge className={`${priorityColors[task.priority]} text-white text-xs`}>
            {task.priority}
          </Badge>
          <Badge className={`${taskStatusColors[task.status]} text-white text-xs`}>
            {task.status}
          </Badge>
        </div>
        <h4 className="font-medium text-sm truncate">{task.task_title}</h4>
        <p className="text-xs text-muted-foreground">
          {task.worker ? `Assigned to ${(task.worker as AIWorker).worker_name}` : 'Unassigned'}
          {task.completed_at && ` • Completed ${new Date(task.completed_at).toLocaleString()}`}
        </p>
      </div>
      
      {task.status === 'pending' && (
        <Button size="sm" variant="outline" onClick={() => onStatusChange('processing')}>
          <Play className="h-3 w-3 mr-1" /> Run
        </Button>
      )}
      {task.status === 'failed' && (
        <Button size="sm" variant="outline" onClick={() => onStatusChange('pending')}>
          Retry
        </Button>
      )}
    </div>
  );
}

export default function Workforce() {
  const [command, setCommand] = useState('');
  const [commandPriority, setCommandPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [taskFilter, setTaskFilter] = useState<string>('all');
  
  const { data: workers, isLoading: workersLoading } = useAIWorkers();
  const { data: tasks, isLoading: tasksLoading } = useAITasks({ limit: 50 });
  const { data: stats } = useWorkforceStats();
  const { submit, isSubmitting } = useSubmitCommand();
  const { run: runEngine, isRunning } = useRunWorkerEngine();
  const { updateStatus } = useTaskActions();

  const filteredWorkers = workers?.filter(w => 
    selectedDepartment === 'all' || w.worker_department === selectedDepartment
  ) || [];

  const filteredTasks = tasks?.filter(t =>
    taskFilter === 'all' || t.status === taskFilter
  ) || [];

  const handleSubmitCommand = async () => {
    if (!command.trim()) return;
    await submit(command, { priority: commandPriority });
    setCommand('');
  };

  const departments = getDepartments();

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Bot className="h-8 w-8 text-primary" />
              AI Workforce
            </h1>
            <p className="text-muted-foreground">Your digital team working 24/7</p>
          </div>
          
          <Button onClick={runEngine} disabled={isRunning} size="lg">
            <Zap className="h-4 w-4 mr-2" />
            {isRunning ? 'Processing...' : 'Run All Workers'}
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{stats?.total_workers || 0}</div>
              <p className="text-xs text-muted-foreground">Total Workers</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-500">{stats?.active_workers || 0}</div>
              <p className="text-xs text-muted-foreground">Active</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-500">{stats?.busy_workers || 0}</div>
              <p className="text-xs text-muted-foreground">Busy</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{stats?.total_tasks || 0}</div>
              <p className="text-xs text-muted-foreground">Total Tasks</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-500">{stats?.pending_tasks || 0}</div>
              <p className="text-xs text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-500">{stats?.completed_tasks || 0}</div>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{stats?.tasks_today || 0}</div>
              <p className="text-xs text-muted-foreground">Today</p>
            </CardContent>
          </Card>
        </div>

        {/* Command Input */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Give Task to AI Workforce</CardTitle>
            <CardDescription>Tell your AI team what to do...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                placeholder='e.g., "Find all unpaid stores and create a route plan"'
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitCommand()}
                className="flex-1"
              />
              <Select value={commandPriority} onValueChange={(v: any) => setCommandPriority(v)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleSubmitCommand} disabled={isSubmitting || !command.trim()}>
                <Send className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <Tabs defaultValue="workers" className="space-y-4">
          <TabsList>
            <TabsTrigger value="workers">AI Workers ({workers?.length || 0})</TabsTrigger>
            <TabsTrigger value="tasks">Task Queue ({tasks?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="workers" className="space-y-4">
            {/* Department Filter */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedDepartment === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedDepartment('all')}
              >
                All
              </Button>
              {departments.map(dept => {
                const Icon = departmentIcons[dept] || Bot;
                return (
                  <Button
                    key={dept}
                    variant={selectedDepartment === dept ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedDepartment(dept)}
                  >
                    <Icon className="h-3 w-3 mr-1" />
                    {dept}
                  </Button>
                );
              })}
            </div>

            {/* Workers Grid */}
            {workersLoading ? (
              <div className="text-center py-8">Loading workers...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredWorkers.map(worker => (
                  <WorkerCard key={worker.id} worker={worker} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4">
            {/* Task Filter */}
            <div className="flex gap-2 flex-wrap">
              {['all', 'pending', 'processing', 'completed', 'failed', 'escalated'].map(status => (
                <Button
                  key={status}
                  variant={taskFilter === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTaskFilter(status)}
                >
                  {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                </Button>
              ))}
            </div>

            {/* Tasks List */}
            {tasksLoading ? (
              <div className="text-center py-8">Loading tasks...</div>
            ) : filteredTasks.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No tasks found. Submit a command to create one!
                </CardContent>
              </Card>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-2 pr-4">
                  {filteredTasks.map(task => (
                    <TaskRow 
                      key={task.id} 
                      task={task} 
                      onStatusChange={(status) => updateStatus({ taskId: task.id, status: status as any })}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
