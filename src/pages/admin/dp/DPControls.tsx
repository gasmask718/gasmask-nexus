import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { dp, fmtMoney, logAdminAction } from "@/lib/dpClient";
import { toast } from "sonner";
import { Pause, Play } from "lucide-react";

function makeKill(table: string, statusField: string, pauseValue: string, resumeValue: string, label: string) {
  return function KillSection() {
    const qc = useQueryClient();
    const { data, isLoading } = useQuery({
      queryKey: [`dp-kill-${table}`],
      queryFn: async () => (await dp().from(table).select("*").order("created_at", { ascending: false }).limit(100)).data ?? [],
    });
    const mut = useMutation({
      mutationFn: async ({ id, next }: { id: string; next: string }) => {
        const { error } = await dp().from(table).update({ [statusField]: next }).eq("id", id);
        if (error) throw error;
        await logAdminAction({ action: `${label}_${next}`, entity_type: label, entity_id: id, metadata: { from_table: table } });
      },
      onSuccess: () => { toast.success(`${label} updated`); qc.invalidateQueries({ queryKey: [`dp-kill-${table}`] }); },
      onError: (e: any) => toast.error(e.message),
    });
    if (isLoading) return <div>Loading…</div>;
    return (
      <Table>
        <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {(data as any[]).map((r) => {
            const isPaused = r[statusField] === pauseValue;
            return (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.id.slice(0,8)}</TableCell>
                <TableCell>{r.name ?? r.full_name ?? r.short_code ?? "—"}</TableCell>
                <TableCell><Badge variant={isPaused ? "destructive" : "default"}>{r[statusField]}</Badge></TableCell>
                <TableCell>
                  <Button size="sm" variant={isPaused ? "default" : "destructive"}
                    onClick={() => mut.mutate({ id: r.id, next: isPaused ? resumeValue : pauseValue })}
                    disabled={mut.isPending}>
                    {isPaused ? <><Play className="h-3 w-3 mr-1" />Resume</> : <><Pause className="h-3 w-3 mr-1" />Pause</>}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };
}

const PausePartners = makeKill("partners", "status", "suspended", "active", "partner");
const PauseCampaigns = makeKill("campaigns", "status", "paused", "active", "campaign");
const PauseAmbassadors = makeKill("ambassadors", "status", "dormant", "active", "ambassador");
const PausePlatforms = makeKill("platforms", "status", "maintenance", "active", "platform");

function HoldPayouts() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["dp-hold-payouts"],
    queryFn: async () => (await dp().from("payouts").select("*").in("status", ["scheduled","processing"]).order("scheduled_for")).data ?? [],
  });
  const mut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await dp().from("payouts").update({ status: "failed", failure_reason: "Held by admin" }).eq("id", id);
      if (error) throw error;
      await logAdminAction({ action: "payout_held", entity_type: "payout", entity_id: id });
    },
    onSuccess: () => { toast.success("Payout held"); qc.invalidateQueries({ queryKey: ["dp-hold-payouts"] }); },
  });
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Recipient</TableHead><TableHead>Amount</TableHead><TableHead>Scheduled</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
      <TableBody>
        {(data as any[] ?? []).map((p) => (
          <TableRow key={p.id}>
            <TableCell className="text-xs">{p.recipient_type}: {p.recipient_id.slice(0,8)}</TableCell>
            <TableCell className="font-mono">{fmtMoney(p.total_amount_cents)}</TableCell>
            <TableCell>{new Date(p.scheduled_for).toLocaleString()}</TableCell>
            <TableCell><Badge>{p.status}</Badge></TableCell>
            <TableCell><Button size="sm" variant="destructive" onClick={() => mut.mutate(p.id)}>Hold</Button></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function DPControls() {
  const [tab, setTab] = useState("partners");
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Kill Switches</h2>
      <Card>
        <CardContent className="pt-6">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="partners">Partners</TabsTrigger>
              <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
              <TabsTrigger value="ambassadors">Ambassadors</TabsTrigger>
              <TabsTrigger value="payouts">Payouts</TabsTrigger>
              <TabsTrigger value="platforms">Platforms</TabsTrigger>
            </TabsList>
            <TabsContent value="partners"><PausePartners /></TabsContent>
            <TabsContent value="campaigns"><PauseCampaigns /></TabsContent>
            <TabsContent value="ambassadors"><PauseAmbassadors /></TabsContent>
            <TabsContent value="payouts"><HoldPayouts /></TabsContent>
            <TabsContent value="platforms"><PausePlatforms /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
