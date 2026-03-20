import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, ShieldAlert, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function ScoutLiveMonitor() {
  const [showDecisions, setShowDecisions] = useState(false);

  const { data: activeRun } = useQuery({
    queryKey: ["scout-active-run"],
    queryFn: async () => {
      const { data } = await supabase
        .from("brandaro_scout_runs" as any)
        .select("*")
        .eq("status", "running")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
    refetchInterval: 3000,
  });

  const { data: lastRun } = useQuery({
    queryKey: ["scout-last-run"],
    queryFn: async () => {
      const { data } = await supabase
        .from("brandaro_scout_runs" as any)
        .select("*")
        .in("status", ["completed", "failed", "stopped_budget"])
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
    refetchInterval: 10000,
  });

  if (activeRun) {
    const startedAt = new Date(activeRun.started_at);
    const minutesAgo = Math.round((Date.now() - startedAt.getTime()) / 60000);

    return (
      <Card className="border-amber-500/50 bg-amber-500/5">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
            <div className="flex-1">
              <p className="font-semibold text-sm text-amber-600">🔄 SCOUT RUNNING RIGHT NOW</p>
              <p className="text-xs text-muted-foreground">
                Started: {startedAt.toLocaleTimeString()} — {minutesAgo} minute{minutesAgo !== 1 ? "s" : ""} ago
              </p>
              <div className="mt-2 h-1.5 bg-amber-200/30 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full animate-pulse" style={{ width: "60%" }} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Searches: {activeRun.searches_completed || "checking..."} · Leads: {activeRun.total_imported || "checking..."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!lastRun) return null;

  const completedAt = lastRun.completed_at ? new Date(lastRun.completed_at) : null;
  const startedAt = new Date(lastRun.started_at);
  const durationMin = completedAt ? Math.round((completedAt.getTime() - startedAt.getTime()) / 60000) : 0;
  const timeAgo = completedAt ? formatTimeAgo(completedAt) : "unknown";
  const decisions = (lastRun.decisions as any[]) || [];

  const statusIcon = lastRun.status === "completed"
    ? <CheckCircle2 className="h-5 w-5 text-green-500" />
    : lastRun.status === "stopped_budget"
    ? <ShieldAlert className="h-5 w-5 text-amber-500" />
    : <XCircle className="h-5 w-5 text-destructive" />;

  const statusColor = lastRun.status === "completed"
    ? "border-green-500/30 bg-green-500/5"
    : lastRun.status === "stopped_budget"
    ? "border-amber-500/30 bg-amber-500/5"
    : "border-destructive/30 bg-destructive/5";

  return (
    <Card className={cn("transition-all", statusColor)}>
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          {statusIcon}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm">
                {lastRun.status === "completed" ? "✅" : lastRun.status === "stopped_budget" ? "💰" : "❌"} LAST RUN {lastRun.status.toUpperCase()} — {timeAgo}
              </p>
              <Badge variant="outline" className="text-[10px]">{lastRun.status}</Badge>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-muted-foreground">
              <span>Duration: {durationMin}m</span>
              <span>Searches: <span className="text-foreground font-medium">{lastRun.searches_completed}/{lastRun.searches_attempted}</span></span>
              <span>Leads: <span className="text-green-600 font-medium">{lastRun.total_imported}</span></span>
              <span>Cost: <span className="text-foreground font-medium">${Number(lastRun.estimated_cost || 0).toFixed(4)}</span></span>
            </div>

            {decisions.length > 0 && (
              <div className="mt-2">
                <button
                  onClick={() => setShowDecisions(!showDecisions)}
                  className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  {showDecisions ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {decisions.length} decisions made
                </button>
                {showDecisions && (
                  <div className="mt-1.5 space-y-0.5 max-h-[200px] overflow-auto">
                    {decisions.map((d: any, i: number) => (
                      <p key={i} className="text-[11px] text-muted-foreground">
                        {d.status === "completed" ? "✅" : d.status?.includes("budget") ? "💰" : d.status === "skipped_duplicate" ? "⏭️" : "❌"}{" "}
                        {d.industry} in {d.city} {d.state} —{" "}
                        <span className={d.imported > 0 ? "text-green-600 font-medium" : ""}>{d.imported || 0} leads</span>
                        {d.reason && <span className="opacity-60"> · {d.reason}</span>}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
