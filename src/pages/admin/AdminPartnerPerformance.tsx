import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";

type Snapshot = {
  id: string;
  snapshot_date: string;
  partner_id: string;
  partner_type: string;
  partner_name: string | null;
  dispatches_received_30d: number;
  dispatches_accepted_30d: number;
  acceptance_rate_30d: number;
  avg_response_time_minutes_30d: number | null;
  bookings_completed_30d: number;
  bookings_cancelled_30d: number;
  completion_rate_30d: number;
  revenue_generated_30d: number;
  performance_tier: string | null;
};

const TIER_COLORS: Record<string, string> = {
  platinum: "bg-slate-200 text-slate-900",
  gold: "bg-amber-200 text-amber-900",
  silver: "bg-zinc-200 text-zinc-900",
  bronze: "bg-orange-200 text-orange-900",
  at_risk: "bg-red-200 text-red-900",
};

export default function AdminPartnerPerformance() {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<keyof Snapshot>("acceptance_rate_30d");
  const [selectedPartner, setSelectedPartner] = useState<Snapshot | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const { data: latestDate } = useQuery({
    queryKey: ["partner-snapshots-latest"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_performance_snapshots")
        .select("snapshot_date")
        .order("snapshot_date", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0]?.snapshot_date as string | undefined;
    },
  });

  const { data: snapshots = [], isLoading, refetch } = useQuery({
    queryKey: ["partner-snapshots", latestDate],
    queryFn: async () => {
      if (!latestDate) return [] as Snapshot[];
      const { data, error } = await supabase
        .from("partner_performance_snapshots")
        .select("*")
        .eq("snapshot_date", latestDate);
      if (error) throw error;
      return (data || []) as Snapshot[];
    },
    enabled: !!latestDate,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["partner-snapshot-history", selectedPartner?.partner_id],
    queryFn: async () => {
      if (!selectedPartner) return [] as Snapshot[];
      const { data, error } = await supabase
        .from("partner_performance_snapshots")
        .select("*")
        .eq("partner_id", selectedPartner.partner_id)
        .order("snapshot_date", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data || []) as Snapshot[];
    },
    enabled: !!selectedPartner,
  });

  const filtered = useMemo(() => {
    let rows = snapshots;
    if (typeFilter !== "all") rows = rows.filter((r) => r.partner_type === typeFilter);
    if (tierFilter !== "all") rows = rows.filter((r) => r.performance_tier === tierFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      rows = rows.filter((r) => (r.partner_name || "").toLowerCase().includes(s));
    }
    return [...rows].sort((a, b) => {
      const av = Number(a[sortBy] ?? 0);
      const bv = Number(b[sortBy] ?? 0);
      return bv - av;
    });
  }, [snapshots, typeFilter, tierFilter, search, sortBy]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-partner-snapshots");
      if (error) throw error;
      toast.success(`Regenerated ${data?.snapshots_created ?? 0} snapshots`);
      await refetch();
    } catch (e: any) {
      toast.error(e.message || "Regenerate failed");
    } finally {
      setRegenerating(false);
    }
  };

  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = { platinum: 0, gold: 0, silver: 0, bronze: 0, at_risk: 0 };
    for (const s of snapshots) {
      if (s.performance_tier) counts[s.performance_tier] = (counts[s.performance_tier] || 0) + 1;
    }
    return counts;
  }, [snapshots]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Partner Performance</h1>
          <p className="text-sm text-muted-foreground">
            Daily snapshot {latestDate ? `· ${latestDate}` : "· no data yet"} ·{" "}
            {snapshots.length} partners
          </p>
        </div>
        <Button onClick={handleRegenerate} disabled={regenerating} variant="outline">
          {regenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Regenerate snapshot
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(["platinum", "gold", "silver", "bronze", "at_risk"] as const).map((t) => (
          <Card key={t}>
            <CardContent className="pt-4">
              <Badge className={TIER_COLORS[t]} variant="secondary">{t}</Badge>
              <p className="text-2xl font-bold mt-2">{tierCounts[t] ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input placeholder="Search partner…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="transport">Transport</SelectItem>
              <SelectItem value="decorator">Decorator</SelectItem>
              <SelectItem value="concierge">Concierge</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger><SelectValue placeholder="Tier" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tiers</SelectItem>
              <SelectItem value="platinum">Platinum</SelectItem>
              <SelectItem value="gold">Gold</SelectItem>
              <SelectItem value="silver">Silver</SelectItem>
              <SelectItem value="bronze">Bronze</SelectItem>
              <SelectItem value="at_risk">At risk</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as keyof Snapshot)}>
            <SelectTrigger><SelectValue placeholder="Sort by" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="acceptance_rate_30d">Acceptance rate</SelectItem>
              <SelectItem value="completion_rate_30d">Completion rate</SelectItem>
              <SelectItem value="revenue_generated_30d">Revenue</SelectItem>
              <SelectItem value="dispatches_received_30d">Dispatches</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No snapshots yet. Click <em>Regenerate snapshot</em> to create today's data.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Dispatches</TableHead>
                  <TableHead className="text-right">Accept %</TableHead>
                  <TableHead className="text-right">Complete %</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id} onClick={() => setSelectedPartner(r)} className="cursor-pointer">
                    <TableCell className="font-medium">{r.partner_name || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.partner_type}</TableCell>
                    <TableCell>
                      {r.performance_tier ? (
                        <Badge className={TIER_COLORS[r.performance_tier]} variant="secondary">
                          {r.performance_tier}
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right">{r.dispatches_received_30d}</TableCell>
                    <TableCell className="text-right">{Number(r.acceptance_rate_30d).toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{Number(r.completion_rate_30d).toFixed(1)}%</TableCell>
                    <TableCell className="text-right">${Number(r.revenue_generated_30d).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selectedPartner} onOpenChange={(o) => !o && setSelectedPartner(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedPartner?.partner_name}</SheetTitle>
          </SheetHeader>
          {selectedPartner && (
            <Tabs defaultValue="summary" className="mt-4">
              <TabsList>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="history">30-day history</TabsTrigger>
              </TabsList>
              <TabsContent value="summary" className="space-y-3 mt-4">
                {[
                  ["Dispatches received", selectedPartner.dispatches_received_30d],
                  ["Dispatches accepted", selectedPartner.dispatches_accepted_30d],
                  ["Acceptance rate", `${Number(selectedPartner.acceptance_rate_30d).toFixed(1)}%`],
                  ["Avg response time", selectedPartner.avg_response_time_minutes_30d != null ? `${Number(selectedPartner.avg_response_time_minutes_30d).toFixed(1)} min` : "—"],
                  ["Bookings completed", selectedPartner.bookings_completed_30d],
                  ["Bookings cancelled", selectedPartner.bookings_cancelled_30d],
                  ["Completion rate", `${Number(selectedPartner.completion_rate_30d).toFixed(1)}%`],
                  ["Revenue (30d)", `$${Number(selectedPartner.revenue_generated_30d).toLocaleString()}`],
                  ["Tier", selectedPartner.performance_tier ?? "—"],
                ].map(([k, v]) => (
                  <div key={String(k)} className="flex items-center justify-between border-b border-border/40 pb-2">
                    <span className="text-sm text-muted-foreground">{k}</span>
                    <span className="font-medium">{v}</span>
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="history" className="mt-4">
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No prior snapshots.</p>
                ) : (
                  <div className="space-y-1">
                    {history.map((h, i) => {
                      const prev = history[i + 1];
                      const delta = prev ? Number(h.acceptance_rate_30d) - Number(prev.acceptance_rate_30d) : 0;
                      return (
                        <div key={h.id} className="flex items-center justify-between text-sm border-b border-border/30 py-2">
                          <span className="text-muted-foreground">{h.snapshot_date}</span>
                          <div className="flex items-center gap-3">
                            {h.performance_tier && (
                              <Badge className={TIER_COLORS[h.performance_tier]} variant="secondary">{h.performance_tier}</Badge>
                            )}
                            <span>{Number(h.acceptance_rate_30d).toFixed(0)}% accept</span>
                            {delta !== 0 && (
                              <span className={delta > 0 ? "text-emerald-500" : "text-red-500"}>
                                {delta > 0 ? <TrendingUp className="h-3 w-3 inline" /> : <TrendingDown className="h-3 w-3 inline" />}
                                {" "}{Math.abs(delta).toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
