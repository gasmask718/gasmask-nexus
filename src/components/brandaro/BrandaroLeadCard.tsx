import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Phone, MessageSquare, Globe, User, ArrowUp, ArrowDown, Minus,
  Link2, ChevronRight, Loader2, Pause, Bot, Calendar, DollarSign, Star,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { PipelineLead, PIPELINE_STAGES } from "@/hooks/useBrandaroPipeline";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCall } from "@/components/communication/CallProvider";

const STAGE_COLORS: Record<string, string> = {
  new: "bg-muted text-muted-foreground",
  contacted: "bg-amber-500 text-white",
  responded: "bg-blue-500 text-white",
  interested: "bg-purple-500 text-white",
  booked: "bg-teal-500 text-white",
  closed: "bg-green-600 text-white",
  lost: "bg-red-500 text-white",
};

export function BrandaroLeadCard({
  lead,
  onOpen,
  onMove,
  onBuildDemo,
  selected,
  onSelect,
}: {
  lead: PipelineLead;
  onOpen: (l: PipelineLead) => void;
  onMove: (id: string, stage: string) => void;
  onBuildDemo?: (lead: PipelineLead) => void;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
}) {
  const [smsLoading, setSmsLoading] = useState(false);
  const [aiCallLoading, setAiCallLoading] = useState(false);
  const [bookLoading, setBookLoading] = useState(false);
  const [pitchLoading, setPitchLoading] = useState(false);

  const { initiateCall } = useCall();
  const handleManualCall = () => {
    if (!lead.phone_number) return;
    initiateCall({ destinationPhone: lead.phone_number, entityType: 'store', entityId: lead.id, entityName: lead.business_name });
  };

  const stageIdx = PIPELINE_STAGES.findIndex((s) => s.key === lead.pipeline_stage);
  const nextStage = PIPELINE_STAGES[stageIdx + 1];

  const demoUrl = (lead as any).demo_url;
  const aiPaused = (lead as any).ai_paused;
  const discoveryJobId = (lead as any).discovery_job_id;
  const smsCount = (lead as any).sms_count || 0;
  const rating = lead.rating;

  const priorityIcon =
    lead.priority_score >= 7 ? <ArrowUp className="h-3 w-3 text-green-500" /> :
    lead.priority_score < 4 ? <ArrowDown className="h-3 w-3 text-red-500" /> :
    <Minus className="h-3 w-3 text-muted-foreground" />;

  const handleSms = async () => {
    setSmsLoading(true);
    try {
      await supabase.functions.invoke("sms-writer", {
        body: {
          lead_id: lead.id,
          business_name: lead.business_name,
          city: lead.city,
          industry: lead.industry,
          call_attempts: lead.call_attempts,
        },
      });
      toast.success("SMS queued for approval");
    } catch {
      toast.error("Failed to generate SMS");
    } finally {
      setSmsLoading(false);
    }
  };

  const handleAiCall = async () => {
    setAiCallLoading(true);
    try {
      const { error } = await supabase.functions.invoke("brandaro-ai-caller", {
        body: { lead_id: lead.id },
      });
      if (error) throw error;
      toast.success(`AI call initiated to ${lead.business_name || "lead"}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to initiate AI call");
    } finally {
      setAiCallLoading(false);
    }
  };

  const handleBook = async () => {
    if (!lead.phone_number) { toast.error("No phone number"); return; }
    setBookLoading(true);
    try {
      await supabase.functions.invoke("send-sms", {
        body: {
          to_number: lead.phone_number,
          message_body: `Hi ${lead.business_name || "there"}, book a quick 15-min call here: https://calendly.com/brandarodigital-sales/website-strategy-call`,
          idempotency_key: `book-${lead.id}-${Date.now()}`,
        },
      });
      toast.success("Booking link sent");
    } catch {
      toast.error("Failed to send booking link");
    } finally {
      setBookLoading(false);
    }
  };

  const handlePitch = async () => {
    if (!demoUrl) {
      onBuildDemo?.(lead);
      return;
    }
    setPitchLoading(true);
    try {
      await supabase.functions.invoke("website-pitch-writer", {
        body: { lead_id: lead.id },
      });
      toast.success("Pitch queued for approval");
    } catch {
      toast.error("Failed to generate pitch");
    } finally {
      setPitchLoading(false);
    }
  };

  const handlePauseAi = async () => {
    try {
      await (supabase as any)
        .from("brandaro_qualified_leads")
        .update({ ai_paused: !aiPaused })
        .eq("id", lead.id);
      toast.success(aiPaused ? "AI resumed" : "AI paused");
    } catch {
      toast.error("Failed to toggle AI");
    }
  };

  const hasReply = !!(lead as any).last_reply_at;
  const replyText = (lead as any).last_reply_text;
  const repliedRecently = hasReply && new Date((lead as any).last_reply_at) > new Date(Date.now() - 86400000);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={`rounded-[10px] border-[0.5px] border-border bg-card hover:shadow-md transition-shadow cursor-pointer w-full flex flex-col ${selected ? "ring-2 ring-primary" : ""} ${repliedRecently ? "ring-2 ring-green-500/50 ring-offset-1" : ""}`}
        >
          {/* Card body */}
          <div className="p-3 flex-1">
            {/* Top row: checkbox + name + stage badge */}
            <div className="flex items-start gap-2 mb-2">
              {onSelect && (
                <Checkbox
                  checked={selected}
                  onCheckedChange={(checked) => onSelect(lead.id, !!checked)}
                  className="mt-0.5 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              <div className="flex-1 min-w-0" onClick={() => onOpen(lead)}>
                <div className="flex items-center gap-1 mb-0.5">
                  {aiPaused && <Pause className="h-3 w-3 text-amber-500 shrink-0" />}
                  {discoveryJobId && <span className="text-xs">🤖</span>}
                </div>
                <p className="text-sm font-medium leading-tight break-words">
                  {lead.business_name || "Unknown"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {[lead.city, (lead as any).state].filter(Boolean).join(", ")}
                </p>
                {lead.industry && (
                  <p className="text-[11px] text-muted-foreground truncate">{lead.industry}</p>
                )}
              </div>
              <Badge className={`text-[10px] shrink-0 border-0 ${STAGE_COLORS[lead.pipeline_stage] || "bg-muted text-muted-foreground"}`}>
                {lead.pipeline_stage}
              </Badge>
            </div>

            {/* Data rows */}
            <div className="space-y-1 mb-2">
              {/* Priority */}
              <div className="flex items-center gap-1 text-xs">
                {priorityIcon}
                <span className="text-muted-foreground">P:</span>
                <span className="font-medium">{lead.priority_score}/10</span>
              </div>
              {/* Engagement bar */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground w-14 shrink-0">Engage:</span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, lead.engagement_score || 0)}%` }} />
                </div>
                <span className="w-6 text-right">{lead.engagement_score || 0}</span>
              </div>
              {/* Calls + SMS + indicators */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.call_attempts || 0}</span>
                <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{smsCount}</span>
                {demoUrl && <span className="text-green-600 flex items-center gap-1"><Globe className="h-3 w-3" />Demo</span>}
                {lead.phone_number ? (
                  <span className="text-green-600">✓</span>
                ) : (
                  <span className="text-red-400 text-[10px]">No phone</span>
                )}
                {rating != null && rating > 0 && (
                  <span className="flex items-center gap-0.5 text-amber-500"><Star className="h-3 w-3" />{rating}★</span>
                )}
                {hasReply && (
                  <span className="flex items-center gap-1 text-green-500 font-medium">
                    <MessageSquare className="h-3 w-3 fill-green-500" />Replied
                  </span>
                )}
              </div>
            </div>

            {/* Next stage button */}
            {nextStage && (
              <button
                onClick={(e) => { e.stopPropagation(); onMove(lead.id, nextStage.key); }}
                className="text-[10px] text-primary hover:underline mb-1 block"
              >
                → Move to {nextStage.label}
              </button>
            )}
          </div>

          {/* Action buttons - bottom */}
          <div className="border-t border-border/50" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-3 divide-x divide-border/30">
              <button onClick={handleManualCall} disabled={!lead.phone_number}
                className="flex items-center justify-center gap-1 py-1.5 text-[10px] hover:bg-muted disabled:opacity-40 transition-colors">
                <Phone className="h-3 w-3" />Call
              </button>
              <button onClick={handleSms} disabled={smsLoading || !lead.phone_number}
                className="flex items-center justify-center gap-1 py-1.5 text-[10px] hover:bg-muted transition-colors disabled:opacity-40">
                {smsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}SMS
              </button>
              <button onClick={() => onBuildDemo?.(lead)}
                className={`flex items-center justify-center gap-1 py-1.5 text-[10px] hover:bg-muted transition-colors ${demoUrl ? "text-green-600" : "text-purple-600"}`}>
                <Globe className="h-3 w-3" />Demo
              </button>
            </div>
            <div className="grid grid-cols-3 divide-x divide-border/30 border-t border-border/30">
              <button onClick={handleBook} disabled={bookLoading || !lead.phone_number}
                className="flex items-center justify-center gap-1 py-1.5 text-[10px] hover:bg-muted disabled:opacity-40 transition-colors">
                {bookLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Calendar className="h-3 w-3" />}Book
              </button>
              <button onClick={handlePitch} disabled={pitchLoading}
                className="flex items-center justify-center gap-1 py-1.5 text-[10px] hover:bg-muted transition-colors disabled:opacity-40">
                {pitchLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <DollarSign className="h-3 w-3" />}Pitch
              </button>
              <button onClick={() => onOpen(lead)}
                className="flex items-center justify-center gap-1 py-1.5 text-[10px] hover:bg-muted transition-colors">
                <User className="h-3 w-3" />Profile
              </button>
            </div>
          </div>
        </div>
      </ContextMenuTrigger>

      {/* Right-click context menu */}
      <ContextMenuContent>
        <ContextMenuItem onClick={() => lead.phone_number && window.open(`tel:${lead.phone_number}`)} disabled={!lead.phone_number}>
          📞 Manual call
        </ContextMenuItem>
        <ContextMenuItem onClick={handleAiCall} disabled={!lead.phone_number || aiCallLoading}>
          🤖 Send AI call
        </ContextMenuItem>
        <ContextMenuItem onClick={handleSms} disabled={!lead.phone_number || smsLoading}>
          💬 Generate SMS
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onBuildDemo?.(lead)}>
          🌐 Build demo
        </ContextMenuItem>
        <ContextMenuItem onClick={handleBook} disabled={!lead.phone_number}>
          📅 Send booking link
        </ContextMenuItem>
        <ContextMenuItem onClick={handlePitch}>
          💰 Send pitch
        </ContextMenuItem>
        <ContextMenuSeparator />
        {PIPELINE_STAGES.filter((s) => s.key !== lead.pipeline_stage).slice(0, 3).map((s) => (
          <ContextMenuItem key={s.key} onClick={() => onMove(lead.id, s.key)}>
            ➡️ Move to {s.label}
          </ContextMenuItem>
        ))}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handlePauseAi}>
          {aiPaused ? "▶️ Resume AI" : "⏸ Pause AI"}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onMove(lead.id, "lost")} className="text-red-500">
          🗑 Mark as Lost
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
