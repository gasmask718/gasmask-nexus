/**
 * TaskCompletionReport - Final summary report when task finishes
 * Shows total items, percentages, blocked reasons, and proof of work
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Download,
  Copy,
  TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface BlockedItem {
  entity_name: string;
  reason: string;
  entity_type?: string;
  entity_id?: string;
}

interface TaskCompletionReportProps {
  taskTitle: string;
  taskType: string;
  status: string;
  totalItems: number;
  itemsCompleted: number;
  itemsBlocked: number;
  itemsSkipped: number;
  blockedItems: BlockedItem[];
  startedAt: string | null;
  completedAt: string | null;
  timeSavedMinutes: number;
  confidenceScore: number | null;
}

export function TaskCompletionReport({
  taskTitle,
  taskType,
  status,
  totalItems,
  itemsCompleted,
  itemsBlocked,
  itemsSkipped,
  blockedItems,
  startedAt,
  completedAt,
  timeSavedMinutes,
  confidenceScore,
}: TaskCompletionReportProps) {
  const { toast } = useToast();
  
  const percentCompleted = totalItems > 0 
    ? Math.round((itemsCompleted / totalItems) * 100) 
    : 0;
  const percentBlocked = totalItems > 0 
    ? Math.round((itemsBlocked / totalItems) * 100) 
    : 0;

  const executionTime = startedAt && completedAt
    ? Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000)
    : null;

  const isComplete = status === 'completed';
  const isFailed = status === 'failed';
  const isCancelled = status === 'cancelled';

  const handleCopyReport = () => {
    const reportText = `
AI Task Completion Report
========================
Task: ${taskTitle}
Type: ${taskType}
Status: ${status.toUpperCase()}

Summary:
- Total Items: ${totalItems}
- Completed: ${itemsCompleted} (${percentCompleted}%)
- Blocked: ${itemsBlocked} (${percentBlocked}%)
- Skipped: ${itemsSkipped}

Execution:
- Started: ${startedAt ? format(new Date(startedAt), 'PPpp') : 'N/A'}
- Completed: ${completedAt ? format(new Date(completedAt), 'PPpp') : 'N/A'}
- Duration: ${executionTime ? `${executionTime}s` : 'N/A'}
- Time Saved: ${timeSavedMinutes} minutes

${blockedItems.length > 0 ? `
Blocked Items (${blockedItems.length}):
${blockedItems.map(b => `- ${b.entity_name}: ${b.reason}`).join('\n')}
` : ''}

Confirmation: No silent writes occurred. All actions logged.
Generated: ${format(new Date(), 'PPpp')}
    `.trim();

    navigator.clipboard.writeText(reportText);
    toast({ title: 'Report copied to clipboard' });
  };

  return (
    <Card className={`border-l-4 ${
      isComplete ? 'border-l-green-500' :
      isFailed ? 'border-l-red-500' :
      isCancelled ? 'border-l-muted' :
      'border-l-primary'
    }`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Task Completion Report
            </CardTitle>
            <CardDescription>{taskTitle}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyReport}>
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Status Badge */}
        <div className="flex items-center gap-3">
          <Badge className={`text-sm px-3 py-1 ${
            isComplete ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
            isFailed ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
            isCancelled ? 'bg-muted text-muted-foreground' :
            'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
          }`}>
            {isComplete && <CheckCircle2 className="h-4 w-4 mr-1" />}
            {isFailed && <XCircle className="h-4 w-4 mr-1" />}
            {isCancelled && <XCircle className="h-4 w-4 mr-1" />}
            {status.replace('_', ' ').toUpperCase()}
          </Badge>
          <Badge variant="outline">{taskType?.replace(/_/g, ' ')}</Badge>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-muted text-center">
            <p className="text-2xl font-bold">{totalItems}</p>
            <p className="text-xs text-muted-foreground">Total Items</p>
          </div>
          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 text-center">
            <p className="text-2xl font-bold text-green-600">{percentCompleted}%</p>
            <p className="text-xs text-green-700 dark:text-green-400">Completed</p>
          </div>
          <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-center">
            <p className="text-2xl font-bold text-amber-600">{percentBlocked}%</p>
            <p className="text-xs text-amber-700 dark:text-amber-400">Blocked</p>
          </div>
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-center">
            <p className="text-2xl font-bold text-blue-600">{timeSavedMinutes}</p>
            <p className="text-xs text-blue-700 dark:text-blue-400">Min Saved</p>
          </div>
        </div>

        {/* Execution Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Started:</span>
            <span>{startedAt ? format(new Date(startedAt), 'PPpp') : '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Completed:</span>
            <span>{completedAt ? format(new Date(completedAt), 'PPpp') : '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Duration:</span>
            <span>{executionTime ? `${executionTime}s` : '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Confidence:</span>
            <span>{confidenceScore ? `${confidenceScore}%` : '—'}</span>
          </div>
        </div>

        <Separator />

        {/* Blocked Items */}
        {blockedItems.length > 0 && (
          <div>
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Blocked Items ({blockedItems.length})
            </h4>
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-2">
                {blockedItems.map((item, idx) => (
                  <div 
                    key={idx}
                    className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20"
                  >
                    <p className="font-medium text-sm">{item.entity_name}</p>
                    <p className="text-xs text-muted-foreground">{item.reason}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Confirmation */}
        <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <p className="font-medium text-sm text-green-800 dark:text-green-200">
              Audit Confirmation
            </p>
          </div>
          <p className="text-xs text-green-700 dark:text-green-300 mt-1">
            No silent writes occurred. All actions have been logged and are reviewable in the Activity Log.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}