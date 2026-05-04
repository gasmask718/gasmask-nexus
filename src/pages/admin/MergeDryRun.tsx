/**
 * /admin/merge-dry-run
 * Read-only dry-run preview for the store-merge engine (Phases A-F).
 * Operator picks a duplicate group, sees the full plan, and leaves feedback.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, Download, ChevronDown, ShieldCheck, Loader2, RefreshCw, Clock } from "lucide-react";

function formatStaleness(ts: string | null): { label: string; isStale: boolean } {
  if (!ts) return { label: "never", isStale: true };
  const diffMs = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  const isStale = diffMs > 60 * 60 * 1000; // >1h
  if (mins < 1) return { label: "just now", isStale: false };
  if (mins < 60) return { label: `${mins} min ago`, isStale };
  if (hrs < 24) return { label: `${hrs} hr ago`, isStale };
  return { label: `${days} day${days > 1 ? "s" : ""} ago`, isStale };
}

type Json = any; // dry-run shape is large + dynamic

export default function MergeDryRun() {
  const [groupIdInput, setGroupIdInput] = useState<string>("1");
  const [activeGroupId, setActiveGroupId] = useState<number | null>(1);
  const [feedbackText, setFeedbackText] = useState("");
  type Decision = "approve" | "hold" | "reject" | "needs_review" | "override_winner" | "skiplist" | "defer_to_bulk";
  const [decision, setDecision] = useState<Decision>("needs_review");
  const qc = useQueryClient();

  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ["merge-dry-run", activeGroupId],
    enabled: activeGroupId !== null,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Json> => {
      const { data, error } = await supabase.rpc("preview_store_merge_group" as any, {
        p_group_id: activeGroupId,
      });
      if (error) throw error;
      return data;
    },
  });

  const { data: cacheMeta, refetch: refetchMeta } = useQuery({
    queryKey: ["merge-cache-meta"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dynasty_merge_analysis_cache_meta" as any)
        .select("last_refreshed_at, rows_cached, last_refresh_duration_seconds")
        .order("last_refreshed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    refetchInterval: 60_000,
  });

  const refreshCache = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("refresh_merge_analysis_cache" as any);
      if (error) throw error;
      return data as any;
    },
    onSuccess: (res: any) => {
      const rows = res?.rows_cached ?? res?.[0]?.rows_cached ?? "?";
      const dur = res?.duration_seconds ?? res?.[0]?.duration_seconds ?? "?";
      toast.success(`Cache refreshed: ${rows} rows in ${dur}s`);
      refetchMeta();
      qc.invalidateQueries({ queryKey: ["merge-dry-run"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Cache refresh failed"),
  });

  const { data: feedback } = useQuery({
    queryKey: ["dryrun-feedback", activeGroupId],
    enabled: activeGroupId !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dynasty_dryrun_feedback" as any)
        .select("*")
        .eq("duplicate_group_id", activeGroupId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const submitFeedback = useMutation({
    mutationFn: async () => {
      if (activeGroupId === null) throw new Error("No group");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("dynasty_dryrun_feedback" as any).insert({
        duplicate_group_id: activeGroupId,
        feedback_text: feedbackText || null,
        decision,
        reviewer_user_id: u?.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Feedback recorded");
      setFeedbackText("");
      qc.invalidateQueries({ queryKey: ["dryrun-feedback", activeGroupId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to record feedback"),
  });

  const downloadJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `merge-dry-run-group-${activeGroupId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const summary = data?.merge_summary ?? {};
  const fkRows: any[] = data?.phase_d_fk_repoints ?? [];
  const phaseE = data?.phase_e_soft_deletes ?? {};
  const phaseF = data?.phase_f_change_log ?? {};
  const warnings: any[] = data?.warnings ?? [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Store Merge — Dry-Run Preview
          </h1>
          <p className="text-sm text-muted-foreground">
            Read-only plan: shows every change that would happen if a merge ran. Nothing is written.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Group ID</label>
            <Input
              value={groupIdInput}
              onChange={(e) => setGroupIdInput(e.target.value)}
              type="number"
              className="w-28"
            />
          </div>
          <Button
            onClick={() => {
              const n = parseInt(groupIdInput, 10);
              if (!Number.isFinite(n)) return toast.error("Enter a numeric group id");
              setActiveGroupId(n);
              setTimeout(() => refetch(), 0);
            }}
          >
            Load
          </Button>
          <Button variant="outline" onClick={downloadJson} disabled={!data}>
            <Download className="h-4 w-4 mr-2" />
            JSON
          </Button>
          <Button
            variant="outline"
            onClick={() => refreshCache.mutate()}
            disabled={refreshCache.isPending}
            title="Rebuild duplicate-analysis cache (admin only)"
          >
            {refreshCache.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh Cache
          </Button>
        </div>
      </div>

      {(() => {
        const stale = formatStaleness(cacheMeta?.last_refreshed_at ?? null);
        return (
          <div
            className={
              "flex items-center gap-2 text-xs px-3 py-2 rounded-md border " +
              (stale.isStale
                ? "bg-yellow-500/10 border-yellow-500/40 text-yellow-700 dark:text-yellow-400"
                : "bg-muted/40 border-border text-muted-foreground")
            }
          >
            <Clock className="h-3.5 w-3.5" />
            <span>
              Analysis cache refreshed: <strong>{stale.label}</strong>
              {cacheMeta?.rows_cached != null && <> · {cacheMeta.rows_cached} rows cached</>}
              {cacheMeta?.last_refresh_duration_seconds != null && (
                <> · last build {Number(cacheMeta.last_refresh_duration_seconds).toFixed(2)}s</>
              )}
            </span>
            {stale.isStale && (
              <Badge variant="destructive" className="ml-auto text-[10px]">Stale &gt; 1 hour</Badge>
            )}
          </div>
        );
      })()}

      {isFetching && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Building dry-run plan…
        </div>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Dry-run failed</AlertTitle>
          <AlertDescription>{(error as any).message}</AlertDescription>
        </Alert>
      )}

      {data && (
        <>
          {/* Manual review gate */}
          {data.needs_review && (
            <Alert className="border-yellow-500/60 bg-yellow-500/10 text-yellow-900 dark:text-yellow-200">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>⚠️ This group requires manual review before merging</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  {(data.review_reasons ?? []).map((r: any, i: number) => (
                    <li key={i}>
                      <Badge variant="outline" className="mr-2">{r.rule}</Badge>
                      {r.description}
                    </li>
                  ))}
                </ul>
                <div className="mt-2 text-xs">
                  Operator must record a decision below before any approval action becomes available.
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Top-level merge summary */}
          <Card>
            <CardHeader>
              <CardTitle>Merge Summary — Group {summary.group_id}</CardTitle>
              <CardDescription>{summary.normalized_address}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Stat label="Winner" value={summary.winner_name ?? "—"} />
                <Stat label="Losers" value={summary.loser_count ?? 0} />
                <Stat label="Contacts to create" value={summary.contacts_to_create ?? 0} />
                <Stat label="Fields to consolidate" value={summary.fields_to_consolidate ?? 0} />
                <Stat label="Tables to re-point" value={summary.tables_to_repoint ?? 0} />
                <Stat label="Rows to re-point" value={summary.rows_to_repoint ?? 0} />
                <Stat label="Rows skipped (dedup)" value={summary.rows_to_skip_dedup ?? 0} />
                <Stat label="Soft-deletes" value={summary.soft_deletes_total ?? 0} />
                <Stat label="Est. change_log writes" value={summary.estimated_change_log_writes ?? 0} />
                <Stat label="Est. total DB writes" value={summary.estimated_total_db_writes ?? 0} />
                <Stat label="Winner store_id" value={String(summary.winner_store_id ?? "—").slice(0, 8) + "…"} mono />
              </div>
            </CardContent>
          </Card>

          {/* Warnings */}
          {warnings.length > 0 && (
            <Alert variant={warnings.some((w) => w.level === "warn") ? "destructive" : "default"}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warnings ({warnings.length})</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  {warnings.map((w, i) => (
                    <li key={i}>
                      <Badge variant={w.level === "warn" ? "destructive" : "secondary"} className="mr-2">
                        {w.level}
                      </Badge>
                      {w.message}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Phase A/B/C summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Phase A — Winner</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div><strong>Name:</strong> {data.winner?.effective_name ?? "—"} <span className="text-xs text-muted-foreground">({data.winner?.name_source})</span></div>
                <div><strong>Phone:</strong> {data.winner?.effective_phone ?? "—"} <span className="text-xs text-muted-foreground">({data.winner?.phone_source})</span></div>
                <div><strong>Address:</strong> {data.winner?.effective_address ?? "—"}</div>
                <div><strong>City/State/Zip:</strong> {data.winner?.effective_city}/{data.winner?.effective_state}/{data.winner?.effective_zip}</div>
                <div><strong>Activity score:</strong> {data.winner?.activity_score ?? 0}</div>
                {data.winner?.is_override && <Badge variant="secondary">Manual override</Badge>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Phase B — Losers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div>Total losers: <strong>{data.losers_count}</strong></div>
                <div>Typo duplicates (absorbed): <strong>{data.typo_duplicates_count}</strong></div>
                <div>Real-person contacts: <strong>{data.real_person_contacts_count}</strong></div>
                <div>Contacts to create: <strong>{summary.contacts_to_create}</strong></div>
                <div>Contacts skipped (dup): <strong>{data.contacts_to_skip_count ?? 0}</strong></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Phase C — Field Consolidation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {(data.field_consolidation ?? []).length === 0 ? (
                  <div className="text-muted-foreground">No field consolidation needed.</div>
                ) : (
                  (data.field_consolidation as any[]).map((f, i) => (
                    <div key={i}>
                      <code className="text-xs">{f.target_table}.{f.target_column}</code> ← <strong>"{f.planned_value}"</strong>
                      <div className="text-xs text-muted-foreground">from loser {String(f.source_loser_id).slice(0,8)}…</div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Phase D */}
          <Card>
            <CardHeader>
              <CardTitle>Phase D — FK Re-point Plan</CardTitle>
              <CardDescription>
                {data.phase_d_summary?.total_tables_affected ?? 0} tables · {data.phase_d_summary?.total_rows_to_repoint ?? 0} rows to re-point · {data.phase_d_summary?.total_rows_to_skip_dedup ?? 0} rows skipped via dedup
              </CardDescription>
            </CardHeader>
            <CardContent>
              {fkRows.length === 0 ? (
                <div className="text-sm text-muted-foreground">No FK rows reference the loser store_ids.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Table</TableHead>
                      <TableHead>FK column</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Re-point</TableHead>
                      <TableHead className="text-right">Skip (dedup)</TableHead>
                      <TableHead>Skip rule</TableHead>
                      <TableHead>Sample skipped</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fkRows.map((r, i) => (
                      <TableRow key={i} className={r.rows_to_skip_dedup > 0 ? "bg-yellow-500/5" : ""}>
                        <TableCell>
                          <div className="font-medium">{r.table_name}</div>
                          {r.is_money_table && <Badge variant="destructive" className="text-[10px]">money</Badge>}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.referencing_column}</TableCell>
                        <TableCell className="text-right">{r.rows_total}</TableCell>
                        <TableCell className="text-right font-semibold">{r.rows_to_repoint}</TableCell>
                        <TableCell className="text-right">{r.rows_to_skip_dedup}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.skip_reason ?? "—"}</TableCell>
                        <TableCell className="text-xs font-mono">
                          {Array.isArray(r.sample_skipped_values) && r.sample_skipped_values.length > 0
                            ? r.sample_skipped_values.slice(0, 3).join(", ")
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Phase E + F side-by-side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Phase E — Soft Deletes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>stores: <strong>{phaseE.stores_table_count ?? 0}</strong></div>
                <div>store_master: <strong>{phaseE.store_master_table_count ?? 0}</strong></div>
                <div>Total: <strong>{phaseE.total ?? 0}</strong></div>
                {Array.isArray(phaseE.drift_warnings) && phaseE.drift_warnings.length > 0 && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertTitle>Drift detected ({phaseE.drift_warnings.length})</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-5">
                        {phaseE.drift_warnings.map((d: any, i: number) => (
                          <li key={i} className="text-xs"><code>{String(d.loser_id).slice(0,8)}…</code> — {d.message}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Phase F — Change-log Estimate</CardTitle>
                <CardDescription>{phaseF.estimated_entries ?? 0} entries would be written</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>change_type</TableHead><TableHead className="text-right">count</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(phaseF.breakdown_by_change_type ?? {}).map(([k, v]) => (
                      <TableRow key={k}>
                        <TableCell className="font-mono text-xs">{k}</TableCell>
                        <TableCell className="text-right">{v as number}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Collapsible className="mt-3">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <ChevronDown className="h-4 w-4 mr-1" /> Sample entries
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-72">
                      {JSON.stringify(phaseF.sample_entries ?? [], null, 2)}
                    </pre>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          </div>

          {/* Operator feedback */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Operator Feedback</CardTitle>
              <CardDescription>Record a decision and notes for this dry-run plan. Logged in dynasty_dryrun_feedback.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 items-end">
                <div className="w-48">
                  <label className="text-xs text-muted-foreground">Decision</label>
                  <Select value={decision} onValueChange={(v) => setDecision(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="needs_review">Needs review</SelectItem>
                      <SelectItem value="approve">Approve</SelectItem>
                      <SelectItem value="hold">Hold</SelectItem>
                      <SelectItem value="reject">Reject</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => submitFeedback.mutate()} disabled={submitFeedback.isPending}>
                  {submitFeedback.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Submit feedback
                </Button>
              </div>
              <Textarea
                placeholder="Notes for this dry-run plan…"
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                rows={3}
              />
              {Array.isArray(feedback) && feedback.length > 0 && (
                <div className="space-y-1 mt-3">
                  <div className="text-xs text-muted-foreground">Previous feedback ({feedback.length})</div>
                  {feedback.map((f: any) => (
                    <div key={f.id} className="text-xs border rounded p-2">
                      <Badge variant="outline" className="mr-2">{f.decision}</Badge>
                      <span className="text-muted-foreground">{new Date(f.created_at).toLocaleString()}</span>
                      {f.feedback_text && <div className="mt-1">{f.feedback_text}</div>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, mono = false }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${mono ? "font-mono text-sm" : ""}`}>{value}</div>
    </div>
  );
}
