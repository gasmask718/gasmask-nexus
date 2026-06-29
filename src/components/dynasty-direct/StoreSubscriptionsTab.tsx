// Dynasty Direct — Store Subscriptions tab (Auto-Reorder management).
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pause, Play, Trash2, Zap, Repeat, Calendar } from "lucide-react";
import { toast } from "sonner";

type SubItem = { product_id: string; qty: number; variant_id?: string | null };
type Sub = {
  id: string;
  user_id: string;
  name: string | null;
  frequency: "weekly" | "biweekly" | "monthly" | "quarterly";
  next_order_date: string;
  items: SubItem[];
  total_estimate: number | null;
  status: "active" | "paused" | "cancelled";
  orders_placed: number;
  last_order_date: string | null;
};

const CADENCE_DAYS: Record<Sub["frequency"], number> = {
  weekly: 7, biweekly: 14, monthly: 30, quarterly: 90,
};
const FREQ_LABEL: Record<Sub["frequency"], string> = {
  weekly: "Weekly", biweekly: "Every 2 weeks", monthly: "Monthly", quarterly: "Quarterly",
};

export default function StoreSubscriptionsTab({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Sub | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["dd-subs", userId],
    queryFn: async (): Promise<Sub[]> => {
      const { data, error } = await (supabase as any)
        .from("dd_subscriptions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Sub[];
    },
  });

  const update = useMutation({
    mutationFn: async (v: { id: string; patch: Partial<Sub> }) => {
      const { error } = await (supabase as any).from("dd_subscriptions").update(v.patch).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dd-subs", userId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const runNow = useMutation({
    mutationFn: async (subId: string) => {
      await (supabase as any).from("dd_subscriptions").update({ next_order_date: new Date().toISOString().slice(0, 10) }).eq("id", subId);
      const { error } = await supabase.functions.invoke("dd-subscription-fulfillment", { body: { sub_id: subId } });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Order placed"); qc.invalidateQueries({ queryKey: ["dd-subs", userId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const subs = data || [];

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Repeat className="h-5 w-5" /> 🔄 Auto-Reorder Subscriptions</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !subs.length ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No subscriptions yet. Browse products and tap "🔄 Subscribe & Save" to set up automatic reorders.
            </p>
          ) : (
            <div className="space-y-3">
              {subs.map((s) => {
                const next3 = Array.from({ length: 3 }, (_, i) => {
                  const d = new Date(s.next_order_date);
                  d.setDate(d.getDate() + i * CADENCE_DAYS[s.frequency]);
                  return d.toISOString().slice(0, 10);
                });
                return (
                  <div key={s.id} className="p-4 rounded border space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{s.name || "Subscription"}</h3>
                          <Badge variant={s.status === "active" ? "default" : s.status === "paused" ? "secondary" : "destructive"}>
                            {s.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {FREQ_LABEL[s.frequency]} · {s.items.length} item(s) · {s.orders_placed} orders placed
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Next order</div>
                        <div className="text-sm font-medium">{s.next_order_date}</div>
                        {s.total_estimate != null && <div className="text-xs text-muted-foreground">~${Number(s.total_estimate).toFixed(2)}</div>}
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground border-t pt-2">
                      <div className="font-medium text-foreground mb-1 flex items-center gap-1"><Calendar className="h-3 w-3" /> Next 3 orders</div>
                      <div className="flex gap-3 flex-wrap">
                        {next3.map((d) => (
                          <span key={d}>📅 {d}{s.total_estimate ? ` — $${Number(s.total_estimate).toFixed(2)} est.` : ""}</span>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {s.status === "active" ? (
                        <Button size="sm" variant="outline" onClick={() => update.mutate({ id: s.id, patch: { status: "paused" } })}>
                          <Pause className="h-3 w-3 mr-1" /> Pause
                        </Button>
                      ) : s.status === "paused" ? (
                        <Button size="sm" variant="outline" onClick={() => update.mutate({ id: s.id, patch: { status: "active" } })}>
                          <Play className="h-3 w-3 mr-1" /> Resume
                        </Button>
                      ) : null}
                      {s.status !== "cancelled" && (
                        <Button size="sm" variant="outline" onClick={() => update.mutate({ id: s.id, patch: { status: "cancelled" } })}>
                          <Trash2 className="h-3 w-3 mr-1" /> Cancel
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setEditing(s)}>Edit Items</Button>
                      {s.status === "active" && (
                        <Button size="sm" onClick={() => runNow.mutate(s.id)} disabled={runNow.isPending}>
                          <Zap className="h-3 w-3 mr-1" /> Order Now
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit items — {editing?.name}</DialogTitle></DialogHeader>
          {editing && (
            <EditItemsForm
              sub={editing}
              onSave={async (items) => {
                await (supabase as any).from("dd_subscriptions").update({ items }).eq("id", editing.id);
                qc.invalidateQueries({ queryKey: ["dd-subs", userId] });
                toast.success("Subscription updated");
                setEditing(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditItemsForm({ sub, onSave }: { sub: Sub; onSave: (items: SubItem[]) => Promise<void> }) {
  const [items, setItems] = useState<SubItem[]>(sub.items);
  const [saving, setSaving] = useState(false);

  const { data: products } = useQuery({
    queryKey: ["sub-items-products", items.map(i => i.product_id).join(",")],
    queryFn: async () => {
      if (!items.length) return [];
      const { data } = await supabase.from("products_all").select("id, product_name").in("id", items.map(i => i.product_id));
      return data || [];
    },
  });
  const nameById = useMemo(() => new Map((products || []).map((p: any) => [p.id, p.product_name])), [products]);

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No items. Add some from a product page.</p>
      ) : items.map((it, idx) => (
        <div key={`${it.product_id}-${idx}`} className="flex items-center gap-2 p-2 border rounded">
          <div className="flex-1 text-sm truncate">{nameById.get(it.product_id) || it.product_id}</div>
          <Input
            type="number" min={1} className="w-20" value={it.qty}
            onChange={(e) => {
              const next = [...items]; next[idx] = { ...it, qty: parseInt(e.target.value) || 1 }; setItems(next);
            }}
          />
          <Button size="sm" variant="ghost" onClick={() => setItems(items.filter((_, i) => i !== idx))}>×</Button>
        </div>
      ))}
      <DialogFooter>
        <Button disabled={saving} onClick={async () => { setSaving(true); await onSave(items); setSaving(false); }}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </div>
  );
}
