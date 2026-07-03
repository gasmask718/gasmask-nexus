import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, ExternalLink, TrendingUp, DollarSign, Users, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

const GOLD = "#C9A84C";

const fmtMoney = (n: number) =>
  "$" + (n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const BUSINESS_BADGE: Record<string, string> = {
  gasmask:         "bg-orange-500/15 text-orange-300 border-orange-500/30",
  brandaro:        "bg-blue-500/15 text-blue-300 border-blue-500/30",
  toptier:         "bg-purple-500/15 text-purple-300 border-purple-500/30",
  uft:             "bg-pink-500/15 text-pink-300 border-pink-500/30",
  playboxxx:       "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
  iclean:          "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  dynasty_connect: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  uben:            "bg-green-500/15 text-green-300 border-green-500/30",
};

const BUSINESS_LABEL: Record<string, string> = {
  gasmask: "GasMask",
  brandaro: "Brandaro",
  toptier: "TopTier",
  uft: "Unforgettable Times",
  playboxxx: "Playboxxx",
  iclean: "iClean WeClean",
  dynasty_connect: "Dynasty Connect",
  uben: "UBEN",
};

export default function ClipperConversions() {
  const [search, setSearch] = useState("");
  const [businessFilter, setBusinessFilter] = useState<string>("all");

  const { data: conversions, isLoading, error } = useQuery({
    queryKey: ["clipper-conversions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("clipper_conversions")
        .select(`
          *,
          clipper_accounts!clipper_id(full_name),
          clipper_campaigns!campaign_id(brand_name, dynasty_business)
        `)
        .order("converted_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    return (conversions || []).filter((c: any) => {
      if (businessFilter !== "all" && c.clipper_campaigns?.dynasty_business !== businessFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const clip = (c.clipper_accounts?.full_name || "").toLowerCase();
        const brand = (c.clipper_campaigns?.brand_name || "").toLowerCase();
        if (!clip.includes(s) && !brand.includes(s)) return false;
      }
      return true;
    });
  }, [conversions, businessFilter, search]);

  const stats = useMemo(() => {
    const rows = conversions || [];
    const total = rows.length;
    const totalCommission = rows.reduce((s: number, r: any) => s + Number(r.commission_amount || 0), 0);
    const totalOrderValue = rows.reduce((s: number, r: any) => s + Number(r.order_value || 0), 0);

    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const monthMap = new Map<string, { count: number; name: string }>();
    rows.forEach((r: any) => {
      if (!r.converted_at || new Date(r.converted_at) < start) return;
      const key = r.clipper_id;
      const prev = monthMap.get(key);
      monthMap.set(key, {
        count: (prev?.count || 0) + 1,
        name: r.clipper_accounts?.full_name || "—",
      });
    });
    let top: { name: string; count: number } | null = null;
    monthMap.forEach((v) => {
      if (!top || v.count > top.count) top = { name: v.name, count: v.count };
    });

    return { total, totalCommission, totalOrderValue, topConverter: top };
  }, [conversions]);

  const topClippers = useMemo(() => {
    const map = new Map<string, { name: string; conversions: number; commission: number }>();
    (conversions || []).forEach((r: any) => {
      const key = r.clipper_id;
      const prev = map.get(key);
      map.set(key, {
        name: r.clipper_accounts?.full_name || "—",
        conversions: (prev?.conversions || 0) + 1,
        commission: (prev?.commission || 0) + Number(r.commission_amount || 0),
      });
    });
    return Array.from(map.values()).sort((a, b) => b.commission - a.commission).slice(0, 10);
  }, [conversions]);

  const exportCSV = () => {
    const headers = ["date", "clipper", "brand", "order_value", "commission", "tracking_link"];
    const rows = filtered.map((c: any) => [
      c.converted_at ? new Date(c.converted_at).toISOString() : "",
      c.clipper_accounts?.full_name || "",
      c.clipper_campaigns?.brand_name || "",
      Number(c.order_value || 0).toFixed(2),
      Number(c.commission_amount || 0).toFixed(2),
      c.tracking_link || "",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clipper_conversions_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: GOLD }}>💰 Conversions</h1>
          <p className="text-sm text-muted-foreground">Tracking-link conversions and clipper commissions.</p>
        </div>
        <Button onClick={exportCSV} variant="outline" size="sm" disabled={!filtered.length}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 text-sm text-red-300">Error loading conversions: {(error as Error).message}</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Total Conversions" loading={isLoading}
          value={stats.total.toString()} />
        <StatCard icon={<DollarSign className="h-4 w-4" />} label="Total Commission" loading={isLoading}
          value={fmtMoney(stats.totalCommission)} />
        <StatCard icon={<Users className="h-4 w-4" />} label="Total Order Value" loading={isLoading}
          value={fmtMoney(stats.totalOrderValue)} />
        <StatCard icon={<Crown className="h-4 w-4" />} label="Top Converter This Month" loading={isLoading}
          value={stats.topConverter?.name || "—"}
          sub={stats.topConverter ? `${stats.topConverter.count} conversions` : "No conversions yet"} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search clipper or brand..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={businessFilter} onValueChange={setBusinessFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Business" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All businesses</SelectItem>
            <SelectItem value="gasmask">GasMask</SelectItem>
            <SelectItem value="brandaro">Brandaro</SelectItem>
            <SelectItem value="toptier">TopTier</SelectItem>
            <SelectItem value="uft">Unforgettable Times</SelectItem>
            <SelectItem value="playboxxx">Playboxxx</SelectItem>
            <SelectItem value="iclean">iClean WeClean</SelectItem>
            <SelectItem value="dynasty_connect">Dynasty Connect</SelectItem>
            <SelectItem value="uben">UBEN</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base" style={{ color: GOLD }}>Conversions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground py-12 text-center max-w-md mx-auto">
              No conversions yet. Conversions are recorded when viewers click tracking links and complete a purchase.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-xs text-muted-foreground uppercase">
                    <th className="text-left py-2 px-2">Date</th>
                    <th className="text-left py-2 px-2">Clipper</th>
                    <th className="text-left py-2 px-2">Brand</th>
                    <th className="text-left py-2 px-2">Business</th>
                    <th className="text-right py-2 px-2">Order Value</th>
                    <th className="text-right py-2 px-2">Commission</th>
                    <th className="text-left py-2 px-2">Tracking</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c: any) => {
                    const biz = c.clipper_campaigns?.dynasty_business;
                    return (
                      <tr key={c.id} className="border-b border-border/30 hover:bg-muted/20">
                        <td className="py-2 px-2 whitespace-nowrap">{fmtDate(c.converted_at)}</td>
                        <td className="py-2 px-2">{c.clipper_accounts?.full_name || "—"}</td>
                        <td className="py-2 px-2">{c.clipper_campaigns?.brand_name || "—"}</td>
                        <td className="py-2 px-2">
                          {biz && (
                            <Badge variant="outline" className={cn("text-xs", BUSINESS_BADGE[biz] || "")}>
                              {BUSINESS_LABEL[biz] || biz}
                            </Badge>
                          )}
                        </td>
                        <td className="text-right py-2 px-2 tabular-nums">{fmtMoney(Number(c.order_value || 0))}</td>
                        <td className="text-right py-2 px-2 tabular-nums" style={{ color: GOLD }}>{fmtMoney(Number(c.commission_amount || 0))}</td>
                        <td className="py-2 px-2">
                          {c.tracking_link ? (
                            <a href={c.tracking_link} target="_blank" rel="noopener noreferrer"
                               className="inline-flex items-center gap-1 text-xs text-blue-300 hover:underline">
                              Link <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base" style={{ color: GOLD }}>Top Converting Clippers</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : topClippers.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">No converting clippers yet.</div>
          ) : (
            <div className="space-y-2">
              {topClippers.map((c, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 rounded border border-border/40 hover:bg-muted/20">
                  <div className="text-xs font-bold w-6 text-center" style={{ color: GOLD }}>{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.conversions} conversions</div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums" style={{ color: GOLD }}>{fmtMoney(c.commission)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, sub, loading }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        {loading ? (
          <>
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-20" />
          </>
        ) : (
          <>
            <div className="text-xl font-bold truncate" style={{ color: GOLD }}>{value}</div>
            {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
