// Dynasty Direct — Support ticket queue (admin).
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Send, Forward, LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Ticket = {
  id: string;
  ticket_number: string;
  order_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  subject: string;
  category: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  wholesaler_id: string | null;
  forwarded_to_wholesaler_at: string | null;
  last_reply_at: string;
  last_reply_role: string | null;
  created_at: string;
};

type Message = {
  id: string;
  ticket_id: string;
  sender_role: string;
  sender_name: string | null;
  body: string;
  is_internal: boolean;
  created_at: string;
};

const STATUSES = ["open", "pending_customer", "pending_wholesaler", "resolved", "closed"];
const PRIORITIES = ["low", "normal", "high", "urgent"];
const CATEGORIES = ["wrong_item", "damaged", "never_arrived", "billing", "other"];

const statusColor: Record<string, string> = {
  open: "bg-primary/15 text-primary border-primary/30",
  pending_customer: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  pending_wholesaler: "bg-sky-500/15 text-sky-600 border-sky-500/30",
  resolved: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  closed: "bg-muted text-muted-foreground border-border",
};

const priorityColor: Record<string, string> = {
  low: "bg-muted text-muted-foreground border-border",
  normal: "bg-primary/10 text-primary border-primary/20",
  high: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  urgent: "bg-destructive/15 text-destructive border-destructive/30",
};

