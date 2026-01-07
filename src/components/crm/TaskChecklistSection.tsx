/**
 * Task Checklist Section Component
 * Displays task checklist with 2026 Goals for CRM dashboards
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  CheckSquare, Plus, Calendar, User, Target, Edit2, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useBusiness } from '@/contexts/BusinessContext';

interface TaskItem {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  due_date?: string;
  assigned_to?: string;
  category: string;
  created_at: string;
  updated_at: string;
}

interface TaskChecklistSectionProps {
  businessSlug?: string;
  show2026Goals?: boolean;
  customTasks?: Array<{
    title: string;
    description?: string;
    category?: string;
  }>;
}

export function TaskChecklistSection({ 
  businessSlug,
  show2026Goals = true,
  customTasks = [],
}: TaskChecklistSectionProps) {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState('general');

  // Fetch business by slug if businessSlug is provided (from URL)
  const { data: businessFromSlug } = useQuery({
    queryKey: ['business-by-slug', businessSlug],
    queryFn: async () => {
      if (!businessSlug) return null;
      const { data, error } = await supabase
        .from('businesses')
        .select('id, name, slug')
        .eq('slug', businessSlug)
        .eq('is_active', true)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!businessSlug,
  });

  // Use business from slug (URL) or from context
  const effectiveBusiness = businessFromSlug || currentBusiness;

  // Fetch tasks
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['crm-tasks', effectiveBusiness?.id],
    queryFn: async () => {
      if (!effectiveBusiness?.id) return [];
      
      const { data, error } = await (supabase as any)
        .from('crm_tasks')
        .select('*')
        .eq('business_id', effectiveBusiness.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        // Table might not exist yet, return empty array
        if (error.code === '42P01') return [];
        throw error;
      }
      return (data || []) as TaskItem[];
    },
    enabled: !!effectiveBusiness?.id,
  });

  // Toggle task completion
  const toggleTaskMutation = useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: string; completed: boolean }) => {
      const { error } = await (supabase as any)
        .from('crm_tasks')
        .update({ 
          completed,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-tasks', effectiveBusiness?.id] });
    },
  });

  // Add new task
  const addTaskMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveBusiness?.id) {
        throw new Error('Please select a business first. Navigate to a business CRM page (e.g., /crm/your-business-slug).');
      }
      if (!newTaskTitle.trim()) {
        throw new Error('Task title is required');
      }

      const { data, error } = await (supabase as any)
        .from('crm_tasks')
        .insert({
          business_id: effectiveBusiness.id,
          title: newTaskTitle.trim(),
          description: newTaskDescription.trim() || null,
          due_date: newTaskDueDate || null,
          category: newTaskCategory,
          completed: false,
        })
        .select()
        .single();

      if (error) {
        // Handle table not existing
        if (error.code === '42P01') {
          throw new Error('Tasks table not found. Please run the database migration first.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-tasks', effectiveBusiness?.id] });
      setIsAddingTask(false);
      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskDueDate('');
      setNewTaskCategory('general');
      toast.success('Task added successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add task: ${error.message}`);
    },
  });

  // Get 2026 Goals tasks (default tasks)
  const get2026GoalsTasks = (): TaskItem[] => {
    if (!show2026Goals) return [];
    
    // Check if we have custom tasks for this business
    const businessSpecificTasks = customTasks.map((task, index) => ({
      id: `goal-2026-${index}`,
      title: task.title,
      description: task.description,
      completed: false,
      category: task.category || '2026-goals',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    // Default 2026 goals if no custom tasks
    if (businessSpecificTasks.length === 0) {
      return [
        {
          id: 'goal-2026-1',
          title: 'Increase customer base by 30%',
          description: 'Focus on customer acquisition and retention',
          completed: false,
          category: '2026-goals',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'goal-2026-2',
          title: 'Improve customer satisfaction scores',
          description: 'Target 90%+ satisfaction rating',
          completed: false,
          category: '2026-goals',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'goal-2026-3',
          title: 'Expand to new markets',
          description: 'Identify and enter 3 new market segments',
          completed: false,
          category: '2026-goals',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
    }

    return businessSpecificTasks;
  };

  // Combine database tasks with 2026 goals
  const allTasks = [...tasks, ...get2026GoalsTasks()];
  const completedCount = allTasks.filter(t => t.completed).length;
  const totalCount = allTasks.length;
  const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Group tasks by category
  const tasksByCategory = allTasks.reduce((acc, task) => {
    const category = task.category || 'general';
    if (!acc[category]) acc[category] = [];
    acc[category].push(task);
    return acc;
  }, {} as Record<string, TaskItem[]>);

  const handleToggleTask = (taskId: string, currentStatus: boolean) => {
    // For 2026 goals (temporary tasks), just show a message
    if (taskId.startsWith('goal-2026-')) {
      toast.info('2026 Goals are reference items. Add them as actual tasks to track completion.');
      return;
    }

    toggleTaskMutation.mutate({ taskId, completed: !currentStatus });
  };

  const handleAddTask = () => {
    addTaskMutation.mutate();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Task Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading tasks...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Task Checklist {show2026Goals && <Badge variant="outline">2026 Goals</Badge>}
          </CardTitle>
          <Dialog open={isAddingTask} onOpenChange={setIsAddingTask}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Task</DialogTitle>
                <DialogDescription>
                  Create a new task for your CRM checklist
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="task-title">Task Title *</Label>
                  <Input
                    id="task-title"
                    placeholder="Enter task title"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-description">Description</Label>
                  <Textarea
                    id="task-description"
                    placeholder="Enter task description"
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="task-due-date">Due Date</Label>
                    <Input
                      id="task-due-date"
                      type="date"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task-category">Category</Label>
                    <Input
                      id="task-category"
                      placeholder="e.g., 2026-goals"
                      value={newTaskCategory}
                      onChange={(e) => setNewTaskCategory(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddingTask(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddTask} 
                  disabled={addTaskMutation.isPending || !effectiveBusiness?.id}
                >
                  {addTaskMutation.isPending ? 'Adding...' : 'Add Task'}
                </Button>
              </DialogFooter>
              {!effectiveBusiness?.id && (
                <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4 inline mr-2" />
                  Please navigate to a business CRM page (e.g., /crm/your-business-slug) to add tasks.
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {completedCount} of {totalCount} completed
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        {/* Tasks by Category */}
        <div className="space-y-4">
          {Object.entries(tasksByCategory).map(([category, categoryTasks]) => (
            <div key={category} className="space-y-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-medium capitalize">{category.replace(/-/g, ' ')}</h4>
                <Badge variant="secondary" className="text-xs">
                  {categoryTasks.filter(t => t.completed).length}/{categoryTasks.length}
                </Badge>
              </div>
              <div className="space-y-2 pl-6">
                {categoryTasks.map((task) => {
                  const isReferenceTask = task.id.startsWith('goal-2026-');
                  const isDisabled = isReferenceTask || !effectiveBusiness?.id;
                  const isRealTask = !isReferenceTask && effectiveBusiness?.id;
                  
                  return (
                    <div
                      key={task.id}
                      className={`flex items-start gap-3 p-2 rounded-lg transition-colors ${
                        isDisabled ? '' : 'hover:bg-muted/50'
                      } ${isRealTask ? 'cursor-pointer' : ''}`}
                      onClick={(e) => {
                        // Only toggle if clicking on the row, not the checkbox itself
                        if (isRealTask && (e.target as HTMLElement).tagName !== 'BUTTON') {
                          handleToggleTask(task.id, task.completed);
                        }
                      }}
                    >
                      <Checkbox
                        checked={task.completed}
                        onCheckedChange={(checked) => {
                          if (isRealTask) {
                            handleToggleTask(task.id, task.completed);
                          }
                        }}
                        disabled={isDisabled}
                        className={isRealTask ? 'cursor-pointer' : ''}
                        onClick={(e) => {
                          // Prevent double-toggling
                          e.stopPropagation();
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-sm ${
                              task.completed ? 'line-through text-muted-foreground' : 'font-medium'
                            }`}
                          >
                            {task.title}
                          </p>
                          {isReferenceTask && (
                            <Badge variant="outline" className="text-xs">
                              Reference
                            </Badge>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          {task.due_date && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(task.due_date).toLocaleDateString()}
                            </div>
                          )}
                          {task.assigned_to && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              Assigned
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {allTasks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <CheckSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">No tasks yet. Add your first task to get started!</p>
            {!effectiveBusiness?.id && (
              <p className="text-xs text-amber-600 mt-2">
                <AlertCircle className="h-3 w-3 inline mr-1" />
                Navigate to a business CRM page to add tasks.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

