import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  MessageSquare, Search, Send, Loader2, AlertTriangle, PhoneOff, Info,
} from 'lucide-react';
import { dynastyDateTime } from '@/lib/dates';
import {
  useVAConversations, useVAThread, useVAMessagingRefresh,
  type VALead, type OutboundStatus, type ThreadMessage,
} from '@/hooks/useVAMessages';

const MAX_CHARS = 1600;

const STATUS_STYLE: Record<OutboundStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  // Status colors stay semantic (red is reserved for failures on this screen).
  approved: 'bg-foreground/10 text-foreground border-border',

  sent: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  rejected: 'bg-muted text-muted-foreground border-border',
  edited: 'bg-violet-500/15 text-violet-600 border-violet-500/30',
  failed: 'bg-destructive/15 text-destructive border-destructive/30',
};

function Bubble({ m }: { m: ThreadMessage }) {
  const outbound = m.direction === 'outbound';
  const failed = m.status === 'failed';
  return (
    <div className={cn('flex', outbound ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[80%] space-y-1', outbound && 'items-end text-right')}>
        <div
          className={cn(
            'rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words',
            outbound
              ? failed
                ? 'bg-destructive/10 border border-destructive/40'
                : 'bg-primary/10 border border-primary/20'
              : 'bg-muted border border-border',
          )}
        >
          {m.body}
        </div>
        <div className={cn('flex items-center gap-2 text-[10px] text-muted-foreground', outbound && 'justify-end')}>
          {outbound && m.status && (
            <Badge variant="outline" className={cn('text-[10px] capitalize', STATUS_STYLE[m.status])}>
              {failed && <AlertTriangle className="mr-1 h-2.5 w-2.5" />}
              {m.status}
            </Badge>
          )}
          {!outbound && m.channel && (
            <Badge variant="secondary" className="text-[10px] uppercase">{m.channel}</Badge>
          )}
          <span>{dynastyDateTime(m.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * VA Messaging — conversation list + thread + composer, scoped to the leads
 * assigned to the signed-in VA. Sending queues a draft in
 * brandaro_pending_messages for admin approval; it never sends directly.
 */
export function VAMessages() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<VALead | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const refresh = useVAMessagingRefresh();

  const { conversations, isLoading, error } = useVAConversations(search);
  const { data: thread = [], isLoading: threadLoading, error: threadError } = useVAThread(selected);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [thread.length, selected?.id]);

  const send = async () => {
    if (!selected || !draft.trim() || !user) return;
    setSending(true);
    try {
      const { error: insErr } = await (supabase as any)
        .from('brandaro_pending_messages')
        .insert({
          lead_id: selected.id,
          lead_name: selected.business_name,
          phone_number: selected.phone_number,
          message_body: draft.trim(),
          message_type: 'sms',
          status: 'pending',
        });
      if (insErr) throw insErr;
      setDraft('');
      refresh();
      toast.success('Message queued for approval');
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not queue message', { duration: 8000 });
    } finally {
      setSending(false);
    }
  };

  const noPhone = selected && !selected.phone_number;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Messages</h2>
        <span className="text-xs text-muted-foreground">Your assigned leads only</span>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error.message}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Conversation list */}
        <Card className="border-border">
          <CardContent className="space-y-2 p-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search leads…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <ScrollArea className="h-[420px] pr-2">
              {isLoading ? (
                <div className="p-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : !conversations.length ? (
                <p className="p-4 text-sm text-muted-foreground">No assigned leads found.</p>
              ) : (
                <div className="space-y-1">
                  {conversations.map((c) => (
                    <button
                      key={c.lead.id}
                      onClick={() => setSelected(c.lead)}
                      className={cn(
                        'w-full rounded-lg border p-2 text-left transition-colors',
                        selected?.id === c.lead.id
                          ? 'border-primary/40 bg-primary/5'
                          : 'border-transparent hover:bg-muted',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {c.lead.business_name || c.lead.phone_number || 'Unnamed lead'}
                        </span>
                        {c.unreadInbound > 0 && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread replies" />
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.lastMessage
                          ? `${c.lastMessage.direction === 'inbound' ? '← ' : '→ '}${c.lastMessage.body}`
                          : 'No messages yet'}
                      </p>
                      {c.lastMessage && (
                        <p className="text-[10px] text-muted-foreground">
                          {dynastyDateTime(c.lastMessage.created_at)}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Thread + composer */}
        <Card className="border-border">
          <CardContent className="flex h-[520px] flex-col gap-3 p-3">
            {!selected ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Select a lead to view the conversation.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
                  <span className="font-medium">{selected.business_name || 'Unnamed lead'}</span>
                  <span className="text-xs text-muted-foreground">{selected.phone_number || 'No phone'}</span>
                  {selected.lead_status && (
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      {selected.lead_status.replace(/_/g, ' ')}
                    </Badge>
                  )}
                </div>

                <ScrollArea className="flex-1 pr-2">
                  {threadError && <p className="text-sm text-destructive">{(threadError as Error).message}</p>}
                  {threadLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : !thread.length ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No messages with this lead yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {thread.map((m) => <Bubble key={`${m.direction}-${m.id}`} m={m} />)}
                      <div ref={bottomRef} />
                    </div>
                  )}
                </ScrollArea>

                <div className="space-y-2 border-t border-border pt-2">
                  {noPhone ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <PhoneOff className="h-4 w-4" />
                      This lead has no phone number — add one before messaging.
                    </p>
                  ) : (
                    <>
                      <Textarea
                        rows={3}
                        placeholder="Write your message…"
                        value={draft}
                        maxLength={MAX_CHARS}
                        onChange={(e) => setDraft(e.target.value)}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Info className="h-3 w-3" />
                          Queued for approval before it goes out.
                        </span>
                        <span className="ml-auto text-[11px] text-muted-foreground">
                          {draft.length}/{MAX_CHARS}
                        </span>
                        <Button size="sm" onClick={send} disabled={sending || !draft.trim()}>
                          {sending
                            ? <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            : <Send className="mr-2 h-3 w-3" />}
                          Send
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default VAMessages;
