import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChecklistTask, ChecklistCategory } from '@/hooks/useDeliveryChecklist';

interface ChecklistSectionProps {
  title: string;
  icon: React.ReactNode;
  category: ChecklistCategory;
  tasks: ChecklistTask[];
  progress: { done: number; total: number };
  isTaskCompleted: (taskKey: string) => boolean;
  onToggleTask: (taskKey: string, completed: boolean) => void;
  children?: React.ReactNode;
  defaultExpanded?: boolean;
  accentColor?: string;
}

export function ChecklistSection({
  title,
  icon,
  tasks,
  progress,
  isTaskCompleted,
  onToggleTask,
  children,
  defaultExpanded = false,
  accentColor = 'text-primary',
}: ChecklistSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const allDone = progress.done === progress.total;

  return (
    <Card className={cn(
      'transition-all',
      allDone && 'border-green-500/30 bg-green-500/5'
    )}>
      <div
        className="flex items-center gap-3 p-4 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={cn('flex-shrink-0', accentColor)}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm">{title}</h4>
            <Badge 
              variant={allDone ? 'default' : 'secondary'} 
              className={cn(
                'text-xs',
                allDone && 'bg-green-500 hover:bg-green-600'
              )}
            >
              {progress.done}/{progress.total}
            </Badge>
          </div>
        </div>
        {expanded 
          ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> 
          : <ChevronRight className="h-4 w-4 text-muted-foreground" />
        }
      </div>

      {expanded && (
        <CardContent className="pt-0 pb-4">
          <div className="space-y-3">
            {tasks.map((task) => {
              const completed = isTaskCompleted(task.key);
              return (
                <label
                  key={task.key}
                  className={cn(
                    'flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors',
                    completed ? 'bg-green-500/5' : 'hover:bg-muted/50'
                  )}
                >
                  <Checkbox
                    checked={completed}
                    onCheckedChange={(checked) => {
                      onToggleTask(task.key, !!checked);
                    }}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <span className={cn(
                      'text-sm',
                      completed && 'line-through text-muted-foreground'
                    )}>
                      {task.label}
                    </span>
                    {task.required && !completed && (
                      <span className="text-xs text-destructive ml-2">Required</span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
          {children && (
            <div className="mt-4 pt-3 border-t">
              {children}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
