import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Phone,
  Bot,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Sparkles,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { format } from "date-fns";
import { CallTranscriptViewer } from "@/components/communication/CallTranscriptViewer";
import { CallAnalysisPanel } from "@/components/communication/CallAnalysisPanel";
import { cn } from "@/lib/utils";

type FinishedCall = {
  id: string;
  call_id: string;
  business_unit: string | null;
  agent_id: string | null;
  agent_name: string | null;
  direction: string | null;
  from_number: string | null;
  to_number: string | null;
  contact_name: string | null;
  company_name: string | null;
  outcome: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  call_started_at: string | null;
  call_ended_at: string | null;
  created_at: string;
  customer_sentiment?: string | null;
  overall_score?: number | null;
  transcript_count?: number;
};

function fmtDur(sec: number | null) {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function sentimentClass(s?: string | null) {
  const v = (s || "").toLowerCase();
  if (v.includes("positive")) return "text-green-500";
  if (v.includes("negative")) return "text-destructive";
  return "text-muted-foreground";
}

function scoreBadgeCls(v?: number | null) {
  if (v == null) return "";
  if (v >= 80) return "bg-green-500/15 text-green-500 border-green-500/30";
  if (v >= 60) return "bg-yellow-500/15 text-yellow-500 border-yellow-500/30";
  return "bg-red-500/15 text-red-500 border-red-500/30";
}

interface BoardProps {
  defaultBusiness?: string;
  /** If true, render in compact embed mode (no page chrome) */
  embed?: boolean;
  /** Pre-filter to a specific phone (e.g. inside a contact card) */
  phoneFilter?: string;
  title?: string;
}

export function FinishedCallsBoard({
  defaultBusiness,
  embed = false,
  phoneFilter,
  title = "Finished Calls",
}: BoardProps) {
  const [business, setBusiness] = useState<string>(defaultBusiness || "all");
  const [outcome, setOutcome] = useState<string>("all");
  const [sentiment, setSentiment] = useState<string>("all");
  const [agentQ, setAgentQ] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: [
      "finished-calls",
      business,
      outcome,
      sentiment,
      agentQ,
      fromDate,
      toDate,
      phoneFilter,
    ],
    queryFn: async () => {
      let q = (supabase as any)
        .from("dynasty_ai_calls")
        .select(
          "id, call_id, business_unit, agent_id, agent_name, direction, from_number, to_number, contact_name, company_name, outcome, duration_seconds, recording_url, call_started_at, call_ended_at, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(300);

      if (business !== "all") q = q.eq("business_unit", business);
      if (outcome !== "all") q = q.eq("outcome", outcome);
      if (agentQ.trim()) q = q.ilike("agent_name", `%${agentQ.trim()}%`);
      if (fromDate) q = q.gte("created_at", `${fromDate}T00:00:00Z`);
      if (toDate) q = q.lte("created_at", `${toDate}T23:59:59Z`);
      if (phoneFilter) {
        const tail = phoneFilter.replace(/\D/g, "").slice(-10);
        if (tail) q = q.or(`to_number.ilike.%${tail}%,from_number.ilike.%${tail}%`);
      }

      const { data: calls, error } = await q;
      if (error) throw error;
      const list = (calls || []) as FinishedCall[];
      if (list.length === 0) return list;

      // Enrich with analysis + transcript counts
      const ids = list.map((c) => c.call_id).filter(Boolean);
      const [{ data: an }, { data: tx }] = await Promise.all([
        (supabase as any)
          .from("dynasty_call_analysis")
          .select("call_id, customer_sentiment, overall_score")
          .in("call_id", ids),
        (supabase as any)
          .from("dynasty_call_transcripts")
          .select("call_id")
          .in("call_id", ids),
      ]);
      const anMap = new Map<string, any>((an || []).map((r: any) => [r.call_id, r]));
      const txCounts = new Map<string, number>();
      (tx || []).forEach((r: any) =>
        txCounts.set(r.call_id, (txCounts.get(r.call_id) || 0) + 1)
      );

      let enriched = list.map((c) => ({
        ...c,
        customer_sentiment: anMap.get(c.call_id)?.customer_sentiment ?? null,
        overall_score: anMap.get(c.call_id)?.overall_score ?? null,
        transcript_count: txCounts.get(c.call_id) || 0,
      }));

      if (sentiment !== "all") {
        enriched = enriched.filter(
          (c) => (c.customer_sentiment || "").toLowerCase() === sentiment
        );
      }
      return enriched;
    },
  });

  // Build option lists from data
  const businesses = useMemo(
    () =>
      Array.from(
        new Set((data || []).map((c) => c.business_unit).filter(Boolean) as string[])
      ).sort(),
    [data]
  );
  const outcomes = useMemo(
    () =>
      Array.from(
        new Set((data || []).map((c) => c.outcome).filter(Boolean) as string[])
      ).sort(),
    [data]
  );

  const Filters = (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="text-[10px] text-muted-foreground block">Business</label>
        <Select value={business} onValueChange={setBusiness}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {["gasmask", "brandaro", "unforgettable-times", "top-tier", "uben", "funding"].map(
              (b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              )
            )}
            {businesses
              .filter(
                (b) =>
                  !["gasmask", "brandaro", "unforgettable-times", "top-tier", "uben", "funding"].includes(
                    b
                  )
              )
              .map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground block">Outcome</label>
        <Select value={outcome} onValueChange={setOutcome}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {outcomes.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground block">Sentiment</label>
        <Select value={sentiment} onValueChange={setSentiment}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="positive">Positive</SelectItem>
            <SelectItem value="neutral">Neutral</SelectItem>
            <SelectItem value="negative">Negative</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground block">Agent</label>
        <Input
          value={agentQ}
          onChange={(e) => setAgentQ(e.target.value)}
          placeholder="agent name"
          className="h-8 w-36 text-xs"
        />
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground block">From</label>
        <Input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="h-8 w-36 text-xs"
        />
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground block">To</label>
        <Input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="h-8 w-36 text-xs"
        />
      </div>
      <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8">
        Refresh
      </Button>
    </div>
  );

  const List = (
    <div className="space-y-2">
      {isLoading ? (
        <div className="py-8 text-center">
          <Loader2 className="h-5 w-5 mx-auto animate-spin text-muted-foreground" />
        </div>
      ) : !data?.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No finished calls match these filters.
        </p>
      ) : (
        data.map((c) => {
          const isOpen = openId === c.id;
          const when = c.call_started_at || c.created_at;
          return (
            <div
              key={c.id}
              className="rounded-lg border border-border bg-card overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : c.id)}
                className="w-full text-left p-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-purple-500/15 text-purple-400 border-purple-500/30 text-[10px]">
                    <Bot className="h-3 w-3 mr-1" /> AI Call
                  </Badge>
                  {c.business_unit && (
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {c.business_unit}
                    </Badge>
                  )}
                  {c.direction === "inbound" ? (
                    <ArrowDownLeft className="h-3 w-3 text-green-500" />
                  ) : (
                    <ArrowUpRight className="h-3 w-3 text-blue-500" />
                  )}
                  {c.outcome && (
                    <Badge variant="outline" className="text-[10px]">
                      {c.outcome}
                    </Badge>
                  )}
                  {c.overall_score != null && (
                    <Badge className={cn("text-[10px]", scoreBadgeCls(c.overall_score))}>
                      score {c.overall_score}
                    </Badge>
                  )}
                  {c.customer_sentiment && (
                    <span
                      className={cn("text-[10px] font-medium", sentimentClass(c.customer_sentiment))}
                    >
                      {c.customer_sentiment}
                    </span>
                  )}
                  {c.transcript_count ? (
                    <Badge variant="secondary" className="text-[10px]">
                      <FileText className="h-3 w-3 mr-1" />
                      {c.transcript_count} utterances
                    </Badge>
                  ) : null}
                  <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(new Date(when), "MMM d, yyyy, h:mm a")}
                    <span>· {fmtDur(c.duration_seconds)}</span>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </div>
                <div className="mt-1.5 flex items-center gap-3 text-xs flex-wrap">
                  <span className="font-medium">
                    {c.agent_name || c.agent_id || "agent"}
                  </span>
                  <span className="text-muted-foreground font-mono">
                    {c.from_number || "—"} → {c.to_number || "—"}
                  </span>
                  {(c.contact_name || c.company_name) && (
                    <span className="text-muted-foreground">
                      {c.contact_name}
                      {c.company_name ? ` · ${c.company_name}` : ""}
                    </span>
                  )}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-border bg-muted/10 p-3 space-y-3">
                  {c.recording_url ? (
                    <audio
                      controls
                      preload="none"
                      className="w-full h-9"
                      src={c.recording_url}
                    />
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic">
                      No recording available.
                    </p>
                  )}

                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-purple-400" /> AI Analysis
                    </div>
                    <CallAnalysisPanel callId={c.call_id} />
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Transcript
                    </div>
                    <CallTranscriptViewer callId={c.call_id} maxHeight="280px" />
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  if (embed) {
    return (
      <div className="space-y-3">
        {!phoneFilter && Filters}
        {List}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Phone className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">{title}</h1>
        {data?.length ? (
          <Badge variant="secondary">{data.length}</Badge>
        ) : null}
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>{Filters}</CardContent>
      </Card>
      <Card>
        <CardContent className="p-3">{List}</CardContent>
      </Card>
    </div>
  );
}

export default FinishedCallsBoard;
