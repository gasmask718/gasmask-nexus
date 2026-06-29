import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Zap, Clock, Plus, Square } from "lucide-react";
import { useCountdown } from "@/lib/dynastyDirect/useActiveFlashSale";

interface FlashSale {
  id: string;
  name: string;
  discount_pct: number;
  starts_at: string;
  ends_at: string;
  product_ids: string[] | null;
  category_filter: string | null;
  max_uses: number | null;
  uses_count: number | null;
  show_countdown: boolean | null;
  banner_text: string | null;
  status: string;
  created_at: string;
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ActiveCountdown({ endsAt }: { endsAt: string }) {
  const { label } = useCountdown(endsAt);
  return <span className="font-mono tabular-nums">{label}</span>;
}

export default function DDFlashSales() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    discount_pct: 20,
    starts_at: toLocalInput(new Date().toISOString()),
    ends_at: toLocalInput(new Date(Date.now() + 2 * 3600_000).toISOString()),
    banner_text: "",
    category_filter: "",
    max_uses: "",
    show_countdown: true,
    activateNow: true,
  });

  const { data: sales = [], isLoading } = useQuery<FlashSale[]>({
    queryKey: ["dd-flash-sales"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dd_flash_sales" as never)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FlashSale[];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        name: form.name.trim() || "Flash Sale",
        discount_pct: Number(form.discount_pct) || 0,
        starts_at: form.activateNow
          ? new Date().toISOString()
          : new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        banner_text: form.banner_text.trim() || null,
        category_filter: form.category_filter.trim() || null,
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        show_countdown: form.show_countdown,
        status: form.activateNow ? "active" : "scheduled",
      };
      const { error } = await supabase.from("dd_flash_sales" as never).insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Flash sale created");
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["dd-flash-sales"] });
      qc.invalidateQueries({ queryKey: ["dd-active-flash-sale"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const endMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("dd_flash_sales" as never)
        .update({ status: "ended", ends_at: new Date().toISOString() } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Flash sale ended");
      qc.invalidateQueries({ queryKey: ["dd-flash-sales"] });
      qc.invalidateQueries({ queryKey: ["dd-active-flash-sale"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activateMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("dd_flash_sales" as never)
        .update({ status: "active", starts_at: new Date().toISOString() } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Activated");
      qc.invalidateQueries({ queryKey: ["dd-flash-sales"] });
      qc.invalidateQueries({ queryKey: ["dd-active-flash-sale"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const active = useMemo(
    () => sales.filter((s) => s.status === "active" && new Date(s.ends_at) > new Date()),
    [sales],
  );
  const other = useMemo(() => sales.filter((s) => !active.includes(s)), [sales, active]);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-red-500" /> Flash Sales
          </h1>
          <p className="text-sm text-muted-foreground">
            Create urgency with limited-time discounts on selected products.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4 mr-1" /> New Flash Sale
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>New Flash Sale</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Weekend Flash Sale" />
              </div>
              <div>
                <Label>Discount %</Label>
                <Input type="number" min={1} max={90} value={form.discount_pct} onChange={(e) => setForm({ ...form, discount_pct: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Starts at</Label>
                <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} disabled={form.activateNow} />
              </div>
              <div>
                <Label>Ends at</Label>
                <Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label>Banner text</Label>
                <Input value={form.banner_text} onChange={(e) => setForm({ ...form, banner_text: e.target.value })} placeholder="Flash Sale: 20% Off All Lighting!" />
              </div>
              <div>
                <Label>Category filter (optional)</Label>
                <Input value={form.category_filter} onChange={(e) => setForm({ ...form, category_filter: e.target.value })} placeholder="e.g. lighting" />
              </div>
              <div>
                <Label>Max uses (optional)</Label>
                <Input type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} placeholder="Unlimited" />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label className="cursor-pointer">Show countdown</Label>
                <Switch checked={form.show_countdown} onCheckedChange={(v) => setForm({ ...form, show_countdown: v })} />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label className="cursor-pointer">Activate now</Label>
                <Switch checked={form.activateNow} onCheckedChange={(v) => setForm({ ...form, activateNow: v })} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
                {createMut.isPending ? "Creating..." : form.activateNow ? "Create & Activate" : "Schedule"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <Clock className="h-5 w-5 text-red-500" /> Active ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active flash sales.</p>
        ) : (
          <div className="space-y-2">
            {active.map((s) => (
              <Card key={s.id}>
                <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{s.name} — {s.discount_pct}% off</div>
                    <div className="text-sm text-muted-foreground">
                      Ends in <ActiveCountdown endsAt={s.ends_at} />
                      {s.max_uses && ` · ${s.uses_count ?? 0}/${s.max_uses} used`}
                    </div>
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => endMut.mutate(s.id)} disabled={endMut.isPending}>
                    <Square className="h-3 w-3 mr-1" /> End Early
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">All Sales</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : other.length === 0 ? (
          <p className="text-sm text-muted-foreground">No other sales.</p>
        ) : (
          <div className="space-y-2">
            {other.map((s) => (
              <Card key={s.id}>
                <CardContent className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {s.name} — {s.discount_pct}% off
                      <Badge variant="outline">{s.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(s.starts_at).toLocaleString()} → {new Date(s.ends_at).toLocaleString()}
                    </div>
                  </div>
                  {s.status === "scheduled" && (
                    <Button size="sm" onClick={() => activateMut.mutate(s.id)} disabled={activateMut.isPending}>
                      Activate Now
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
