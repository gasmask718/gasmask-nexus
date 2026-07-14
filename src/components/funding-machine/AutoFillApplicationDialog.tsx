import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, Sparkles, Send, AlertTriangle, CheckCircle2, Copy } from "lucide-react";

type Funder = { id: string; name: string };

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientId?: string;
  businessProfileId?: string;
  funderType: "lender" | "grant";
  /** Preselected funder — if omitted, dialog lists funders for the type. */
  funder?: Funder;
};

export default function AutoFillApplicationDialog({
  open, onOpenChange, clientId, businessProfileId, funderType, funder,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [funders, setFunders] = useState<Funder[]>([]);
  const [selectedFunderId, setSelectedFunderId] = useState<string>(funder?.id ?? "");
  const [pkg, setPkg] = useState<any>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [narratives, setNarratives] = useState<any>(null);

  useEffect(() => {
    if (!open || funder) return;
    (async () => {
      const table = funderType === "lender" ? "funding_lender_database" : "grant_funders";
      const nameCol = funderType === "lender" ? "lender_name" : "name";
      const { data } = await supabase.from(table).select(`id, ${nameCol}`).limit(200);
      setFunders(((data ?? []) as any[]).map((r) => ({ id: r.id, name: r[nameCol] })));
    })();
  }, [open, funder, funderType]);

  useEffect(() => {
    if (open && funder) setSelectedFunderId(funder.id);
    if (!open) {
      setPkg(null); setMissing([]); setNarratives(null);
    }
  }, [open, funder]);

  async function runAutofill(submit = false) {
    if (!selectedFunderId) {
      toast.error("Select a funder first");
      return;
    }
    submit ? setSubmitting(true) : setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-fill-application", {
        body: {
          client_id: clientId,
          business_profile_id: businessProfileId,
          funder_type: funderType,
          funder_id: selectedFunderId,
          submit,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setPkg((data as any).filled_package);
      setMissing((data as any).missing_fields ?? []);
      setNarratives((data as any).narratives ?? null);
      if (submit) toast.success("Application submitted");
      else toast.success("Package generated — review below");
    } catch (e: any) {
      toast.error(e?.message ?? "Auto-fill failed");
    } finally {
      submit ? setSubmitting(false) : setLoading(false);
    }
  }

  function copyJson() {
    if (!pkg) return;
    navigator.clipboard.writeText(JSON.stringify(pkg, null, 2)).then(
      () => toast.success("Package JSON copied"),
      () => toast.error("Copy failed"),
    );
  }

  const selectedFunder = funder ?? funders.find((f) => f.id === selectedFunderId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#C9A84C]" />
            Auto-Fill Application
          </DialogTitle>
          <DialogDescription>
            Merges the client's Application Profile with AI-generated narratives and produces a filled package for{" "}
            {funderType === "lender" ? "the lender" : "the grant funder"}.
          </DialogDescription>
        </DialogHeader>

        {!funder && (
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-muted-foreground">
              Select {funderType === "lender" ? "Lender" : "Grant Funder"}
            </label>
            <select
              value={selectedFunderId}
              onChange={(e) => setSelectedFunderId(e.target.value)}
              className="w-full h-10 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">— Select —</option>
              {funders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        )}

        {funder && (
          <div className="text-sm">
            Target: <span className="font-medium">{funder.name}</span>
          </div>
        )}

        {!pkg && (
          <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
            <p className="text-sm text-muted-foreground">
              Click "Generate Filled Package" to auto-fill this application using stored client data and AI-drafted narratives.
            </p>
            <Button
              onClick={() => runAutofill(false)}
              disabled={loading || !selectedFunderId}
              className="gap-2"
              style={{ backgroundColor: "#C9A84C", color: "#000" }}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate Filled Package
            </Button>
          </div>
        )}

        {pkg && (
          <ScrollArea className="flex-1 max-h-[55vh] pr-4">
            <div className="space-y-4">
              {missing.length > 0 && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                  <div className="flex items-center gap-2 font-medium text-amber-500 mb-1">
                    <AlertTriangle className="h-4 w-4" />
                    Missing required fields ({missing.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {missing.map((m) => (
                      <Badge key={m} variant="outline" className="border-amber-500/40 text-amber-500">
                        {m}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    Update the client's Application Profile to complete these before submitting.
                  </p>
                </div>
              )}

              {narratives?.warning && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs">
                  {narratives.warning}
                </div>
              )}

              {narratives?.cover_letter && (
                <section>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Cover Letter</div>
                  <div className="rounded border p-3 whitespace-pre-wrap text-sm">{narratives.cover_letter}</div>
                </section>
              )}
              {narratives?.business_narrative && (
                <section>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Business Narrative</div>
                  <div className="rounded border p-3 whitespace-pre-wrap text-sm">{narratives.business_narrative}</div>
                </section>
              )}
              {narratives?.use_of_funds_plan && (
                <section>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Use of Funds</div>
                  <div className="rounded border p-3 whitespace-pre-wrap text-sm">{narratives.use_of_funds_plan}</div>
                </section>
              )}

              <section>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Filled JSON Package</div>
                  <Button variant="ghost" size="sm" onClick={copyJson} className="h-7 gap-1 text-xs">
                    <Copy className="h-3 w-3" /> Copy
                  </Button>
                </div>
                <pre className="rounded border bg-muted/30 p-3 text-[11px] overflow-auto max-h-64">
{JSON.stringify(pkg, null, 2)}
                </pre>
              </section>
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="gap-2">
          {pkg && (
            <>
              <Button variant="outline" onClick={() => runAutofill(false)} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Regenerate"}
              </Button>
              <Button
                onClick={() => runAutofill(true)}
                disabled={submitting || missing.length > 0}
                className="gap-2"
                style={{ backgroundColor: "#C9A84C", color: "#000" }}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Approve &amp; Submit
              </Button>
            </>
          )}
        </DialogFooter>
        {pkg && missing.length === 0 && (
          <div className="text-[11px] text-emerald-500 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Ready for submission
            {selectedFunder ? ` to ${selectedFunder.name}` : ""}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
