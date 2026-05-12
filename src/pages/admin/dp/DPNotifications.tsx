import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { dp, logAdminAction } from "@/lib/dpClient";
import { toast } from "sonner";

export default function DPNotifications() {
  const qc = useQueryClient();
  const [channel, setChannel] = useState<"in_app"|"email"|"sms"|"push">("in_app");
  const [audience, setAudience] = useState<"all"|"foundation"|"equity"|"sovereign">("all");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const { data: stats } = useQuery({
    queryKey: ["dp-notif-stats"],
    queryFn: async () => {
      const { data } = await dp().from("notifications").select("status");
      const counts: Record<string, number> = {};
      (data ?? []).forEach((r: any) => { counts[r.status] = (counts[r.status] ?? 0) + 1; });
      return counts;
    },
  });

  const sendMut = useMutation({
    mutationFn: async () => {
      if (!body) throw new Error("Body required");
      let q = dp().from("partners").select("id, tier");
      if (audience !== "all") q = q.eq("tier", audience);
      const { data: targets } = await q;
      if (!targets?.length) throw new Error("No partners match audience");
      const rows = targets.map((p: any) => ({
        recipient_id: p.id, recipient_type: "partner",
        channel, subject: subject || null, body, status: "queued",
      }));
      const { error } = await dp().from("notifications").insert(rows);
      if (error) throw error;
      await logAdminAction({
        action: "broadcast_sent", entity_type: "notification",
        metadata: { audience, channel, recipients: rows.length, subject },
      });
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`Queued ${n} notifications`);
      setSubject(""); setBody("");
      qc.invalidateQueries({ queryKey: ["dp-notif-stats"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Notifications</h2>

      <Card>
        <CardHeader><CardTitle>Compose system-wide announcement</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Select value={audience} onValueChange={(v: any) => setAudience(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All partners</SelectItem>
                <SelectItem value="foundation">Foundation tier</SelectItem>
                <SelectItem value="equity">Equity tier</SelectItem>
                <SelectItem value="sovereign">Sovereign tier</SelectItem>
              </SelectContent>
            </Select>
            <Select value={channel} onValueChange={(v: any) => setChannel(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["in_app","email","sms","push"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Input placeholder="Subject (optional)" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <Textarea rows={5} placeholder="Message body" value={body} onChange={(e) => setBody(e.target.value)} />
          <Button onClick={() => sendMut.mutate()} disabled={sendMut.isPending}>
            {sendMut.isPending ? "Queueing…" : "Queue broadcast"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Delivery stats</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Status</TableHead><TableHead>Count</TableHead></TableRow></TableHeader>
            <TableBody>
              {Object.entries(stats ?? {}).map(([s, n]) => (
                <TableRow key={s}><TableCell><Badge>{s}</Badge></TableCell><TableCell>{n}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
