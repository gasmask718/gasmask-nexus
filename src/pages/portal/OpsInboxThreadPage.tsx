import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  useOpsThreadMessages,
  useMarkThreadRead,
  useAckThread,
  useResolveThread,
  useSnoozeThread,
  useReplyToThread,
} from '@/hooks/useOpsInbox';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Check, CheckCheck, Clock, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function OpsInboxThreadPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const [reply, setReply] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const { data: messages = [], isLoading } = useOpsThreadMessages(threadId);
  const markRead = useMarkThreadRead();
  const ack = useAckThread();
  const resolve = useResolveThread();
  const snooze = useSnoozeThread();
  const replyMutation = useReplyToThread();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
  }, []);

  // Auto-mark read on mount
  useEffect(() => {
    if (threadId) markRead.mutate(threadId);
  }, [threadId]);

  const handleSendReply = () => {
    if (!reply.trim() || !threadId) return;
    replyMutation.mutate({ threadId, body: reply.trim() });
    setReply('');
  };

  const handleSnooze = () => {
    if (!threadId) return;
    const until = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(); // 4 hours
    snooze.mutate({ threadId, until });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate('/portal/inbox')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-sm font-semibold text-foreground truncate">Thread</h2>
      </div>

      {/* Actions */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-2 bg-muted/30 overflow-x-auto">
        <Button size="sm" variant="outline" onClick={() => threadId && ack.mutate(threadId)} className="gap-1 text-xs shrink-0">
          <Check className="h-3 w-3" /> Acknowledge
        </Button>
        <Button size="sm" variant="outline" onClick={() => threadId && resolve.mutate(threadId)} className="gap-1 text-xs shrink-0">
          <CheckCheck className="h-3 w-3" /> Resolve
        </Button>
        <Button size="sm" variant="outline" onClick={handleSnooze} className="gap-1 text-xs shrink-0">
          <Clock className="h-3 w-3" /> Snooze 4h
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Loading...</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No messages</p>
        ) : (
          messages.map(msg => {
            const isOwn = msg.sender_user_id === currentUserId;
            return (
              <div key={msg.id} className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-2',
                  isOwn ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm',
                  msg.sender_type === 'system' && 'bg-amber-100 dark:bg-amber-900/20 italic'
                )}>
                  {!isOwn && (
                    <Badge variant="outline" className="text-[10px] mb-1">{msg.sender_type}</Badge>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                  <p className={cn('text-[10px] mt-1', isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                    {format(new Date(msg.created_at), 'h:mm a')}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reply */}
      <div className="px-4 py-3 border-t border-border bg-card flex items-center gap-2">
        <Input
          placeholder="Reply..."
          value={reply}
          onChange={e => setReply(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSendReply()}
          className="flex-1"
        />
        <Button size="icon" onClick={handleSendReply} disabled={!reply.trim() || replyMutation.isPending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
