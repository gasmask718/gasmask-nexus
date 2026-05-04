import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  PhoneOff, Clock, Calendar,
} from "lucide-react";
import { format } from "date-fns";

const PAGE_SIZE = 10;

/**
 * VA-scoped Call History panel.
 *
 * Reads from the SAME source as /brandaro/admin-call-review (`va_call_logs`)
 * but constrained to the logged-in VA via `.eq('va_id', user.id)` — RLS on the
 * table further enforces this server-side. Admin view continues to work
 * untouched (it does not filter by va_id).
 *
 * Features: search (number / call_sid / transcript), date filter, recording
 * filter, pagination, audio playback, expandable transcript.
 */
export function VACallHistory() {
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [recordingFilter, setRecordingFilter] = useState<"all" | "with" | "without">("all");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Reset to first page whenever filters change
  useEffect(() => {
    setPage(0);
  }, [search, dateFilter, recordingFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ["va-call-history", user?.id, search, dateFilter, recordingFilter, page],
    queryFn: async () => {
      let q = (supabase as any)
        .from("va_call_logs")
        .select(
          "id, call_sid, twilio_number, called_at, duration_seconds, call_status, disposition, excitement_level, recording_url, transcript, ai_summary, lead_id",
          { count: "exact" },
        )
        .eq("va_id", user!.id)
        .order("called_at", { ascending: false });

      if (dateFilter) {
        q = q.gte("called_at", `${dateFilter}T00:00:00`).lte("called_at", `${dateFilter}T23:59:59`);
      }
      if (recordingFilter === "with") q = q.not("recording_url", "is", null);
      if (recordingFilter === "without") q = q.is("recording_url", null);
      if (search.trim()) {
        const t = search.trim().replace(/,/g, " ");
        q = q.or(
          `twilio_number.ilike.%${t}%,call_sid.ilike.%${t}%,transcript.ilike.%${t}%`,
        );
      }

      const from = page * PAGE_SIZE;
      q = q.range(from, from + PAGE_SIZE - 1);

      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: data || [], count: count || 0 };
    },
    enabled: !!user,
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

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 md:p-4 grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-3">
        <div className="relative md:col-span-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search number, call SID, or transcript…"
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
      </div>

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
          <p className="text-xs text-slate-500 mt-1">Try clearing the date or search.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {calls.map((c: any) => {
            const isOpen = expanded === c.id;
            return (
              <div
                key={c.id}
                className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 md:p-4 hover:border-cyan-500/40 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 md:gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                      <Phone className="h-4 w-4 text-cyan-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white font-mono truncate">
                        {c.twilio_number || "—"}
                      </p>
                      <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {c.called_at ? format(new Date(c.called_at), "MMM d, yyyy · h:mm a") : "—"}
                        <span className="font-mono tabular-nums">· {fmtDur(c.duration_seconds)}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
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

                {/* Recording */}
                {c.recording_url && (
                  <audio
                    controls
                    preload="none"
                    src={c.recording_url}
                    className="w-full h-9 mt-3"
                  />
                )}

                {/* AI summary preview */}
                {c.ai_summary && (
                  <p className="mt-2 text-xs text-slate-300 leading-relaxed line-clamp-2">
                    {c.ai_summary}
                  </p>
                )}

                {/* Transcript toggle */}
                {(c.transcript || c.ai_summary) && (
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
