import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, AlertTriangle, CheckCircle2, BarChart3 } from "lucide-react";

export default function LeadQualificationPage() {
  const { data: qualified } = useQuery({
    queryKey: ["brandaro-qualification-overview"],
    queryFn: async () => {
      const { data } = await supabase
        .from("brandaro_qualified_leads")
        .select("priority_tier, priority_score, lead_status, industry, city, state");
      return data || [];
    },
  });

  const total = qualified?.length || 0;
  const tier1 = qualified?.filter(l => l.priority_tier === "tier_1") || [];
  const tier2 = qualified?.filter(l => l.priority_tier === "tier_2") || [];
  const tier3 = qualified?.filter(l => l.priority_tier === "tier_3") || [];
  const avgScore = total > 0 ? Math.round(qualified!.reduce((s, l) => s + (l.priority_score || 0), 0) / total) : 0;

  // Industry breakdown
  const industries = qualified?.reduce((acc, l) => {
    const ind = l.industry || "Unknown";
    acc[ind] = (acc[ind] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};
  const topIndustries = Object.entries(industries).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // City breakdown
  const cities = qualified?.reduce((acc, l) => {
    const city = l.city || "Unknown";
    acc[city] = (acc[city] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};
  const topCities = Object.entries(cities).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Actionable pipeline
  const actionable = qualified?.filter(l => ["new", "queued"].includes(l.lead_status || "")).length || 0;
  const inProgress = qualified?.filter(l => ["calling", "callback", "send_info"].includes(l.lead_status || "")).length || 0;
  const converted = qualified?.filter(l => ["interested", "hot_lead", "sold"].includes(l.lead_status || "")).length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Target className="h-6 w-6 text-cyan-500" />
          Lead Qualification Engine
        </h1>
        <p className="text-muted-foreground">Scoring, tiering, and funnel analysis</p>
      </div>

      {/* Tier Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Qualified</p>
            <p className="text-3xl font-bold">{total}</p>
            <p className="text-xs text-muted-foreground mt-1">Avg Score: {avgScore}/100</p>
          </CardContent>
        </Card>
        <Card className="border-red-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <p className="text-sm text-red-500 font-medium">Tier 1 — Call Now</p>
            </div>
            <p className="text-3xl font-bold text-red-500">{tier1.length}</p>
            <Progress value={total > 0 ? (tier1.length / total) * 100 : 0} className="mt-2 h-1" />
          </CardContent>
        </Card>
        <Card className="border-amber-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-500" />
              <p className="text-sm text-amber-500 font-medium">Tier 2 — Medium</p>
            </div>
            <p className="text-3xl font-bold text-amber-500">{tier2.length}</p>
            <Progress value={total > 0 ? (tier2.length / total) * 100 : 0} className="mt-2 h-1" />
          </CardContent>
        </Card>
        <Card className="border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-500" />
              <p className="text-sm text-blue-500 font-medium">Tier 3 — Low</p>
            </div>
            <p className="text-3xl font-bold text-blue-500">{tier3.length}</p>
            <Progress value={total > 0 ? (tier3.length / total) * 100 : 0} className="mt-2 h-1" />
          </CardContent>
        </Card>
      </div>

      {/* Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Pipeline Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Actionable (New + Queued)</span>
                <span className="font-medium">{actionable}</span>
              </div>
              <Progress value={total > 0 ? (actionable / total) * 100 : 0} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>In Progress (Calling + Callback)</span>
                <span className="font-medium">{inProgress}</span>
              </div>
              <Progress value={total > 0 ? (inProgress / total) * 100 : 0} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Converted (Interested + Hot + Sold)</span>
                <span className="font-medium text-emerald-500">{converted}</span>
              </div>
              <Progress value={total > 0 ? (converted / total) * 100 : 0} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Industries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topIndustries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet</p>
              ) : topIndustries.map(([ind, count]) => (
                <div key={ind} className="flex justify-between text-sm">
                  <span className="truncate max-w-[200px]">{ind}</span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Cities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topCities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet</p>
              ) : topCities.map(([city, count]) => (
                <div key={city} className="flex justify-between text-sm">
                  <span>{city}</span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scoring Criteria */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scoring Criteria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="font-medium">Phone Valid</p>
              <p className="text-muted-foreground">+30 points</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="font-medium">Rating ≥ 4.0</p>
              <p className="text-muted-foreground">+20 points</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="font-medium">10+ Reviews</p>
              <p className="text-muted-foreground">+15 points</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="font-medium">50+ Reviews</p>
              <p className="text-muted-foreground">+10 points</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="font-medium">Industry Detected</p>
              <p className="text-muted-foreground">+10 points</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="font-medium">City Known</p>
              <p className="text-muted-foreground">+5 points</p>
            </div>
          </div>
          <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
            <span>🔴 Tier 1: Score ≥ 60</span>
            <span>🟡 Tier 2: Score 35-59</span>
            <span>🔵 Tier 3: Score &lt; 35</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
