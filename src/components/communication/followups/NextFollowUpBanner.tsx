import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Phone, MessageSquare, User, Play } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { FollowUpReasonBadge } from './FollowUpReasonBadge';
import type { FollowUpQueueItem } from '@/hooks/useFollowUps';

interface NextFollowUpBannerProps {
  followUp: FollowUpQueueItem | null;
  onTrigger?: (id: string) => void;
  isLoading?: boolean;
}

export function NextFollowUpBanner({ followUp, onTrigger, isLoading }: NextFollowUpBannerProps) {
  if (!followUp) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="p-4 text-center text-muted-foreground">
          No upcoming follow-ups scheduled
        </CardContent>
      </Card>
    );
  }

  const getActionIcon = () => {
    switch (followUp.recommended_action) {
      case 'ai_call':
        return <Phone className="h-5 w-5" />;
      case 'ai_text':
        return <MessageSquare className="h-5 w-5" />;
      case 'manual_call':
      case 'manual_text':
        return <User className="h-5 w-5" />;
      default:
        return <Clock className="h-5 w-5" />;
    }
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10 text-primary">
              {getActionIcon()}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">Next Follow-Up</span>
                <FollowUpReasonBadge reason={followUp.reason} size="sm" />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{formatDistanceToNow(new Date(followUp.due_at), { addSuffix: true })}</span>
                <span>({format(new Date(followUp.due_at), 'MMM d, h:mm a')})</span>
              </div>
              <div className="text-sm capitalize mt-1">
                {followUp.recommended_action.replace(/_/g, ' ')}
              </div>
            </div>
          </div>

          {onTrigger && (
            <Button onClick={() => onTrigger(followUp.id)} disabled={isLoading}>
              <Play className="h-4 w-4 mr-2" />
              Trigger Now
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