export default function DDSupportTickets() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [forwardedFilter, setForwardedFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  const ticketsQuery = useQuery({
    queryKey: ["dd-support-tickets", statusFilter, priorityFilter, categoryFilter, forwardedFilter],
    queryFn: async () => {
      let query = supabase
        .from("dd_support_tickets" as any)
        .select("*")
        .order("last_reply_at", { ascending: false });
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (priorityFilter !== "all") query = query.eq("priority", priorityFilter);
      if (categoryFilter !== "all") query = query.eq("category", categoryFilter);
      if (forwardedFilter === "forwarded") query = query.not("forwarded_to_wholesaler_at", "is", null);
      if (forwardedFilter === "not_forwarded") query = query.is("forwarded_to_wholesaler_at", null);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Ticket[];
    },
    refetchInterval: 20000,
  });

  const selected = ticketsQuery.data?.find((t) => t.id === selectedId) ?? null;

  const messagesQuery = useQuery({
    queryKey: ["dd-ticket-messages", selectedId],
    enabled: !!selectedId,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dd_ticket_messages" as any)
        .select("*")
        .eq("ticket_id", selectedId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Message[];
    },
  });

  const updateTicket = useMutation({
    mutationFn: async (updates: Partial<Ticket> & { id: string }) => {
      const { id, ...rest } = updates;
      const { error } = await supabase.from("dd_support_tickets" as any).update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dd-support-tickets"] });
      toast.success("Ticket updated");
    },
    onError: (e: any) => toast.error(e?.message ?? "Update failed"),
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !replyBody.trim()) return;
      const { error } = await supabase.from("dd_ticket_messages" as any).insert({
        ticket_id: selected.id,
        sender_role: "admin",
        sender_user_id: user?.id,
        sender_name: user?.email,
        body: replyBody.trim(),
        is_internal: isInternal,
      });
      if (error) throw error;
      if (!isInternal) {
        await supabase
          .from("dd_support_tickets" as any)
          .update({
            status: "pending_customer",
            last_reply_at: new Date().toISOString(),
            last_reply_role: "admin",
          })
          .eq("id", selected.id);
      }
    },
    onSuccess: () => {
      setReplyBody("");
      setIsInternal(false);
      queryClient.invalidateQueries({ queryKey: ["dd-ticket-messages", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["dd-support-tickets"] });
      toast.success("Sent");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to send"),
  });

  const forwardMutation = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      let wholesalerId = selected.wholesaler_id;
      if (!wholesalerId && selected.order_id) {
        const { data: order } = await supabase
          .from("marketplace_orders")
          .select("wholesaler_id")
          .eq("id", selected.order_id)
          .maybeSingle();
        wholesalerId = order?.wholesaler_id ?? null;
      }
      if (!wholesalerId) throw new Error("No wholesaler found for this order");
      const { error } = await supabase
        .from("dd_support_tickets" as any)
        .update({
          wholesaler_id: wholesalerId,
          forwarded_to_wholesaler_at: new Date().toISOString(),
          status: "pending_wholesaler",
        })
        .eq("id", selected.id);
      if (error) throw error;
      await supabase.from("dd_ticket_messages" as any).insert({
        ticket_id: selected.id,
        sender_role: "system",
        sender_name: "System",
        body: "This ticket was forwarded to the supplying wholesaler.",
        is_internal: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dd-support-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["dd-ticket-messages", selectedId] });
      toast.success("Forwarded to wholesaler");
    },
    onError: (e: any) => toast.error(e?.message ?? "Forward failed"),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <LifeBuoy className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Support Tickets</h1>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={forwardedFilter} onValueChange={setForwardedFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Forwarded" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="forwarded">Forwarded to wholesaler</SelectItem>
            <SelectItem value="not_forwarded">Not forwarded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Queue</CardTitle></CardHeader>
          <CardContent className="p-0">
            {ticketsQuery.isLoading ? (
              <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reply</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(ticketsQuery.data ?? []).map((t) => (
                    <TableRow
                      key={t.id}
                      className={`cursor-pointer ${selectedId === t.id ? "bg-muted/60" : ""}`}
                      onClick={() => setSelectedId(t.id)}
                    >
                      <TableCell>
                        <div className="font-mono text-xs">{t.ticket_number}</div>
                        <div className="text-sm font-medium truncate max-w-[160px]">{t.subject}</div>
                      </TableCell>
                      <TableCell className="text-sm">{t.customer_name || t.customer_email || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColor[t.status]}>{t.status.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(t.last_reply_at), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(ticketsQuery.data ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No tickets</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          {!selected ? (
            <CardContent className="py-16 text-center text-muted-foreground">Select a ticket</CardContent>
          ) : (
            <>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-base">{selected.subject}</CardTitle>
                    <p className="text-xs text-muted-foreground font-mono">{selected.ticket_number} · {selected.customer_email}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className={statusColor[selected.status]}>{selected.status.replace("_", " ")}</Badge>
                    <Badge variant="outline" className={priorityColor[selected.priority]}>{selected.priority}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Status</Label>
                    <Select
                      value={selected.status}
                      onValueChange={(v) => updateTicket.mutate({ id: selected.id, status: v, ...(v === "resolved" ? { resolved_at: new Date().toISOString() } : {}) })}
                    >
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Priority</Label>
                    <Select value={selected.priority} onValueChange={(v) => updateTicket.mutate({ id: selected.id, priority: v })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Assign to me</Label>
                    <Button
                      size="sm"
                      variant={selected.assigned_to === user?.id ? "default" : "outline"}
                      className="h-8 w-full"
                      onClick={() => updateTicket.mutate({ id: selected.id, assigned_to: selected.assigned_to === user?.id ? null : user?.id })}
                      disabled={updateTicket.isPending}
                    >
                      {updateTicket.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                      {selected.assigned_to === user?.id ? "Assigned" : "Assign"}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={forwardMutation.isPending || !!selected.forwarded_to_wholesaler_at}
                    onClick={() => forwardMutation.mutate()}
                  >
                    {forwardMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Forward className="h-4 w-4 mr-2" />}
                    {selected.forwarded_to_wholesaler_at ? "Forwarded to wholesaler" : "Forward to wholesaler"}
                  </Button>
                </div>

                <div className="border rounded-lg p-3 max-h-72 overflow-y-auto space-y-3">
                  {messagesQuery.isLoading ? (
                    <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
                  ) : (
                    (messagesQuery.data ?? []).map((m) => (
                      <div
                        key={m.id}
                        className={`rounded-lg border p-2 text-sm ${
                          m.is_internal ? "bg-amber-500/10 border-amber-500/30" : m.sender_role === "customer" ? "bg-muted/40" : "bg-primary/5"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-xs capitalize">
                            {m.sender_role} {m.is_internal && "· internal note"}
                          </span>
                          <span className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</span>
                        </div>
                        <p className="whitespace-pre-wrap">{m.body}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-2">
                  <Textarea value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="Write a reply..." rows={3} />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch checked={isInternal} onCheckedChange={setIsInternal} id="internal-toggle" />
                      <Label htmlFor="internal-toggle" className="text-sm">Internal note</Label>
                    </div>
                    <Button onClick={() => replyMutation.mutate()} disabled={replyMutation.isPending}>
                      {replyMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                      Send
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
