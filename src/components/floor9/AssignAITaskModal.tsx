/**
 * AssignAITaskModal - Human-Initiated AI Task Assignment
 * 
 * Phase 9.2: Assisted Execution
 * Only humans can assign tasks. AI executes within bounded authority.
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Bot, 
  Lock, 
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  FileText,
  Shield,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getExecutableTaskTypes,
  assignAITask,
  ExecutableTaskTypeConfig,
  ExecutionMode,
  TargetEntityType,
  ExecutableTaskType,
} from '@/services/floor9/executionEngine';

const TARGET_ENTITY_TYPES: { value: TargetEntityType; label: string }[] = [
  { value: 'store', label: 'Store' },
  { value: 'customer', label: 'Customer' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'route', label: 'Route' },
  { value: 'worker', label: 'Worker' },
  { value: 'wholesaler', label: 'Wholesaler' },
  { value: 'ambassador', label: 'Ambassador' },
  { value: 'freeform', label: 'Freeform (No Target)' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-800' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-800' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800' },
];

const formSchema = z.object({
  task_type: z.string().min(1, 'Task type is required'),
  target_entity_type: z.string().min(1, 'Target entity type is required'),
  target_entity_id: z.string().optional(),
  instructions: z.string().min(10, 'Instructions must be at least 10 characters'),
  execution_mode: z.enum(['draft_only', 'execute_with_approval', 'recommendation_only']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  deadline: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface AssignAITaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignAITaskModal({ open, onOpenChange }: AssignAITaskModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTaskType, setSelectedTaskType] = useState<ExecutableTaskTypeConfig | null>(null);

  const { data: taskTypes = [], isLoading: loadingTaskTypes } = useQuery({
    queryKey: ['floor9', 'executable-task-types'],
    queryFn: getExecutableTaskTypes,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      task_type: '',
      target_entity_type: '',
      target_entity_id: '',
      instructions: '',
      execution_mode: 'draft_only',
      priority: 'medium',
      deadline: '',
    },
  });

  const assignMutation = useMutation({
    mutationFn: (values: FormValues) =>
      assignAITask({
        task_type: values.task_type as ExecutableTaskType,
        target_entity_type: values.target_entity_type as TargetEntityType,
        target_entity_id: values.target_entity_id || undefined,
        instructions: values.instructions,
        execution_mode: values.execution_mode as ExecutionMode,
        priority: values.priority,
        deadline: values.deadline || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor9', 'tasks'] });
      toast({
        title: 'AI Task Assigned',
        description: 'The task has been assigned and queued for execution.',
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Assignment Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update selected task type when form value changes
  useEffect(() => {
    const taskTypeValue = form.watch('task_type');
    const found = taskTypes.find(t => t.task_type === taskTypeValue);
    setSelectedTaskType(found || null);

    // Reset execution mode if not allowed
    if (found && !found.allowed_execution_modes.includes(form.getValues('execution_mode') as ExecutionMode)) {
      form.setValue('execution_mode', found.allowed_execution_modes[0] as any);
    }
  }, [form.watch('task_type'), taskTypes]);

  const onSubmit = (values: FormValues) => {
    assignMutation.mutate(values);
  };

  const getExecutionModeInfo = (mode: ExecutionMode) => {
    switch (mode) {
      case 'draft_only':
        return {
          icon: <FileText className="h-4 w-4" />,
          label: 'Draft Only',
          description: 'AI creates drafts that require manual action',
          color: 'bg-blue-100 text-blue-800',
        };
      case 'execute_with_approval':
        return {
          icon: <CheckCircle2 className="h-4 w-4" />,
          label: 'Execute with Approval',
          description: 'AI executes after human approval',
          color: 'bg-amber-100 text-amber-800',
        };
      case 'recommendation_only':
        return {
          icon: <Bot className="h-4 w-4" />,
          label: 'Recommendation Only',
          description: 'AI provides recommendations, no action taken',
          color: 'bg-gray-100 text-gray-800',
        };
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Assign AI Task
          </DialogTitle>
          <DialogDescription>
            Assign a bounded task to an AI worker. All execution is sandboxed and audited.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-primary/50 bg-primary/5">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Phase 9.2 Governance:</strong> AI executes within bounded authority.
            Humans assign tasks — AI cannot self-assign.
          </AlertDescription>
        </Alert>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Task Type */}
            <FormField
              control={form.control}
              name="task_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select task type..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {loadingTaskTypes ? (
                        <SelectItem value="_loading" disabled>Loading...</SelectItem>
                      ) : (
                        taskTypes.map(type => (
                          <SelectItem key={type.task_type} value={type.task_type}>
                            <div className="flex items-center gap-2">
                              <span>{type.display_name}</span>
                              {type.requires_approval && (
                                <Lock className="h-3 w-3 text-amber-500" />
                              )}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {selectedTaskType && (
                    <FormDescription>{selectedTaskType.description}</FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Target Entity Type */}
            <FormField
              control={form.control}
              name="target_entity_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Entity Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select target..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TARGET_ENTITY_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Target Entity ID (optional) */}
            {form.watch('target_entity_type') && form.watch('target_entity_type') !== 'freeform' && (
              <FormField
                control={form.control}
                name="target_entity_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target ID (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="UUID of specific entity..." {...field} />
                    </FormControl>
                    <FormDescription>
                      Leave empty to process all entities of this type
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Instructions */}
            <FormField
              control={form.control}
              name="instructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instructions *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe what the AI should do..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Be specific. The AI will follow these instructions within its sandbox permissions.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Execution Mode */}
            <FormField
              control={form.control}
              name="execution_mode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Execution Mode *</FormLabel>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {(['draft_only', 'execute_with_approval', 'recommendation_only'] as ExecutionMode[]).map(mode => {
                      const info = getExecutionModeInfo(mode);
                      const isAllowed = !selectedTaskType || selectedTaskType.allowed_execution_modes.includes(mode);
                      const isSelected = field.value === mode;

                      return (
                        <button
                          key={mode}
                          type="button"
                          disabled={!isAllowed}
                          onClick={() => isAllowed && field.onChange(mode)}
                          className={`p-3 rounded-lg border text-left transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/5 ring-1 ring-primary'
                              : isAllowed
                              ? 'border-border hover:border-primary/50'
                              : 'border-muted bg-muted/50 opacity-50 cursor-not-allowed'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {info.icon}
                            <span className="font-medium text-sm">{info.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{info.description}</p>
                          {!isAllowed && (
                            <Badge variant="outline" className="mt-2 text-xs">
                              Not allowed for this task type
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Priority and Deadline Row */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <Badge className={opt.color}>{opt.label}</Badge>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="deadline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deadline (Optional)</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Approval Warning */}
            {selectedTaskType?.requires_approval && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This task type requires human approval before execution.
                  The task will be queued for review.
                </AlertDescription>
              </Alert>
            )}

            {/* Sandbox Permissions Display */}
            {selectedTaskType && (
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Sandbox Permissions
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedTaskType.sandbox_permissions.read && (
                    <Badge variant="secondary">📖 Read</Badge>
                  )}
                  {selectedTaskType.sandbox_permissions.write_drafts && (
                    <Badge variant="secondary">📝 Write Drafts</Badge>
                  )}
                  {selectedTaskType.sandbox_permissions.generate && (
                    <Badge variant="secondary">🤖 Generate</Badge>
                  )}
                  {selectedTaskType.sandbox_permissions.execute && (
                    <Badge variant="outline" className="border-red-500 text-red-500">
                      ⚡ Execute
                    </Badge>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={assignMutation.isPending}>
                {assignMutation.isPending ? (
                  <>
                    <Clock className="h-4 w-4 animate-spin mr-2" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <Bot className="h-4 w-4 mr-2" />
                    Assign Task
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
