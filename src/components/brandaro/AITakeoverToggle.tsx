import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function AITakeoverToggle({
  leadId,
  businessName,
  phoneNumber,
  aiPaused,
  onToggle,
}: {
  leadId: string;
  businessName: string;
  phoneNumber: string | null;
  aiPaused: boolean;
  onToggle: (paused: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [manualMsg, setManualMsg] = useState("");
  const [sending, setSending] = useState(false);

  const handleToggle = async (checked: boolean) => {
    const newPaused = !checked; // checked = AI active, so paused = !checked
    setLoading(true);
    try {
      await (supabase as any)
        .from("brandaro_qualified_leads")
        .update({ ai_paused: newPaused })
        .eq("id", leadId);
      onToggle(newPaused);
      toast.success(
        newPaused
          ? `AI paused for ${businessName}. You're in control.`
          : `AI resumed for ${businessName}. Automation is back on.`
      );
    } catch {
      toast.error("Failed to update");
    } finally {
      setLoading(false);
    }
  };

  const handleSendManual = async () => {
    if (!manualMsg.trim() || !phoneNumber) return;
    setSending(true);
    try {
      await supabase.functions.invoke("send-sms", {
        body: { phone_number: phoneNumber, message: manualMsg },
      });
      await (supabase as any).from("brandaro_pending_messages").insert({
        lead_id: leadId,
        lead_name: businessName,
        phone_number: phoneNumber,
        message_body: manualMsg,
        message_type: "sms",
        ai_agent: "human_override",
        status: "sent",
        sent_at: new Date().toISOString(),
      });
      await supabase.functions.invoke("brandaro-pipeline-automator", {
        body: { action: "record_event", lead_id: leadId, event_type: "sms_sent" },
      });
      toast.success("Manual message sent");
      setManualMsg("");
    } catch {
      toast.error("Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3 border rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">AI Automation</p>
          <p className="text-[11px] text-muted-foreground">
            {aiPaused
              ? "Paused — You have control"
              : "Active — AI is managing this lead"}
          </p>
        </div>
        <Switch
          checked={!aiPaused}
          onCheckedChange={handleToggle}
          disabled={loading}
        />
      </div>

      {aiPaused && phoneNumber && (
        <div className="space-y-2 pt-2 border-t">
          <label className="text-xs font-medium">Send manual message</label>
          <Textarea
            value={manualMsg}
            onChange={(e) => setManualMsg(e.target.value)}
            placeholder="Type your message..."
            rows={2}
            className="text-sm"
          />
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={handleSendManual}
            disabled={sending || !manualMsg.trim()}
          >
            {sending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
            Send via Twilio
          </Button>
        </div>
      )}
    </div>
  );
}
