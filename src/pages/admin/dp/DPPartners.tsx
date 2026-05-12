import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { dp, fmtMoney, fmtDate, logAdminAction } from "@/lib/dpClient";
import { toast } from "sonner";
import { Eye, Pause, Ban } from "lucide-react";

type Partner = {
  id: string; full_name: string; email: string; tier: string; status: string;
  created_at: string; mrr_active_until: string | null;
  total_lifetime_earnings_cents: number;
  ambassador_count?: number; churn_risk?: number;
};

export default function DPPartners() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: rows, isLoading } = useQuery({
    queryKey: ["dp-partners-list"],
    queryFn: async () => {
      const { data: partners, error } = await dp()
        .from("partners")
        .select("id, full_name, email, tier, status, created_at, mrr_active_until, total_lifetime_earnings_cents")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const ids = (partners ?? []).map((p: any) => p.id);
      const { data: ambs } = await dp()
        .from("ambassadors").select("partner_id, status").in("partner_id", ids);

      const counts: Record<string, number> = {};
      const active: Record<string, number> = {};
      (ambs ?? []).forEach((a: any) => {
        counts[a.partner_id] = (counts[a.partner_id] ?? 0) + 1;
        if (a.status === "active") active[a.partner_id] = (active[a.partner_id] ?? 0) + 1;
      });

      const now = Date.now();
      return (partners ?? []).map((p: any): Partner => {
        const ambCount = counts[p.id] ?? 0;
        const activeAmb = active[p.id] ?? 0;
        let risk = 0;
        if (p.status === "dormant" || p.status === "suspended") risk += 50;
        if (p.mrr_active_until && new Date(p.mrr_active_until).getTime() < now) risk += 30;
        if (ambCount === 0) risk += 30;
        else if (activeAmb / ambCount < 0.2) risk += 20;
        return { ...p, ambassador_count: ambCount, churn_risk: Math.min(100, risk) };
      });
    },
  });

  const filtered = (rows ?? []).filter((r) => {
    if (tierFilter !== "all" && r.tier !== tierFilter) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search && !`${r.full_name} ${r.email}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const bulkMut = useMutation({
    mutationFn: async (status: "dormant" | "suspended") => {
      const ids = Array.from(selected);
      const { error } = await dp().from("partners").update({ status }).in("id", ids);
      if (error) throw error;
      await Promise.all(ids.map((id) =>
        logAdminAction({ action: `partner_${status}`, entity_type: "partner", entity_id: id, partner_id: id, metadata: { bulk: true } }),
      ));
    },
    onSuccess: (_, status) => {
      toast.success(`Marked ${selected.size} partner(s) as ${status}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["dp-partners-list"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Bulk update failed"),
  });

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">All Partners</h2>

      <Card>
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <Input placeholder="Search name / email" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Tier" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tiers</SelectItem>
              <SelectItem value="foundation">Foundation</SelectItem>
              <SelectItem value="equity">Equity</SelectItem>
              <SelectItem value="sovereign">Sovereign</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              {["pending_onboarding","active","dormant","suspended","churned"].map(s =>
                <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          {selected.size > 0 && (
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={() => bulkMut.mutate("dormant")} disabled={bulkMut.isPending}>
                <Pause className="h-3 w-3 mr-1" /> Pause ({selected.size})
              </Button>
              <Button size="sm" variant="destructive" onClick={() => bulkMut.mutate("suspended")} disabled={bulkMut.isPending}>
                <Ban className="h-3 w-3 mr-1" /> Suspend ({selected.size})
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-6">Loading…</div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>MRR until</TableHead>
                  <TableHead>Lifetime to Dynasty</TableHead>
                  <TableHead>Ambassadors</TableHead>
                  <TableHead>Churn risk</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell><Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} /></TableCell>
                    <TableCell>
                      <div className="font-medium">{p.full_name}</div>
                      <div className="text-xs text-muted-foreground">{p.email}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{p.tier}</Badge></TableCell>
                    <TableCell><Badge>{p.status}</Badge></TableCell>
                    <TableCell>{fmtDate(p.created_at)}</TableCell>
                    <TableCell>{fmtDate(p.mrr_active_until)}</TableCell>
                    <TableCell className="font-mono">{fmtMoney(p.total_lifetime_earnings_cents)}</TableCell>
                    <TableCell>{p.ambassador_count}</TableCell>
                    <TableCell>
                      <Badge variant={p.churn_risk! >= 60 ? "destructive" : p.churn_risk! >= 30 ? "secondary" : "outline"}>
                        {p.churn_risk}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => nav(`/admin?as=${p.id}`)}>
                        <Eye className="h-3 w-3 mr-1" /> Impersonate
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
