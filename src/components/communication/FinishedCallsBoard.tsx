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
import { LeadIntelligencePanel } from "@/components/communication/LeadIntelligencePanel";
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
  source: "dynasty" | "dc";
  raw_transcript?: string | null;
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
      // 1. Fetch from BOTH sources in parallel
      let dynQ = (supabase as any)
        .from("dynasty_ai_calls")
        .select(
          "id, call_id, business_unit, agent_id, agent_name, direction, from_number, to_number, contact_name, company_name, outcome, duration_seconds, recording_url, call_started_at, call_ended_at, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(300);

      let dcQ = (supabase as any)
        .from("dc_call_logs")
        .select(
          "id, call_sid, business, source_business, agent_id, agent_name, agent_type, direction, from_number, to_number, lead_name, outcome, duration_seconds, recording_url, transcript, created_at, updated_at"
        )
        .order("created_at", { ascending: false })
        .limit(300);

      if (business !== "all") {
        dynQ = dynQ.eq("business_unit", business);
        dcQ = dcQ.or(`business.eq.${business},source_business.eq.${business}`);
      }
      if (outcome !== "all") {
        dynQ = dynQ.eq("outcome", outcome);
        dcQ = dcQ.eq("outcome", outcome);
      }
      if (agentQ.trim()) {
        const q = `%${agentQ.trim()}%`;
        dynQ = dynQ.ilike("agent_name", q);
        dcQ = dcQ.ilike("agent_name", q);
      }
      if (fromDate) {
        dynQ = dynQ.gte("created_at", `${fromDate}T00:00:00Z`);
        dcQ = dcQ.gte("created_at", `${fromDate}T00:00:00Z`);
      }
      if (toDate) {
        dynQ = dynQ.lte("created_at", `${toDate}T23:59:59Z`);
        dcQ = dcQ.lte("created_at", `${toDate}T23:59:59Z`);
      }
      if (phoneFilter) {
        const tail = phoneFilter.replace(/\D/g, "").slice(-10);
        if (tail) {
          const or = `to_number.ilike.%${tail}%,from_number.ilike.%${tail}%`;
          dynQ = dynQ.or(or);
          dcQ = dcQ.or(or);
        }
      }

      const [dynRes, dcRes] = await Promise.all([dynQ, dcQ]);
      if (dynRes.error) throw dynRes.error;
      if (dcRes.error) throw dcRes.error;

      const dynList: FinishedCall[] = (dynRes.data || []).map((c: any) => ({
        ...c,
        source: "dynasty" as const,
        raw_transcript: null,
      }));

      const dcList: (FinishedCall & { _dcId?: string; _dcSid?: string })[] = (dcRes.data || []).map((c: any) => ({
        id: `dc:${c.id}`,
        // Provisional: prefer call_sid, fall back to id. Re-resolved below against dc_lead_analysis.
        call_id: c.call_sid || c.id,
        _dcId: c.id,
        _dcSid: c.call_sid || null,
        business_unit: c.business || c.source_business || null,
        agent_id: c.agent_id || null,
        agent_name: c.agent_name || c.agent_type || null,
        direction: c.direction || null,
        from_number: c.from_number || null,
        to_number: c.to_number || null,
        contact_name: c.lead_name || null,
        company_name: null,
        outcome: c.outcome || null,
        duration_seconds: c.duration_seconds ?? null,
        recording_url: c.recording_url || null,
        call_started_at: c.created_at || null,
        call_ended_at: c.updated_at || null,
        created_at: c.created_at,
        source: "dc" as const,
        raw_transcript: c.transcript || null,
      }));

      // Hide synthetic health-check rows (dynasty_ai_calls call_id like 'health_*')
      const filteredDyn = dynList.filter(
        (c: any) => !(typeof c.call_id === "string" && c.call_id.startsWith("health_"))
      );
      // Sort by the same date the row displays (call_started_at || created_at) so
      // the visible order is strictly newest-first.
      const rowDate = (c: any) =>
        new Date(c.call_started_at || c.created_at).getTime();
      const list = [...filteredDyn, ...dcList].sort((a, b) => rowDate(b) - rowDate(a));
      if (list.length === 0) return list;

      // 2. Enrich: dynasty_call_analysis (coaching) + dc_lead_analysis (lead intel).
      //    dc_lead_analysis.call_id is keyed inconsistently — sometimes call_sid,
      //    sometimes dc_call_logs.id. Query BOTH sets and match either way.
      const dynIds = dynList.map((c) => c.call_id).filter(Boolean);
      const dcSids = dcList.map((c) => c._dcSid).filter(Boolean) as string[];
      const dcRowIds = dcList.map((c) => c._dcId).filter(Boolean) as string[];
      const analysisLookupIds = Array.from(new Set([...dynIds, ...dcSids, ...dcRowIds]));

      const [{ data: an }, { data: tx }, { data: la }] = await Promise.all([
        (supabase as any)
          .from("dynasty_call_analysis")
          .select("call_id, customer_sentiment, overall_score")
          .in("call_id", analysisLookupIds),
        (supabase as any)
          .from("dynasty_call_transcripts")
          .select("call_id")
          .in("call_id", analysisLookupIds),
        (supabase as any)
          .from("dc_lead_analysis")
          .select("call_id, sentiment, interest_score")
          .in("call_id", analysisLookupIds),
      ]);
      const anMap = new Map<string, any>((an || []).map((r: any) => [r.call_id, r]));
      const laMap = new Map<string, any>((la || []).map((r: any) => [r.call_id, r]));
      const txCounts = new Map<string, number>();
      (tx || []).forEach((r: any) =>
        txCounts.set(r.call_id, (txCounts.get(r.call_id) || 0) + 1)
      );

      // Debug: source distribution + dc join resolution
      // eslint-disable-next-line no-console
      console.log("[FinishedCalls] rows", {
        dynasty: dynList.length,
        dc: dcList.length,
        dc_lead_analysis_matches: la?.length ?? 0,
      });

      let enriched = list.map((c: any) => {
        // Resolve real call_id for dc rows: prefer whichever key actually has analysis.
        let effectiveCallId = c.call_id;
        if (c.source === "dc") {
          if (c._dcSid && (laMap.has(c._dcSid) || anMap.has(c._dcSid))) {
            effectiveCallId = c._dcSid;
          } else if (c._dcId && (laMap.has(c._dcId) || anMap.has(c._dcId))) {
            effectiveCallId = c._dcId;
          }
          // eslint-disable-next-line no-console
          console.log("[FinishedCalls] dc row", {
            id: c._dcId,
            call_sid: c._dcSid,
            effectiveCallId,
            hasLeadAnalysis: laMap.has(effectiveCallId),
            hasCoaching: anMap.has(effectiveCallId),
            agent: c.agent_name,
            business: c.business_unit,
          });
          // Extra: highlight TopTier Paul Benjie call for verification
          if (
            c._dcId?.startsWith("5a126283") ||
            c._dcSid?.includes("c4494ed8")
          ) {
            // eslint-disable-next-line no-console
            console.log("[FinishedCalls] 🎯 TopTier Paul call resolved", {
              effectiveCallId,
              laRow: laMap.get(effectiveCallId),
              anRow: anMap.get(effectiveCallId),
            });
          }
        }
        const anRow = anMap.get(effectiveCallId);
        const laRow = laMap.get(effectiveCallId);
        const txN = txCounts.get(effectiveCallId) || 0;
        const sentimentVal =
          anRow?.customer_sentiment ?? laRow?.sentiment ?? null;
        return {
          ...c,
          call_id: effectiveCallId,
          customer_sentiment: sentimentVal,
          overall_score: anRow?.overall_score ?? null,
          transcript_count: txN + (c.raw_transcript ? 1 : 0),
        };
      });

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
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] uppercase tracking-wider",
                      c.source === "dc"
                        ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                        : "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30"
                    )}
                  >
                    {c.source === "dc" ? "DC" : "Dynasty"}
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
                    <RecordingPlayer
                      recordingUrl={c.recording_url}
                      recordingSid={c.call_id}
                    />
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic">
                      No recording available.
                    </p>
                  )}


                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-purple-400" /> Coaching
                      </div>
                      <CallAnalysisPanel callId={c.call_id} />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-amber-400" /> Lead Intelligence
                      </div>
                      <LeadIntelligencePanel callId={c.call_id} />
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Transcript
                    </div>
                    <CallTranscriptViewer
                      callId={c.call_id}
                      maxHeight="280px"
                      rawTranscript={c.raw_transcript}
                    />

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
