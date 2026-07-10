import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Grid3x3,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

type Business = {
  id: string;
  business_name: string;
  completeness_pct?: number | null;
};
type Opportunity = {
  id: string;
  title: string | null;
  grant_name: string;
  funder_name: string;
  amount_typical?: number | null;
  amount_max?: number | null;
  deadline?: string | null;
  description?: string | null;
};
type Result = {
  id: string;
  business_profile_id: string;
  grant_opportunity_id: string;
  eligibility_status: string;
  eligibility_score: number | null;
  ai_recommendation: string | null;
  ai_action_plan: string | null;
  ai_success_probability: number | null;
  application_status: string | null;
  requirements_met: any;
  requirements_missing: any;
  requirements_failed: any;
  last_checked_at?: string | null;
};


type StatusFilter = "all" | "eligible" | "partially_eligible" | "needs_review" | "not_eligible";

const CELL_STYLES: Record<string, string> = {
  eligible:
    "bg-amber-400/20 text-amber-600 dark:text-amber-300 border-amber-500/40 hover:bg-amber-400/30",
  partially_eligible:
    "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/25",
  needs_review:
    "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30 hover:bg-blue-500/25",
  not_eligible:
    "bg-muted text-muted-foreground border-border hover:bg-muted/70",
};

const CELL_ICON: Record<string, string> = {
  eligible: "🟢",
  partially_eligible: "🟡",
  needs_review: "🔵",
  not_eligible: "⬜",
};

const CELL_LABEL: Record<string, string> = {
  eligible: "ELIGIBLE",
  partially_eligible: "PARTIAL",
  needs_review: "REVIEW",
  not_eligible: "NOT ELIGIBLE",
};

