import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserCheck, Video, Eye, DollarSign, Clock, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const GOLD = "#C9A84C";

const fmtViews = (n: number) =>
  !n ? "0" : n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M" : n >= 1_000 ? (n / 1_000).toFixed(1) + "K" : n.toString();
const fmtMoney = (n: number) =>
  "$" + (n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const PLATFORM_BADGE: Record<string, string> = {
  tiktok: "bg-pink-500/15 text-pink-300 border-pink-500/30",
  instagram: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  youtube: "bg-red-500/15 text-red-300 border-red-500/30",
  twitter: "bg-blue-500/15 text-blue-300 border-blue-500/30",
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  approved: "bg-green-500/15 text-green-300 border-green-500/30",
  rejected: "bg-red-500/15 text-red-300 border-red-500/30",
  flagged: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  active: "bg-green-500/15 text-green-300 border-green-500/30",
  suspended: "bg-red-500/15 text-red-300 border-red-500/30",
  inactive: "bg-gray-500/15 text-gray-300 border-gray-500/30",
};

const PLATFORMS = ["tiktok", "instagram", "youtube", "twitter"] as const;

function StatCard({
  label,
  value,
  icon: Icon,
  loading,
  accent,
}: {
  label: string;
  value: string | number;
  icon: any;
  loading: boolean;
  accent?: "blue" | "green" | "gold";
}) {
  const accentCls =
    accent === "blue"
      ? "border-blue-500/30 bg-blue-500/5"
      : accent === "green"
      ? "border-green-500/30 bg-green-500/5"
      : accent === "gold"
      ? "border-[#C9A84C]/30 bg-[#C9A84C]/5"
      : "";
  return (
    <Card className={cn(accentCls)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        {loading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold text-foreground">{value}</div>}
      </CardContent>
    </Card>
  );
}

export default function ClipperDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["clipper-dash-stats"],
    queryFn: async () => {
      const [totalClippers, activeClippers, totalSubs, views, paid, pending] = await Promise.all([
        supabase.from("clipper_accounts").select("id", { count: "exact", head: true }),
        supabase.from("clipper_accounts").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("clipper_submissions").select("id", { count: "exact", head: true }),
        supabase.from("clipper_submissions").select("views").eq("status", "approved"),
        supabase.from("clipper_payouts").select("amount").eq("status", "paid"),
        supabase.from("clipper_earnings").select("amount").eq("status", "pending"),
      ]);

      if (totalClippers.error) throw totalClippers.error;
      if (activeClippers.error) throw activeClippers.error;
      if (totalSubs.error) throw totalSubs.error;
      if (views.error) throw views.error;
      if (paid.error) throw paid.error;
      if (pending.error) throw pending.error;

      return {
        totalClippers: totalClippers.count ?? 0,
        activeClippers: activeClippers.count ?? 0,
        totalSubs: totalSubs.count ?? 0,
        totalViews: (views.data ?? []).reduce((s, r: any) => s + Number(r.views || 0), 0),
        totalPaid: (paid.data ?? []).reduce((s, r: any) => s + Number(r.amount || 0), 0),
        pendingEarnings: (pending.data ?? []).reduce((s, r: any) => s + Number(r.amount || 0), 0),
      };
    },
  });

  const { data: platformRows, isLoading: platformLoading } = useQuery({
    queryKey: ["clipper-dash-platforms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clipper_submissions")
        .select("platform, views")
        .eq("status", "approved");
      if (error) throw error;
      const map = new Map<string, { clips: number; views: number }>();
      for (const p of PLATFORMS) map.set(p, { clips: 0, views: 0 });
      for (const r of data ?? []) {
        const key = (r as any).platform;
        const cur = map.get(key) ?? { clips: 0, views: 0 };
        cur.clips += 1;
        cur.views += Number((r as any).views || 0);
        map.set(key, cur);
      }
      return PLATFORMS.map((p) => ({ platform: p, ...(map.get(p) ?? { clips: 0, views: 0 }) }));
    },
  });

  const { data: leaders, isLoading: leadersLoading } = useQuery({
    queryKey: ["clipper-dash-leaders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clipper_accounts")
        .select("full_name, total_views, total_earnings, tier, status")
        .eq("status", "active")
        .order("total_views", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: recent, isLoading: recentLoading } = useQuery({
    queryKey: ["clipper-dash-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clipper_submissions")
        .select(
          "post_url, platform, views, status, submitted_at, clipper_accounts!clipper_id(full_name), clipper_campaigns!campaign_id(brand_name)"
        )
        .order("submitted_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: GOLD }}>
          🎬 Clipper Nation
        </h1>
        <p className="text-sm text-muted-foreground">Dashboard overview across all campaigns and clippers.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <StatCard label="Total Clippers" value={stats?.totalClippers ?? 0} icon={Users} loading={statsLoading} />
        <StatCard label="Active Clippers" value={stats?.activeClippers ?? 0} icon={UserCheck} loading={statsLoading} />
        <StatCard label="Submissions" value={stats?.totalSubs ?? 0} icon={Video} loading={statsLoading} />
        <StatCard label="Total Views" value={fmtViews(stats?.totalViews ?? 0)} icon={Eye} loading={statsLoading} accent="blue" />
        <StatCard label="Total Paid Out" value={fmtMoney(stats?.totalPaid ?? 0)} icon={DollarSign} loading={statsLoading} accent="green" />
        <StatCard label="Pending Earnings" value={fmtMoney(stats?.pendingEarnings ?? 0)} icon={Clock} loading={statsLoading} accent="gold" />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Platform Breakdown</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {platformLoading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
            : (platformRows ?? []).map((p) => (
                <Card key={p.platform}>
                  <CardContent className="p-4">
                    <Badge variant="outline" className={cn("capitalize mb-2", PLATFORM_BADGE[p.platform])}>
                      {p.platform}
                    </Badge>
                    <div className="text-xl font-bold text-foreground">{fmtViews(p.views)}</div>
                    <div className="text-xs text-muted-foreground">{p.clips} approved clips</div>
                  </CardContent>
                </Card>
              ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base" style={{ color: GOLD }}>
            Top 5 Clippers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {leadersLoading ? (
            <Skeleton className="h-40" />
          ) : !leaders || leaders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active clippers yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left py-2 pr-3">#</th>
                    <th className="text-left py-2 pr-3">Name</th>
                    <th className="text-left py-2 pr-3">Tier</th>
                    <th className="text-right py-2 pr-3">Views</th>
                    <th className="text-right py-2">Earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {leaders.map((c: any, i: number) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                      <td className="py-2 pr-3 font-medium">{c.full_name || "—"}</td>
                      <td className="py-2 pr-3">
                        <Badge variant="outline" className="capitalize">
                          {c.tier || "—"}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-right">{fmtViews(Number(c.total_views || 0))}</td>
                      <td className="py-2 text-right" style={{ color: GOLD }}>
                        {fmtMoney(Number(c.total_earnings || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base" style={{ color: GOLD }}>
            Recent Submissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentLoading ? (
            <Skeleton className="h-40" />
          ) : !recent || recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No submissions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left py-2 pr-3">Clipper</th>
                    <th className="text-left py-2 pr-3">Brand</th>
                    <th className="text-left py-2 pr-3">Platform</th>
                    <th className="text-left py-2 pr-3">Post</th>
                    <th className="text-right py-2 pr-3">Views</th>
                    <th className="text-left py-2 pr-3">Status</th>
                    <th className="text-left py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r: any, i: number) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 pr-3">{r.clipper_accounts?.full_name || "—"}</td>
                      <td className="py-2 pr-3">{r.clipper_campaigns?.brand_name || "—"}</td>
                      <td className="py-2 pr-3">
                        <Badge variant="outline" className={cn("capitalize", PLATFORM_BADGE[r.platform])}>
                          {r.platform}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3">
                        {r.post_url ? (
                          <a
                            href={r.post_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-400 hover:underline"
                          >
                            View <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right">{fmtViews(Number(r.views || 0))}</td>
                      <td className="py-2 pr-3">
                        <Badge variant="outline" className={cn("capitalize", STATUS_BADGE[r.status])}>
                          {r.status}
                        </Badge>
                      </td>
                      <td className="py-2 text-muted-foreground">{fmtDate(r.submitted_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
