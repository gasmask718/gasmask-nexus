import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Phone, Bot, Zap, Loader2 } from "lucide-react";

interface BrandaroLeadAssignmentButtonsProps {
  leadId: string;
  leadName: string;
  phoneNumber: string | null;
  currentCallSource?: string | null;
  totalDcCalls?: number | null;
  fromNumber?: string;
  onAssigned?: () => void;
}

export function BrandaroLeadAssignmentButtons({
  leadId,
  leadName,
  phoneNumber,
  currentCallSource,
  totalDcCalls,
  fromNumber,
  onAssigned,
}: BrandaroLeadAssignmentButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleAssignVA = async () => {
    if (!phoneNumber) { toast.error("No phone number on this lead"); return; }
    setLoading("va");
    try {
      const { error } = await supabase.functions.invoke("brandaro-ai-caller", {
        body: { lead_id: leadId, from_number: fromNumber },
      });
      if (error) throw error;
      toast.success(`VA call initiated to ${leadName}`);
      onAssigned?.();
    } catch (err: any) {
      toast.error(`VA call failed: ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  const handleAssignDC = async () => {
    if (!phoneNumber) { toast.error("No phone number on this lead"); return; }
    setLoading("dc");
    try {
      const { data, error } = await supabase.functions.invoke("assign-lead-to-dc", {
        body: { lead_id: leadId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${leadName} queued in Dynasty Connect`);
      onAssigned?.();
    } catch (err: any) {
      toast.error(`DC assignment failed: ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  const handleAssignBoth = async () => {
    if (!phoneNumber) { toast.error("No phone number on this lead"); return; }
    setLoading("both");
    try {
      // Fire VA call first
      await supabase.functions.invoke("brandaro-ai-caller", {
        body: { lead_id: leadId, from_number: fromNumber },
      });
      // Then queue in DC for follow-up
      await supabase.functions.invoke("assign-lead-to-dc", {
        body: { lead_id: leadId },
      });
      toast.success(`${leadName} assigned to VA + DC`);
      onAssigned?.();
    } catch (err: any) {
      toast.error(`Dual assignment failed: ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium">Assign Calling:</span>
        {currentCallSource && (
          <Badge variant="outline" className="text-[10px]">
            Source: {currentCallSource}
          </Badge>
        )}
        {(totalDcCalls ?? 0) > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            {totalDcCalls} DC call{totalDcCalls !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!phoneNumber || loading !== null}
          onClick={handleAssignVA}
          className="flex-1"
        >
          {loading === "va" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Phone className="h-3 w-3 mr-1" />}
          VA Call
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!phoneNumber || loading !== null}
          onClick={handleAssignDC}
          className="flex-1 border-purple-500/30 hover:bg-purple-500/10"
        >
          {loading === "dc" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Bot className="h-3 w-3 mr-1" />}
          DC AI
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!phoneNumber || loading !== null}
          onClick={handleAssignBoth}
          className="flex-1 border-amber-500/30 hover:bg-amber-500/10"
        >
          {loading === "both" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Zap className="h-3 w-3 mr-1" />}
          Both
        </Button>
      </div>
    </div>
  );
}
