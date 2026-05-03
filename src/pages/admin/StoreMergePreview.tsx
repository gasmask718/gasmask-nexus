import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle } from "lucide-react";

interface SummaryRow {
  duplicate_group_id: number;
  normalized_address: string;
  group_size: number;
  pristine_shell_count: number;
  active_record_count: number;
  proposed_winner_store_id: string | null;
  proposed_winner_name: string | null;
  proposed_winner_activity_score: number | null;
  group_classification: string;
  review_priority: string;
}

const classBadge = (c: string) => {
  if (c === "pristine_easy") return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
  if (c === "scattered_clear_winner") return "bg-blue-500/15 text-blue-700 border-blue-500/30";
  if (c === "scattered_close_call") return "bg-amber-500/15 text-amber-700 border-amber-500/30";
  return "bg-muted text-muted-foreground";
};

export default function StoreMergePreview() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["store-merge-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("analyze_store_duplicate_groups_summary" as never);
      if (error) throw error;
      return (data || []) as SummaryRow[];
    },
    staleTime: 5 * 60_000,
  });

  const rows = data || [];
  const totalGroups = rows.length;
  const pristineEasy = rows.filter(r => r.group_classification === "pristine_easy").length;
  const scatteredClear = rows.filter(r => r.group_classification === "scattered_clear_winner").length;
  const scatteredClose = rows.filter(r => r.group_classification === "scattered_close_call").length;
  const allPristine = rows.filter(r => r.group_classification === "all_pristine").length;
  const recordsToDelete = rows.reduce((s, r) => s + (r.group_size - 1), 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Store Merge Preview</h1>
        <p className="text-sm text-muted-foreground mt-1">Read-only analysis of duplicate store groups</p>
      </div>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="flex items-start gap-3 pt-6">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <strong>MERGE PREVIEW — READ-ONLY.</strong> No data has been moved or deleted yet.
            Review the analysis below, then authorize merges in a separate session.
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <SummaryCard label="Total groups" value={totalGroups} />
        <SummaryCard label="Pristine easy" value={pristineEasy} tone="emerald" />
        <SummaryCard label="Scattered clear" value={scatteredClear} tone="blue" />
        <SummaryCard label="Scattered close" value={scatteredClose} tone="amber" />
        <SummaryCard label="All pristine" value={allPristine} />
        <SummaryCard label="Records to delete" value={recordsToDelete} tone="destructive" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Duplicate Groups (sorted by review priority)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Loading analysis (this can take 30–60s)…</p>}
          {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
          {!isLoading && !error && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Normalized Address</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Classification</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Proposed Winner</TableHead>
                  <TableHead className="text-right">Winner Score</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                  <TableHead className="text-right">Pristine</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.duplicate_group_id}>
                    <TableCell className="font-mono text-xs">{r.duplicate_group_id}</TableCell>
                    <TableCell className="text-xs max-w-md truncate">{r.normalized_address}</TableCell>
                    <TableCell>{r.group_size}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={classBadge(r.group_classification)}>
                        {r.group_classification}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.review_priority === "HIGH" ? "destructive" : "outline"}>
                        {r.review_priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{r.proposed_winner_name || "—"}</TableCell>
                    <TableCell className="text-right font-mono">{r.proposed_winner_activity_score ?? 0}</TableCell>
                    <TableCell className="text-right">{r.active_record_count}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.pristine_shell_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "blue" | "amber" | "destructive" }) {
  const toneClass =
    tone === "emerald" ? "text-emerald-600" :
    tone === "blue" ? "text-blue-600" :
    tone === "amber" ? "text-amber-600" :
    tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className={`text-2xl font-bold mt-1 ${toneClass}`}>{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}
