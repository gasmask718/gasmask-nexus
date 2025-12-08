import { format } from 'date-fns';
import { FollowUpReasonBadge } from './FollowUpReasonBadge';
import { CheckCircle, Clock, XCircle, Play } from 'lucide-react';
import type { FollowUpQueueItem } from '@/hooks/useFollowUps';

interface FollowUpTimelineProps {
  followUps: FollowUpQueueItem[];
}

export function FollowUpTimeline({ followUps }: FollowUpTimelineProps) {
  if (followUps.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No follow-up history
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'canceled':
        return <XCircle className="h-4 w-4 text-muted-foreground" />;
      case 'in_progress':
        return <Play className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-orange-500" />;
    }
  };

  return (
    <div className="space-y-4">
      {followUps.map((followUp, index) => (
        <div key={followUp.id} className="relative flex gap-4">
          {/* Timeline line */}
          {index < followUps.length - 1 && (
            <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-border" />
          )}

          {/* Status icon */}
          <div className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-background border">
            {getStatusIcon(followUp.status)}
          </div>

          {/* Content */}
          <div className="flex-1 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <FollowUpReasonBadge reason={followUp.reason} size="sm" />
              <span className="text-xs text-muted-foreground">
                {format(new Date(followUp.created_at), 'MMM d, yyyy h:mm a')}
              </span>
            </div>

            <div className="text-sm">
              <span className="capitalize">{followUp.recommended_action.replace(/_/g, ' ')}</span>
              {followUp.status === 'completed' && followUp.completed_at && (
                <span className="text-muted-foreground">
                  {' '}— Completed {format(new Date(followUp.completed_at), 'MMM d, h:mm a')}
                </span>
              )}
            </div>

            {followUp.context && Object.keys(followUp.context).length > 0 && (
              <div className="mt-1 text-xs text-muted-foreground">
                {JSON.stringify(followUp.context)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
