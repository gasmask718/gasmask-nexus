import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dp, fmtMoney } from "@/lib/dpClient";

export default function DPRecruitment() {
  const [channel, setChannel] = useState<string>("all");
  const [platform, setPlatform] = useState<string>("all");

  const { data: platforms } = useQuery({
    queryKey: ["dp-rec-platforms"],
    queryFn: async () => (await dp().from("platforms").select("id, name")).data ?? [],
  });

  const { data, isLoading } = useQuery({
    queryKey: ["dp-rec", channel, platform],
    queryFn: async () => {
      let q = dp().from("outreach_messages").select("channel, direction, status, ai_generated, lead_id");
      if (channel !== "all") q = q.eq("channel", channel);
      const { data: msgs } = await q;

      const byChannel: Record<string, { sent: number; delivered: number; read: number; replied: number; failed: number; }> = {};
      (msgs ?? []).forEach((m: any) => {
        const c = m.channel;
        if (!byChannel[c]) byChannel[c] = { sent: 0, delivered: 0, read: 0, replied: 0, failed: 0 };
        if (m.direction === "outbound") {
          if (["sent","delivered","read","replied"].includes(m.status)) byChannel[c].sent++;
          if (["delivered","read","replied"].includes(m.status)) byChannel[c].delivered++;
          if (["read","replied"].includes(m.status)) byChannel[c].read++;
          if (m.status === "replied") byChannel[c].replied++;
          if (m.status === "failed") byChannel[c].failed++;
        }
      });

      // Qualification rate from leads.status
      let leadsQ = dp().from("leads").select("status, platform_id, campaign_id");
      if (platform !== "all") leadsQ = leadsQ.eq("platform_id", platform);
      const { data: leads } = await leadsQ;
      const total = (leads ?? []).length;
      const qualified = (leads ?? []).filter((l: any) => ["qualified","onboarding","onboarded"].includes(l.status)).length;
      const onboarded = (leads ?? []).filter((l: any) => l.status === "onboarded").length;

      // Spend across campaigns / ambassadors acquired
      let campQ = dp().from("campaigns").select("spent_cents, platform_id");
      if (platform !== "all") campQ = campQ.eq("platform_id", platform);
      const { data: camps } = await campQ;
      const spent = (camps ?? []).reduce((s: number, r: any) => s + (r.spent_cents ?? 0), 0);
      const cac = onboarded ? Math.round(spent / onboarded) : 0;

      return { byChannel, total, qualified, onboarded, spent, cac };
    },
  });

  if (isLoading) return <div>Loading…</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Recruitment Health</h2>

      <Card>
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent className="flex gap-3">
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All channels</SelectItem>
              {["ig_dm","tiktok_dm","sms","email"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              {(platforms ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total leads", value: data!.total },
          { label: "Qualified", value: data!.qualified },
          { label: "Qualification rate", value: data!.total ? `${((data!.qualified/data!.total)*100).toFixed(1)}%` : "—" },
          { label: "CAC (ambassador)", value: fmtMoney(data!.cac) },
        ].map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">{c.label}</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{c.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>By channel</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Channel</TableHead><TableHead>Sent</TableHead><TableHead>Delivered</TableHead>
              <TableHead>Read</TableHead><TableHead>Replied</TableHead><TableHead>Reply rate</TableHead><TableHead>Failed</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {Object.entries(data!.byChannel).map(([c, s]) => (
                <TableRow key={c}>
                  <TableCell><Badge>{c}</Badge></TableCell>
                  <TableCell>{s.sent}</TableCell>
                  <TableCell>{s.delivered}</TableCell>
                  <TableCell>{s.read}</TableCell>
                  <TableCell>{s.replied}</TableCell>
                  <TableCell>{s.sent ? `${((s.replied/s.sent)*100).toFixed(1)}%` : "—"}</TableCell>
                  <TableCell>{s.failed}</TableCell>
                </TableRow>
              ))}
              {Object.keys(data!.byChannel).length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No outreach data yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