function scoreBarColor(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function asArray(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

export default function EligibilityMatrix() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [businessFilter, setBusinessFilter] = useState<string>("all");
  const [openCell, setOpenCell] = useState<{ b: Business; o: Opportunity; r?: Result } | null>(
    null,
  );
  const [runningAll, setRunningAll] = useState(false);
  const [applying, setApplying] = useState(false);
  const [regenAi, setRegenAi] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: b }, { data: o }, { data: r }] = await Promise.all([
      supabase
        .from("grant_business_profiles")
        .select("id, business_name, completeness_pct")
        .order("business_name"),
      supabase
        .from("grant_opportunities")
        .select("id, title, grant_name, funder_name, amount_typical, amount_max, deadline, description")
        .eq("status", "open")
        .order("grant_name"),
      supabase
        .from("grant_eligibility_results")
        .select(
          "id, business_profile_id, grant_opportunity_id, eligibility_status, eligibility_score, ai_recommendation, ai_action_plan, ai_success_probability, application_status, requirements_met, requirements_missing, requirements_failed, last_checked_at",
        ),
    ]);
    setBusinesses((b as any) ?? []);
    setOpps((o as any) ?? []);
    const map: Record<string, Result> = {};
    ((r as any) ?? []).forEach((row: Result) => {
      map[`${row.business_profile_id}::${row.grant_opportunity_id}`] = row;
    });
    setResults(map);
    setLoading(false);
  };


  useEffect(() => {
    load();
  }, []);

  const visibleBusinesses = useMemo(
    () =>
      businessFilter === "all"
        ? businesses
        : businesses.filter((b) => b.id === businessFilter),
    [businesses, businessFilter],
  );

  const runAllChecks = async () => {
    setRunningAll(true);
    try {
      const { error } = await supabase.functions.invoke("grant-eligibility-checker", {
        body: {},
      });
      if (error) throw error;
      toast.success("All eligibility checks complete");
      await load();
    } catch (e: any) {
      toast.error(`Run failed: ${e.message || "unknown error"}`);
    } finally {
      setRunningAll(false);
    }
  };

  const approveAndApply = async (r: Result) => {
    if (applying) return;
    setApplying(true);
    try {
      const { data, error } = await supabase.functions.invoke("grant-auto-apply", {
        body: { eligibility_result_id: r.id },
      });
      if (error) throw error;
      const payload = (data ?? {}) as any;
      if (payload?.error) throw new Error(payload.error);
      const packageId = payload?.package_id;
      if (!packageId) throw new Error("No package returned");
      toast.success(payload?.reused ? "Existing package opened" : "Package ready!");
      await load();
      navigate(`/os/grants/apply/${packageId}`);
    } catch (e: any) {
      toast.error(`Auto-apply failed: ${e.message || "unknown error"}`);
    } finally {
      setApplying(false);
    }
  };

  const regenerateAi = async () => {
    if (!openCell) return;
    setRegenAi(true);
    try {
      const { error } = await supabase.functions.invoke("grant-eligibility-checker", {
        body: {
          business_profile_id: openCell.b.id,
          grant_opportunity_id: openCell.o.id,
        },
      });
      if (error) throw error;
      const { data: fresh } = await supabase
        .from("grant_eligibility_results")
        .select(
          "id, business_profile_id, grant_opportunity_id, eligibility_status, eligibility_score, ai_recommendation, ai_action_plan, ai_success_probability, application_status, requirements_met, requirements_missing, requirements_failed, last_checked_at",
        )
        .eq("business_profile_id", openCell.b.id)
        .eq("grant_opportunity_id", openCell.o.id)
        .maybeSingle();
      if (fresh) {
        const key = `${openCell.b.id}::${openCell.o.id}`;
        setResults((prev) => ({ ...prev, [key]: fresh as Result }));
        setOpenCell({ ...openCell, r: fresh as Result });
      }
      toast.success("AI recommendation refreshed");
    } catch (e: any) {
      toast.error(`Generation failed: ${e.message || "unknown error"}`);
    } finally {
      setRegenAi(false);
    }
  };


  const cellPassesFilter = (r: Result | undefined) => {
    if (statusFilter === "all") return true;
    return r?.eligibility_status === statusFilter;
  };

  const openTitle = (o: Opportunity) => o.title || o.grant_name || "Untitled Grant";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Grid3x3 className="h-6 w-6" /> Eligibility Matrix
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Every business × every open grant. Click a cell for AI recommendation and action plan.
          </p>
        </div>
        <Button onClick={runAllChecks} disabled={runningAll}>
          {runningAll ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Run All Checks
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="eligible">🟢 Eligible</SelectItem>
            <SelectItem value="partially_eligible">🟡 Partial</SelectItem>
            <SelectItem value="needs_review">🔵 Review</SelectItem>
            <SelectItem value="not_eligible">⬜ Not Eligible</SelectItem>
          </SelectContent>
        </Select>

        <Select value={businessFilter} onValueChange={setBusinessFilter}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="All businesses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All businesses</SelectItem>
            {businesses.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.business_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-xs text-muted-foreground">
          {visibleBusinesses.length} businesses × {opps.length} open grants
        </span>
      </div>

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/40">
                  <th className="sticky left-0 bg-muted/40 text-left p-3 border-b border-r border-border min-w-[200px] z-10">
                    Business
                  </th>
                  {opps.map((o) => (
                    <th
                      key={o.id}
                      className="p-3 border-b border-border text-left min-w-[160px] font-medium"
                    >
                      <div className="truncate max-w-[180px]" title={openTitle(o)}>
                        {openTitle(o)}
                      </div>
                      <div className="truncate max-w-[180px] text-muted-foreground font-normal text-[10px]">
                        {o.funder_name}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleBusinesses.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/20">
                    <td className="sticky left-0 bg-background p-3 border-b border-r border-border font-medium z-10">
                      {b.business_name}
                    </td>
                    {opps.map((o) => {
                      const r = results[`${b.id}::${o.id}`];
                      const passes = cellPassesFilter(r);
                      if (!passes) {
                        return (
                          <td key={o.id} className="p-2 border-b border-border">
                            <div className="text-muted-foreground/40 text-center">·</div>
                          </td>
                        );
                      }
                      if (!r) {
                        return (
                          <td
                            key={o.id}
                            className="p-2 border-b border-border cursor-pointer"
                            onClick={() => setOpenCell({ b, o })}
                          >
                            <div className="text-muted-foreground text-center text-lg">—</div>
                          </td>
                        );
                      }
                      return (
                        <td key={o.id} className="p-2 border-b border-border">
                          <button
                            onClick={() => setOpenCell({ b, o, r })}
                            className={`w-full rounded-md border px-2 py-1.5 text-left transition ${CELL_STYLES[r.eligibility_status] ?? ""}`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-semibold tracking-wide">
                                {CELL_ICON[r.eligibility_status]}{" "}
                                {CELL_LABEL[r.eligibility_status] ?? r.eligibility_status}
                              </span>
                              <span className="font-mono font-bold tabular-nums">
                                {r.eligibility_score ?? 0}
                              </span>
                            </div>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Sheet open={!!openCell} onOpenChange={(v) => !v && setOpenCell(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {openCell && (
            <>
              <SheetHeader className="pb-4 border-b">
                <SheetTitle className="text-lg leading-tight">
                  {openCell.b.business_name}{" "}
                  <span className="text-muted-foreground">×</span>{" "}
                  {openTitle(openCell.o)}
                </SheetTitle>
                <p className="text-xs text-muted-foreground">{openCell.o.funder_name}</p>
              </SheetHeader>

              {openCell.r ? (
                <div className="space-y-5 pt-5">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-muted-foreground">Eligibility Score</span>
                      <span className="font-mono font-semibold">
                        {openCell.r.eligibility_score ?? 0}/100
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full ${scoreBarColor(openCell.r.eligibility_score ?? 0)}`}
                        style={{ width: `${openCell.r.eligibility_score ?? 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Success Probability</div>
                      <div className="text-lg font-semibold">
                        {openCell.r.ai_success_probability ?? "—"}%
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {(openCell.r.application_status ?? "not_started").replace(/_/g, " ")}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-md border p-2">
                      <div className="text-muted-foreground">Business Readiness</div>
                      <div className="font-semibold text-sm mt-0.5">
                        {openCell.b.completeness_pct ?? 0}% complete
                      </div>
                    </div>
                    <div className="rounded-md border p-2">
                      <div className="text-muted-foreground">Funding Readiness</div>
                      <div className="font-semibold text-sm mt-0.5 capitalize">
                        {(openCell.r.eligibility_status ?? "unknown").replace(/_/g, " ")}
                      </div>
                    </div>
                  </div>

                  <div className="border-l-4 border-amber-400 bg-amber-400/5 pl-4 py-3 rounded-r">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                        <Sparkles className="h-3 w-3" /> AI Recommendation
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px]"
                        onClick={regenerateAi}
                        disabled={regenAi}
                      >
                        {regenAi ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1" />
                        )}
                        {openCell.r.ai_recommendation ? "Regenerate" : "Generate"}
                      </Button>
                    </div>
                    <p className="text-sm">
                      {openCell.r.ai_recommendation || (
                        <span className="text-muted-foreground italic">
                          No AI recommendation available.
                        </span>
                      )}
                    </p>
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Action Plan
                    </div>
                    {openCell.r.ai_action_plan ? (
                      <ol className="list-decimal list-inside space-y-1 text-sm">
                        {openCell.r.ai_action_plan
                          .split(/\n+/)
                          .map((line) => line.replace(/^\s*\d+[\.\)]\s*/, "").trim())
                          .filter(Boolean)
                          .map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                      </ol>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        No action plan available.
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-2">
                      Requirements Met ({asArray(openCell.r.requirements_met).length})
                    </div>
                    {asArray(openCell.r.requirements_met).length > 0 ? (
                      <ul className="space-y-1.5">
                        {asArray(openCell.r.requirements_met).map((req: any, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                            <span>{typeof req === "string" ? req : req.name ?? req.label ?? JSON.stringify(req)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">None recorded.</p>
                    )}
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-2">
                      Requirements Missing ({asArray(openCell.r.requirements_missing).length})
                    </div>
                    {asArray(openCell.r.requirements_missing).length > 0 ? (
                      <ul className="space-y-1.5">
                        {asArray(openCell.r.requirements_missing).map((req: any, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                            <div>
                              <div>
                                {typeof req === "string"
                                  ? req
                                  : req.name ?? req.label ?? JSON.stringify(req)}
                              </div>
                              {typeof req === "object" && req?.fix_action && (
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  Fix: {req.fix_action}
                                </div>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">None recorded.</p>
                    )}
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 mb-2">
                      Requirements Failed ({asArray(openCell.r.requirements_failed).length})
                    </div>
                    {asArray(openCell.r.requirements_failed).length > 0 ? (
                      <ul className="space-y-1.5">
                        {asArray(openCell.r.requirements_failed).map((req: any, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <X className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                            <div>
                              <div>
                                {typeof req === "string"
                                  ? req
                                  : req.name ?? req.label ?? JSON.stringify(req)}
                              </div>
                              {typeof req === "object" && req?.reason && (
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  Reason: {req.reason}
                                </div>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">None recorded.</p>
                    )}
                  </div>

                  <div className="rounded-md border p-3 text-xs space-y-1">
                    <div className="font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      Grant Details
                    </div>
                    <div>Funder: {openCell.o.funder_name}</div>
                    {openCell.o.amount_typical != null && (
                      <div>Typical Amount: ${openCell.o.amount_typical.toLocaleString()}</div>
                    )}
                    {openCell.o.amount_max != null && (
                      <div>Max Amount: ${openCell.o.amount_max.toLocaleString()}</div>
                    )}
                    {openCell.o.deadline && <div>Deadline: {openCell.o.deadline}</div>}
                    <div className="pt-1 text-muted-foreground">
                      Last checked:{" "}
                      {openCell.r.last_checked_at
                        ? new Date(openCell.r.last_checked_at).toLocaleString()
                        : "—"}
                    </div>
                  </div>


                  <div className="flex flex-col gap-2 pt-4 border-t sticky bottom-0 bg-background pb-2">
                    {(openCell.r.eligibility_status === "eligible" ||
                      openCell.r.eligibility_status === "partially_eligible") && (
                      <Button
                        onClick={() => approveAndApply(openCell.r!)}
                        disabled={applying}
                        className="w-full"
                      >
                        {applying ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating application package...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Approve & Apply
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() =>
                        navigate(`/os/grants/businesses/${openCell.b.id}`)
                      }
                      className="w-full"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Edit Business Profile
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="pt-6 text-sm text-muted-foreground">
                  No eligibility check has been run for this pair yet. Use{" "}
                  <span className="font-medium">Run All Checks</span> above or
                  the Run Check button on the business profile.
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
