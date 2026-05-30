import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Send, AlertTriangle, Loader2, Shield, User, Store } from 'lucide-react';
import { format } from 'date-fns';
import { useOrderMessages, OrderMessage } from '@/services/marketplace/useOrderMessages';

interface Props {
  orderId: string;
  senderRole: 'customer' | 'vendor' | 'admin';
  vendorId?: string | null;
  disputeActive?: boolean;
}

const CANNED_TEMPLATES = [
  'Your order has shipped.',
  'Please confirm your address.',
  'Delivery attempt failed — please check details.',
  'We are preparing your order.',
];

const senderConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  customer: { label: 'Customer', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', icon: User },
  vendor: { label: 'Vendor', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30', icon: Store },
  admin: { label: 'Admin', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: Shield },
  system: { label: 'System', color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30', icon: Shield },
};

export function OrderMessageThread({ orderId, senderRole, vendorId, disputeActive }: Props) {
  const { messages, isLoading, sendMessage, isSending, unreadCount, markAsRead } = useOrderMessages(orderId, vendorId);
  const [draft, setDraft] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Mark unread messages as read
  useEffect(() => {
    const unreadIds = messages
      .filter(m => !m.is_read && m.sender_role !== senderRole)
      .map(m => m.id);
    if (unreadIds.length > 0) {
      markAsRead(unreadIds);
    }
  }, [messages, senderRole, markAsRead]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body) return;

    await sendMessage({
      messageBody: body,
      senderRole,
      vendorId,
    });
    setDraft('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const applyTemplate = (t: string) => {
    setDraft(t);
    setShowTemplates(false);
  };

  return (
    <Card className="bg-card/50 border-border/50 flex flex-col h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Order Messages
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold">
                {unreadCount}
              </span>
            )}
          </CardTitle>
          <span className="text-[10px] text-muted-foreground font-mono">#{orderId.slice(0, 8)}</span>
        </div>
      </CardHeader>

      {/* Dispute banner */}
      {disputeActive && (
        <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>Dispute active — messages may be reviewed as evidence.</span>
        </div>
      )}

      {/* Messages */}
      <CardContent className="flex-1 p-0 overflow-hidden">
        <div ref={scrollRef} className="h-[320px] overflow-y-auto px-4 py-2 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground text-sm">
              <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
              <p>No messages yet</p>
              <p className="text-xs mt-1">Start the conversation below</p>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} isOwnMessage={msg.sender_role === senderRole} />
            ))
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-border/30 px-4 py-3">
          {/* Vendor canned templates */}
          {senderRole === 'vendor' && (
            <div className="mb-2">
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider"
              >
                {showTemplates ? '— Hide Templates' : '+ Quick Templates'}
              </button>
              {showTemplates && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {CANNED_TEMPLATES.map((t) => (
                    <button
                      key={t}
                      onClick={() => applyTemplate(t)}
                      className="text-[11px] px-2 py-1 rounded-md bg-muted/40 hover:bg-muted/60 border border-border/30 text-foreground transition-colors"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="min-h-[40px] max-h-[100px] resize-none text-sm bg-background/50"
              maxLength={2000}
            />
            <Button
              size="sm"
              onClick={handleSend}
              disabled={isSending || !draft.trim()}
              className="self-end h-10 w-10 p-0 shrink-0"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 text-right">
            {draft.length}/2000 · Enter to send · Shift+Enter for new line
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function MessageBubble({ message, isOwnMessage }: { message: OrderMessage; isOwnMessage: boolean }) {
  const cfg = senderConfig[message.sender_role] || senderConfig.system;
  const Icon = cfg.icon;
  const isDispute = message.message_type === 'dispute_related';
  const isSystem = message.sender_role === 'system' || message.message_type === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="px-3 py-1.5 rounded-full bg-muted/30 border border-border/20 text-[11px] text-muted-foreground flex items-center gap-1.5">
          <Shield className="h-3 w-3" />
          {message.message_body}
          <span className="text-[9px] opacity-60 ml-1">
            {format(new Date(message.created_at), 'h:mm a')}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
        <div className="flex items-center gap-1.5 mb-0.5">
          {!isOwnMessage && (
            <Badge className={`text-[9px] h-4 px-1.5 ${cfg.color}`}>
              <Icon className="h-2.5 w-2.5 mr-0.5" />
              {cfg.label}
            </Badge>
          )}
          {isDispute && (
            <Badge className="text-[9px] h-4 px-1.5 bg-red-500/15 text-red-400 border-red-500/30">
              <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
              Dispute
            </Badge>
          )}
        </div>
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            isOwnMessage
              ? 'bg-primary/15 border border-primary/20 text-foreground'
              : 'bg-muted/30 border border-border/20 text-foreground'
          } ${isDispute ? 'border-red-500/20' : ''}`}
        >
          <p className="whitespace-pre-wrap break-words">{message.message_body}</p>
        </div>
        <p className={`text-[9px] text-muted-foreground mt-0.5 ${isOwnMessage ? 'text-right' : ''}`}>
          {format(new Date(message.created_at), 'MMM d, yyyy, h:mm a')}
          {isOwnMessage && message.is_read && (
            <span className="ml-1 text-primary/60">✓ Read</span>
          )}
        </p>
      </div>
    </div>
  );
}
