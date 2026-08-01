import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertTriangle, Copy, ExternalLink, Zap } from "lucide-react";

export type SendDemoLead = {
  id: string;
  business_name: string;
  city?: string | null;
  phone_number?: string | null;
  google_place_id?: string | null;
};

type Props = {
  lead: SendDemoLead | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: (demoUrl: string | null) => void;
};

const STEP_DELAY_MS = 2500;

export function SendDemoModal({ lead, open, onClose, onSuccess }: Props) {
  const [businessName, setBusinessName] = useState("");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "success" | "error">("idle");
  const [stepIndex, setStepIndex] = useState(0);
  const [demoUrl, setDemoUrl] = useState<string | null>(null);
  const [smsSent, setSmsSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  useEffect(() => {
    if (open && lead) {
      setBusinessName(lead.business_name ?? "");
      setCity(lead.city ?? "");
      setStatus("idle");
      setStepIndex(0);
      setDemoUrl(null);
      setSmsSent(false);
      setErrorMsg("");
    }
    return clearTimers;
  }, [open, lead]);

  if (!lead) return null;

  const steps = [
    `Searching Google for ${businessName || lead.business_name}...`,
    "Building your demo site...",
    "Deploying...",
    "Sending SMS to prospect...",
  ];

  const handleGenerate = async () => {
    if (!businessName.trim()) {
      toast.error("Business name is required");
      return;
    }
    setStatus("working");
    setStepIndex(0);
    clearTimers();
    [1, 2, 3].forEach((i) => {
      timers.current.push(
        window.setTimeout(() => setStepIndex((prev) => (prev < i ? i : prev)), STEP_DELAY_MS * i),
      );
    });

    try {
      const { data, error } = await supabase.functions.invoke("brandaro-generate-demo", {
        body: {
          lead_id: lead.id,
          engine: "native",
          business_name: businessName.trim(),
          city: city.trim() || null,
          phone_number: lead.phone_number,
          google_place_id: lead.google_place_id ?? null,
        },
      });
      clearTimers();
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const url = (data as any)?.demo_url ?? null;
      setDemoUrl(url);
      setSmsSent(Boolean((data as any)?.sms_sent ?? lead.phone_number));
      setStatus("success");
      onSuccess?.(url);
      timers.current.push(window.setTimeout(() => onClose(), 5000));
    } catch (err: any) {
      clearTimers();
      setErrorMsg(err?.message || "Demo generation failed");
      setStatus("error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { clearTimers(); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Demo to {lead.business_name}</DialogTitle>
        </DialogHeader>

        {status === "idle" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="demo-business-name">Business Name</Label>
              <Input
                id="demo-business-name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="demo-city">City</Label>
              <Input id="demo-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={lead.phone_number || "No phone on file"} readOnly disabled />
            </div>
            <Button className="w-full" onClick={handleGenerate}>
              <Zap className="h-4 w-4 mr-2" /> Generate and Send Demo
            </Button>
          </div>
        )}

        {status === "working" && (
          <div className="py-8 flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">{steps[stepIndex]}</p>
            <p className="text-xs text-muted-foreground">This can take up to a minute.</p>
          </div>
        )}

        {status === "success" && (
          <div className="py-6 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="h-9 w-9 text-primary" />
            <p className="text-lg font-semibold">Demo Live!</p>
            {demoUrl ? (
              <>
                <a
                  href={demoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline break-all inline-flex items-center gap-1"
                >
                  {demoUrl} <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { navigator.clipboard.writeText(demoUrl); toast.success("Link copied"); }}
                >
                  <Copy className="h-3 w-3 mr-2" /> Copy Link
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Demo queued — URL will appear shortly.</p>
            )}
            <p className="text-xs text-muted-foreground">
              {smsSent ? `SMS sent to ${lead.phone_number}` : "No SMS sent (no phone on file)"}
            </p>
            <p className="text-[11px] text-muted-foreground">Closing automatically…</p>
          </div>
        )}

        {status === "error" && (
          <div className="py-6 flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="h-9 w-9 text-destructive" />
            <p className="text-sm font-medium text-destructive break-all">{errorMsg}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStatus("idle")}>Try Again</Button>
              <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
