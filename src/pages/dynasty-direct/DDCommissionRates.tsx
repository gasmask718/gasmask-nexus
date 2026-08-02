// Dynasty Direct — Commission Rates admin (single source of truth for rates)
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Percent, AlertTriangle, Plus, History, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  CommissionRateRow, CommissionScope, SCOPE_LABEL, resolveCommissionRate,
} from "@/lib/dynastyDirect/commissionRates";

const SCOPES: CommissionScope[] = ["platform", "category", "seller", "order"];

const scopeColor: Record<CommissionScope, string> = {
  order: "bg-destructive/15 text-destructive",
  seller: "bg-primary/15 text-primary",
  category: "bg-accent text-accent-foreground",
  platform: "bg-muted text-muted-foreground",
};

export default function DDCommissionRates() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CommissionRateRow | null>(null);
  const [form, setForm] = useState({ scope: "seller" as CommissionScope, scope_id: "", rate_pct: "", note: "", active: true });

  // Preview resolver inputs
  const [pvSeller, setPvSeller] = useState("");
  const [pvCategory, setPvCategory] = useState("");
  const [pvOrder, setPvOrder] = useState("");
  const [pvResult, setPvResult] = useState<string | null>(null);
  const [pvBusy, setPvBusy] = useState(false);

  const { data: rates = [], isLoading } = useQuery({
    queryKey: ["dd-commission-rates"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("commission_rates")
        .select("*")
        .order("scope", { ascending: true })
        .order("effective_from", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CommissionRateRow[];
    },
  });

  const { data: audit = [] } = useQuery({
    queryKey: ["dd-commission-rate-audit"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("commission_rate_audit")
        .select("*")
        .order("changed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const platformRate = useMemo(
    () => rates.find((r) => r.scope === "platform" && r.active) ?? null,
    [rates],
  );

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        scope: form.scope,
        scope_id: form.scope === "platform" ? null : form.scope_id.trim(),
        rate_pct: Number(form.rate_pct),
        note: form.note.trim() || null,
        active: form.active,
        updated_by: u.user?.id ?? null,
      };
      if (!Number.isFinite(payload.rate_pct) || payload.rate_pct < 0 || payload.rate_pct > 100) {
        throw new Error("Rate must be between 0 and 100");
      }
      if (form.scope !== "platform" && !payload.scope_id) {
        throw new Error(`A ${form.scope} id is required for this scope`);
      }
      if (editing) {
        const { error } = await (supabase as any)
          .from("commission_rates").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("commission_rates").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Rate updated — applies to the next order" : "Rate added — applies to the next order");
      setOpen(false); setEditing(null);
      qc.invalidateQueries({ queryKey: ["dd-commission-rates"] });
      qc.invalidateQueries({ queryKey: ["dd-commission-rate-audit"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save rate"),
  });

  const toggleActive = useMutation({
    mutationFn: async (row: CommissionRateRow) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("commission_rates")
        .update({ active: !row.active, updated_by: u.user?.id ?? null })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dd-commission-rates"] });
      qc.invalidateQueries({ queryKey: ["dd-commission-rate-audit"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = (scope: CommissionScope) => {
    setEditing(null);
    setForm({ scope, scope_id: "", rate_pct: "", note: "", active: true });
    setOpen(true);
  };

  const openEdit = (row: CommissionRateRow) => {
    setEditing(row);
    setForm({
      scope: row.scope,
      scope_id: row.scope_id ?? "",
      rate_pct: String(row.rate_pct),
      note: row.note ?? "",
      active: row.active,
    });
    setOpen(true);
  };

  const runPreview = async () => {
    setPvBusy(true);
    try {
      const rate = await resolveCommissionRate({
        sellerId: pvSeller.trim() || null,
        categoryId: pvCategory.trim() || null,
        orderId: pvOrder.trim() || null,
      });
      setPvResult(rate === null ? "No rate found" : `${rate}%`);
    } catch (e: any) {
      toast.error(e.message ?? "Resolver failed");
    } finally {
      setPvBusy(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Percent className="h-6 w-6 text-primary" /> Commission Rates
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Precedence: <strong>order override → seller → category → platform default</strong>.
            Changes apply to the <strong>next</strong> order — never retroactively.
          </p>
        </div>
        <Button onClick={() => openNew("seller")}><Plus className="h-4 w-4 mr-1" /> Add rate</Button>
      </div>

      {platformRate?.needs_confirmation && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Platform default is <strong>{platformRate.rate_pct}%</strong> — a TEMPORARY placeholder.
            David must confirm the real platform commission % before going live.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Rate preview (uses the live resolver)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Seller id</Label>
            <Input className="w-64" value={pvSeller} onChange={(e) => setPvSeller(e.target.value)} placeholder="uuid" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Category</Label>
            <Input className="w-48" value={pvCategory} onChange={(e) => setPvCategory(e.target.value)} placeholder="category" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Order id</Label>
            <Input className="w-64" value={pvOrder} onChange={(e) => setPvOrder(e.target.value)} placeholder="uuid" />
          </div>
          <Button variant="secondary" onClick={runPreview} disabled={pvBusy}>
            {pvBusy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Resolve
          </Button>
          {pvResult && <Badge className="h-9 px-3 text-sm">{pvResult}</Badge>}
        </CardContent>
      </Card>

      {SCOPES.map((scope) => {
        const rows = rates.filter((r) => r.scope === scope);
        return (
          <Card key={scope}>
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <Badge className={scopeColor[scope]}>{SCOPE_LABEL[scope]}</Badge>
                <span className="text-muted-foreground text-sm font-normal">{rows.length} rate(s)</span>
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => openNew(scope)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No {SCOPE_LABEL[scope].toLowerCase()} rates.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Scope id</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead>Effective from</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.scope_id ?? "—"}</TableCell>
                        <TableCell className="text-right font-semibold">{Number(r.rate_pct)}%</TableCell>
                        <TableCell className="text-xs">{new Date(r.effective_from).toLocaleString()}</TableCell>
                        <TableCell>
                          <Switch checked={r.active} onCheckedChange={() => toggleActive.mutate(r)} />
                        </TableCell>
                        <TableCell className="text-xs max-w-[280px] truncate">{r.note ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>Edit</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" /> Change log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Scope id</TableHead>
                  <TableHead className="text-right">Old → New</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audit.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs">{new Date(a.changed_at).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline">{a.action}</Badge></TableCell>
                    <TableCell className="text-xs">{a.scope}</TableCell>
                    <TableCell className="font-mono text-xs">{a.scope_id ?? "—"}</TableCell>
                    <TableCell className="text-right text-xs">
                      {a.old_values?.rate_pct != null ? `${a.old_values.rate_pct}%` : "—"} → {a.new_values?.rate_pct != null ? `${a.new_values.rate_pct}%` : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-[10px]">{a.changed_by ? String(a.changed_by).slice(0, 8) : "system"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit rate" : "Add rate"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Scope</Label>
              <Select value={form.scope} onValueChange={(v) => setForm((f) => ({ ...f, scope: v as CommissionScope }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCOPES.map((s) => <SelectItem key={s} value={s}>{SCOPE_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.scope !== "platform" && (
              <div className="space-y-1">
                <Label>{form.scope === "category" ? "Category" : form.scope === "seller" ? "Seller id" : "Order id"}</Label>
                <Input value={form.scope_id} onChange={(e) => setForm((f) => ({ ...f, scope_id: e.target.value }))} />
              </div>
            )}
            <div className="space-y-1">
              <Label>Rate %</Label>
              <Input type="number" step="0.001" value={form.rate_pct}
                onChange={(e) => setForm((f) => ({ ...f, rate_pct: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Note</Label>
              <Input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
