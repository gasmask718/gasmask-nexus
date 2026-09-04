import { useState, useEffect, useRef } from "react";
import { SmsProviderSelect } from "@/components/communication/SmsProviderSelect";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageSquare, Send, RefreshCw, User, ArrowLeft, 
  Phone, Bot, Sparkles, CheckCheck, Clock
} from "lucide-react";
import { useCall } from "@/components/communication/CallProvider";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { toast } from "sonner";

interface Contact {
  id: string;
  name: string;
  phone: string;
  type: string;
  source: string;
}

interface Message {
  id: string;
  direction: "inbound" | "outbound";
  channel: string;
  content: string | null;
  phone_number: string | null;
  status: string;
  ai_generated: boolean;
  created_at: string;
  store?: { id: string; store_name: string } | null;
  business?: { id: string; name: string; primary_color: string } | null;
}

interface ConversationPanelProps {
  contact: Contact | null;
  onBack?: () => void;
}

export function ConversationPanel({ contact, onBack }: ConversationPanelProps) {
  const queryClient = useQueryClient();
  const { initiateCall } = useCall();
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("default");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Normalize phone for query
  const normalizePhone = (phone: string) => {
    return phone.replace(/\D/g, "");
  };

  // Fetch conversation history from DB + Twilio fallback (for messages not yet ingested)
  const { data: messages = [], isLoading, refetch } = useQuery({
    queryKey: ["conversation-messages", contact?.phone],
    queryFn: async () => {
      if (!contact?.phone) return [];
      
      const normalizedPhone = normalizePhone(contact.phone);
      const last10 = normalizedPhone.slice(-10);
      
      // Query from communication_messages (legacy + inbound)
      const { data: commMsgs, error: commErr } = await supabase
        .from("communication_messages")
        .select(`
          id, direction, channel, content, phone_number, 
          status, ai_generated, created_at,
          store:store_master(id, store_name),
          business:businesses(id, name, primary_color)
        `)
        .or(`phone_number.ilike.%${last10}%`)
        .order("created_at", { ascending: true });

      if (commErr) console.error("communication_messages error:", commErr);

      // Query from outbound_messages (canonical sent messages via send-sms)
      const { data: outMsgs, error: outErr } = await supabase
        .from("outbound_messages")
        .select("id, to_number, message_body, status, created_at, provider, store_id, metadata, sent_at")
        .or(`to_number.ilike.%${last10}%`)
        .order("created_at", { ascending: true });

      if (outErr) console.error("outbound_messages error:", outErr);

      // Fetch full Twilio thread as fallback source
      const { data: twilioData, error: twilioErr } = await supabase.functions.invoke("fetch-twilio-conversation", {
        body: { phone: normalizedPhone },
      });

      if (twilioErr) {
        console.warn("fetch-twilio-conversation warning:", twilioErr.message);
      }

      // Normalize outbound_messages into the same Message shape
      const outboundNormalized: Message[] = (outMsgs || []).map((m) => ({
        id: m.id,
        direction: "outbound" as const,
        channel: "sms",
        content: m.message_body,
        phone_number: m.to_number,
        status: m.status,
        ai_generated: false,
        created_at: m.sent_at || m.created_at || "",
        store: null,
        business: null,
      }));

      // Normalize Twilio messages into the same Message shape
      const twilioNormalized: Message[] = ((twilioData?.messages || []) as any[]).map((m) => ({
        id: `twilio-${m.sid}`,
        direction: m.direction === "inbound" ? "inbound" : "outbound",
        channel: "sms",
        content: m.body || null,
        phone_number: m.direction === "inbound" ? m.from : m.to,
        status: m.status || (m.direction === "inbound" ? "received" : "sent"),
        ai_generated: false,
        created_at: m.created_at || "",
        store: null,
        business: null,
      }));

      // Merge and dedupe with a semantic fingerprint
      const allMessages = [...((commMsgs || []) as Message[]), ...outboundNormalized, ...twilioNormalized];
      const deduped = new Map<string, Message>();

      allMessages.forEach((msg) => {
        const phoneKey = normalizePhone(msg.phone_number || "").slice(-10);
        const minuteBucket = Math.floor(new Date(msg.created_at || 0).getTime() / 60000) || 0;
        const contentKey = (msg.content || "").trim();
        const fingerprint = `${msg.direction}|${phoneKey}|${contentKey}|${minuteBucket}`;

        const existing = deduped.get(fingerprint);
        if (!existing || new Date(msg.created_at || 0).getTime() > new Date(existing.created_at || 0).getTime()) {
          deduped.set(fingerprint, msg);
        }
      });
      
      return Array.from(deduped.values()).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    },
    enabled: !!contact?.phone,
  });

  // Subscribe to real-time updates for this conversation
  useEffect(() => {
    if (!contact?.phone) return;

    const channel = supabase
      .channel(`conversation-${contact.phone}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "communication_messages" },
        (payload) => {
          const newMsg = payload.new as any;
          const normalizedPhone = normalizePhone(contact.phone);
          const msgPhone = normalizePhone(newMsg.phone_number || "");
          
          if (msgPhone.includes(normalizedPhone.slice(-10)) || normalizedPhone.includes(msgPhone.slice(-10))) {
            queryClient.invalidateQueries({ queryKey: ["conversation-messages", contact.phone] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contact?.phone, queryClient]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !contact?.phone) return;
    
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: {
          to_number: contact.phone,
          message_body: newMessage,
          // Inbox reply in an existing thread → conversational.
          send_class: "conversational",
          idempotency_key: crypto.randomUUID(),
          explicit_provider: selectedProvider === "default" ? undefined : selectedProvider,
          skip_cooldown: true,
          metadata: { contact_id: contact.id, contact_name: contact.name },
        },
      });

      if (error) throw error;
      
      if (data?.success) {
        toast.success("Message sent");
        setNewMessage("");
        refetch();
        queryClient.invalidateQueries({ queryKey: ["communication-messages"] });
        queryClient.invalidateQueries({ queryKey: ["unified-inbox-messages"] });
      } else {
        throw new Error(data?.error || "Failed to send");
      }
    } catch (error: any) {
      console.error("Send error:", error);
      toast.error(error.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatMessageDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, "h:mm a");
    if (isYesterday(date)) return `Yesterday ${format(date, "h:mm a")}`;
    return format(date, "MMM d, yyyy, h:mm a");
  };

  const getStatusIcon = (status: string, direction: string) => {
    if (direction === "inbound") return null;
    switch (status) {
      case "delivered":
      case "read":
        return <CheckCheck className="h-3 w-3 text-primary" />;
      case "pending":
        return <Clock className="h-3 w-3 text-muted-foreground" />;
      case "failed":
        return <span className="text-destructive text-xs">Failed</span>;
      default:
        return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
    }
  };

  if (!contact) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center text-muted-foreground">
          <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <h3 className="text-lg font-medium mb-2">Select a contact</h3>
          <p className="text-sm">Choose a contact from the list to start messaging</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      {/* Header */}
      <CardHeader className="py-3 px-4 border-b flex-shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{contact.name}</h3>
            <p className="text-sm text-muted-foreground">{contact.phone}</p>
          </div>
          <Badge variant="secondary" className="capitalize">
            {contact.type}
          </Badge>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => contact && initiateCall({
              destinationPhone: contact.phone,
              entityName: contact.name,
              entityType: (contact.type as any) || "other",
              entityId: contact.id,
            })}
          >
            <Phone className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full" ref={scrollRef as any}>
          <div className="p-4 space-y-3 min-h-full flex flex-col justify-end">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No messages yet</p>
                <p className="text-sm">Send a message to start the conversation</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    msg.direction === "outbound" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-4 py-2 shadow-sm",
                      msg.direction === "outbound"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted rounded-bl-md"
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {msg.content || "(No content)"}
                    </p>
                    <div 
                      className={cn(
                        "flex items-center gap-1.5 mt-1 text-xs",
                        msg.direction === "outbound" 
                          ? "text-primary-foreground/70 justify-end" 
                          : "text-muted-foreground"
                      )}
                    >
                      {msg.ai_generated && <Bot className="h-3 w-3" />}
                      <span>{formatMessageDate(msg.created_at)}</span>
                      {getStatusIcon(msg.status, msg.direction)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input */}
      <div className="p-4 border-t flex-shrink-0 space-y-2">
        <SmsProviderSelect value={selectedProvider} onChange={setSelectedProvider} showLabel={false} className="w-40" />
        <div className="flex gap-2">
          <Textarea
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            className="min-h-[44px] max-h-32 resize-none"
            rows={1}
          />
          <Button 
            onClick={handleSend}
            disabled={isSending || !newMessage.trim()}
            size="icon"
            className="h-11 w-11 flex-shrink-0"
          >
            {isSending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
