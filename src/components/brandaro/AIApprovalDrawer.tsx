import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle,
  DrawerTrigger, DrawerClose,
} from "@/components/ui/drawer";
import {
  Bell, Check, X, Edit2, Loader2, ChevronDown, CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface PendingMessage {
  id: string;
  lead_id: string;
  lead_name: string | null;
  phone_number: string | null;
  message_body: string;
  message_type: string;
  ai_agent: string | null;
  status: string;
  objection_responses: any;
  created_at: string;
}

const TYPE_COLORS: Record<string, string> = {
  sms: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  pitch: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  objection_response: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  followup: "bg-muted text-muted-foreground",
};

export function AIApprovalDrawer() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<PendingMessage[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Record<string, string | null>>({});

  const fetchMessages = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("brandaro_pending_messages")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) {
      setMessages(data);
      setCount(data.length);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 30000);

    const channel = supabase
      .channel("pending-messages-count")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "brandaro_pending_messages",
      }, () => fetchMessages())
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchMessages]);

  const handleApprove = async (msg: PendingMessage) => {
    setLoading((p) => ({ ...p, [msg.id]: true }));
    try {
      const body = editing[msg.id] ?? msg.message_body;
      const { error } = await supabase.functions.invoke("send-sms", {
        body: { phone_number: msg.phone_number, message: body },
      });
      if (error) throw error;

      await (supabase as any)
        .from("brandaro_pending_messages")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", msg.id);

      await supabase.functions.invoke("brandaro-pipeline-automator", {
        body: {
          action: "record_event",
          lead_id: msg.lead_id,
          event_type: "sms_sent",
        },
      });

      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      setCount((c) => Math.max(0, c - 1));
      toast.success("Sent");
    } catch {
      toast.error("Send failed — message kept in queue");
    } finally {
      setLoading((p) => ({ ...p, [msg.id]: false }));
      setEditing((p) => ({ ...p, [msg.id]: null }));
    }
  };

  const handleReject = async (msg: PendingMessage) => {
    await (supabase as any)
      .from("brandaro_pending_messages")
      .update({ status: "rejected" })
      .eq("id", msg.id);
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    setCount((c) => Math.max(0, c - 1));
  };

  return (
    <Drawer direction="right" open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold">
              {count}
            </span>
          )}
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-full w-full sm:w-[420px] ml-auto rounded-none">
        <DrawerHeader className="flex items-center justify-between border-b pb-3">
          <div>
            <DrawerTitle className="text-base">AI Message Queue</DrawerTitle>
            <p className="text-xs text-muted-foreground">{count} pending</p>
          </div>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <X className="h-4 w-4" />
            </Button>
          </DrawerClose>
        </DrawerHeader>
        <ScrollArea className="flex-1 px-4 py-2">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mb-2" />
              <p className="text-sm">All clear — no messages pending approval</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <MessageItem
                  key={msg.id}
                  msg={msg}
                  isLoading={!!loading[msg.id]}
                  editText={editing[msg.id] ?? null}
                  onEdit={(text) => setEditing((p) => ({ ...p, [msg.id]: text }))}
                  onCancelEdit={() => setEditing((p) => ({ ...p, [msg.id]: null }))}
                  onApprove={() => handleApprove(msg)}
                  onReject={() => handleReject(msg)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}

function MessageItem({
  msg,
  isLoading,
  editText,
  onEdit,
  onCancelEdit,
  onApprove,
  onReject,
}: {
  msg: PendingMessage;
  isLoading: boolean;
  editText: string | null;
  onEdit: (text: string) => void;
  onCancelEdit: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isEditing = editText !== null;

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-card">
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm truncate flex-1">{msg.lead_name || "Unknown"}</span>
        <Badge variant="outline" className={`text-[10px] ${TYPE_COLORS[msg.message_type] || ""}`}>
          {msg.message_type}
        </Badge>
      </div>
      {msg.ai_agent && (
        <p className="text-[11px] text-muted-foreground">Written by: {msg.ai_agent}</p>
      )}

      {isEditing ? (
        <div className="space-y-1">
          <Textarea
            value={editText}
            onChange={(e) => onEdit(e.target.value)}
            rows={3}
            className="text-[13px]"
          />
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onCancelEdit}>
            Cancel
          </Button>
        </div>
      ) : (
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.message_body}</p>
      )}

      {msg.message_type === "pitch" && msg.objection_responses && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 w-full justify-start">
              <ChevronDown className="h-3 w-3" /> Objection responses
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 pt-1">
            {Object.entries(msg.objection_responses as Record<string, string>).map(([key, val]) => (
              <div key={key} className="bg-muted/50 rounded p-2 text-xs">
                <span className="font-medium capitalize">{key.replace(/_/g, " ")}:</span>{" "}
                {val}
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-muted-foreground">
          {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
        </span>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50"
            onClick={onReject}
            disabled={isLoading}
          >
            <X className="h-3 w-3" />
          </Button>
          {!isEditing && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => onEdit(msg.message_body)}
              disabled={isLoading}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          )}
          <Button
            size="sm"
            className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700 text-white"
            onClick={onApprove}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
            {isLoading ? "" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
