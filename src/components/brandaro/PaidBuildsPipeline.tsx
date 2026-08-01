import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ExternalLink } from "lucide-react";

const SPEC_STATUSES = ["intake_sent", "building", "review", "live"] as const;

const STATUS_LABELS: Record<string, string> = {
  intake_sent: "Intake Sent",
  building: "Building",
  review: "Review",
  live: "Live",
};

const STATUS_TONE: Record<string, string> = {
  intake_sent: "bg-muted text-muted-foreground",
  building: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  review: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  live: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  failed: "bg-destructive/10 text-destructive",
};

type JobRow = {
  id: string;
  build_status: string | null;
  package_tier: string | null;
  demo_id: string | null;
  lead_id: string | null;
  deployed_url: string | null;
  preview_url: string | null;
  review_requested_at: string | null;
  created_at: string;
  business_name: string | null;
  paid_amount: number | null;
  paid_tier: string | null;
};

function money(v: number | null) {
  if (v === null || v === undefined) return "—";
  return `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function PaidBuildsPipeline() {
  const qc = useQueryClient();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["brandaro-paid-builds"],
    queryFn: async (): Promise<JobRow[]> => {
      const { data, error } = await (supabase as any)
        .from("brandaro_build_jobs")
        .select("id, build_status, package_tier, demo_id, lead_id, deployed_url, preview_url, review_requested_at, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data || []) as any[];
      if (rows.length === 0) return [];

      const demoIds = [...new Set(rows.map(r => r.demo_id).filter(Boolean))];
      const leadIds = [...new Set(rows.map(r => r.lead_id).filter(Boolean))];

      const [demosRes, leadsRes] = await Promise.all([
        demoIds.length
          ? (supabase as any)
              .from("brandaro_demo_sites")
              .select("id, business_name, paid_amount, paid_tier")
              .in("id", demoIds)
          : Promise.resolve({ data: [], error: null }),
        leadIds.length
          ? (supabase as any)
              .from("brandaro_qualified_leads")
              .select("id, business_name")
              .in("id", leadIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (demosRes.error) throw demosRes.error;
      if (leadsRes.error) throw leadsRes.error;

      const demoMap = new Map((demosRes.data || []).map((d: any) => [d.id, d]));
      const leadMap = new Map((leadsRes.data || []).map((l: any) => [l.id, l]));

      const mapped = rows.map((r) => {
        const demo: any = r.demo_id ? demoMap.get(r.demo_id) : null;
        const lead: any = r.lead_id ? leadMap.get(r.lead_id) : null;
        return {
          id: r.id,
          build_status: r.build_status,
          package_tier: r.package_tier ?? demo?.paid_tier ?? null,
          demo_id: r.demo_id,
          lead_id: r.lead_id,
          deployed_url: r.deployed_url,
          preview_url: r.preview_url ?? null,
          review_requested_at: r.review_requested_at ?? null,
          created_at: r.created_at,
          business_name: demo?.business_name ?? lead?.business_name ?? null,
          paid_amount: demo?.paid_amount ?? null,
          paid_tier: demo?.paid_tier ?? null,
        };
      });

      // Builds waiting on a human check float to the top so they can't be missed.
      return mapped.sort((a, b) => {
        const aReview = a.build_status === "review" ? 0 : 1;
        const bReview = b.build_status === "review" ? 0 : 1;
        return aReview - bReview;
      });
    },
    refetchInterval: 30000,
  });

  const reviewCount = jobs.filter((j) => j.build_status === "review").length;

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const job = jobs.find((j) => j.id === id);
      const wasLive = job?.build_status === "live";
      const patch: Record<string, unknown> = { build_status: status };
      // Moving to 'live' IS the dev approval: stamp the reviewer and promote the
      // preview build to the live URL.
      if (status === "live") {
        const { data: auth } = await supabase.auth.getUser();
        patch.reviewed_by = auth?.user?.id ?? null;
        patch.reviewed_at = new Date().toISOString();
        if (!job?.deployed_url && job?.preview_url) patch.deployed_url = job.preview_url;
      }
      const { error } = await (supabase as any)
        .from("brandaro_build_jobs")
        .update(patch)
        .eq("id", id);
      if (error) throw error;

      // Step 16: monthly hosting billing starts on the transition INTO live only.
      // The function itself is idempotent, so flip-flopping never double-bills.
      if (status === "live" && !wasLive) {
        const { data, error: subErr } = await supabase.functions.invoke(
          "brandaro-start-hosting-subscription",
          { body: { build_job_id: id } },
        );
        return { billing: subErr ? { error: subErr.message } : data };
      }
      return {} as any;
    },
    onMutate: ({ id }) => setPendingId(id),
    onSuccess: (res: any, { status }) => {
      toast.success(`Status updated to ${STATUS_LABELS[status] ?? status}`);
      const billing = res?.billing;
      if (billing?.error) toast.error(`Hosting billing failed: ${billing.error}`);
      else if (billing?.already) toast.info("Hosting subscription already active");
      else if (billing?.created) toast.success("Hosting subscription started ($99/mo)");
      qc.invalidateQueries({ queryKey: ["brandaro-paid-builds"] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to update status"),
    onSettled: () => setPendingId(null),
  });


  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Paid Builds Pipeline ({jobs.length})</CardTitle>
          {reviewCount > 0 && (
            <Badge variant="secondary" className={STATUS_TONE.review}>
              Needs Review ({reviewCount})
            </Badge>
          )}
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/brandaro/build-pipeline">
            Full build pipeline <ExternalLink className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
        ) : jobs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No paid builds yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Business</th>
                  <th className="px-4 py-2 font-medium">Tier</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => {
                  const status = j.build_status ?? "";
                  const needsReview = status === "review";
                  return (
                    <tr
                      key={j.id}
                      className={`border-b last:border-0 ${needsReview ? "bg-blue-500/5" : ""}`}
                    >
                      <td className="px-4 py-2 font-medium">
                        {j.business_name || `Build #${j.id.slice(0, 8)}`}
                      </td>
                      <td className="px-4 py-2 capitalize">{j.package_tier || "—"}</td>
                      <td className="px-4 py-2 tabular-nums">{money(j.paid_amount)}</td>
                      <td className="px-4 py-2">
                        <Badge
                          variant="secondary"
                          className={STATUS_TONE[status] ?? "bg-muted text-muted-foreground"}
                        >
                          {STATUS_LABELS[status] ?? (status || "—")}
                        </Badge>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <Select
                            value={SPEC_STATUSES.includes(status as any) ? status : undefined}
                            onValueChange={(v) => updateStatus.mutate({ id: j.id, status: v })}
                            disabled={pendingId === j.id}
                          >
                            <SelectTrigger className="h-8 w-[150px]">
                              <SelectValue placeholder="Update Status" />
                            </SelectTrigger>
                            <SelectContent>
                              {SPEC_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {pendingId === j.id && (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                          {(j.preview_url || j.deployed_url) && (
                            <Button asChild variant="outline" size="sm" className="h-8">
                              <a
                                href={(j.preview_url || j.deployed_url) as string}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {j.preview_url && status !== "live" ? "Preview" : "Visit"}
                                <ExternalLink className="h-3 w-3 ml-1" />
                              </a>
                            </Button>
                          )}
                        </div>
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
  );
}
