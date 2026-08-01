import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, CheckCircle2, XCircle, Loader2 } from "lucide-react";

const PASS_THRESHOLD = 88;

type AuditRow = {
  id: string;
  created_at: string | null;
  overall_score: number | null;
  pass_number: number;
  fix_count: number;
  business_name: string | null;
};

function fixCount(fixes: any): number {
  if (!fixes) return 0;
  if (Array.isArray(fixes)) return fixes.length;
  if (typeof fixes === "object") return Object.keys(fixes).length;
  if (typeof fixes === "string") return fixes.trim() ? 1 : 0;
  return 0;
}

function scoreTone(score: number | null) {
  if (score === null || score === undefined) return "text-muted-foreground";
  if (score >= PASS_THRESHOLD) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 75) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

export function AuditLogCard() {
  const [open, setOpen] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["brandaro-audit-log"],
    queryFn: async (): Promise<AuditRow[]> => {
      const { data, error } = await (supabase as any)
        .from("brandaro_demo_quality_scores")
        .select("id, demo_id, lead_id, overall_score, fixes_applied, pass_number, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      const scores = (data || []) as any[];
      if (scores.length === 0) return [];

      const demoIds = [...new Set(scores.map((s) => s.demo_id).filter(Boolean))];
      const leadIds = [...new Set(scores.filter((s) => !s.demo_id).map((s) => s.lead_id).filter(Boolean))];

      const [demosRes, leadsRes] = await Promise.all([
        demoIds.length
          ? (supabase as any).from("brandaro_demo_sites").select("id, business_name").in("id", demoIds)
          : Promise.resolve({ data: [], error: null }),
        leadIds.length
          ? (supabase as any).from("brandaro_qualified_leads").select("id, business_name").in("id", leadIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (demosRes.error) throw demosRes.error;
      if (leadsRes.error) throw leadsRes.error;

      const demoMap = new Map<string, string | null>((demosRes.data || []).map((d: any) => [d.id, d.business_name]));
      const leadMap = new Map<string, string | null>((leadsRes.data || []).map((l: any) => [l.id, l.business_name]));
      const leadMap = new Map((leadsRes.data || []).map((l: any) => [l.id, l.business_name]));

      return scores.map((s) => ({
        id: s.id,
        created_at: s.created_at,
        overall_score: s.overall_score,
        pass_number: s.pass_number,
        fix_count: fixCount(s.fixes_applied),
        business_name:
          (s.demo_id ? demoMap.get(s.demo_id) : null) ??
          (s.lead_id ? leadMap.get(s.lead_id) : null) ??
          null,
      }));
    },
    refetchInterval: 30000,
  });

  const passed = rows.filter((r) => (r.overall_score ?? 0) >= PASS_THRESHOLD).length;

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="flex-row items-center justify-between gap-4 space-y-0 cursor-pointer hover:bg-muted/40 transition-colors rounded-t-lg">
            <CardTitle className="text-base">
              Audit Log
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {isLoading
                  ? "loading…"
                  : rows.length === 0
                    ? "no runs yet"
                    : `last ${rows.length} runs · ${passed}/${rows.length} passed`}
              </span>
            </CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </Button>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
            ) : rows.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No audit runs recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr className="text-left text-xs uppercase text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Time</th>
                      <th className="px-4 py-2 font-medium">Business</th>
                      <th className="px-4 py-2 font-medium">Score</th>
                      <th className="px-4 py-2 font-medium">Passed</th>
                      <th className="px-4 py-2 font-medium">Fixed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const didPass = (r.overall_score ?? 0) >= PASS_THRESHOLD;
                      return (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                            {r.created_at
                              ? formatDistanceToNow(new Date(r.created_at), { addSuffix: true })
                              : "—"}
                          </td>
                          <td className="px-4 py-2 font-medium">
                            {r.business_name || "—"}
                            {r.pass_number > 1 && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                pass {r.pass_number}
                              </span>
                            )}
                          </td>
                          <td className={`px-4 py-2 tabular-nums font-semibold ${scoreTone(r.overall_score)}`}>
                            {r.overall_score ?? "—"}
                          </td>
                          <td className="px-4 py-2">
                            {r.overall_score === null || r.overall_score === undefined ? (
                              <span className="text-muted-foreground">—</span>
                            ) : didPass ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <XCircle className="h-4 w-4 text-destructive" />
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {r.fix_count > 0 ? (
                              <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                Yes · {r.fix_count}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
