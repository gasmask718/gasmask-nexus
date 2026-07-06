import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { dpWrite } from "@/lib/dpClient";
import { isSchemaNotExposedError } from "@/components/admin/SchemaNotExposedBanner";
import { DP_PLATFORMS, getTier } from "@/lib/dpTiers";

type Partner = {
  id: string;
  full_name: string;
  tier: string;
  profile_data?: { platforms?: string[] } | null;
};

/**
 * Records a manual sale for a partner. Inserts into `partners.sales` — the
 * `trg_sales_commission_split` trigger then creates the matching commission
 * split row automatically.
 *
 * Requires the partner to have at least one ambassador AND at least one
 * activated platform (with a matching `partners.platforms` row). If either
 * is missing the dialog surfaces a helpful error.
 */
export function RecordSaleDialog({
  partner,
  open,
  onOpenChange,
}: {
  partner: Partner | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [platformSlug, setPlatformSlug] = useState<string>("");
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const tierDef = partner ? getTier(partner.tier) : null;
  const activatedSlugs = partner?.profile_data?.platforms ?? [];
  const availablePlatforms = DP_PLATFORMS.filter((p) => activatedSlugs.includes(p.slug));
  const amountCents = Math.round(parseFloat(amount || "0") * 100);
  const commissionRate = tierDef?.commissionRate ?? 0;
  const commissionCents = Math.round((amountCents * commissionRate) / 100);

  const reset = () => {
    setAmount(""); setPlatformSlug(""); setNotes("");
    setSaleDate(new Date().toISOString().slice(0, 10));
  };

  const submit = async () => {
    if (!partner || !tierDef) return;
    if (!amountCents || amountCents < 1) { toast.error("Enter a sale amount."); return; }
    if (!platformSlug) { toast.error("Select a platform."); return; }

    setSubmitting(true);
    try {
      // Look up the platform_id (partners.platforms is seeded with slugs)
      const { data: platformRow, error: pErr } = await dpWrite()
        .from("platforms").select("id").eq("slug", platformSlug).maybeSingle();
      if (pErr) throw pErr;
      if (!platformRow?.id) { toast.error(`Platform ${platformSlug} not found in partners.platforms.`); return; }

      // Need an ambassador for the sale — use the partner's oldest active one
      const { data: ambRow, error: aErr } = await dpWrite()
        .from("ambassadors").select("id")
        .eq("partner_id", partner.id).eq("status", "active")
        .order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (aErr) throw aErr;
      if (!ambRow?.id) {
        toast.error("Partner has no active ambassador — cannot record a commissioned sale.");
        return;
      }

      const soldAt = new Date(`${saleDate}T12:00:00Z`).toISOString();
      const { error } = await dpWrite().from("sales").insert({
        partner_id: partner.id,
        ambassador_id: ambRow.id,
        platform_id: platformRow.id,
        external_sale_id: `manual-${Date.now()}`,
        amount_cents: amountCents,
        commission_pool_cents: commissionCents,
        currency: "USD",
        status: "pending",
        sold_at: soldAt,
      });
      if (error) throw error;

      toast.success(`Recorded $${(amountCents / 100).toFixed(2)} sale — $${(commissionCents / 100).toFixed(2)} commission queued.`);
      qc.invalidateQueries({ queryKey: ["dp-partners-list"] });
      reset();
      onOpenChange(false);
    } catch (err: any) {
      if (isSchemaNotExposedError(err)) {
        toast.error("Partners schema not exposed yet — writes are blocked until the backend schema list is updated.");
      } else {
        toast.error(err?.message ?? "Failed to record sale");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record sale — {partner?.full_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Platform</Label>
            <Select value={platformSlug} onValueChange={setPlatformSlug}>
              <SelectTrigger><SelectValue placeholder={availablePlatforms.length ? "Select platform" : "No activated platforms"} /></SelectTrigger>
              <SelectContent>
                {availablePlatforms.map((p) => (
                  <SelectItem key={p.slug} value={p.slug}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Sale amount (USD)</Label>
            <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <Label>Sale date</Label>
            <Input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>
          {amountCents > 0 && tierDef && (
            <div className="rounded-md bg-muted/60 px-3 py-2 text-sm">
              Commission preview: <strong>${(commissionCents / 100).toFixed(2)}</strong>{" "}
              <span className="text-muted-foreground">
                ({commissionRate}% of ${(amountCents / 100).toFixed(2)})
              </span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || !amountCents || !platformSlug}>
            {submitting ? "Recording…" : "Record sale"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
