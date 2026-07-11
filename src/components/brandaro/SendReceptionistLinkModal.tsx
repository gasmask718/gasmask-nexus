import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Copy, Send, ExternalLink } from "lucide-react";

type Lead = {
  id: string;
  business_name: string;
  phone_number: string | null;
};

const PLANS = {
  starter: { label: "Starter — $197/mo", monthly: 197, setup: 497 },
  pro:     { label: "Pro — $297/mo",     monthly: 297, setup: 497 },
} as const;
type PlanKey = keyof typeof PLANS;

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fallthrough */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

export function SendReceptionistLinkModal({
  lead,
  open,
  onOpenChange,
}: {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [plan, setPlan] = useState<PlanKey>("starter");
  const [businessName, setBusinessName] = useState(lead?.business_name ?? "");
  const [phone, setPhone] = useState(lead?.phone_number ?? "");
  const [sending, setSending] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [smsSent, setSmsSent] = useState<boolean | null>(null);

  // Sync when lead changes
  const leadKey = lead?.id ?? null;
  useState(() => leadKey);

  // reset on open
  if (open && lead && businessName === "" && lead.business_name) {
    setBusinessName(lead.business_name);
    setPhone(lead.phone_number ?? "");
  }

  const pricing = PLANS[plan];
  const total = pricing.setup + pricing.monthly;

  const handleSend = async () => {
    if (!lead) return;
    setSending(true);
    setCheckoutUrl(null);
    setSmsSent(null);
    try {
      const { data, error } = await supabase.functions.invoke("brandaro-receptionist-checkout", {
        body: {
          lead_id: lead.id,
          plan,
          business_name: businessName,
          send_sms: !!phone,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const url: string | undefined = data?.checkout_url;
      if (!url) throw new Error("No checkout URL returned");
      setCheckoutUrl(url);
      setSmsSent(!!data?.sms_sent);
      toast.success(data?.sms_sent ? "Payment link sent via SMS" : "Checkout link created");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create checkout link");
    } finally {
      setSending(false);
    }
  };

  const handleCopy = async () => {
    if (!checkoutUrl) return;
    const ok = await copyToClipboard(checkoutUrl);
    if (ok) toast.success("Checkout URL copied");
    else toast.error("Copy failed — select and copy manually");
  };

  const handleClose = (o: boolean) => {
    if (!o) {
      setCheckoutUrl(null);
      setSmsSent(null);
      setBusinessName("");
      setPhone("");
      setPlan("starter");
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send Receptionist Payment Link</DialogTitle>
          <DialogDescription>
            Send an SMS with a Stripe checkout link to onboard this lead onto the AI Receptionist.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="biz">Business name</Label>
            <Input id="biz" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone number (SMS target)</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1..." />
          </div>
          <div className="space-y-2">
            <Label>Plan</Label>
            <Select value={plan} onValueChange={(v) => setPlan(v as PlanKey)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PLANS) as PlanKey[]).map((k) => (
                  <SelectItem key={k} value={k}>{PLANS[k].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border p-3 space-y-1 text-sm bg-muted/30">
            <div className="flex justify-between"><span>Setup fee</span><span>${pricing.setup}</span></div>
            <div className="flex justify-between"><span>First month ({plan})</span><span>${pricing.monthly}</span></div>
            <div className="flex justify-between font-semibold border-t pt-1 mt-1">
              <span>Total today</span><span>${total}</span>
            </div>
          </div>

          {checkoutUrl ? (
            <div className="rounded-md border p-3 space-y-2 bg-green-500/5 border-green-500/30">
              <div className="text-xs text-muted-foreground">
                {smsSent ? "SMS sent to lead." : "SMS not sent — share URL manually:"}
              </div>
              <div className="flex items-center gap-2">
                <Input readOnly value={checkoutUrl} className="text-xs" />
                <Button size="icon" variant="outline" onClick={handleCopy} title="Copy">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" onClick={() => window.open(checkoutUrl, "_blank")} title="Open">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <Button className="w-full" onClick={handleSend} disabled={sending || !businessName}>
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send Payment Link via SMS
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
