import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Message {
  id: string;
  direction: string;
  message_body: string | null;
  message_text: string | null;
  from_number: string | null;
  to_number: string | null;
  status: string | null;
  created_at: string;
}

export function ConversationThread({ leadId }: { leadId: string }) {
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages } = useQuery({
    queryKey: ["conversations", leadId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("brandaro_conversations")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: true });
      return (data || []) as Message[];
    },
  });

  // Realtime subscription — instantly add new messages
  useEffect(() => {
    if (!leadId) return;

    const channel = supabase
      .channel(`conv-${leadId}-live`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "brandaro_conversations",
          filter: `lead_id=eq.${leadId}`,
        },
        (payload) => {
          // Optimistically add new message to cache
          queryClient.setQueryData(
            ["conversations", leadId],
            (old: Message[] | undefined) => [...(old || []), payload.new as Message]
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leadId, queryClient]);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-[400px]">
      {/* Message thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 p-3">
        {messages?.map((msg) => {
          const text = msg.message_body || msg.message_text || "";
          const isInbound = msg.direction === "inbound";
          return (
            <div key={msg.id} className={`flex ${isInbound ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                  isInbound
                    ? "bg-muted text-foreground"
                    : "bg-primary text-primary-foreground"
                }`}
              >
                <p>{text}</p>
                <p className={`text-[10px] mt-1 ${isInbound ? "text-muted-foreground" : "text-primary-foreground/70"}`}>
                  {msg.created_at
                    ? formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })
                    : ""}
                  {isInbound && " · Received"}
                </p>
              </div>
            </div>
          );
        })}
        {(!messages || messages.length === 0) && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2">
            <MessageSquare className="h-8 w-8" />
            No messages yet
          </div>
        )}
      </div>

      {/* Quick reply input */}
      <div className="border-t p-3">
        <QuickReplyInput leadId={leadId} />
      </div>
    </div>
  );
}

function QuickReplyInput({ leadId }: { leadId: string }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const queryClient = useQueryClient();

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const { data: lead } = await (supabase as any)
        .from("brandaro_qualified_leads")
        .select("phone_number, business_name")
        .eq("id", leadId)
        .single();

      if (!lead?.phone_number) {
        toast.error("No phone number");
        return;
      }

      await supabase.functions.invoke("send-sms", {
        body: {
          to_number: lead.phone_number,
          message_body: text,
          idempotency_key: `manual-${leadId}-${Date.now()}`,
        },
      });

      // Log as outbound conversation
      await (supabase as any).from("brandaro_conversations").insert({
        lead_id: leadId,
        direction: "outbound",
        message_body: text,
        message_text: text,
        status: "sent",
      });

      setText("");
      // Realtime will pick it up, but also invalidate for safety
      queryClient.invalidateQueries({ queryKey: ["conversations", leadId] });
      toast.success("Message sent");
    } catch (err: any) {
      toast.error(err.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message..."
        className="flex-1 text-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
      />
      <Button size="icon" onClick={send} disabled={sending || !text.trim()}>
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </div>
  );
}
