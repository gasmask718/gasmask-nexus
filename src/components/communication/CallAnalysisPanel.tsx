import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, TrendingUp, TrendingDown, Minus, Lightbulb, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  callId: string;
  className?: string;
}

type Analysis = {
  call_id: string;
  overall_score: number | null;
  rapport_score: number | null;
  objection_handling_score: number | null;
  qualification_score: number | null;
  closing_score: number | null;
  energy_score: number | null;
  what_went_well: string[] | null;
  what_to_improve: string[] | null;
  missed_opportunities: string[] | null;
  best_moment: string | null;
  worst_moment: string | null;
  specific_coaching: string | null;
  script_adherence_percentage: number | null;
  talk_to_listen_ratio: number | null;
  objections_raised: string[] | null;
  objection_handling_grade: string | null;
  objection_handling_notes: string | null;
  recommended_followup: string | null;
  callback_timing: string | null;
  suggested_talking_points: string[] | null;
  customer_sentiment: string | null;
  rep_sentiment: string | null;
  analyzed_at: string | null;
};

function SentimentIcon({ s }: { s: string | null }) {
  const v = (s || "").toLowerCase();
  if (v.includes("positive")) return <TrendingUp className="h-3.5 w-3.5 text-green-500" />;
  if (v.includes("negative")) return <TrendingDown className="h-3.5 w-3.5 text-destructive" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function ScorePill({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  const color =
    value >= 80
      ? "bg-green-500/15 text-green-500 border-green-500/30"
      : value >= 60
      ? "bg-yellow-500/15 text-yellow-500 border-yellow-500/30"
      : "bg-red-500/15 text-red-500 border-red-500/30";
  return (
    <div className={cn("rounded border px-2 py-1 text-[10px]", color)}>
      <div className="opacity-70 uppercase tracking-wider">{label}</div>
      <div className="font-bold text-sm tabular-nums">{value}</div>
    </div>
  );
}

export function CallAnalysisPanel({ callId, className }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["call-analysis", callId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("dynasty_call_analysis")
        .select("*")
        .eq("call_id", callId)
        .maybeSingle();
      if (error) throw error;
      return data as Analysis | null;
    },
    enabled: !!callId,
  });

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-4", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data) {
    return (
      <p className={cn("text-xs text-muted-foreground italic py-2", className)}>
        No AI analysis available yet for this call.
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Score grid */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5">
        <ScorePill label="Overall" value={data.overall_score} />
        <ScorePill label="Rapport" value={data.rapport_score} />
        <ScorePill label="Qualif" value={data.qualification_score} />
        <ScorePill label="Object" value={data.objection_handling_score} />
        <ScorePill label="Close" value={data.closing_score} />
        <ScorePill label="Energy" value={data.energy_score} />
      </div>

      {/* Sentiment */}
      <div className="flex items-center gap-3 text-xs flex-wrap">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Customer:</span>
          <SentimentIcon s={data.customer_sentiment} />
          <span className="capitalize">{data.customer_sentiment || "—"}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Rep:</span>
          <SentimentIcon s={data.rep_sentiment} />
          <span className="capitalize">{data.rep_sentiment || "—"}</span>
        </div>
        {data.objection_handling_grade && (
          <Badge variant="outline" className="text-[10px]">
            Objection: {data.objection_handling_grade}
          </Badge>
        )}
        {data.script_adherence_percentage != null && (
          <Badge variant="outline" className="text-[10px]">
            Script: {data.script_adherence_percentage}%
          </Badge>
        )}
        {data.talk_to_listen_ratio != null && (
          <Badge variant="outline" className="text-[10px]">
            Talk/Listen: {data.talk_to_listen_ratio}%
          </Badge>
        )}
      </div>

      {/* Coaching */}
      {data.specific_coaching && (
        <div className="rounded border border-purple-500/30 bg-purple-500/5 p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-purple-400 mb-1">
            <Sparkles className="h-3 w-3" /> Coaching
          </div>
          <p className="text-xs leading-relaxed">{data.specific_coaching}</p>
        </div>
      )}

      {/* What went well / improve */}
      <div className="grid md:grid-cols-2 gap-2">
        {data.what_went_well?.length ? (
          <div className="rounded border border-green-500/20 bg-green-500/5 p-2">
            <div className="text-[10px] uppercase tracking-wider text-green-500 mb-1">
              ✓ Went well
            </div>
            <ul className="text-xs space-y-0.5 list-disc list-inside">
              {data.what_went_well.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {data.what_to_improve?.length ? (
          <div className="rounded border border-yellow-500/20 bg-yellow-500/5 p-2">
            <div className="text-[10px] uppercase tracking-wider text-yellow-500 mb-1">
              ↑ Improve
            </div>
            <ul className="text-xs space-y-0.5 list-disc list-inside">
              {data.what_to_improve.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {data.missed_opportunities?.length ? (
        <div className="rounded border border-orange-500/20 bg-orange-500/5 p-2">
          <div className="text-[10px] uppercase tracking-wider text-orange-500 mb-1 flex items-center gap-1">
            <Target className="h-3 w-3" /> Missed opportunities
          </div>
          <ul className="text-xs space-y-0.5 list-disc list-inside">
            {data.missed_opportunities.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.suggested_talking_points?.length ? (
        <div className="rounded border border-blue-500/20 bg-blue-500/5 p-2">
          <div className="text-[10px] uppercase tracking-wider text-blue-400 mb-1 flex items-center gap-1">
            <Lightbulb className="h-3 w-3" /> Next-call talking points
          </div>
          <ul className="text-xs space-y-0.5 list-disc list-inside">
            {data.suggested_talking_points.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {(data.recommended_followup || data.callback_timing) && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Next action:</span>{" "}
          {data.recommended_followup}
          {data.callback_timing ? ` • ${data.callback_timing}` : ""}
        </div>
      )}
    </div>
  );
}
