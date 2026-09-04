import { useState } from "react";
import { Phone, Bot, MessageSquare, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCall } from "./CallProvider";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";

export interface OutreachActionsProps {
  phone?: string | null;
  entityName?: string;
  entityType?: "store" | "customer" | "wholesaler" | "driver" | "ambassador" | "other";
  entityId?: string;
  businessId?: string;
  /** Brand key for dc-outbound-call (e.g. "gasmask", "brandaro", "unforgettable") */
  businessKey?: string;
  /** Bland agent_type to use when AI call selected */
  agentType?: string;
  /**
   * Source table for bidirectional sync (e.g. "store_master", "brandaro_qualified_leads",
   * "ut_partner_leads", "re_leads", "dc_leads"). Defaults inferred from entityType=store
   * → "store_master". For non-store sources, callers MUST pass this explicitly.
   */
  sourceTable?: string;
  /** Source row id (defaults to entityId). */
  sourceId?: string;
  /** Source business — used by post-call write-back for cross-business safety. */
  sourceBusiness?: string;
  size?: "sm" | "default" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
  className?: string;
  /** Show as a compact icon-only trigger */
  compact?: boolean;
  label?: string;
}

/**
 * OutreachActions — unified per-action launcher that ALWAYS routes calls/SMS
 * through logged pipelines (CallProvider, dc-outbound-call, send-sms).
 *
 * Role gating: ambassadors only see Manual Call + SMS (no AI call).
 * Replaces raw window.open('tel:') bypass sites.
 */
export function OutreachActions({
  phone,
  entityName,
  entityType = "other",
  entityId,
  businessId,
  businessKey,
  agentType = "sales",
  sourceTable,
  sourceId,
  sourceBusiness,
  size = "sm",
  variant = "outline",
  className,
  compact = false,
  label = "Contact",
}: OutreachActionsProps) {
  const { initiateCall } = useCall();
  const { role } = useUserRole(businessId);
  const [smsOpen, setSmsOpen] = useState(false);
  const [smsBody, setSmsBody] = useState("");
  const [sending, setSending] = useState(false);
  const [aiLaunching, setAiLaunching] = useState(false);

  const disabled = !phone;
  const isAmbassador = role === "ambassador";
  const canUseAI = !isAmbassador && !!businessKey;

  // Resolve source for bidirectional sync. Falls back to entityType=store → store_master.
  const resolvedSourceTable = sourceTable || (entityType === "store" ? "store_master" : undefined);
  const resolvedSourceId = sourceId || entityId;
  const resolvedSourceBusiness = sourceBusiness || businessKey;

  const handleManualCall = () => {
    if (!phone) return toast.error("No phone number");
    initiateCall({
      destinationPhone: phone,
      entityType,
      entityId,
      entityName,
      businessId,
    });
  };

  const handleAICall = async () => {
    if (!phone || !businessKey) return;
    setAiLaunching(true);
    try {
      const { data, error } = await supabase.functions.invoke("dc-outbound-call", {
        body: {
          to_number: phone,
          lead_name: entityName,
          business: businessKey,
          agent_type: agentType,
          source_table: resolvedSourceTable,
          source_id: resolvedSourceId,
          source_business: resolvedSourceBusiness,
          // legacy fallback so older fn versions still capture
          store_id: entityType === "store" ? entityId : undefined,
          lead_id: resolvedSourceId,
        },
      });
      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || "AI call failed");
      }
      toast.success("📞 AI call placed", {
        description: `Call ID: ${data.call_id || "logged"}`,
      });
    } catch (e: any) {
      console.error("AI call failed", e);
      toast.error(e.message || "AI call failed");
    } finally {
      setAiLaunching(false);
    }
  };

  const handleSendSMS = async () => {
    if (!phone || !smsBody.trim()) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: {
          to_number: phone,
          message_body: smsBody.trim(),
          // Human-composed 1:1 outreach to a lead/store contact.
          send_class: "conversational",
          idempotency_key: `outreach-${entityId || "anon"}-${Date.now()}`,
          metadata: {
            business: businessKey,
            entity_type: entityType,
            entity_id: entityId,
            source: "outreach_actions",
          },
        },
      });
      if (error || data?.error) {
        throw new Error(error?.message || data?.error || "SMS failed");
      }
      toast.success("✉️ SMS sent");
      setSmsOpen(false);
      setSmsBody("");
    } catch (e: any) {
      console.error("SMS failed", e);
      toast.error(e.message || "SMS failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size={size}
            variant={variant}
            disabled={disabled}
            className={cn("gap-1.5", className)}
            onClick={(e) => e.stopPropagation()}
            title={disabled ? "No phone number" : "Outreach actions"}
          >
            {aiLaunching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Phone className="h-3.5 w-3.5" />
            )}
            {!compact && <span>{label}</span>}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="bg-popover z-50 w-56"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenuLabel className="text-xs">
            {entityName || phone || "Contact"}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleManualCall} disabled={disabled}>
            <Phone className="h-4 w-4 mr-2" />
            Manual Call
            <span className="ml-auto text-[10px] text-muted-foreground">logged</span>
          </DropdownMenuItem>
          {canUseAI && (
            <DropdownMenuItem onClick={handleAICall} disabled={disabled || aiLaunching}>
              <Bot className="h-4 w-4 mr-2" />
              AI Call (Bland)
              <span className="ml-auto text-[10px] text-muted-foreground">{agentType}</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => setSmsOpen(true)}
            disabled={disabled}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Send SMS
          </DropdownMenuItem>
          {isAmbassador && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1 text-[10px] text-muted-foreground">
                AI calls disabled for ambassador role
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={smsOpen} onOpenChange={setSmsOpen}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>
              Send SMS {entityName ? `to ${entityName}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">To: {phone}</Label>
            <Textarea
              value={smsBody}
              onChange={(e) => setSmsBody(e.target.value)}
              placeholder="Type your message..."
              rows={4}
              maxLength={1600}
            />
            <div className="text-[10px] text-muted-foreground text-right">
              {smsBody.length}/1600
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSmsOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={handleSendSMS} disabled={sending || !smsBody.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default OutreachActions;
