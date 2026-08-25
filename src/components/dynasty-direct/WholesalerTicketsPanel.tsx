// Dynasty Direct — tickets forwarded to the signed-in wholesaler.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Send, LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Ticket = {
  id: string;
  ticket_number: string;
  subject: string;
  status: string;
  last_reply_at: string;
};

type Message = {
  id: string;
  sender_role: string;
  sender_name: string | null;
  body: string;
  created_at: string;
};

export function WholesalerTicketsPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");

  const ticketsQuery = useQuery({
    queryKey: ["wholesaler-tickets"],
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dd_support_tickets" as any)
        .select("id, ticket_number, subject, status, last_reply_at")
        .not("forwarded_to_wholesaler_at", "is", null)
        .order("last_reply_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Ticket[];
    },
  });

  const selected = ticketsQuery.data?.find((t) => t.id === selectedId) ?? null;

  const messagesQuery = useQuery({
    queryKey: ["wholesaler-ticket-messages", selectedId],
    enabled: !!selectedId,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dd_ticket_messages" as any)
        .select("id, sender_role, sender_name, body, created_at")
        .eq("ticket_id", selectedId)
        .eq("is_internal", false)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Message[];
    },
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !replyBody.trim()) return;
      const { error } = await supabase.from("dd_ticket_messages" as any).insert({
        ticket_id: selected.id,
        sender_role: "wholesaler",
        sender_user_id: user?.id,
        sender_name: user?.email,
        body: replyBody.trim(),
        is_internal: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setReplyBody("");
      queryClient.invalidateQueries({ queryKey: ["wholesaler-ticket-messages", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["wholesaler-tickets"] });
      toast.success("Reply sent");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to send reply"),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LifeBuoy className="h-4 w-4 text-primary" /> Support Tickets
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {ticketsQuery.isLoading ? (
            <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Ticket</TableHead><TableHead>Status</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {(ticketsQuery.data ?? []).map((t) => (
                  <TableRow key={t.id} className={`cursor-pointer ${selectedId === t.id ? "bg-muted/60" : ""}`} onClick={() => setSelectedId(t.id)}>
                    <TableCell>
                      <div className="font-mono text-xs">{t.ticket_number}</div>
                      <div className="text-sm truncate max-w-[160px]">{t.subject}</div>
                      <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(t.last_reply_at), { addSuffix: true })}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{t.status.replace("_", " ")}</Badge></TableCell>
                  </TableRow>
                ))}
                {(ticketsQuery.data ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-8">No tickets forwarded yet</TableCell></TableRow>
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
            <CardHeader><CardTitle className="text-base">{selected.subject}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-lg p-3 max-h-72 overflow-y-auto space-y-3">
                {(messagesQuery.data ?? []).map((m) => (
                  <div key={m.id} className={`rounded-lg border p-2 text-sm ${m.sender_role === "wholesaler" ? "bg-primary/5" : "bg-muted/40"}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-xs capitalize">{m.sender_role}</span>
                      <span className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Textarea value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="Reply to customer..." rows={3} />
                <Button onClick={() => replyMutation.mutate()} disabled={replyMutation.isPending}>
                  {replyMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Send reply
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}

export default WholesalerTicketsPanel;
