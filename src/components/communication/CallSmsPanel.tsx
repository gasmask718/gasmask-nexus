import { useState, useEffect, useRef } from 'react';
import { useCallSmsThread } from '@/hooks/useCallSmsThread';
import { Send, MessageSquare, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface CallSmsPanelProps {
  phone: string;
  contactName: string;
  leadId?: string;
  callId?: string;
}

export function CallSmsPanel({ phone, contactName, leadId, callId }: CallSmsPanelProps) {
  const { data: messages, isLoading } = useCallSmsThread(phone);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const replyCount = messages?.filter(m => (m as any).message_type === 'inbound_reply').length || 0;

  const sendSms = async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-sms', {
        body: {
          to_number: phone,
          message_body: reply,
          // send_class is mandatory (no default) — a 1:1 human reply in a live
          // call thread is conversational traffic.
          send_class: 'conversational',
          idempotency_key: `call-sms-${callId || 'manual'}-${Date.now()}`,
        },
      });
      if (error) throw error;

      // Also insert into outreach_sms for thread tracking
      await supabase.from('outreach_sms').insert({
        lead_id: leadId || null,
        call_id: callId || null,
        phone,
        message: reply,
        message_type: 'outbound_manual',
        delivered: true,
        sent_at: new Date().toISOString(),
      } as any);

      setReply('');
      queryClient.invalidateQueries({ queryKey: ['call-sms-thread', phone] });
      toast.success('SMS sent');
    } catch (e: any) {
      toast.error(e.message || 'Failed to send SMS');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            SMS Thread
            {replyCount > 0 && (
              <Badge variant="secondary" className="text-xs">{replyCount} replies</Badge>
            )}
          </span>
          <Badge variant="outline" className="text-xs gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Live
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-3 pt-0 gap-2">
        <ScrollArea className="flex-1 min-h-[200px] max-h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !messages?.length ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No messages yet. Send a text to start the conversation.
            </div>
          ) : (
            <div className="space-y-2 pr-2">
              {messages.map((msg: any) => {
                const isInbound = msg.message_type === 'inbound_reply';
                return (
                  <div key={msg.id} className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                      isInbound
                        ? 'bg-muted text-foreground'
                        : 'bg-primary text-primary-foreground'
                    }`}>
                      <p className="whitespace-pre-wrap">{msg.message}</p>
                      <p className={`text-[10px] mt-1 ${isInbound ? 'text-muted-foreground' : 'text-primary-foreground/70'}`}>
                        {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {!isInbound && (
                          <span>{msg.delivered ? ' · ✓' : ' · ⏳'}</span>
                        )}
                        {isInbound && <span> · Reply</span>}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>

        <div className="flex gap-2 pt-1 border-t">
          <Input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Send a message..."
            className="flex-1 h-8 text-xs"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendSms();
              }
            }}
          />
          <Button size="icon" className="h-8 w-8" onClick={sendSms} disabled={!reply.trim() || sending}>
            {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
