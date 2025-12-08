import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, MessageSquare, User, Clock, Play, CheckCircle, X, AlertTriangle, Building2, CalendarClock, Star } from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { FollowUpReasonBadge } from './FollowUpReasonBadge';
import type { FollowUpQueueItem } from '@/hooks/useFollowUps';

interface FollowUpCardProps {
  followUp: FollowUpQueueItem;
  onTrigger?: (id: string) => void;
  onComplete?: (id: string) => void;
  onCancel?: (id: string) => void;
  onReschedule?: (item: FollowUpQueueItem) => void;
  isLoading?: boolean;
}

export function FollowUpCard({ followUp, onTrigger, onComplete, onCancel, onReschedule, isLoading }: FollowUpCardProps) {
  const isOverdue = followUp.status === 'overdue' || (followUp.status === 'pending' && isPast(new Date(followUp.due_at)));
  
  const getActionIcon = () => {
    switch (followUp.recommended_action) {
      case 'ai_call': return <Phone className="h-4 w-4 text-primary" />;
      case 'ai_text': return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case 'manual_call': return <User className="h-4 w-4 text-orange-500" />;
      case 'manual_text': return <User className="h-4 w-4 text-purple-500" />;
      default: return <User className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActionLabel = () => {
    switch (followUp.recommended_action) {
      case 'ai_call': return 'AI Call';
      case 'ai_text': return 'AI Text';
      case 'manual_call': return 'Manual Call';
      case 'manual_text': return 'Manual Text';
      default: return followUp.recommended_action?.replace(/_/g, ' ') || 'Unknown';
    }
  };

  const getPriorityStars = () => {
    const priority = followUp.priority || 3;
    return Array.from({ length: Math.min(priority, 5) }, (_, i) => (
      <Star key={i} className={`h-3 w-3 ${i < priority ? 'fill-yellow-500 text-yellow-500' : 'text-muted'}`} />
    ));
  };

  const contextInfo = followUp.context as Record<string, unknown> | null;

  return (
    <Card className={`transition-all hover:shadow-md ${isOverdue ? 'border-destructive/50 bg-destructive/5' : ''}`}>
      <CardContent className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          {/* Main Info */}
          <div className="flex-1 space-y-3">
            {/* Header Row */}
            <div className="flex flex-wrap items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-lg">{followUp.store?.name || 'Unknown Store'}</span>
              {followUp.vertical?.name && (
                <Badge variant="outline" className="text-xs">{followUp.vertical.name}</Badge>
              )}
            </div>

            {/* Business */}
            {followUp.business?.name && (
              <div className="text-sm text-muted-foreground">
                {followUp.business.name}
              </div>
            )}

            {/* Tags Row */}
            <div className="flex flex-wrap items-center gap-2">
              <FollowUpReasonBadge reason={followUp.reason} />
              <Badge variant={followUp.priority === 1 ? 'destructive' : followUp.priority === 2 ? 'default' : 'outline'}>
                P{followUp.priority}
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1">
                {getActionIcon()}
                {getActionLabel()}
              </Badge>
            </div>

            {/* Context Info */}
            {contextInfo && Object.keys(contextInfo).length > 0 && (
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-2">
                <span className="font-medium">Context: </span>
                {contextInfo.sentiment && <span>Sentiment: {String(contextInfo.sentiment)} </span>}
                {contextInfo.days_since_order && <span>• No order in {String(contextInfo.days_since_order)} days </span>}
                {contextInfo.message && <span>"{String(contextInfo.message)}"</span>}
              </div>
            )}

            {/* Priority & Due */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1">
                {getPriorityStars()}
              </div>
              <div className={`flex items-center gap-1 text-sm ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                {isOverdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                <span>Due: {format(new Date(followUp.due_at), 'MMM d, yyyy h:mm a')}</span>
                <span className="text-xs">({formatDistanceToNow(new Date(followUp.due_at), { addSuffix: true })})</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          {(followUp.status === 'pending' || followUp.status === 'overdue') && (onTrigger || onComplete || onCancel) && (
            <div className="flex flex-wrap lg:flex-col gap-2 lg:min-w-[140px]">
              {onTrigger && (
                <Button size="sm" onClick={() => onTrigger(followUp.id)} disabled={isLoading} className="gap-1">
                  <Play className="h-3 w-3" />
                  Trigger Now
                </Button>
              )}
              {onReschedule && (
                <Button size="sm" variant="outline" onClick={() => onReschedule(followUp)} disabled={isLoading} className="gap-1">
                  <CalendarClock className="h-3 w-3" />
                  Reschedule
                </Button>
              )}
              {onComplete && (
                <Button size="sm" variant="secondary" onClick={() => onComplete(followUp.id)} disabled={isLoading} className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Complete
                </Button>
              )}
              {onCancel && (
                <Button size="sm" variant="ghost" onClick={() => onCancel(followUp.id)} disabled={isLoading} className="gap-1 text-muted-foreground">
                  <X className="h-3 w-3" />
                  Cancel
                </Button>
              )}
            </div>
          )}

          {/* Completed Status */}
          {followUp.status === 'completed' && (
            <Badge variant="outline" className="text-green-600 border-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              Completed
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
