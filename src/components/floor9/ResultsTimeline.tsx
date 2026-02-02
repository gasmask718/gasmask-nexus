// Floor 9 - Results Timeline (Chronological Ledger)
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Brain,
  Target,
  User,
  ChevronRight,
  FileText,
  Undo2,
  Shield,
} from 'lucide-react';
import { AIResultItem } from '@/hooks/useAIResults';
import { format, formatDistanceToNow } from 'date-fns';

interface ResultsTimelineProps {
  results: AIResultItem[];
  isLoading: boolean;
  onResultClick: (taskId: string) => void;
}

const statusConfig: Record<string, { icon: React.ReactNode; color: string; bgColor: string; label: string }> = {
  completed: { 
    icon: <CheckCircle className="h-4 w-4" />, 
    color: 'text-green-600', 
    bgColor: 'bg-green-500/10 border-green-500/30',
    label: 'Completed' 
  },
  failed: { 
    icon: <XCircle className="h-4 w-4" />, 
    color: 'text-red-600', 
    bgColor: 'bg-red-500/10 border-red-500/30',
    label: 'Failed' 
  },
  escalated: { 
    icon: <AlertTriangle className="h-4 w-4" />, 
    color: 'text-orange-600', 
    bgColor: 'bg-orange-500/10 border-orange-500/30',
    label: 'Escalated' 
  },
  blocked: { 
    icon: <Shield className="h-4 w-4" />, 
    color: 'text-yellow-600', 
    bgColor: 'bg-yellow-500/10 border-yellow-500/30',
    label: 'Blocked' 
  },
  rolled_back: { 
    icon: <Undo2 className="h-4 w-4" />, 
    color: 'text-purple-600', 
    bgColor: 'bg-purple-500/10 border-purple-500/30',
    label: 'Rolled Back' 
  },
};

export function ResultsTimeline({ results, isLoading, onResultClick }: ResultsTimelineProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Results Timeline
          </CardTitle>
          <CardDescription>Chronological ledger of finalized AI task outcomes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Results Timeline
        </CardTitle>
        <CardDescription>
          Chronological ledger of finalized AI task outcomes — {results.length} result{results.length !== 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {results.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No finalized results found for the selected filters</p>
            <p className="text-sm text-muted-foreground mt-1">
              Results appear here once AI tasks are completed or failed
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((result) => (
              <ResultTimelineItem 
                key={result.id} 
                result={result} 
                onClick={() => onResultClick(result.id)} 
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ResultTimelineItem({ 
  result, 
  onClick 
}: { 
  result: AIResultItem; 
  onClick: () => void;
}) {
  const status = statusConfig[result.status] || statusConfig.completed;
  const completedTime = result.completed_at 
    ? formatDistanceToNow(new Date(result.completed_at), { addSuffix: true })
    : null;

  return (
    <div
      className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${status.bgColor}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <span className={status.color}>{status.icon}</span>
            <span className="font-medium truncate">{result.task_title}</span>
            <Badge variant="outline" className="shrink-0">
              {result.task_type?.replace(/_/g, ' ') || 'General'}
            </Badge>
          </div>

          {/* Details Row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {result.target_entity_type && (
              <span className="flex items-center gap-1">
                <Target className="h-3 w-3" />
                {result.target_entity_type}
              </span>
            )}
            
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {completedTime || 'In progress'}
            </span>

            {result.confidence_score != null && (
              <span className="flex items-center gap-1">
                <Brain className="h-3 w-3" />
                {result.confidence_score}% confidence
              </span>
            )}

            {result.execution_mode && (
              <Badge variant="secondary" className="text-xs">
                {result.execution_mode.replace(/_/g, ' ')}
              </Badge>
            )}
          </div>

          {/* Bottom Row */}
          <div className="flex items-center gap-4 mt-2">
            {result.approval_status && (
              <Badge 
                variant={result.approval_status === 'approved' ? 'default' : 
                         result.approval_status === 'rejected' ? 'destructive' : 'secondary'}
              >
                <User className="h-3 w-3 mr-1" />
                {result.approval_status}
              </Badge>
            )}

            {result.time_saved_minutes && result.time_saved_minutes > 0 && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {result.time_saved_minutes} min saved
              </span>
            )}

            {result.worker && (
              <span className="text-xs text-muted-foreground">
                Worker: {result.worker.worker_name}
              </span>
            )}
          </div>

          {/* Error Preview */}
          {result.error_message && (
            <p className="text-xs text-red-600 mt-2 truncate">
              Error: {result.error_message}
            </p>
          )}
        </div>

        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
      </div>
    </div>
  );
}
