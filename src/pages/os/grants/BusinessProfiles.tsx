import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Loader2, PlayCircle, Pencil, RefreshCw, Trophy } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const GOLD = "#C9A84C";

type Profile = {
  id: string;
  business_name: string;
  entity_type: string | null;
  completeness_pct: number | null;
  completeness_missing: string[] | null;
  eligible_grant_count: number;
  last_eligibility_check_at: string | null;
  is_active: boolean;
};

type CountMap = Record<string, number>;

function completenessColor(pct: number) {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function completenessBadgeStyle(pct: number) {
  if (pct >= 80) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (pct >= 50) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-red-500/15 text-red-400 border-red-500/30";
}

export default function BusinessProfiles() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [partialCounts, setPartialCounts] = useState<CountMap>({});
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const [runningAll, setRunningAll] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: prof, error: pErr }, { data: elig, error: eErr }] = await Promise.all([
      supabase
        .from("grant_business_profiles")
        .select("id, business_name, entity_type, completeness_pct, completeness_missing, eligible_grant_count, last_eligibility_check_at, is_active")
        .order("business_name", { ascending: true }),
      supabase
        .from("grant_eligibility_results")
        .select("business_profile_id, status"),
    ]);
    if (pErr) toast.error(`Load profiles: ${pErr.message}`);
    if (eErr) toast.error(`Load eligibility: ${eErr.message}`);

    const partial: CountMap = {};
    (elig ?? []).forEach((r: any) => {
      if (r.status === "partially_eligible" && r.business_profile_id) {
        partial[r.business_profile_id] = (partial[r.business_profile_id] ?? 0) + 1;
      }
    });
    setPartialCounts(partial);
    setProfiles((prof ?? []) as Profile[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function runCheck(business_profile_id: string) {
    setRunningIds((s) => new Set(s).add(business_profile_id));
    try {
      const { data, error } = await supabase.functions.invoke("grant-eligibility-checker", {
        body: { business_profile_id },
      });
      if (error) throw error;
      toast.success(
        `Checked ${data?.results_summary?.eligible ?? 0} eligible / ${data?.pairs_evaluated ?? 0} evaluated`
      );
      await load();
    } catch (e: any) {
      toast.error(`Check failed: ${e.message ?? e}`);
    } finally {
      setRunningIds((s) => {
        const n = new Set(s);
        n.delete(business_profile_id);
        return n;
      });
    }
  }

  async function runAll() {
    setRunningAll(true);
    try {
      const { data, error } = await supabase.functions.invoke("grant-eligibility-checker", {
        body: {},
      });
      if (error) throw error;
      toast.success(
        `Full sweep: ${data?.businesses_checked ?? 0} businesses × ${data?.opportunities_checked ?? 0} opportunities → ${data?.results_summary?.eligible ?? 0} eligible`
      );
      await load();
    } catch (e: any) {
      toast.error(`Sweep failed: ${e.message ?? e}`);
    } finally {
      setRunningAll(false);
    }
  }

  const totalEligible = useMemo(
    () => profiles.reduce((s, p) => s + (p.eligible_grant_count ?? 0), 0),
    [profiles]
  );

  const lastChecked = useMemo(() => {
    const times = profiles
      .map((p) => p.last_eligibility_check_at)
      .filter(Boolean)
      .map((t) => new Date(t as string).getTime());
    if (!times.length) return null;
    return new Date(Math.max(...times));
  }, [profiles]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Building2 className="h-6 w-6" style={{ color: GOLD }} />
            Business Profiles
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Dynasty business profiles &mdash; eligibility, completeness, and grant fit.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Total eligible opportunities</div>
            <div className="text-2xl font-semibold" style={{ color: GOLD }}>
              {totalEligible}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Last checked</div>
            <div className="text-sm">
              {lastChecked ? formatDistanceToNow(lastChecked, { addSuffix: true }) : "never"}
            </div>
          </div>
          <Button onClick={runAll} disabled={runningAll || loading}>
            {runningAll ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" /> Run All Checks
              </>
            )}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No business profiles found.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map((p) => {
            const pct = Math.round(p.completeness_pct ?? 0);
            const missing = (p.completeness_missing ?? []).slice(0, 3);
            const isRunning = runningIds.has(p.id);
            const partial = partialCounts[p.id] ?? 0;
            return (
              <Card key={p.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight">{p.business_name}</CardTitle>
                    {p.entity_type && (
                      <Badge variant="outline" className="shrink-0">
                        {p.entity_type}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 flex-1">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-muted-foreground">Completeness</span>
                      <Badge variant="outline" className={completenessBadgeStyle(pct)}>
                        {pct}%
                      </Badge>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${completenessColor(pct)} transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {missing.length > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1.5">Missing critical</div>
                      <div className="flex flex-wrap gap-1">
                        {missing.map((m) => (
                          <Badge key={m} variant="secondary" className="text-[10px] font-normal">
                            {m}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 mt-auto">
                    <Badge
                      variant="outline"
                      className="border-[color:var(--gold,#C9A84C)]/40"
                      style={{ color: GOLD, borderColor: `${GOLD}66` }}
                    >
                      <Trophy className="h-3 w-3 mr-1" />
                      {p.eligible_grant_count ?? 0} eligible
                    </Badge>
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                      {partial} partial
                    </Badge>
                  </div>

                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => navigate(`/os/grants/businesses/${p.id}`)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Profile
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => runCheck(p.id)}
                      disabled={isRunning}
                    >
                      {isRunning ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Checking
                        </>
                      ) : (
                        <>
                          <PlayCircle className="h-3.5 w-3.5 mr-1.5" /> Run Check
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
