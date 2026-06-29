// Dynasty Direct — "🔄 Subscribe & Save" component for product cards / PDP.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Repeat } from "lucide-react";
import { toast } from "sonner";

type Freq = "weekly" | "biweekly" | "monthly" | "quarterly";
const CADENCE_DAYS: Record<Freq, number> = { weekly: 7, biweekly: 14, monthly: 30, quarterly: 90 };

export default function SubscribeAndSave({
  userId, productId, productName, productPrice, storeAccountId,
}: {
  userId: string | null;
  productId: string;
  productName: string;
  productPrice: number;
  storeAccountId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [freq, setFreq] = useState<Freq>("monthly");
  const [qty, setQty] = useState(1);
  const [targetSubId, setTargetSubId] = useState<string>("new");
  const [newName, setNewName] = useState(`${productName} reorder`);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const { data: subs } = useQuery({
    queryKey: ["my-subs-mini", userId],
    enabled: !!userId && open,
    queryFn: async () => {
      const { data } = await (supabase as any).from("dd_subscriptions")
        .select("id, name, frequency").eq("user_id", userId).eq("status", "active");
      return (data || []) as Array<{ id: string; name: string | null; frequency: Freq }>;
    },
  });

  const submit = async () => {
    if (!userId) { toast.error("Sign in to subscribe"); return; }
    setSaving(true);
    try {
      const unitDiscounted = productPrice * 0.95; // 5% subscribe & save
      if (targetSubId !== "new" && subs?.length) {
        const existing = subs.find(s => s.id === targetSubId);
        if (existing) {
          const { data: full } = await (supabase as any).from("dd_subscriptions").select("items, total_estimate").eq("id", targetSubId).single();
          const items = Array.isArray(full?.items) ? full.items : [];
          items.push({ product_id: productId, qty });
          const totalEst = Number(full?.total_estimate ?? 0) + unitDiscounted * qty;
          const { error } = await (supabase as any).from("dd_subscriptions")
            .update({ items, total_estimate: totalEst }).eq("id", targetSubId);
          if (error) throw error;
          toast.success(`Added to "${existing.name}"`);
        }
      } else {
        const days = CADENCE_DAYS[freq];
        const next = new Date(startDate);
        const { error } = await (supabase as any).from("dd_subscriptions").insert({
          user_id: userId,
          store_account_id: storeAccountId ?? null,
          name: newName,
          frequency: freq,
          next_order_date: next.toISOString().slice(0, 10),
          items: [{ product_id: productId, qty }],
          total_estimate: unitDiscounted * qty,
          status: "active",
        } as any);
        if (error) throw error;
        toast.success("Subscription created — 5% off recurring orders");
      }
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" className="w-full gap-1" onClick={() => setOpen(true)}>
        <Repeat className="h-3 w-3" /> 🔄 Subscribe & Save 5%
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>🔄 Subscribe & Save</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">
            Set up automatic reorders for <strong>{productName}</strong> and save 5% on every subscription order.
          </p>

          <div className="space-y-3">
            <div>
              <Label>Frequency</Label>
              <RadioGroup value={freq} onValueChange={(v) => setFreq(v as Freq)} className="grid grid-cols-2 gap-2 mt-1">
                {(["weekly", "biweekly", "monthly", "quarterly"] as Freq[]).map(f => (
                  <label key={f} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-muted">
                    <RadioGroupItem value={f} />
                    <span className="text-sm">{f === "biweekly" ? "Every 2 weeks" : f.charAt(0).toUpperCase() + f.slice(1)}{f === "monthly" ? " ⭐" : ""}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div>
              <Label>Quantity</Label>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setQty(Math.max(1, qty - 1))}>−</Button>
                <Input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))} className="w-20 text-center" />
                <Button size="sm" variant="outline" onClick={() => setQty(qty + 1)}>+</Button>
              </div>
            </div>

            {subs && subs.length > 0 && (
              <div>
                <Label>Add to</Label>
                <Select value={targetSubId} onValueChange={setTargetSubId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">＋ New subscription</SelectItem>
                    {subs.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name || "(unnamed)"} · {s.frequency}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {targetSubId === "new" && (
              <>
                <div>
                  <Label>Subscription name</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>
                <div>
                  <Label>Start date</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button disabled={saving} onClick={submit}>
              {saving ? "Saving…" : targetSubId !== "new" ? "Add to Subscription" : "Create Subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
