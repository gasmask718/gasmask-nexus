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
          phone_number: lead.phone_number,
          message: `Hi ${lead.business_name || "there"}, book a quick 15-min call here: https://calendly.com/brandarodigital-sales/website-strategy-call`,
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

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Card
          className={`min-h-[200px] rounded-[10px] border-[0.5px] border-border hover:shadow-md transition-all overflow-hidden ${selected ? "ring-2 ring-primary" : ""}`}
        >
          <CardContent className="p-3 space-y-2">
            {/* Top: Checkbox + Name + Stage */}
            <div className="flex items-start gap-2">
              {onSelect && (
                <Checkbox
                  checked={selected}
                  onCheckedChange={(checked) => onSelect(lead.id, !!checked)}
                  className="mt-0.5 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onOpen(lead)}>
                <div className="flex items-start justify-between gap-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      {aiPaused && <Pause className="h-3 w-3 text-amber-500 shrink-0" />}
                      {discoveryJobId && <Bot className="h-3 w-3 text-blue-500 shrink-0" />}
                      <p className="font-semibold text-sm leading-tight line-clamp-2">
                        {lead.business_name || "Unknown"}
                      </p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {[lead.city, (lead as any).state].filter(Boolean).join(", ")}
                    </p>
                    {lead.industry && (
                      <p className="text-[11px] text-muted-foreground">{lead.industry}</p>
                    )}
                  </div>
                  <Badge className={`text-[10px] shrink-0 border-0 ${STAGE_COLORS[lead.pipeline_stage] || "bg-muted text-muted-foreground"}`}>
                    {lead.pipeline_stage}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Middle: Data Rows */}
            <div className="space-y-1.5 text-xs">
              {/* Row 1: Priority */}
              <div className="flex items-center gap-1 text-muted-foreground">
                {priorityIcon}
                <span>Priority: {lead.priority_score}/10</span>
              </div>

              {/* Row 2: Engagement */}
              <div className="space-y-0.5">
                <span className="text-muted-foreground text-[11px]">Engagement: {lead.engagement_score}</span>
                <Progress value={lead.engagement_score} className="h-1.5" />
              </div>

              {/* Row 3: Contact attempts */}
              <div className="flex items-center gap-3 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Calls: {lead.call_attempts}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> SMS: {smsCount}
                </span>
              </div>

              {/* Row 4: Status indicators */}
              <div className="flex items-center gap-2 flex-wrap">
                {demoUrl && (
                  <span className="flex items-center gap-0.5 text-green-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <Link2 className="h-3 w-3" /> Demo
                  </span>
                )}
                {lead.phone_number ? (
                  <span className="flex items-center gap-0.5 text-green-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Phone
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-red-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> No phone
                  </span>
                )}
                {rating != null && rating > 0 && (
                  <span className="flex items-center gap-0.5 text-amber-500">
                    <Star className="h-3 w-3" /> {rating}★ ({lead.review_count})
                  </span>
                )}
              </div>
            </div>

            {/* Stage move */}
            {nextStage && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[10px] text-muted-foreground w-full justify-center"
                onClick={(e) => { e.stopPropagation(); onMove(lead.id, nextStage.key); }}
              >
                → {nextStage.label} <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
            )}
          </CardContent>

          {/* Bottom: 6-Button Action Bar (2 rows of 3) */}
          <div className="border-t border-border/50" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-3">
              <Button
                variant="ghost"
                className="h-8 rounded-none text-[10px] flex flex-col gap-0 px-1"
                onClick={() => lead.phone_number && window.open(`tel:${lead.phone_number}`)}
                disabled={!lead.phone_number || aiCallLoading}
              >
                {aiCallLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5" />}
                Call
              </Button>
              <Button
                variant="ghost"
                className="h-8 rounded-none text-[10px] flex flex-col gap-0 px-1"
                onClick={handleSms}
                disabled={smsLoading || !lead.phone_number}
              >
                {smsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                SMS
              </Button>
              <Button
                variant="ghost"
                className={`h-8 rounded-none text-[10px] flex flex-col gap-0 px-1 ${demoUrl ? "text-green-600" : "text-purple-600"}`}
                onClick={() => onBuildDemo?.(lead)}
              >
                <Globe className="h-3.5 w-3.5" />
                Demo
              </Button>
            </div>
            <div className="grid grid-cols-3 border-t border-border/30">
              <Button
                variant="ghost"
                className="h-8 rounded-none text-[10px] flex flex-col gap-0 px-1"
                onClick={handleBook}
                disabled={bookLoading || !lead.phone_number}
              >
                {bookLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Calendar className="h-3.5 w-3.5" />}
                Book
              </Button>
              <Button
                variant="ghost"
                className="h-8 rounded-none text-[10px] flex flex-col gap-0 px-1"
                onClick={handlePitch}
                disabled={pitchLoading}
              >
                {pitchLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DollarSign className="h-3.5 w-3.5" />}
                Pitch
              </Button>
              <Button
                variant="ghost"
                className="h-8 rounded-none text-[10px] flex flex-col gap-0 px-1"
                onClick={() => onOpen(lead)}
              >
                <User className="h-3.5 w-3.5" />
                Profile
              </Button>
            </div>
          </div>
        </Card>
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
