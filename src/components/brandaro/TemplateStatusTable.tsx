import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

const LEGACY_INDUSTRIES = new Set(["auto_repair", "electrician", "plumber", "roofing"]);

type TemplateRow = {
  id: string;
  industry: string;
  template_name: string | null;
  is_active: boolean | null;
  hook_set: boolean;
  legacy: boolean;
  demos: number;
};

export function TemplateStatusTable() {
  const qc = useQueryClient();
  const [showLegacy, setShowLegacy] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["brandaro-template-status"],
    queryFn: async (): Promise<TemplateRow[]> => {
      const { data, error } = await (supabase as any)
        .from("brandaro_demo_templates")
        .select("id, industry, template_name, is_active, vercel_deploy_hook_url")
        .order("industry");
      if (error) throw error;

      // Tally template_used (text column, not an FK) across all demo sites.
      const counts = new Map<string, number>();
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data: page, error: pErr } = await (supabase as any)
          .from("brandaro_demo_sites")
          .select("template_used")
          .range(from, from + PAGE - 1);
        if (pErr) throw pErr;
        const list = (page || []) as any[];
        for (const d of list) {
          const key = (d.template_used || "").toString().trim().toLowerCase();
          if (!key) continue;
          counts.set(key, (counts.get(key) || 0) + 1);
        }
        if (list.length < PAGE) break;
      }

      return ((data || []) as any[]).map((t) => ({
        id: t.id,
        industry: t.industry,
        template_name: t.template_name,
        is_active: t.is_active,
        hook_set: !!t.vercel_deploy_hook_url,
        legacy: LEGACY_INDUSTRIES.has(t.industry),
        demos: counts.get((t.industry || "").toLowerCase()) || 0,
      }));
    },
    refetchInterval: 60000,
  });

  const toggleActive = useMutation({
    mutationFn: async ({ row, next }: { row: TemplateRow; next: boolean }) => {
      if (next && !row.hook_set) {
        throw new Error(`Cannot activate ${row.industry}: no Vercel deploy hook URL set`);
      }
      const { error } = await (supabase as any)
        .from("brandaro_demo_templates")
        .update({ is_active: next })
        .eq("id", row.id);
      if (error) throw error;
    },
    onMutate: ({ row }) => setPendingId(row.id),
    onSuccess: (_d, { row, next }) => {
      toast.success(`${row.industry} ${next ? "activated" : "deactivated"}`);
      qc.invalidateQueries({ queryKey: ["brandaro-template-status"] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to update template"),
    onSettled: () => setPendingId(null),
  });

  const real = rows.filter((r) => !r.legacy);
  const legacy = rows.filter((r) => r.legacy);
  const visible = showLegacy ? [...real, ...legacy] : real;

  if (isLoading) {
    return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {real.length} live industries · {real.filter((r) => r.is_active).length} active
        </p>
        <div className="flex items-center gap-2">
          <Switch id="show-legacy" checked={showLegacy} onCheckedChange={setShowLegacy} />
          <Label htmlFor="show-legacy" className="text-sm text-muted-foreground">
            Show legacy ({legacy.length})
          </Label>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr className="text-left text-xs uppercase text-muted-foreground">
              <th className="px-4 py-2 font-medium">Industry</th>
              <th className="px-4 py-2 font-medium">Active</th>
              <th className="px-4 py-2 font-medium">Deploy Hook Set</th>
              <th className="px-4 py-2 font-medium">Demos Generated</th>
              <th className="px-4 py-2 font-medium">Activate</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className={`border-b last:border-0 ${r.legacy ? "opacity-50" : ""}`}>
                <td className="px-4 py-2">
                  <div className="font-medium">{r.industry}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.template_name}
                    {r.legacy && (
                      <Badge variant="outline" className="ml-2 text-[10px] border-destructive text-destructive">
                        Deprecated
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <Badge
                    variant="secondary"
                    className={
                      r.is_active
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {r.is_active ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="px-4 py-2">
                  {r.hook_set ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                </td>
                <td className="px-4 py-2 tabular-nums">{r.demos}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!!r.is_active}
                      disabled={pendingId === r.id || r.legacy}
                      onCheckedChange={(next) => {
                        if (next && !r.hook_set) {
                          toast.error(`Cannot activate ${r.industry}: no Vercel deploy hook URL set`);
                          return;
                        }
                        toggleActive.mutate({ row: r, next });
                      }}
                    />
                    {pendingId === r.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
