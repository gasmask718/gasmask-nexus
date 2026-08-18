import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Phone, Search, ChevronLeft, ChevronRight, FileText, ChevronDown,
  PhoneOff, Clock, Calendar, User, AlertCircle, PhoneIncoming, PhoneOutgoing,
  Sparkles,
} from "lucide-react";
import { format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns";
import { RecordingPlayer } from "@/components/phone/RecordingPlayer";

const PAGE_SIZE = 10;

/**
 * VA-scoped Call History panel.
 *
 * Reads from `va_call_logs` (same table as /brandaro/admin-call-review)
 * but constrained to the logged-in VA via `.eq('va_id', user.id)`.
 * RLS policy `va_own_call_logs` (va_id = auth.uid()) further enforces
 * this server-side, so a VA can only ever see calls tied to their own
 * account — including calls made via VAPowerDialer, VACallPanel, or any
 * inbound call routed to a number assigned to them.
 */
export function VACallHistory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [recordingFilter, setRecordingFilter] = useState<"all" | "with" | "without">("all");
  const [directionFilter, setDirectionFilter] = useState<"all" | "outbound" | "inbound">("all");
  const [aiFilter, setAiFilter] = useState<"all" | "with_ai" | "without_ai">("all");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Reset to first page whenever filters change
  useEffect(() => {
    setPage(0);
  }, [search, dateFilter, recordingFilter, directionFilter, aiFilter]);

  // Realtime: refresh when new calls land for this VA
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`va-call-history-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "va_call_logs", filter: `va_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["va-call-history", user.id] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["va-call-history", user?.id, search, dateFilter, recordingFilter, directionFilter, aiFilter, page],
    queryFn: async () => {
      // No FK declared between va_call_logs.lead_id and any leads table, and lead_id
      // can reference either outreach_leads or brandaro_qualified_leads. So fetch the
      // call rows first, then enrich client-side with a single batched lookup against
      // both possible source tables.
      let q = (supabase as any)
        .from("va_call_logs")
        .select(
          `id, call_sid, twilio_number, called_at, duration_seconds, call_status,
           disposition, excitement_level, recording_url, transcript,
           ai_analysis, va_notes, direction, lead_id, va_id`,
          { count: "exact" },
        )
        .eq("va_id", user!.id)
        // Prioritize calls that have AI feedback (non-null ai_analysis) first,
        // then most recent.
        .order("ai_analysis", { ascending: false, nullsFirst: false })
        .order("called_at", { ascending: false, nullsFirst: false });

      if (dateFilter) {
        q = q.gte("called_at", `${dateFilter}T00:00:00`).lte("called_at", `${dateFilter}T23:59:59`);
      }
      if (recordingFilter === "with") q = q.not("recording_url", "is", null);
      if (recordingFilter === "without") q = q.is("recording_url", null);
      if (directionFilter !== "all") q = q.eq("direction", directionFilter);
      if (aiFilter === "with_ai") q = q.not("ai_analysis", "is", null);
      if (aiFilter === "without_ai") q = q.is("ai_analysis", null);
      if (search.trim()) {
        const t = search.trim().replace(/,/g, " ");
        q = q.or(
          `twilio_number.ilike.%${t}%,call_sid.ilike.%${t}%,transcript.ilike.%${t}%,va_notes.ilike.%${t}%`,
        );
      }

      const from = page * PAGE_SIZE;
      q = q.range(from, from + PAGE_SIZE - 1);

      const { data, count, error } = await q;
      if (error) throw error;

      const rows = data || [];
      const leadIds = Array.from(
        new Set(rows.map((r: any) => r.lead_id).filter(Boolean)),
      ) as string[];

      const leadMap = new Map<string, { store_name?: string; contact_name?: string; phone?: string }>();
      if (leadIds.length > 0) {
        const [outreach, qualified] = await Promise.all([
          (supabase as any)
            .from("outreach_leads")
            .select("id, store_name, contact_name, phone")
            .in("id", leadIds),
          (supabase as any)
            .from("brandaro_qualified_leads")
            .select("id, business_name, full_name, phone_number")
            .in("id", leadIds),
        ]);
        (outreach.data || []).forEach((l: any) =>
          leadMap.set(l.id, { store_name: l.store_name, contact_name: l.contact_name, phone: l.phone }),
        );
        (qualified.data || []).forEach((l: any) => {
          if (!leadMap.has(l.id)) {
            leadMap.set(l.id, {
              store_name: l.business_name,
              contact_name: l.full_name,
              phone: l.phone_number,
            });
          }
        });
      }

      const enriched = rows.map((r: any) => ({
        ...r,
        outreach_leads: r.lead_id ? leadMap.get(r.lead_id) || null : null,
      }));

      return { rows: enriched, count: count || 0 };
    },
    enabled: !!user,
    refetchOnWindowFocus: true,
  });

  const calls = data?.rows ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fmtDur = (s: number | null) => {
    if (!s) return "0:00";
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  };

  const fmtWhen = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isToday(d)) return format(d, "h:mm a");
    if (isYesterday(d)) return `Yest · ${format(d, "h:mm a")}`;
    const days = (Date.now() - d.getTime()) / 86400000;
    if (days < 7) return format(d, "EEE · h:mm a");
    return format(d, "MMM d · h:mm a");
  };

  const getAISummary = (c: any): string | null => {
    if (typeof c.ai_analysis === "string") return c.ai_analysis;
    if (c.ai_analysis && typeof c.ai_analysis === "object") {
      return c.ai_analysis.summary || c.ai_analysis.ai_summary || null;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Header / scope indicator */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-cyan-400" />
          <span>
            Showing calls for VA <span className="font-mono text-slate-300">{user?.email || user?.id?.slice(0, 8)}</span>
          </span>
        </div>
        <span className="text-slate-500">
          {isLoading ? "Loading…" : `${total.toLocaleString()} total`}
        </span>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 md:p-4 grid grid-cols-2 md:grid-cols-6 gap-2 md:gap-3">
        <div className="relative col-span-2 md:col-span-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search number, SID, transcript or notes…"
            className="pl-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>
        <div className="relative">
          <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="pl-9 bg-slate-900 border-slate-700 text-white"
          />
        </div>
        <Select value={directionFilter} onValueChange={(v) => setDirectionFilter(v as any)}>
          <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
            <SelectValue placeholder="Direction" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All directions</SelectItem>
            <SelectItem value="outbound">Outbound</SelectItem>
            <SelectItem value="inbound">Inbound</SelectItem>
          </SelectContent>
        </Select>
        <Select value={recordingFilter} onValueChange={(v) => setRecordingFilter(v as any)}>
          <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All calls</SelectItem>
            <SelectItem value="with">With recording</SelectItem>
            <SelectItem value="without">Without recording</SelectItem>
          </SelectContent>
        </Select>
        <Select value={aiFilter} onValueChange={(v) => setAiFilter(v as any)}>
          <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">AI: any</SelectItem>
            <SelectItem value="with_ai">With AI feedback</SelectItem>
            <SelectItem value="without_ai">No AI feedback</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-300">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Failed to load call history</div>
            <div className="text-xs text-red-400/80 mt-0.5">{(error as Error).message}</div>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg bg-slate-800/50" />
          ))}
        </div>
      ) : calls.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/30 rounded-xl border border-slate-700/50">
          <PhoneOff className="h-10 w-10 mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400 font-medium">No calls match your filters</p>
          <p className="text-xs text-slate-500 mt-1">
            {total === 0
              ? "Calls placed or received under your VA account will appear here."
              : "Try clearing the date or search."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {calls.map((c: any) => {
            const isOpen = expanded === c.id;
            const lead = c.outreach_leads;
            const aiSummary = getAISummary(c);
            const isInbound = c.direction === "inbound";
            return (
              <div
                key={c.id}
                className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 md:p-4 hover:border-cyan-500/40 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 md:gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                      {isInbound ? (
                        <PhoneIncoming className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <PhoneOutgoing className="h-4 w-4 text-cyan-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate flex items-center gap-2">
                        {lead?.store_name || lead?.contact_name || "Manual call"}
                        <span className="font-mono text-xs text-slate-400">
                          {lead?.phone || c.twilio_number || "—"}
                        </span>
                      </p>
                      <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <Clock className="h-3 w-3" />
                        <span title={c.called_at ? format(new Date(c.called_at), "PPpp") : ""}>
                          {fmtWhen(c.called_at)}
                        </span>
                        <span className="font-mono tabular-nums text-slate-500">· {fmtDur(c.duration_seconds)}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {aiSummary && (
                      <Badge className="text-[10px] bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 gap-1">
                        <Sparkles className="h-2.5 w-2.5" /> AI
                      </Badge>
                    )}
                    {c.disposition && (
                      <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-300">
                        {String(c.disposition).replace(/_/g, " ")}
                      </Badge>
                    )}
                    {c.excitement_level && (
                      <Badge className="text-[10px] bg-orange-500/15 text-orange-400 border-orange-500/30">
                        {c.excitement_level}
                      </Badge>
                    )}
                    {c.call_status && (
                      <Badge className="text-[10px] bg-slate-700 text-slate-300">
                        {c.call_status}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Recording (proxied through backend so users never see Twilio auth) */}
                {c.recording_url && (
                  <div className="mt-3">
                    <RecordingPlayer recordingUrl={c.recording_url} compact />
                  </div>
                )}

                {/* AI summary preview */}
                {aiSummary && (
                  <p className="mt-2 text-xs text-slate-300 leading-relaxed line-clamp-2">
                    {aiSummary}
                  </p>
                )}

                {/* VA notes */}
                {c.va_notes && (
                  <p className="mt-2 text-xs text-slate-400 italic border-l-2 border-cyan-500/40 pl-2">
                    VA note: {c.va_notes}
                  </p>
                )}

                {/* Transcript toggle */}
                {(c.transcript || aiSummary) && (
                  <button
                    onClick={() => setExpanded(isOpen ? null : c.id)}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
                  >
                    <FileText className="h-3 w-3" />
                    {isOpen ? "Hide transcript" : "View transcript"}
                    <ChevronDown
                      className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                )}
                {isOpen && (
                  <pre className="mt-2 text-[11px] text-slate-300 bg-slate-900/70 rounded-lg p-3 whitespace-pre-wrap max-h-72 overflow-y-auto border border-slate-700/50">
                    {c.transcript || "(No transcript available for this call.)"}
                  </pre>
                )}

                {/* Footer meta */}
                <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-500 font-mono">
                  {c.call_sid && <span>SID {c.call_sid.slice(0, 14)}…</span>}
                  {c.direction && <span>· {c.direction}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
          <span>
            Page {page + 1} of {totalPages} · {total.toLocaleString()} call{total === 1 ? "" : "s"}
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              <ChevronLeft className="h-3 w-3" /> Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Next <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
