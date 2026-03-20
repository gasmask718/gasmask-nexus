import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Phone, MessageSquare, Globe, User, ArrowUp, ArrowDown, Minus,
  Link2, ChevronLeft, ChevronRight, Loader2, Pause, Bot,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { PipelineLead, PIPELINE_STAGES } from "@/hooks/useBrandaroPipeline";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STAGE_COLORS: Record<string, string> = {
  new: "bg-gray-500 text-white",
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
}: {
  lead: PipelineLead;
  onOpen: (l: PipelineLead) => void;
  onMove: (id: string, stage: string) => void;
  onBuildDemo?: (lead: PipelineLead) => void;
}) {
  const [smsLoading, setSmsLoading] = useState(false);
  const [aiCallLoading, setAiCallLoading] = useState(false);
  const stageIdx = PIPELINE_STAGES.findIndex((s) => s.key === lead.pipeline_stage);
  const nextStage = PIPELINE_STAGES[stageIdx + 1];
  const prevStage = stageIdx > 0 ? PIPELINE_STAGES[stageIdx - 1] : null;

  const priorityIcon =
    lead.priority_score >= 7 ? <ArrowUp className="h-3 w-3 text-green-500" /> :
    lead.priority_score < 4 ? <ArrowDown className="h-3 w-3 text-red-500" /> :
    <Minus className="h-3 w-3 text-muted-foreground" />;

  const demoUrl = (lead as any).demo_url;
  const aiPaused = (lead as any).ai_paused;

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
      toast.success("SMS draft queued for approval");
    } catch {
      toast.error("Failed to generate SMS");
    } finally {
      setSmsLoading(false);
    }
  };

  const handleAiCall = async () => {
    setAiCallLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("brandaro-ai-caller", {
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

  return (
    <Card
      className="cursor-pointer hover:ring-1 hover:ring-primary/40 transition-all group overflow-hidden"
      onClick={() => onOpen(lead)}
    >
      <CardContent className="p-3 space-y-2">
        {/* Top: Name + Stage Badge */}
        <div className="flex items-start justify-between gap-1">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              {aiPaused && <Pause className="h-3 w-3 text-amber-500 shrink-0" />}
              <p className="font-semibold text-sm leading-tight truncate">
                {lead.business_name || "Unknown"}
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {[lead.city, lead.industry].filter(Boolean).join(" · ")}
            </p>
          </div>
          <Badge className={`text-[10px] shrink-0 border-0 ${STAGE_COLORS[lead.pipeline_stage] || "bg-gray-500 text-white"}`}>
            {lead.pipeline_stage}
          </Badge>
        </div>

        {/* Middle: Priority, Engagement, Calls, Demo */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              {priorityIcon} P: {lead.priority_score}
            </span>
            <span className="text-muted-foreground">Calls: {lead.call_attempts}</span>
          </div>
          <Progress value={lead.engagement_score} className="h-1.5" />
          {demoUrl && (
            <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
              <Link2 className="h-3 w-3" /> Demo ready
            </span>
          )}
        </div>

        {/* Stage navigation (hover) */}
        <div
          className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          {prevStage && (
            <Button size="sm" variant="ghost" className="h-5 px-1 text-[10px]"
              onClick={() => onMove(lead.id, prevStage.key)}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
          )}
          {nextStage && (
            <Button size="sm" variant="ghost" className="h-5 px-1 text-[10px] flex-1"
              onClick={() => onMove(lead.id, nextStage.key)}
            >
              {nextStage.label} <ChevronRight className="h-3 w-3 ml-0.5" />
            </Button>
          )}
        </div>
      </CardContent>

      {/* Bottom: 4-Button Action Bar */}
      <div
        className="grid grid-cols-4 border-t border-border/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Call button with context menu for AI call option */}
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 rounded-none text-[10px] flex flex-col gap-0 px-1"
              onClick={() => lead.phone_number && window.open(`tel:${lead.phone_number}`)}
              disabled={!lead.phone_number || aiCallLoading}
            >
              {aiCallLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Phone className="h-3.5 w-3.5" />
              )}
              Call
            </Button>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem
              onClick={() => lead.phone_number && window.open(`tel:${lead.phone_number}`)}
              disabled={!lead.phone_number}
            >
              <Phone className="h-3.5 w-3.5 mr-2" />
              📞 Call manually
            </ContextMenuItem>
            <ContextMenuItem
              onClick={handleAiCall}
              disabled={!lead.phone_number || aiCallLoading}
            >
              <Bot className="h-3.5 w-3.5 mr-2" />
              🤖 Send AI call
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

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
        <Button
          variant="ghost"
          className="h-8 rounded-none text-[10px] flex flex-col gap-0 px-1"
          onClick={() => onOpen(lead)}
        >
          <User className="h-3.5 w-3.5" />
          Profile
        </Button>
      </div>
    </Card>
  );
}
