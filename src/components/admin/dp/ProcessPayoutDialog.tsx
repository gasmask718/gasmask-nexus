import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { dp, dpWrite, fmtMoney } from "@/lib/dpClient";
import { isSchemaNotExposedError } from "@/components/admin/SchemaNotExposedBanner";

type Partner = {
  id: string;
  full_name: string;
  total_lifetime_earnings_cents: number | null;
  total_lifetime_paid_cents?: number | null;
};

/**
 * Queues a payout for the partner's outstanding balance.
 *
 * Available balance = total_lifetime_earnings_cents − total_lifetime_paid_cents
 * − any already-pending/processing payouts.
 */
export function ProcessPayoutDialog({
  partner,
  open,
  onOpenChange,
}: {
  partner: Partner | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const { data: pendingCents = 0 } = useQuery({
    queryKey: ["dp-partner-pending-payouts", partner?.id],
    enabled: !!partner?.id && open,
    queryFn: async () => {
      const { data, error } = await dp()
        .from("payouts")
        .select("total_amount_cents,status,recipient_type,recipient_id")
        .eq("recipient_type", "partner")
        .eq("recipient_id", partner!.id)
        .in("status", ["pending", "processing", "scheduled"]);
      if (error) throw error;
      return (data ?? []).reduce((sum: number, r: any) => sum + (r.total_amount_cents ?? 0), 0);
    },
  });

  const lifetime = partner?.total_lifetime_earnings_cents ?? 0;
  const paid = partner?.total_lifetime_paid_cents ?? 0;
  const available = Math.max(0, lifetime - paid - pendingCents);

  const submit = async () => {
    if (!partner) return;
    if (available <= 0) { toast.error("No available balance to pay out."); return; }
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const { error } = await dpWrite().from("payouts").insert({
        recipient_type: "partner",
        recipient_id: partner.id,
        total_amount_cents: available,
        currency: "USD",
        status: "pending",
        period_start: now,
        period_end: now,
        scheduled_for: now,
      });
      if (error) throw error;
      toast.success(`Payout of ${fmtMoney(available)} queued for ${partner.full_name}.`);
      qc.invalidateQueries({ queryKey: ["dp-partners-list"] });
      qc.invalidateQueries({ queryKey: ["dp-partner-pending-payouts", partner.id] });
      onOpenChange(false);
    } catch (err: any) {
      if (isSchemaNotExposedError(err)) {
        toast.error("Partners schema not exposed yet — writes are blocked until the backend schema list is updated.");
      } else {
        toast.error(err?.message ?? "Failed to queue payout");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Process payout — {partner?.full_name}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-1 font-mono text-xs">
                <span className="text-muted-foreground">Lifetime earnings</span><span className="text-right">{fmtMoney(lifetime)}</span>
                <span className="text-muted-foreground">Lifetime paid</span><span className="text-right">− {fmtMoney(paid)}</span>
                <span className="text-muted-foreground">Pending payouts</span><span className="text-right">− {fmtMoney(pendingCents)}</span>
                <span className="font-semibold border-t pt-1">Available</span><span className="text-right font-semibold border-t pt-1">{fmtMoney(available)}</span>
              </div>
              <p className="pt-2">
                Queue a payout of <strong>{fmtMoney(available)}</strong> to {partner?.full_name}? This cannot be undone.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={submit} disabled={submitting || available <= 0}>
            {submitting ? "Queuing…" : `Process ${fmtMoney(available)}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
