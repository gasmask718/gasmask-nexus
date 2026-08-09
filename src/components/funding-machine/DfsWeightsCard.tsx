import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Scale, RefreshCw, AlertTriangle } from "lucide-react";

interface WeightRow {
  component: string;
  label: string;
  description: string | null;
  weight: number;
  is_active: boolean;
}

export function DfsWeightsCard() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const { data: weights = [], isLoading } = useQuery({
    queryKey: ["funding-dfs-weights"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funding_dfs_weights")
        .select("*")
        .order("weight", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WeightRow[];
    },
  });

  useEffect(() => {
    if (weights.length) {
      setDraft(Object.fromEntries(weights.map(w => [w.component, w.weight])));
    }
  }, [weights]);

  const total = Object.values(draft).reduce((a, b) => a + (Number(b) || 0), 0);
  const dirty = weights.some(w => draft[w.component] !== w.weight);
  const valid = total === 100 && Object.values(draft).every(v => v >= 0 && v <= 100);

  const save = async () => {
    setSaving(true);
    try {
      const changed = weights.filter(w => draft[w.component] !== w.weight);
      for (const w of changed) {
        const { error } = await supabase
          .from("funding_dfs_weights")
          .update({ weight: draft[w.component], updated_at: new Date().toISOString() })
          .eq("component", w.component);
        if (error) throw error;
      }
      // Weights changed => every existing score is stale. Recompute all clients.
      const { error: rpcError } = await supabase.rpc("recompute_all_funding_dfs");
      if (rpcError) throw rpcError;

      await queryClient.invalidateQueries({ queryKey: ["funding-dfs-weights"] });
      await queryClient.invalidateQueries({ queryKey: ["funding-dfs"] });
      await queryClient.invalidateQueries({ queryKey: ["funding-clients"] });
      toast.success(`${changed.length} weight${changed.length === 1 ? "" : "s"} saved — all client scores recomputed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save weights");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-amber-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-amber-500" />
          Fundability Score Weights
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          How each factor contributes to the 0-100 Dynasty Fundability Score. These are
          starting defaults, not your playbook — adjust them to match how you actually
          underwrite. Saving recomputes every client score.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading weights…</p>
        ) : (
          <>
            <div className="space-y-3">
              {weights.map(w => (
                <div key={w.component} className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{w.label}</p>
                    <p className="text-xs text-muted-foreground">{w.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={draft[w.component] ?? w.weight}
                      onChange={e =>
                        setDraft(d => ({ ...d, [w.component]: Number(e.target.value) }))
                      }
                      className="w-20 text-right tabular-nums"
                    />
                    <span className="text-xs text-muted-foreground w-4">pts</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Total</span>
                <Badge
                  className={
                    total === 100
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : "bg-red-500/20 text-red-400 border-red-500/30"
                  }
                >
                  {total} / 100
                </Badge>
              </div>
              <Button
                onClick={save}
                disabled={!dirty || !valid || saving}
                className="bg-gradient-to-r from-amber-600 to-yellow-500 text-black"
              >
                {saving && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                Save & recompute
              </Button>
            </div>

            {total !== 100 && (
              <div className="flex items-start gap-2 text-xs text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  Weights must total exactly 100 before they can be saved.
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
