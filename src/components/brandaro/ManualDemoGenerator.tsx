import { useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertTriangle, Copy, ExternalLink, Zap } from "lucide-react";

const STEP_DELAY_MS = 2500;

type Status = "idle" | "working" | "success" | "error";

export function ManualDemoGenerator({ onGenerated }: { onGenerated?: () => void }) {
  const [businessName, setBusinessName] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [stepIndex, setStepIndex] = useState(0);
  const [demoUrl, setDemoUrl] = useState<string | null>(null);
  const [smsSent, setSmsSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const steps = [
    `Searching Google for ${businessName || "business"}...`,
    "Building your demo site...",
    "Deploying...",
    "Sending SMS to prospect...",
  ];

  const reset = () => {
    setStatus("idle");
    setStepIndex(0);
    setDemoUrl(null);
    setSmsSent(false);
    setErrorMsg("");
  };

  const handleGenerate = async () => {
    if (!businessName.trim()) {
      toast.error("Business name is required");
      return;
    }
    const digits = phone.replace(/\D/g, "");
    if (phone.trim() && digits.length < 10) {
      toast.error("Enter a valid 10-digit phone number (or leave it blank)");
      return;
    }

    setStatus("working");
    setStepIndex(0);
    setErrorMsg("");
    clearTimers();
    [1, 2, 3].forEach((i) => {
      timers.current.push(
        window.setTimeout(() => setStepIndex((prev) => (prev < i ? i : prev)), STEP_DELAY_MS * i),
      );
    });

    try {
      // brandaro-generate-demo requires a lead_id, so create an ad-hoc lead row
      // for this manual/testing request before invoking it.
      const { data: lead, error: insertErr } = await supabase
        .from("brandaro_qualified_leads")
        .insert({
          business_name: businessName.trim(),
          city: city.trim() || null,
          phone_number: phone.trim() || null,
          query_source: "manual_generator",
          lead_status: "new",
        })
        .select("id, phone_number")
        .single();

      if (insertErr) throw insertErr;

      const { data, error } = await supabase.functions.invoke("brandaro-generate-demo", {
        body: {
          lead_id: lead.id,
          engine: "native",
          business_name: businessName.trim(),
          city: city.trim() || null,
          phone_number: lead.phone_number,
        },
      });
      clearTimers();
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      setDemoUrl((data as any)?.demo_url ?? null);
      setSmsSent(Boolean((data as any)?.sms_sent ?? Boolean(lead.phone_number)));
      setStatus("success");
      onGenerated?.();
    } catch (err: any) {
      clearTimers();
      setErrorMsg(err?.message || "Demo generation failed");
      setStatus("error");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Manual Demo Generator</CardTitle>
        <CardDescription>For testing or manual outreach</CardDescription>
      </CardHeader>
      <CardContent>
        {status === "idle" && (
          <div className="grid gap-4 md:grid-cols-4 md:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="mdg-business">Business Name</Label>
              <Input
                id="mdg-business"
                placeholder="Acme Plumbing"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mdg-city">City</Label>
              <Input
                id="mdg-city"
                placeholder="Brooklyn, NY"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mdg-phone">Phone</Label>
              <Input
                id="mdg-phone"
                type="tel"
                placeholder="(555) 555-1234"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <Button onClick={handleGenerate} className="w-full md:w-auto">
              <Zap className="h-4 w-4 mr-2" /> Generate Demo
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
                  onClick={() => {
                    navigator.clipboard.writeText(demoUrl);
                    toast.success("Link copied");
                  }}
                >
                  <Copy className="h-3 w-3 mr-2" /> Copy Link
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Demo queued — URL will appear shortly.</p>
            )}
            <p className="text-xs text-muted-foreground">
              {smsSent ? `SMS sent to ${phone}` : "No SMS sent (no phone entered)"}
            </p>
            <Button variant="ghost" size="sm" onClick={reset}>
              Generate Another
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="py-6 flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="h-9 w-9 text-destructive" />
            <p className="text-sm font-medium text-destructive break-all">{errorMsg}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStatus("idle")}>
                Try Again
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
