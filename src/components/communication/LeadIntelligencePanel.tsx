import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Brain, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  callId: string;
  className?: string;
}

type LeadAnalysis = {
  call_id: string;
  interest_score: number | null;
  interest_level: string | null;
  sentiment: string | null;
  recommended_action: string | null;
  summary: string | null;
  key_objections: unknown;
  contact_confirmed: boolean | null;
  opted_out: boolean | null;
  email_provided: string | null;
  qualification_payload: Record<string, unknown> | null;
  business_unit_key: string | null;
  analyzed_at: string | null;
};

// Color for score ring
function scoreRingCls(v: number | null) {
  if (v == null) return "border-muted text-muted-foreground";
  if (v >= 8) return "border-green-500 text-green-500";
  if (v >= 5) return "border-yellow-500 text-yellow-500";
  return "border-red-500 text-red-500";
}

function interestLevelCls(l: string | null) {
  const v = (l || "").toLowerCase();
  if (v === "high") return "bg-green-500/15 text-green-500 border-green-500/30";
  if (v === "medium") return "bg-yellow-500/15 text-yellow-500 border-yellow-500/30";
  if (v === "low") return "bg-orange-500/15 text-orange-500 border-orange-500/30";
  return "bg-muted text-muted-foreground border-border";
}

function sentimentCls(s: string | null) {
  const v = (s || "").toLowerCase();
  if (v === "positive") return "bg-green-500/15 text-green-500 border-green-500/30";
  if (v === "negative") return "bg-red-500/15 text-red-500 border-red-500/30";
  return "bg-muted text-muted-foreground border-border";
}

function actionCls(a: string | null) {
  const v = (a || "").toLowerCase();
  if (v === "auto_promote")
    return "bg-purple-500/15 text-purple-400 border-purple-500/40";
  if (v === "interested" || v === "onboard")
    return "bg-green-500/15 text-green-500 border-green-500/40";
  if (v.includes("callback") || v === "schedule_callback")
    return "bg-yellow-500/15 text-yellow-500 border-yellow-500/40";
  if (v === "remove" || v === "opt_out" || v === "disqualify")
    return "bg-red-500/15 text-red-500 border-red-500/40";
  return "bg-muted text-muted-foreground border-border";
}

const BU_CLS: Record<string, string> = {
  top_tier: "bg-amber-500/15 text-amber-400 border-amber-500/40",
  unforgettable_times: "bg-pink-500/15 text-pink-400 border-pink-500/40",
  gasmask: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  brandaro: "bg-orange-500/15 text-orange-400 border-orange-500/40",
  surplus_funds: "bg-cyan-500/15 text-cyan-400 border-cyan-500/40",
  wholesale_re: "bg-indigo-500/15 text-indigo-400 border-indigo-500/40",
  dynasty_direct: "bg-purple-500/15 text-purple-400 border-purple-500/40",
};

function humanizeKey(k: string) {
  return k
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.length ? v.map((x) => String(x)).join(", ") : "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function LeadIntelligencePanel({ callId, className }: Props) {
  const [openModal, setOpenModal] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dc-lead-analysis", callId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("dc_lead_analysis")
        .select(
          "call_id, interest_score, interest_level, sentiment, recommended_action, summary, key_objections, contact_confirmed, opted_out, email_provided, qualification_payload, business_unit_key, analyzed_at"
        )
        .eq("call_id", callId)
        .maybeSingle();
      if (error) throw error;
      return data as LeadAnalysis | null;
    },
    enabled: !!callId,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-4", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p
        className={cn(
          "text-xs text-muted-foreground italic py-2",
          className
        )}
      >
        No lead analysis available.
      </p>
    );
  }

  const objections = Array.isArray(data.key_objections)
    ? (data.key_objections as unknown[])
    : [];

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header row: score ring + badges */}
      <div className="flex items-start gap-3 flex-wrap">
        <div
          className={cn(
            "h-14 w-14 rounded-full border-4 flex flex-col items-center justify-center shrink-0",
            scoreRingCls(data.interest_score)
          )}
        >
          <span className="text-lg font-bold leading-none tabular-nums">
            {data.interest_score ?? "—"}
          </span>
          <span className="text-[8px] uppercase opacity-70 leading-none mt-0.5">
            /10
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          {data.interest_level && (
            <Badge
              variant="outline"
              className={cn("text-[10px] capitalize", interestLevelCls(data.interest_level))}
            >
              {data.interest_level} interest
            </Badge>
          )}
          {data.sentiment && (
            <Badge
              variant="outline"
              className={cn("text-[10px] capitalize", sentimentCls(data.sentiment))}
            >
              {data.sentiment}
            </Badge>
          )}
          {data.recommended_action && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-semibold",
                actionCls(data.recommended_action)
              )}
            >
              → {data.recommended_action.replace(/_/g, " ")}
            </Badge>
          )}
          {data.business_unit_key && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                BU_CLS[data.business_unit_key] ||
                  "bg-muted text-muted-foreground border-border"
              )}
            >
              {data.business_unit_key.replace(/_/g, " ")}
            </Badge>
          )}
          {data.opted_out && (
            <Badge variant="outline" className="text-[10px] bg-red-500/15 text-red-500 border-red-500/30">
              Opted out
            </Badge>
          )}
          {data.contact_confirmed && (
            <Badge variant="outline" className="text-[10px] bg-blue-500/15 text-blue-400 border-blue-500/30">
              Contact confirmed
            </Badge>
          )}
        </div>
      </div>

      {/* Summary */}
      {data.summary && (
        <div className="rounded border border-border bg-muted/20 p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Summary
          </div>
          <p className="text-xs leading-relaxed whitespace-pre-wrap">
            {data.summary}
          </p>
        </div>
      )}

      {/* Objections */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
          Key objections
        </div>
        {objections.length ? (
          <div className="flex flex-wrap gap-1">
            {objections.map((o, i) => (
              <span
                key={i}
                className="text-[11px] bg-muted text-foreground/80 border border-border rounded px-2 py-0.5"
              >
                {typeof o === "string" ? o : JSON.stringify(o)}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">None</p>
        )}
      </div>

      {data.email_provided && (
        <div className="text-xs">
          <span className="text-muted-foreground">Email:</span>{" "}
          <span className="font-mono">{data.email_provided}</span>
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={() => setOpenModal(true)}
        disabled={!data.qualification_payload}
      >
        <Eye className="h-3 w-3 mr-1" /> View full analysis
      </Button>

      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-400" />
              Full lead analysis
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 divide-y divide-border">
            {data.qualification_payload &&
              Object.entries(data.qualification_payload).map(([k, v]) => (
                <div
                  key={k}
                  className="grid grid-cols-[minmax(0,180px)_1fr] gap-3 py-2 text-sm"
                >
                  <div className="text-muted-foreground text-xs uppercase tracking-wider">
                    {humanizeKey(k)}
                  </div>
                  <div className="break-words">{formatValue(v)}</div>
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default LeadIntelligencePanel;
