import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ExternalLink, Loader2, ChevronDown, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PipelineLead } from "@/hooks/useBrandaroPipeline";

type ModalState = "input" | "result" | "existing";

export function BuildDemoModal({
  lead,
  open,
  onClose,
}: {
  lead: PipelineLead | null;
  open: boolean;
  onClose: () => void;
}) {
  const demoUrl = (lead as any)?.demo_url;
  const [state, setState] = useState<ModalState>(demoUrl ? "existing" : "input");
  const [urlInput, setUrlInput] = useState(demoUrl || "");
  const [loading, setLoading] = useState(false);
  const [pitchResult, setPitchResult] = useState<{
    pitch_sms: string;
    objections: Record<string, string>;
  } | null>(null);
  const [editedPitch, setEditedPitch] = useState("");

  if (!lead) return null;

  const resetToInput = (preserveUrl = false) => {
    setState("input");
    setPitchResult(null);
    if (!preserveUrl) setUrlInput(demoUrl || "");
  };

  const handleGenerate = async (url?: string) => {
    const durable = url || urlInput;
    if (!durable.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("website-pitch-writer", {
        body: { lead_id: lead.id, durable_url: durable },
      });
      if (error) throw error;
      setPitchResult(data);
      setEditedPitch(data.pitch_sms);
      setState("result");
    } catch {
      toast.error("Failed to generate pitch");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveQueue = async () => {
    setLoading(true);
    try {
      await (supabase as any)
        .from("brandaro_qualified_leads")
        .update({ demo_url: urlInput })
        .eq("id", lead.id);
      toast.success("Queued for approval");
      onClose();
    } catch {
      toast.error("Failed to save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Build Demo for {lead.business_name}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {[lead.city, lead.industry].filter(Boolean).join(", ")}
          </p>
        </DialogHeader>

        {/* STATE: existing */}
        {state === "existing" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <ExternalLink className="h-4 w-4 text-green-600 shrink-0" />
              <a href={demoUrl} target="_blank" rel="noreferrer" className="text-sm text-primary underline truncate">
                {demoUrl}
              </a>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setUrlInput(""); resetToInput(); }}>
                Update with new URL
              </Button>
              <Button size="sm" onClick={() => handleGenerate(demoUrl)} disabled={loading}>
                {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Resend pitch
              </Button>
            </div>
          </div>
        )}

        {/* STATE: input */}
        {state === "input" && (
          <div className="space-y-3">
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs gap-1 h-6">
                  <ChevronDown className="h-3 w-3" /> Instructions
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="text-xs text-muted-foreground space-y-1 py-2 pl-4">
                <p>1. Go to durable.co</p>
                <p>2. Type: {lead.business_name} {lead.city} {lead.industry}</p>
                <p>3. Copy the preview URL</p>
                <p>4. Paste it below</p>
              </CollapsibleContent>
            </Collapsible>
            <div className="space-y-2">
              <label className="text-xs font-medium">Durable.co demo URL</label>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://preview.durable.co/..."
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <Button
              onClick={() => handleGenerate()}
              disabled={loading || !urlInput.trim()}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Claude is writing your pitch...
                </>
              ) : (
                "Generate Pitch →"
              )}
            </Button>
          </div>
        )}

        {/* STATE: result */}
        {state === "result" && pitchResult && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium">Pitch SMS</label>
                <Badge variant="outline" className={`text-[10px] ${editedPitch.length > 160 ? "text-red-500" : ""}`}>
                  {editedPitch.length}/160
                </Badge>
              </div>
              <Textarea
                value={editedPitch}
                onChange={(e) => setEditedPitch(e.target.value)}
                rows={3}
                className="text-sm"
              />
              {editedPitch.length > 160 && (
                <p className="text-[10px] text-red-500">Over SMS character limit</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">Objection Responses</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {Object.entries(pitchResult.objections).map(([key, val]) => (
                  <div key={key} className="bg-muted/50 rounded-lg p-2.5 text-xs space-y-1">
                    <p className="font-medium capitalize">{key.replace(/_/g, " ")}</p>
                    <p className="text-muted-foreground">{val}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleApproveQueue} disabled={loading} className="flex-1 bg-purple-600 hover:bg-purple-700">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Approve & Queue
              </Button>
              <Button variant="outline" size="icon" onClick={() => resetToInput(true)}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
