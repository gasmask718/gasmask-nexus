import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const GOLD = "#C9A84C";

const fmtViews = (n: number) =>
  !n ? "0" : n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M" : n >= 1_000 ? (n / 1_000).toFixed(1) + "K" : n.toString();
const fmtMoney = (n: number) =>
  "$" + (n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const ALL_PLATFORMS = ["tiktok", "instagram", "youtube", "twitter"] as const;
type Platform = typeof ALL_PLATFORMS[number];

const PLATFORM_STYLES: Record<Platform, { border: string; label: string; accent: string }> = {
  tiktok:    { border: "border-pink-500/30 bg-pink-500/5",     label: "TikTok",    accent: "text-pink-300" },
  instagram: { border: "border-purple-500/30 bg-purple-500/5", label: "Instagram", accent: "text-purple-300" },
  youtube:   { border: "border-red-500/30 bg-red-500/5",       label: "YouTube",   accent: "text-red-300" },
  twitter:   { border: "border-blue-500/30 bg-blue-500/5",     label: "Twitter",   accent: "text-blue-300" },
};

const BUSINESS_BADGE: Record<string, string> = {
  gasmask:  "bg-orange-500/15 text-orange-300 border-orange-500/30",
  brandaro: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  toptier:  "bg-purple-500/15 text-purple-300 border-purple-500/30",
  uben:     "bg-green-500/15 text-green-300 border-green-500/30",
  solar:    "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
};

export default function ClipperAnalytics() {
  const { data: submissions, isLoading: sLoad, error: sErr } = useQuery({
    queryKey: ["clipper-analytics-submissions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("clipper_submissions")
        .select(`
          id, platform, views, likes, status, submitted_at, base_earnings,
          clipper_id, campaign_id,
          clipper_accounts!clipper_id(full_name),
          clipper_campaigns!campaign_id(brand_name, dynasty_business)
        `)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: activeClippers, isLoading: cLoad } = useQuery({
    queryKey: ["clipper-analytics-clippers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("clipper_accounts")
        .select("id, full_name, tier, status, total_views, total_earnings")
        .eq("status", "active")
        .order("total_views", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: campaigns, isLoading: campLoad } = useQuery({
    queryKey: ["clipper-analytics-campaigns"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("clipper_campaigns")
        .select("id, brand_name, dynasty_business, status");
      if (error) throw error;
      return data || [];
    },
  });

  // Platform breakdown — client-side grouping (always show 4 cards)
  const platformStats = useMemo(() => {
    return ALL_PLATFORMS.map((p) => {
      const rows = (submissions || []).filter((s: any) => s.platform === p);
      return {
        platform: p,
        clips: rows.length,
        total_views: rows.reduce((s: number, r: any) => s + (r.views || 0), 0),
        total_likes: rows.reduce((s: number, r: any) => s + (r.likes || 0), 0),
        avg_views: rows.length
          ? Math.round(rows.reduce((s: number, r: any) => s + (r.views || 0), 0) / rows.length)
          : 0,
      };
    });
  }, [submissions]);

  // Campaign performance table
  const campaignPerformance = useMemo(() => {
    return (campaigns || []).map((c: any) => {
      const rows = (submissions || []).filter((s: any) => s.campaign_id === c.id);
      const approved = rows.filter((r: any) => r.status === "approved");
      return {
        id: c.id,
        brand_name: c.brand_name,
        dynasty_business: c.dynasty_business,
        clips: rows.length,
        approved_clips: approved.length,
        total_views: rows.reduce((s: number, r: any) => s + (r.views || 0), 0),
        total_earnings: approved.reduce((s: number, r: any) => s + Number(r.base_earnings || 0), 0),
      };
    }).sort((a, b) => b.total_views - a.total_views);
  }, [campaigns, submissions]);

  // Top 10 clips by views
  const topClips = useMemo(() => {
    return [...(submissions || [])]
      .sort((a: any, b: any) => (b.views || 0) - (a.views || 0))
      .slice(0, 10);
  }, [submissions]);

  // Clips this month per clipper
  const clipsThisMonth = useMemo(() => {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const map = new Map<string, number>();
    (submissions || []).forEach((s: any) => {
      if (!s.submitted_at) return;
      if (new Date(s.submitted_at) < start) return;
      map.set(s.clipper_id, (map.get(s.clipper_id) || 0) + 1);
    });
    return map;
  }, [submissions]);

  const topClippers = useMemo(() => {
    return [...(activeClippers || [])]
      .sort((a: any, b: any) => Number(b.total_views || 0) - Number(a.total_views || 0))
      .slice(0, 10);
  }, [activeClippers]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: GOLD }}>📊 Analytics</h1>
        <p className="text-sm text-muted-foreground">Platform breakdown, campaign performance, and top performers.</p>
      </div>

      {sErr && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 text-sm text-red-300">Error loading submissions: {(sErr as Error).message}</CardContent>
        </Card>
      )}

      {/* Platform breakdown */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Platform Breakdown</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {platformStats.map((p) => {
            const style = PLATFORM_STYLES[p.platform];
            return (
              <Card key={p.platform} className={cn("border", style.border)}>
                <CardHeader className="pb-2">
                  <CardTitle className={cn("text-sm font-semibold", style.accent)}>{style.label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {sLoad ? (
                    <>
                      <Skeleton className="h-8 w-20" />
                      <Skeleton className="h-4 w-32" />
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold" style={{ color: GOLD }}>{p.clips}</div>
                      <div className="text-xs text-muted-foreground">clips</div>
                      <div className="pt-2 space-y-1 text-xs">
                        <div className="flex justify-between"><span className="text-muted-foreground">Total views</span><span className="font-medium">{fmtViews(p.total_views)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Total likes</span><span className="font-medium">{fmtViews(p.total_likes)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Avg views</span><span className="font-medium">{fmtViews(p.avg_views)}</span></div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Campaign performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base" style={{ color: GOLD }}>Campaign Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {campLoad || sLoad ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : campaignPerformance.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">No campaigns yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-xs text-muted-foreground uppercase">
                    <th className="text-left py-2 px-2">Brand</th>
                    <th className="text-left py-2 px-2">Business</th>
                    <th className="text-right py-2 px-2">Clips</th>
                    <th className="text-right py-2 px-2">Approved</th>
                    <th className="text-right py-2 px-2">Total Views</th>
                    <th className="text-right py-2 px-2">Earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignPerformance.map((c) => (
                    <tr key={c.id} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="py-2 px-2 font-medium">{c.brand_name}</td>
                      <td className="py-2 px-2">
                        {c.dynasty_business && (
                          <Badge variant="outline" className={cn("text-xs capitalize", BUSINESS_BADGE[c.dynasty_business] || "")}>
                            {c.dynasty_business}
                          </Badge>
                        )}
                      </td>
                      <td className="text-right py-2 px-2">{c.clips}</td>
                      <td className="text-right py-2 px-2">{c.approved_clips}</td>
                      <td className="text-right py-2 px-2">{fmtViews(c.total_views)}</td>
                      <td className="text-right py-2 px-2" style={{ color: GOLD }}>{fmtMoney(c.total_earnings)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 clips */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base" style={{ color: GOLD }}>Top 10 Clips by Views</CardTitle>
          </CardHeader>
          <CardContent>
            {sLoad ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : topClips.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">No clips yet.</div>
            ) : (
              <div className="space-y-2">
                {topClips.map((c: any, idx: number) => (
                  <div key={c.id} className="flex items-center gap-3 p-2 rounded border border-border/40 hover:bg-muted/20">
                    <div className="text-xs font-bold w-6 text-center" style={{ color: GOLD }}>{idx + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{c.clipper_accounts?.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.clipper_campaigns?.brand_name || "—"} · {c.platform}</div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums">{fmtViews(c.views || 0)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top clippers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base" style={{ color: GOLD }}>Top Clippers</CardTitle>
          </CardHeader>
          <CardContent>
            {cLoad ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : topClippers.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">No active clippers yet.</div>
            ) : (
              <div className="space-y-2">
                {topClippers.map((c: any, idx: number) => (
                  <div key={c.id} className="flex items-center gap-3 p-2 rounded border border-border/40 hover:bg-muted/20">
                    <div className="text-xs font-bold w-6 text-center" style={{ color: GOLD }}>{idx + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{c.full_name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{c.tier || "standard"} · {clipsThisMonth.get(c.id) || 0} clips this month</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold tabular-nums">{fmtViews(Number(c.total_views || 0))}</div>
                      <div className="text-xs" style={{ color: GOLD }}>{fmtMoney(Number(c.total_earnings || 0))}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
