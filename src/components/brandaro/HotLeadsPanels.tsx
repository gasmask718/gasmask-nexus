import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Flame, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface PanelLead {
  id: string;
  business_name: string | null;
  city: string | null;
  priority_score: number;
}

function useHotLeads() {
  return useQuery({
    queryKey: ["brandaro-hot-leads"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("brandaro_qualified_leads")
        .select("id, business_name, city, priority_score, pipeline_stage")
        .gte("priority_score", 5)
        .in("pipeline_stage", ["new", "contacted", "responded", "interested", "booked"])
        .order("priority_score", { ascending: false })
        .limit(3);
      return (data || []) as PanelLead[];
    },
    refetchInterval: 60000,
  });
}

function useFollowUpLeads() {
  return useQuery({
    queryKey: ["brandaro-followup-leads"],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await (supabase as any)
        .from("brandaro_qualified_leads")
        .select("id, business_name, city, priority_score, last_call_at")
        .eq("pipeline_stage", "responded")
        .or(`last_call_at.lt.${cutoff},last_call_at.is.null`)
        .order("last_call_at", { ascending: true, nullsFirst: true })
        .limit(3);
      return (data || []) as PanelLead[];
    },
    refetchInterval: 60000,
  });
}

function useStuckLeads() {
  return useQuery({
    queryKey: ["brandaro-stuck-leads"],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data } = await (supabase as any)
        .from("brandaro_qualified_leads")
        .select("id, business_name, city, priority_score, last_call_at, call_attempts")
        .eq("pipeline_stage", "contacted")
        .lt("last_call_at", cutoff)
        .order("last_call_at", { ascending: true })
        .limit(3);
      return (data || []) as PanelLead[];
    },
    refetchInterval: 60000,
  });
}

function IntelPanel({
  icon: Icon,
  label,
  emoji,
  color,
  count,
  leads,
  emptyText,
  onClick,
}: {
  icon: any;
  label: string;
  emoji: string;
  color: string;
  count: number;
  leads: PanelLead[];
  emptyText: string;
  onClick?: () => void;
}) {
  return (
    <Card
      className={cn("p-3 h-[88px] flex flex-col justify-between cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all bg-secondary/50")}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <span className={cn("text-[11px] uppercase font-semibold tracking-wide flex items-center gap-1", color)}>
          {emoji} {label}
        </span>
        <span className={cn("text-2xl font-bold", color)}>{count}</span>
      </div>
      <p className="text-xs text-muted-foreground truncate">
        {count === 0
          ? emptyText
          : leads.map((l) => l.business_name || "Unknown").join(", ")}
      </p>
    </Card>
  );
}

export function HotLeadsPanels({
  onFilterStage,
}: {
  onFilterStage?: (stages: string[]) => void;
}) {
  const { data: hotLeads = [] } = useHotLeads();
  const { data: followUpLeads = [] } = useFollowUpLeads();
  const { data: stuckLeads = [] } = useStuckLeads();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <IntelPanel
        icon={Flame}
        label="Hot Leads"
        emoji="🔥"
        color="text-amber-500"
        count={hotLeads.length}
        leads={hotLeads}
        emptyText="No hot leads right now"
        onClick={() => onFilterStage?.(["interested", "booked"])}
      />
      <IntelPanel
        icon={Clock}
        label="Follow-Up Needed"
        emoji="⏰"
        color="text-blue-500"
        count={followUpLeads.length}
        leads={followUpLeads}
        emptyText="All follow-ups handled"
        onClick={() => onFilterStage?.(["responded"])}
      />
      <IntelPanel
        icon={AlertTriangle}
        label="Stuck"
        emoji="⚠️"
        color="text-red-500"
        count={stuckLeads.length}
        leads={stuckLeads}
        emptyText="No stuck leads"
        onClick={() => onFilterStage?.(["contacted"])}
      />
    </div>
  );
}
