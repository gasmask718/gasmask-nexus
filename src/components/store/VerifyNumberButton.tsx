import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, ShieldAlert, ShieldQuestion, Send, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  contactId: string;
  storeId: string;
  contactName: string;
  contactPhone?: string | null;
  status?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  confirmedAt?: string | null;
  error?: string | null;
  businessLabel?: string;
  size?: "sm" | "default" | "lg";
  fullWidth?: boolean;
  onChanged?: () => void;
}

type Status = "unverified" | "sent" | "delivered" | "confirmed" | "failed";

const STATE: Record<Status, { label: string; cls: string; icon: any }> = {
  unverified: { label: "Unverified", cls: "bg-muted text-muted-foreground border-border", icon: ShieldQuestion },
  sent:        { label: "Sent",       cls: "bg-amber-500/15 text-amber-500 border-amber-500/30", icon: Send },
  delivered:   { label: "Delivered",  cls: "bg-blue-500/15 text-blue-500 border-blue-500/30", icon: ShieldCheck },
  confirmed:   { label: "Confirmed ✓", cls: "bg-green-500/20 text-green-500 border-green-500/40", icon: CheckCircle2 },
  failed:      { label: "Failed",     cls: "bg-red-500/15 text-red-500 border-red-500/30", icon: ShieldAlert },
};

export function VerifyNumberButton({
  contactId, storeId, contactName, contactPhone,
  status: statusProp, sentAt, deliveredAt, confirmedAt, error,
  businessLabel = "GasMask",
  size = "sm", fullWidth = false, onChanged,
}: Props) {
  const qc = useQueryClient();
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<Status>(((statusProp as Status) || "unverified"));
  const [liveSentAt, setLiveSentAt] = useState<string | null>(sentAt || null);
  const [liveDeliveredAt, setLiveDeliveredAt] = useState<string | null>(deliveredAt || null);
  const [liveConfirmedAt, setLiveConfirmedAt] = useState<string | null>(confirmedAt || null);
  const [liveErr, setLiveErr] = useState<string | null>(error || null);

  useEffect(() => { setStatus((statusProp as Status) || "unverified"); }, [statusProp]);
  useEffect(() => { setLiveSentAt(sentAt || null); }, [sentAt]);
  useEffect(() => { setLiveDeliveredAt(deliveredAt || null); }, [deliveredAt]);
  useEffect(() => { setLiveConfirmedAt(confirmedAt || null); }, [confirmedAt]);
  useEffect(() => { setLiveErr(error || null); }, [error]);

  // Realtime — react to status webhook + inbound YES updates
  useEffect(() => {
    const ch = supabase
      .channel(`verif-${contactId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "store_contacts",
        filter: `id=eq.${contactId}`,
      }, (payload: any) => {
        const n = payload.new || {};
        if (n.number_verification_status) setStatus(n.number_verification_status as Status);
        setLiveSentAt(n.number_verification_sent_at || null);
        setLiveDeliveredAt(n.number_verification_delivered_at || null);
        setLiveConfirmedAt(n.number_verification_confirmed_at || null);
        setLiveErr(n.number_verification_error || null);
        onChanged?.();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [contactId, onChanged]);

  // Light poll while pending (in case realtime is off) — every 8s for up to 2 min
  useEffect(() => {
    if (status !== "sent") return;
    let n = 0;
    const t = setInterval(async () => {
      n += 1;
      const { data } = await supabase
        .from("store_contacts")
        .select("number_verification_status, number_verification_sent_at, number_verification_delivered_at, number_verification_confirmed_at, number_verification_error")
        .eq("id", contactId)
        .maybeSingle();
      if (data?.number_verification_status) {
        setStatus(data.number_verification_status as Status);
        setLiveSentAt(data.number_verification_sent_at);
        setLiveDeliveredAt(data.number_verification_delivered_at);
        setLiveConfirmedAt(data.number_verification_confirmed_at);
        setLiveErr(data.number_verification_error);
        if (data.number_verification_status !== "sent") clearInterval(t);
      }
      if (n >= 15) clearInterval(t);
    }, 8000);
    return () => clearInterval(t);
  }, [status, contactId]);

  const send = async () => {
    if (!contactPhone) { toast.error("No phone on file"); return; }
    setSending(true);
    try {
      const { data, error: e } = await supabase.functions.invoke("verify-contact-number", {
        body: { contact_id: contactId, business_label: businessLabel },
      });
      if (e) throw e;
      if (data?.success === false) throw new Error(data.error || "Failed");
      setStatus("sent");
      setLiveSentAt(new Date().toISOString());
      toast.success(`Verification text sent to ${contactName}`);
      qc.invalidateQueries({ queryKey: ["store-contacts-responsiveness", storeId] });
      qc.invalidateQueries({ queryKey: ["contact-comm-timeline", contactId] });
      onChanged?.();
    } catch (err: any) {
      setStatus("failed");
      setLiveErr(err.message);
      toast.error(`Verification failed: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const meta = STATE[status] || STATE.unverified;
  const Icon = meta.icon;
  const isConfirmed = status === "confirmed";
  const isFinalSuccess = isConfirmed;

  const subtle =
    isConfirmed && liveConfirmedAt ? `Confirmed ${new Date(liveConfirmedAt).toLocaleString()}` :
    status === "delivered" && liveDeliveredAt ? `Delivered ${new Date(liveDeliveredAt).toLocaleString()}` :
    status === "sent" && liveSentAt ? `Sent ${new Date(liveSentAt).toLocaleString()} — awaiting delivery/reply` :
    status === "failed" ? (liveErr || "Send failed") :
    "Not yet verified";

  return (
    <div className={cn("flex flex-col gap-1", fullWidth && "w-full")}>
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size={size}
          onClick={send}
          disabled={sending || !contactPhone || isFinalSuccess}
          className={cn(
            "font-semibold border",
            meta.cls,
            "hover:opacity-90",
            fullWidth && "w-full",
          )}
          variant="outline"
        >
          {sending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Icon className="h-4 w-4 mr-1.5" />}
          {isFinalSuccess ? "Number Verified" :
            status === "sent" ? "Re-send Verification" :
            status === "delivered" ? "Awaiting YES Reply" :
            status === "failed" ? "Retry Verification" :
            "Verify Number"}
        </Button>
        <Badge variant="outline" className={cn("text-[10px]", meta.cls)}>
          {meta.label}
        </Badge>
      </div>
      <p className="text-[10px] text-muted-foreground">{subtle}</p>
    </div>
  );
}
