import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, MessageSquare, User, Clock, Play, CheckCircle, X, AlertTriangle, Building2 } from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { FollowUpReasonBadge } from './FollowUpReasonBadge';
import type { FollowUpQueueItem } from '@/hooks/useFollowUps';

interface FollowUpCardProps {
  followUp: FollowUpQueueItem;
  onTrigger?: (id: string) => void;
  onComplete?: (id: string) => void;
  onCancel?: (id: string) => void;
  isLoading?: boolean;
}

export function FollowUpCard({ followUp, onTrigger, onComplete, onCancel, isLoading }: FollowUpCardProps) {
  const isOverdue = followUp.status === 'overdue' || (followUp.status === 'pending' && isPast(new Date(followUp.due_at)));
  
  const getActionIcon = () => {
    switch (followUp.recommended_action) {
      case 'ai_call': return <Phone className="h-4 w-4 text-primary" />;
      case 'ai_text': return <MessageSquare className="h-4 w-4 text-blue-500" />;
      default: return <User className="h-4 w-4 text-orange-500" />;
    }
  };

  return (
    <Card className={`transition-all ${isOverdue ? 'border-destructive/50 bg-destructive/5' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{followUp.store?.name || 'Unknown Store'}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <FollowUpReasonBadge reason={followUp.reason} />
              <Badge variant={followUp.priority === 1 ? 'destructive' : 'outline'}>P{followUp.priority}</Badge>
              <Badge variant="outline" className="flex items-center gap-1">{getActionIcon()}{followUp.recommended_action.replace(/_/g, ' ')}</Badge>
            </div>
            <div className={`flex items-center gap-1 text-sm ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
              {isOverdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              <span>{formatDistanceToNow(new Date(followUp.due_at), { addSuffix: true })}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {(followUp.status === 'pending' || followUp.status === 'overdue') && (
              <>
                <Button size="sm" onClick={() => onTrigger?.(followUp.id)} disabled={isLoading}><Play className="h-3 w-3 mr-1" />Trigger</Button>
                <Button size="sm" variant="outline" onClick={() => onComplete?.(followUp.id)} disabled={isLoading}><CheckCircle className="h-3 w-3 mr-1" />Complete</Button>
                <Button size="sm" variant="ghost" onClick={() => onCancel?.(followUp.id)} disabled={isLoading}><X className="h-3 w-3 mr-1" />Cancel</Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
