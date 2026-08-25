// Dynasty Direct — order-attached support ticket panel.
// Works for signed-in customers (direct table access via RLS) and guests
// (routed through the dd-support-ticket edge function).
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, LifeBuoy, Send, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "wrong_item", label: "Wrong item" },
  { value: "damaged", label: "Damaged" },
  { value: "never_arrived", label: "Never arrived" },
  { value: "billing", label: "Billing" },
  { value: "other", label: "Other" },
];

type TicketMessage = {
  id: string;
  sender_role: string;
  sender_name: string | null;
  body: string;
  attachment_url?: string | null;
  created_at: string;
};

type ThreadState = {
  ticketNumber: string;
  subject: string;
  status: string;
  messages: TicketMessage[];
};

async function callEdge(action: string, payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("dd-support-ticket", {
    body: { action, ...payload },
  });
  if (error) throw error;
  return data as any;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "bg-primary/15 text-primary border-primary/30",
    pending_customer: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    pending_wholesaler: "bg-sky-500/15 text-sky-600 border-sky-500/30",
    resolved: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    closed: "bg-muted text-muted-foreground border-border",
  };
  return <Badge variant="outline" className={map[status] ?? ""}>{status.replace("_", " ")}</Badge>;
}

function Thread({ messages }: { messages: TicketMessage[] }) {
  return (
    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
      {messages.map((m) => (
        <div
          key={m.id}
          className={`rounded-lg border p-3 text-sm ${
            m.sender_role === "customer" ? "bg-muted/40" : "bg-primary/5"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium capitalize">{m.sender_role === "customer" ? m.sender_name || "You" : m.sender_role}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(m.created_at).toLocaleString()}
            </span>
          </div>
          <p className="whitespace-pre-wrap">{m.body}</p>
        </div>
      ))}
      {messages.length === 0 && (
        <p className="text-sm text-muted-foreground">No messages yet.</p>
      )}
    </div>
  );
}

export function OrderSupportPanel({
  orderId,
  orderEmail,
  ticketNumber: initialTicketNumber,
  collapsible = false,
}: {
  orderId?: string;
  orderEmail?: string;
  ticketNumber?: string;
  collapsible?: boolean;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isSignedIn = !!user;

  const [open, setOpen] = useState(!collapsible);
  const [ticketNumber, setTicketNumber] = useState(initialTicketNumber ?? "");
  const [lookupEmail, setLookupEmail] = useState(orderEmail ?? "");
  const [category, setCategory] = useState("other");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(orderEmail ?? "");
  const [replyBody, setReplyBody] = useState("");

  const hasActiveTicket = !!ticketNumber;

  // Signed-in thread via RLS-protected table.
  const signedInThreadQuery = useQuery({
    queryKey: ["dd-ticket-thread-authed", ticketNumber],
    enabled: isSignedIn && hasActiveTicket,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data: ticket, error: tErr } = await supabase
        .from("dd_support_tickets" as any)
        .select("id, ticket_number, subject, status")
        .eq("ticket_number", ticketNumber)
        .maybeSingle();
      if (tErr || !ticket) throw tErr ?? new Error("not_found");
      const { data: messages, error: mErr } = await supabase
        .from("dd_ticket_messages" as any)
        .select("id, sender_role, sender_name, body, attachment_url, created_at")
        .eq("ticket_id", (ticket as any).id)
        .eq("is_internal", false)
        .order("created_at", { ascending: true });
      if (mErr) throw mErr;
      return {
        ticketNumber: (ticket as any).ticket_number,
        subject: (ticket as any).subject,
        status: (ticket as any).status,
        messages: (messages ?? []) as unknown as TicketMessage[],
      } satisfies ThreadState;
    },
  });

  // Guest thread via edge function.
  const guestThreadQuery = useQuery({
    queryKey: ["dd-ticket-thread-guest", ticketNumber, lookupEmail],
    enabled: !isSignedIn && hasActiveTicket && !!lookupEmail,
    refetchInterval: 15000,
    queryFn: async () => {
      const data = await callEdge("thread", { ticket_number: ticketNumber, email: lookupEmail });
      if (!data?.ticket) throw new Error("not_found");
      return {
        ticketNumber: data.ticket.ticket_number,
        subject: data.ticket.subject,
        status: data.ticket.status,
        messages: (data.messages ?? []) as TicketMessage[],
      } satisfies ThreadState;
    },
  });

  const thread = isSignedIn ? signedInThreadQuery.data : guestThreadQuery.data;
  const threadLoading = isSignedIn ? signedInThreadQuery.isFetching : guestThreadQuery.isFetching;
  const threadError = isSignedIn ? signedInThreadQuery.error : guestThreadQuery.error;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!subject.trim() || !message.trim()) throw new Error("Subject and message are required");
      if (isSignedIn) {
        if (!orderId) throw new Error("Missing order");
        const { data: ticket, error } = await supabase
          .from("dd_support_tickets" as any)
          .insert({
            order_id: orderId,
            user_id: user!.id,
            customer_email: user!.email,
            customer_name: name || null,
            subject: subject.trim(),
            category,
            last_reply_role: "customer",
          })
          .select("id, ticket_number")
          .single();
        if (error || !ticket) throw error ?? new Error("Could not create ticket");
        const { error: msgErr } = await supabase.from("dd_ticket_messages" as any).insert({
          ticket_id: (ticket as any).id,
          sender_role: "customer",
          sender_user_id: user!.id,
          sender_name: name || null,
          body: message.trim(),
          is_internal: false,
        });
        if (msgErr) throw msgErr;
        return { ticket_number: (ticket as any).ticket_number };
      } else {
        if (!orderId || !email) throw new Error("Order and email are required");
        const data = await callEdge("create", {
          order_id: orderId,
          email,
          subject: subject.trim(),
          category,
          body: message.trim(),
          name: name || undefined,
        });
        if (!data?.ticket_number) throw new Error("We couldn't verify that order and email combination.");
        return data;
      }
    },
    onSuccess: (data) => {
      toast.success(`Ticket ${data.ticket_number} created`);
      setTicketNumber(data.ticket_number);
      setLookupEmail(email);
      setSubject("");
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["dd-ticket-thread-guest"] });
      queryClient.invalidateQueries({ queryKey: ["dd-ticket-thread-authed"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to create ticket"),
  });

  const lookupMutation = useMutation({
    mutationFn: async () => {
      if (!ticketNumber.trim()) throw new Error("Enter a ticket number");
      if (isSignedIn) {
        await queryClient.invalidateQueries({ queryKey: ["dd-ticket-thread-authed", ticketNumber] });
      } else {
        if (!lookupEmail) throw new Error("Enter the email used on the ticket");
        await queryClient.invalidateQueries({ queryKey: ["dd-ticket-thread-guest", ticketNumber, lookupEmail] });
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "Lookup failed"),
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      if (!replyBody.trim()) throw new Error("Type a message");
      if (!thread) throw new Error("No ticket loaded");
      if (isSignedIn) {
        const { data: ticket, error: tErr } = await supabase
          .from("dd_support_tickets" as any)
          .select("id")
          .eq("ticket_number", ticketNumber)
          .maybeSingle();
        if (tErr || !ticket) throw tErr ?? new Error("Ticket not found");
        const { error } = await supabase.from("dd_ticket_messages" as any).insert({
          ticket_id: (ticket as any).id,
          sender_role: "customer",
          sender_user_id: user!.id,
          sender_name: name || user?.email,
          body: replyBody.trim(),
          is_internal: false,
        });
        if (error) throw error;
        await supabase
          .from("dd_support_tickets" as any)
          .update({ status: "open", last_reply_at: new Date().toISOString(), last_reply_role: "customer" })
          .eq("id", (ticket as any).id);
      } else {
        await callEdge("reply", { ticket_number: ticketNumber, email: lookupEmail, body: replyBody.trim() });
      }
    },
    onSuccess: () => {
      setReplyBody("");
      queryClient.invalidateQueries({ queryKey: ["dd-ticket-thread-guest"] });
      queryClient.invalidateQueries({ queryKey: ["dd-ticket-thread-authed"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to send reply"),
  });

  const body = (
    <div className="space-y-6">
      {!hasActiveTicket && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!isSignedIn && (
              <div className="space-y-2">
                <Label>Your email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Your name (optional)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief summary" />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us what happened..."
              rows={4}
            />
          </div>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !orderId}
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit ticket
          </Button>
          {!orderId && (
            <p className="text-xs text-muted-foreground">
              Or look up an existing ticket below by number and email.
            </p>
          )}

          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium">Have a ticket already?</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input
                placeholder="DD-2506-00001"
                value={ticketNumber}
                onChange={(e) => setTicketNumber(e.target.value.trim())}
              />
              {!isSignedIn && (
                <Input
                  placeholder="email on file"
                  value={lookupEmail}
                  onChange={(e) => setLookupEmail(e.target.value)}
                />
              )}
              <Button variant="outline" onClick={() => lookupMutation.mutate()} disabled={lookupMutation.isPending}>
                {lookupMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                View thread
              </Button>
            </div>
          </div>
        </div>
      )}

      {hasActiveTicket && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Ticket</p>
              <p className="font-mono font-semibold">{ticketNumber}</p>
            </div>
            {thread && <StatusBadge status={thread.status} />}
            <Button variant="ghost" size="sm" onClick={() => setTicketNumber("")}>
              New ticket
            </Button>
          </div>

          {threadLoading && !thread && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading thread...
            </div>
          )}
          {threadError && (
            <p className="text-sm text-destructive">We couldn't load that ticket. Check the ticket number and email.</p>
          )}
          {thread && <Thread messages={thread.messages} />}

          {thread && thread.status !== "closed" && (
            <div className="space-y-2">
              <Textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="Reply..."
                rows={3}
              />
              <Button onClick={() => replyMutation.mutate()} disabled={replyMutation.isPending}>
                {replyMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send reply
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader
        className={collapsible ? "cursor-pointer" : undefined}
        onClick={collapsible ? () => setOpen((o) => !o) : undefined}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <LifeBuoy className="h-4 w-4 text-primary" />
              Something wrong with this order?
            </CardTitle>
            <CardDescription>Open a support ticket and we'll follow up here.</CardDescription>
          </div>
          {collapsible && (open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
        </div>
      </CardHeader>
      {open && <CardContent>{body}</CardContent>}
    </Card>
  );
}

export function OrderSupportLink({ orderId, email }: { orderId?: string; email?: string }) {
  return <OrderSupportPanel orderId={orderId} orderEmail={email} collapsible />;
}

export default OrderSupportPanel;
